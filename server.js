const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// 中間件 - 必須在最前面
app.use(cors());
app.use(express.json());

// ==================== 基本健康檢查路由 - 必須在最前面 ====================
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查請求收到');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '服務正常運行中',
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 根路徑也提供健康檢查
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'Hotel Booking Chatbot',
    timestamp: new Date().toISOString(),
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /health',
      session: 'GET /api/session/:id'
    }
  });
});

// 會話存儲
const sessions = new Map();

// ==================== 訊息清理工具 ====================
function cleanInputMessage(message) {
  if (!message) return '';
  
  let cleaned = message
    .replace(/\[translate:\s*|\]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned || message;
}

// ==================== n8n 整合服務 ====================
class N8NIntegrationService {
  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL;
    this.apiKey = process.env.N8N_API_KEY;
    this.enabled = !!process.env.N8N_WEBHOOK_URL;
  }

  async sendBookingConfirmation(bookingData) {
    if (!this.enabled) {
      console.log('🔕 n8n 整合未啟用，跳過發送訂房確認');
      return null;
    }

    try {
      console.log('📤 發送訂房確認到 n8n:', bookingData.orderNumber);
      
      const payload = {
        action: 'booking_confirmation',
        sessionId: bookingData.sessionId,
        orderNumber: bookingData.orderNumber,
        roomType: bookingData.roomType,
        roomCount: bookingData.roomCount,
        adults: bookingData.adults,
        children: bookingData.children,
        childAge: bookingData.childAge,
        nights: bookingData.nights,
        finalPrice: bookingData.finalPrice,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${this.baseUrl}/webhook/hotel-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload),
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`n8n 響應錯誤: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ n8n 訂房確認發送成功');
      return result;

    } catch (error) {
      console.error('❌ n8n 訂房確認發送失敗:', error.message);
      return null;
    }
  }
}

// 初始化 n8n 服務
const n8nService = new N8NIntegrationService();

// ==================== Webhook 路由 ====================
const webhookRouter = express.Router();

webhookRouter.post('/webhook/booking', (req, res) => {
  try {
    const { action, data } = req.body;
    console.log('📥 收到 webhook 請求:', { action });
    
    res.status(200).json({ 
      status: 'success', 
      message: 'Webhook 處理完成',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Webhook 處理錯誤:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Webhook 處理失敗'
    });
  }
});

webhookRouter.get('/webhook/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'hotel-booking-webhook',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', webhookRouter);

// 獲取或創建會話
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      lastActivity: Date.now()
    });
  }
  return sessions.get(sessionId);
}

// ==================== 房間容量資料庫 ====================
const roomCapacityData = {
  '標準雙人房': {
    price: 2800,
    description: '舒適雙人床，基本設施齊全',
    breakfastIncluded: false
  },
  '豪華雙人房': {
    price: 3800,
    description: '加大雙人床，景觀較佳',
    breakfastIncluded: true
  },
  '套房': {
    price: 5800,
    description: '獨立客廳，豪華衛浴',
    breakfastIncluded: true
  },
  '家庭房': {
    price: 4500,
    description: '兩張雙人床，專為家庭設計',
    breakfastIncluded: false
  }
};

// ==================== 對話處理 ====================
function processMessage(message, session) {
  const cleanMessage = cleanInputMessage(message);
  const lowerMsg = cleanMessage.toLowerCase();
  
  console.log('🔄 處理訊息:', { 
    cleaned: cleanMessage, 
    step: session.step 
  });
  
  let response = null;

  // 重置會話
  if (lowerMsg.includes('重置') || lowerMsg.includes('重新開始')) {
    session.step = 'welcome';
    session.data = {};
    response = {
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
  }
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看優惠政策\n• 取消訂房 - 取消現有訂單\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
  }
  // 早餐查詢
  else if (lowerMsg.includes('早餐') || lowerMsg.includes('含早')) {
    response = handleBreakfastQuery(session);
  }
  // 取消訂房
  else if (lowerMsg.includes('取消訂房')) {
    response = {
      reply: '❌ **取消訂房說明**\n\n📞 客服專線: 02-1234-5678\n💻 會員中心: 登入官網取消\n⏰ 服務時間: 09:00-21:00',
      nextStep: session.step
    };
  }
  // 感謝訊息
  else if (lowerMsg.includes('謝謝') || lowerMsg.includes('感謝')) {
    response = {
      reply: '🙏 感謝您的使用！如有任何問題，歡迎隨時詢問。',
      nextStep: session.step
    };
  }
  // 確認訂房
  else if (lowerMsg.includes('確認訂房') || lowerMsg.includes('完成訂房')) {
    response = handleBookingConfirmation(session);
  }
  // 數字處理
  else if (!response) {
    response = handleNumberInput(cleanMessage, session, lowerMsg);
  }
  // 訂房相關
  else if (!response) {
    response = handleBookingIntent(lowerMsg, session);
  }

  if (!response) {
    response = generateDefaultResponse(session);
  }

  return response;
}

// ==================== 處理早餐查詢 ====================
function handleBreakfastQuery(session) {
  let reply = '🍽️ **早餐資訊**\n\n';
  
  if (session.data.roomType) {
    const roomInfo = roomCapacityData[session.data.roomType];
    reply += `您選擇的 ${session.data.roomType}:\n`;
    reply += roomInfo.breakfastIncluded ? '✅ **已包含免費早餐**\n' : '❌ **未包含早餐**\n';
    reply += '   • 自助式早餐 (06:30-10:00)\n';
    reply += '   • 中西式餐點選擇\n';
  } else {
    reply += '請先選擇房型以查看早餐資訊。';
  }
  
  return continueBookingProcess(session, reply);
}

// ==================== 處理訂房確認 ====================
function handleBookingConfirmation(session) {
  if (session.data.roomType && session.data.adults && session.data.nights) {
    return generateBookingSummary(session);
  } else {
    return guideToCompleteBooking(session);
  }
}

// ==================== 繼續訂房流程 ====================
function continueBookingProcess(session, additionalMessage = '') {
  let reply = additionalMessage;
  
  if (!session.data.roomType) {
    session.step = 'select_room';
    if (reply) reply += '\n\n';
    reply += '請選擇房型：標準雙人房、豪華雙人房、套房、家庭房';
    return { reply, nextStep: 'select_room' };
  } else if (!session.data.adults) {
    session.step = 'ask_guests';
    if (reply) reply += '\n\n';
    reply += '請問有幾位大人入住？';
    return { reply, nextStep: 'ask_guests' };
  } else if (!session.data.nights) {
    session.step = 'ask_nights';
    if (reply) reply += '\n\n';
    reply += `了解，${session.data.adults}位大人。請問打算入住幾晚？`;
    return { reply, nextStep: 'ask_nights' };
  } else {
    return generateBookingSummary(session);
  }
}

// ==================== 引導完成訂房 ====================
function guideToCompleteBooking(session) {
  let missingInfo = [];
  if (!session.data.roomType) missingInfo.push('房型');
  if (!session.data.adults) missingInfo.push('大人人數');
  if (!session.data.nights) missingInfo.push('入住天數');
  
  let reply = `📋 **還需要以下資訊：**\n`;
  missingInfo.forEach(info => reply += `• ${info}\n`);
  reply += `\n請提供缺少的資訊！`;
  
  return { reply, nextStep: 'complete_booking' };
}

// ==================== 數字處理 ====================
function handleNumberInput(cleanMessage, session, lowerMsg) {
  const numberMatch = cleanMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  
  if ((!session.data.adults) && (cleanMessage.includes('大人') || cleanMessage.includes('位'))) {
    session.data.adults = number;
    session.step = 'ask_nights';
    return {
      reply: `了解，${number}位大人。請問打算入住幾晚？`,
      nextStep: 'ask_nights'
    };
  }
  
  if ((!session.data.nights) && (cleanMessage.includes('晚') || cleanMessage.includes('天'))) {
    session.data.nights = number;
    return generateBookingSummary(session);
  }
  
  return null;
}

// ==================== 訂房意圖處理 ====================
function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '🏨 **開始訂房流程**\n\n請選擇房型：\n• 標準雙人房 - NT$2,800/晚\n• 豪華雙人房 - NT$3,800/晚\n• 套房 - NT$5,800/晚\n• 家庭房 - NT$4,500/晚',
        nextStep: 'select_room'
      };
    } else {
      return continueBookingProcess(session);
    }
  }
  
  const roomKeywords = {
    '標準': '標準雙人房', '豪華': '豪華雙人房', '套房': '套房', '家庭': '家庭房'
  };
  
  for (const [keyword, roomType] of Object.entries(roomKeywords)) {
    if (lowerMsg.includes(keyword)) {
      session.data.roomType = roomType;
      session.step = 'ask_guests';
      const roomInfo = roomCapacityData[roomType];
      return {
        reply: `🏨 已選擇 ${roomType}\n💰 NT$${roomInfo.price}/晚\n📝 ${roomInfo.description}\n\n請問有幾位大人入住？`,
        nextStep: 'ask_guests'
      };
    }
  }
  
  return null;
}

// ==================== 生成訂單摘要 ====================
function generateBookingSummary(session) {
  const roomInfo = roomCapacityData[session.data.roomType];
  const finalPrice = roomInfo.price * session.data.nights;
  
  session.step = 'confirm_booking';
  
  let summary = `📋 **訂單摘要**\n\n`;
  summary += `🏨 ${session.data.roomType}\n`;
  summary += `👥 ${session.data.adults}位大人\n`;
  summary += `📅 ${session.data.nights}晚\n`;
  summary += `💰 總金額: NT$ ${finalPrice.toLocaleString()}\n\n`;
  summary += `請確認以上資訊？回覆「確認」完成訂房。`;
  
  return { reply: summary, nextStep: 'confirm_booking' };
}

// ==================== 預設回應 ====================
function generateDefaultResponse(session) {
  const prompts = {
    'welcome': '您好！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 設施介紹',
    'select_room': '請選擇房型',
    'ask_guests': '請問有幾位大人入住？',
    'ask_nights': '請問打算入住幾晚？',
    'confirm_booking': '請確認訂房資訊？'
  };
  
  return {
    reply: prompts[session.step] || '請問需要什麼協助？',
    nextStep: session.step
  };
}

// ==================== 完成訂房 ====================
async function completeBooking(session) {
  const roomInfo = roomCapacityData[session.data.roomType];
  const finalPrice = roomInfo.price * session.data.nights;
  const orderNumber = `HTL${Date.now().toString().slice(-6)}`;
  
  session.step = 'booking_completed';
  session.data.orderNumber = orderNumber;
  session.data.finalPrice = finalPrice;

  await n8nService.sendBookingConfirmation(session.data);

  return {
    reply: `🎉 **訂房完成！**\n\n訂單編號: ${orderNumber}\n總金額: NT$${finalPrice.toLocaleString()}\n\n感謝您的預訂！`,
    nextStep: 'booking_completed'
  };
}

// ==================== 確認處理 ====================
function handleConfirmation(message, session) {
  if (message.includes('確認') && session.step === 'confirm_booking') {
    return completeBooking(session);
  }
  return null;
}

// ==================== API 路由 ====================
app.post('/api/chat', (req, res) => {
  const { message, sessionId = `session_${Date.now()}` } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '訊息不能為空' });
  }
  
  try {
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    
    let response = processMessage(message, session);
    
    // 處理確認
    if (!response) {
      response = handleConfirmation(message.toLowerCase(), session);
    }
    
    if (response && response.nextStep) {
      session.step = response.nextStep;
    }
    
    res.json({
      reply: response.reply,
      sessionId: sessionId,
      step: session.step,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 處理錯誤:', error);
    res.status(500).json({
      reply: '抱歉，處理請求時發生錯誤。',
      sessionId: sessionId,
      error: true
    });
  }
});

app.post('/chat', (req, res) => {
  res.redirect('/api/chat');
});

// 會話管理
app.get('/api/session/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  res.json(session ? {
    sessionId: req.params.sessionId,
    step: session.step,
    data: session.data
  } : { error: '會話不存在' });
});

// ==================== 啟動伺服器 ====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 服務已啟動在端口 ${PORT}`);
  console.log(`📍 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
});

// 健康檢查間隔
setInterval(() => {
  console.log(`💓 服務運行中，活躍會話: ${sessions.size}`);
}, 60000);

// 優雅關機
process.on('SIGTERM', () => {
  console.log('🛑 收到關機信號...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

module.exports = app;

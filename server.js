const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// ==================== 載入對話流程配置 ====================
let dialogFlow;
try {
  dialogFlow = require('./config/dialog-flow.json');
  console.log('✅ 載入對話流程配置成功');
} catch (error) {
  console.error('❌ 載入對話流程配置失敗:', error.message);
  dialogFlow = {
    states: {
      init: {
        prompt: '您好，歡迎使用 AI 訂房助理！請問您需要什麼幫助？'
      }
    }
  };
}

// 會話狀態管理
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// ==================== 服務就緒狀態 ====================
let serverReady = false;

// 中間件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 請求日誌
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body || req.query);
  next();
});

// ==================== 會話操作函數 ====================
async function loadSessions() {
  try {
    const exists = await fs.access(SESSION_FILE).then(() => true).catch(() => false);
    if (exists) {
      const data = await fs.readFile(SESSION_FILE, 'utf8');
      const savedSessions = JSON.parse(data);
      for (const [sessionId, sessionData] of savedSessions) {
        sessions.set(sessionId, sessionData);
      }
      console.log(`✅ 成功加載 ${sessions.size} 個會話`);
    }
  } catch (error) {
    console.error('❌ 加載會話失敗:', error.message);
  }
}

async function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    await fs.writeFile(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
  } catch (error) {
    console.error('❌ 保存會話失敗:', error.message);
  }
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
    saveSessions().catch(console.error);
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 優化的分層意圖識別系統 ====================

// 第一層：主要意圖識別（優化版）
function detectMainIntent(message) {
  const lowerMsg = message.toLowerCase().trim();
  
  const intentPatterns = {
    book_room: /(訂房|預訂|預定|訂房間|想要訂|我要訂|預約)/,
    ask_price: /(價格|價錢|多少錢|費用|房價|價位)/,
    ask_promotion: /(優惠|折扣|促銷|特價|會員價|便宜)/,
    cancel_booking: /(取消|退訂|退房|取消訂房)/,
    ask_pet_policy: /(寵物|帶狗|帶貓|動物|狗|貓)/,
    ask_facilities: /(設施|設備|服務|wifi|停車|早餐|網路)/,
    ask_attractions: /(附近|景點|餐廳|美食|購物|好玩|推薦)/
  };

  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    if (pattern.test(lowerMsg)) {
      return intent;
    }
  }
  
  return 'general_inquiry';
}

// 第二層：實體提取（優化版）
function extractEntities(message) {
  const lowerMsg = message.toLowerCase();
  const entities = {};

  try {
    // 房型提取
    const roomTypeMatch = lowerMsg.match(/(標準雙人房|豪華雙人房|套房|家庭房|雙人房|單人房)/);
    if (roomTypeMatch) entities.roomType = roomTypeMatch[1];

    // 人數提取 - 改進的 regex
    const peopleMatch = lowerMsg.match(/(\d+)\s*(個|位|人)?\s*(大人|成人)/);
    const childMatch = lowerMsg.match(/(\d+)\s*(個|位)?\s*(小孩|兒童|孩子)/);
    if (peopleMatch) entities.adults = parseInt(peopleMatch[1]);
    if (childMatch) entities.children = parseInt(childMatch[1]);

    // 房間數量 - 改進的 regex
    const roomCountMatch = lowerMsg.match(/(\d+)\s*(間|房)/);
    if (roomCountMatch) entities.roomCount = parseInt(roomCountMatch[1]);

    // 天數
    const nightsMatch = lowerMsg.match(/(\d+)\s*(晚|天|夜)/);
    if (nightsMatch) entities.nights = parseInt(nightsMatch[1]);

    // 布林標記
    entities.isMember = /(會員|vip|金卡|銀卡)/.test(lowerMsg);
    entities.hasPets = /(寵物|狗|貓)/.test(lowerMsg);

    // 年齡相關
    const ageMatch = lowerMsg.match(/(\d+)\s*歲/);
    if (ageMatch) entities.childAge = parseInt(ageMatch[1]);

  } catch (error) {
    console.error('實體提取錯誤:', error);
  }

  return entities;
}

// 第三層：上下文理解（優化版）
function understandContext(message, session) {
  const context = {
    needsClarification: false,
    clarificationType: null,
    missingInfo: []
  };

  const currentStep = session.step;
  const currentData = session.data || {};

  // 根據當前步驟檢查缺失信息
  const stepRequirements = {
    'room_selected': ['roomCount', 'adults', 'nights'],
    'ask_guest_count': ['adults'],
    'ask_room_count': ['roomCount'],
    'ask_stay_duration': ['nights']
  };

  const requirements = stepRequirements[currentStep] || [];
  requirements.forEach(field => {
    if (!currentData[field]) {
      context.needsClarification = true;
      context.missingInfo.push(field);
    }
  });

  // 設置澄清類型
  if (context.needsClarification) {
    if (context.missingInfo.includes('roomCount')) {
      context.clarificationType = 'room_count';
    } else if (context.missingInfo.includes('adults')) {
      context.clarificationType = 'guest_count';
    } else if (context.missingInfo.includes('nights')) {
      context.clarificationType = 'stay_duration';
    }
  }

  return context;
}

// ==================== 優化的智能回應生成 ====================

function generateRoomSelectionReply(entities, session) {
  // 確保數據結構
  session.data = session.data || {};
  
  if (entities.roomType) {
    session.data.roomType = entities.roomType;
    session.step = 'room_selected';
    
    const roomMessages = {
      '標準雙人房': '標準雙人房是我們的熱門選擇，請問有幾位大人入住？',
      '豪華雙人房': '豪華雙人房提供更舒適的體驗，請問有幾位大人入住？',
      '套房': '套房空間寬敞，適合商務或家庭旅客，請問有幾位大人入住？',
      '家庭房': '家庭房適合親子同遊，請問有幾位大人和小孩？'
    };
    
    return `好的，您選擇的是 ${entities.roomType}。${roomMessages[entities.roomType] || '請問有幾位大人入住？'}`;
  }
  
  return '請問您想要預訂哪種房型？我們有：標準雙人房、豪華雙人房、套房、家庭房。';
}

function generateGuestInfoReply(entities, session) {
  session.data = session.data || {};
  const replies = [];
  
  // 處理現有信息
  if (entities.adults) {
    session.data.adults = entities.adults;
    replies.push(`了解，${entities.adults}位大人`);
  }
  
  if (entities.children) {
    session.data.children = entities.children;
    session.data.hasChildren = true;
    replies.push(`${entities.children}位小孩`);
    
    if (!session.data.childAges && entities.children > 0) {
      session.step = 'ask_child_ages';
      return `${replies.join('，')}。請問小孩的年齡分別是？這會影響住宿費用。`;
    }
  }
  
  if (entities.roomCount) {
    session.data.roomCount = entities.roomCount;
    replies.push(`${entities.roomCount}間房間`);
  }
  
  // 決定下一步
  let nextQuestion = '';
  if (!session.data.adults) {
    session.step = 'ask_guest_count';
    nextQuestion = '請問有幾位大人入住？';
  } else if (!session.data.roomCount) {
    session.step = 'ask_room_count';
    nextQuestion = '請問需要幾間房間？';
  } else if (!session.data.nights) {
    session.step = 'ask_stay_duration';
    nextQuestion = '請問打算入住幾晚？';
  } else {
    session.step = 'ready_to_book';
    nextQuestion = '信息已完整！需要我為您計算價格嗎？';
  }
  
  return replies.length > 0 ? `${replies.join('，')}。${nextQuestion}` : nextQuestion;
}

function generatePetPolicyReply(entities, session) {
  session.context = session.context || {};
  session.context.petInquiry = true;
  
  const petPolicy = [
    '🐾 寵物入住政策：',
    '• 歡迎小型寵物（15公斤以下）',
    '• 每房限帶1隻寵物',
    '• 清潔費 NT$500/晚',
    '• 請自備寵物用品',
    '• 寵物不可單獨留在房內'
  ].join('\n');
  
  if (entities.hasPets) {
    session.data.hasPets = true;
    return `${petPolicy}\n\n了解您會帶寵物，已為您備註。請問還有其他需求嗎？`;
  }
  
  return `${petPolicy}\n\n請問您還有其他問題嗎？`;
}

function generatePromotionReply(entities, session) {
  session.context = session.context || {};
  session.context.promotionInquiry = true;
  
  const promotions = [];
  
  if (entities.isMember) {
    promotions.push(
      '🎯 **會員專屬優惠**',
      '• 房價9折優惠',
      '• 免費延遲退房至14:00',
      '• 入住禮：迎賓水果',
      '• 累積點數兌換免費住宿'
    );
  }
  
  promotions.push(
    '💰 **一般優惠**',
    '• 連住3晚以上享85折',
    '• 預訂2間房以上享團體優惠',
    '• 長者（65歲以上）享9折',
    '• 學生證享95折',
    '',
    '👨‍👩‍👧‍👦 **家庭優惠**',
    '• 12歲以下兒童不加床免費',
    '• 提供嬰兒床租借服務'
  );
  
  return promotions.join('\n');
}

function generateChildAgeReply(entities, session) {
  session.data = session.data || {};
  
  if (entities.childAge) {
    if (!session.data.childAges) session.data.childAges = [];
    session.data.childAges.push(entities.childAge);
    
    const remaining = session.data.children - session.data.childAges.length;
    
    if (remaining > 0) {
      return `已記錄 ${entities.childAge} 歲，請問其他小孩的年齡是？`;
    } else {
      const ages = session.data.childAges;
      const hasExtraBed = ages.some(age => age >= 6);
      const hasFreeChild = ages.some(age => age < 6);
      
      const messages = ['感謝提供年齡信息！'];
      if (hasFreeChild) messages.push('• 6歲以下兒童不加床免費');
      if (hasExtraBed) messages.push('• 6歲以上兒童可能需要加床（NT$800/晚）');
      
      session.step = 'ask_room_count';
      return `${messages.join('\n')}\n請問需要幾間房間？`;
    }
  }
  
  return '請問小孩的年齡是？這會影響住宿費用。';
}

// ==================== 主對話處理邏輯（優化版） ====================
function processDialog(message, session) {
  try {
    console.log(`💬 處理訊息: "${message}"`);
    console.log(`📊 當前狀態: ${session.step}`, session.data);
    
    // 確保數據結構
    session.data = session.data || {};
    session.context = session.context || {};
    
    const mainIntent = detectMainIntent(message);
    const entities = extractEntities(message);
    const context = understandContext(message, session);
    
    console.log('🎯 分析結果:', { mainIntent, entities, context });
    
    let reply = '';
    let nextStep = session.step;
    
    // 優先處理澄清需求
    if (context.needsClarification) {
      const clarificationMessages = {
        'room_count': '請問需要預訂幾間房間？',
        'guest_count': '請問有幾位大人入住？',
        'stay_duration': '請問打算入住幾晚？'
      };
      
      reply = clarificationMessages[context.clarificationType] || '請問您需要什麼協助？';
      nextStep = `ask_${context.clarificationType}`;
      return { reply, nextStep };
    }
    
    // 狀態機處理
    const stateHandlers = {
      'welcome': () => {
        if (mainIntent === 'book_room') {
          return generateRoomSelectionReply(entities, session);
        }
        return '您好！我是訂房助理，可以幫您預訂房間、查詢價格、了解優惠等。請問您需要什麼協助？';
      },
      
      'ask_child_ages': () => generateChildAgeReply(entities, session),
      
      'ask_guest_count': () => generateGuestInfoReply(entities, session),
      
      'ask_room_count': () => generateGuestInfoReply(entities, session),
      
      'ask_stay_duration': () => generateGuestInfoReply(entities, session),
      
      'room_selected': () => generateGuestInfoReply(entities, session),
      
      'default': () => {
        // 基於意圖的處理
        const intentHandlers = {
          'book_room': () => generateRoomSelectionReply(entities, session),
          'ask_pet_policy': () => generatePetPolicyReply(entities, session),
          'ask_promotion': () => generatePromotionReply(entities, session),
          'ask_price': () => {
            if (session.data.roomType) {
              nextStep = 'ask_stay_duration';
              return '好的，我來為您計算價格。請問入住日期和天數是？';
            }
            nextStep = 'ask_room_type';
            return '請問您想了解哪種房型的價格？我們有標準雙人房、豪華雙人房、套房、家庭房。';
          }
        };
        
        return intentHandlers[mainIntent] ? 
          intentHandlers[mainIntent]() : 
          '您好！我可以幫您預訂房間、查詢價格、了解優惠政策等。請問您需要什麼協助？';
      }
    };
    
    const handler = stateHandlers[session.step] || stateHandlers.default;
    const result = handler();
    
    // 確保返回正確的格式
    if (typeof result === 'string') {
      reply = result;
    } else {
      // 如果處理器返回對象，提取信息
      reply = result.reply || result;
      nextStep = result.nextStep || session.step;
    }
    
    return { reply, nextStep };
    
  } catch (error) {
    console.error('❌ 對話處理錯誤:', error);
    return {
      reply: '抱歉，系統暫時遇到問題。請重新描述您的需求，我會盡力協助您。',
      nextStep: 'welcome'
    };
  }
}

// ==================== 聊天接口（完全修復版） ====================
app.post('/chat', async (req, res) => {
  try {
    console.log('📨 收到聊天請求:', req.body);
    
    const { message, sessionId } = req.body;
    
    // 輸入驗證
    if (!message || !sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要參數',
        message: '請提供對話內容和會話ID'
      });
    }

    if (typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: '無效的訊息內容',
        message: '請提供有效的對話內容'
      });
    }

    // 獲取會話
    const session = getOrCreateSession(sessionId);
    console.log(`👤 會話狀態: ${session.step}`, session.data);

    // 處理對話
    const { reply, nextStep } = processDialog(message.trim(), session);
    
    // 更新會話
    session.step = nextStep;
    sessions.set(sessionId, session);
    
    // 異步保存
    saveSessions().catch(err => {
      console.error('💾 保存會話失敗:', err);
    });

    // 🎯 關鍵修復：確保回應格式正確
    const responseData = {
      success: true,
      reply: reply,  // ✅ 正確：使用 reply
      sessionId: sessionId,
      step: session.step,
      data: session.data,  // ✅ 正確：使用 data
      timestamp: new Date().toISOString()
    };

    console.log('📤 發送回應:', { 
      reply: reply.substring(0, 100) + '...',
      step: session.step,
      data: session.data 
    });
    
    res.json(responseData);

  } catch (error) {
    console.error('💥 聊天處理錯誤:', error);
    
    res.status(500).json({ 
      success: false, 
      error: '系統處理失敗',
      message: '請稍後再試或聯繫客服',
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 健康檢查接口 ====================
app.get('/health', (req, res) => {
  const healthStatus = {
    status: serverReady ? 'healthy' : 'starting',
    service: 'AI Hotel Assistant - Optimized',
    version: '8.1.0',
    timestamp: new Date().toISOString(),
    serverReady: serverReady,
    sessionsCount: sessions.size,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  const statusCode = serverReady ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.get('/ready', (req, res) => {
  res.json({
    status: serverReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString()
  });
});

app.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// ==================== 價格計算系統 ====================
const roomPrices = {
  '標準雙人房': { basePrice: 2800, capacity: 2 },
  '豪華雙人房': { basePrice: 3800, capacity: 2 },
  '套房': { basePrice: 5800, capacity: 3 },
  '家庭房': { basePrice: 4500, capacity: 4 }
};

app.post('/api/price', (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少會話ID' 
      });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.data || !session.data.roomType) {
      return res.status(400).json({ 
        success: false, 
        error: '請先選擇房型',
        message: '請先通過聊天接口選擇房型和相關資訊'
      });
    }

    const { roomType, adults = 2, children = 0, roomCount = 1, nights = 1, hasPets = false, isMember = false } = session.data;
    const roomConfig = roomPrices[roomType];
    
    if (!roomConfig) {
      return res.status(400).json({ 
        success: false, 
        error: '不支援的房型'
      });
    }

    // 計算價格
    let totalPrice = roomConfig.basePrice * nights * roomCount;
    let discountInfo = [];
    let extraCharges = [];

    // 應用折扣
    if (isMember) {
      totalPrice *= 0.9;
      discountInfo.push('會員9折');
    }
    if (nights >= 3) {
      totalPrice *= 0.85;
      discountInfo.push('連住3晚85折');
    }
    if (roomCount >= 2) {
      totalPrice *= 0.9;
      discountInfo.push('多間房9折');
    }
    
    // 額外費用
    if (hasPets) {
      const petFee = 500 * nights * roomCount;
      totalPrice += petFee;
      extraCharges.push(`寵物清潔費 NT$${petFee}`);
    }
    
    // 兒童加床費用
    const childAges = session.data.childAges || [];
    const extraBedChildren = childAges.filter(age => age >= 6).length;
    if (extraBedChildren > 0) {
      const extraBedFee = 800 * extraBedChildren * nights;
      totalPrice += extraBedFee;
      extraCharges.push(`兒童加床費 NT$${extraBedFee}`);
    }

    const priceResult = {
      roomType,
      adults,
      children,
      roomCount,
      nights,
      basePrice: Math.round(roomConfig.basePrice * roomCount * nights),
      totalPrice: Math.round(totalPrice),
      currency: 'TWD',
      discounts: discountInfo,
      extraCharges: extraCharges,
      finalPrice: Math.round(totalPrice)
    };

    // 生成回覆訊息
    let replyMessage = `🏨 ${roomType} 價格明細：\n`;
    replyMessage += `• 房間：${roomCount}間 x ${nights}晚\n`;
    replyMessage += `• 人數：${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''}\n`;
    replyMessage += `• 基礎房價：NT$ ${priceResult.basePrice.toLocaleString()}\n`;
    
    if (discountInfo.length > 0) {
      replyMessage += `• 適用優惠：${discountInfo.join(' + ')}\n`;
    }
    if (extraCharges.length > 0) {
      replyMessage += `• 額外費用：${extraCharges.join(' + ')}\n`;
    }
    
    replyMessage += `• 💰 總價格：NT$ ${priceResult.finalPrice.toLocaleString()}`;

    // ✅ 確保格式正確
    res.json({
      success: true,
      data: priceResult,
      reply: replyMessage,  // ✅ 正確：使用 reply
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 價格查詢錯誤:', error);
    res.status(500).json({
      success: false,
      error: '價格查詢失敗',
      message: error.message
    });
  }
});

// ==================== 啟動伺服器 ====================
(async () => {
  try {
    console.log('🚀 啟動優化版訂房助理服務...');
    await loadSessions();

    const server = app.listen(PORT, () => {
      console.log(`\n🎉 優化版訂房助理服務已啟動！`);
      console.log(`📍 服務地址: http://localhost:${PORT}`);
      console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
      console.log(`📊 載入會話數: ${sessions.size}`);
      console.log(`🔧 服務狀態: 運行中\n`);
      
      serverReady = true;
    });

    server.on('error', (error) => {
      console.error('💥 伺服器啟動錯誤:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('💥 啟動過程失敗:', error);
    process.exit(1);
  }
})();

// ==================== 優雅關閉 ====================
async function gracefulShutdown() {
  console.log('📦 收到終止信號，優雅關閉中...');
  serverReady = false;
  await saveSessions();
  console.log('👋 服務已優雅關閉');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;

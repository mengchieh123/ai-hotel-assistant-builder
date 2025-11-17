const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

// 會話存儲
const sessions = new Map();

// ==================== 基本健康檢查路由 ====================
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查請求收到');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    message: '服務正常運行中'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

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
        basePrice: bookingData.basePrice,
        finalPrice: bookingData.finalPrice,
        contactPerson: bookingData.contactPerson,
        checkInDate: bookingData.checkInDate,
        includesBreakfast: bookingData.includesBreakfast,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      const response = await fetch(`${this.baseUrl}/webhook/hotel-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`n8n 響應錯誤: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ n8n 訂房確認發送成功');
      return result;

    } catch (error) {
      console.error('❌ n8n 訂房確認發送失敗:', error.message);
      return null;
    }
  }

  async logCustomerInquiry(sessionId, userMessage, botResponse, intent) {
    if (!this.enabled) {
      return null;
    }

    try {
      const payload = {
        action: 'customer_inquiry',
        sessionId,
        userMessage,
        botResponse: botResponse.reply,
        intent: intent || 'unknown',
        step: botResponse.nextStep,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      // 使用 Promise 不等待響應，避免阻塞
      fetch(`${this.baseUrl}/webhook/customer-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error('❌ n8n 客戶查詢記錄失敗:', error.message);
      });

    } catch (error) {
      console.error('❌ n8n 客戶查詢記錄錯誤:', error.message);
    }
  }
}

// 初始化 n8n 服務
const n8nService = new N8NIntegrationService();

// 獲取或創建會話
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      conversationHistory: [],
      lastActivity: Date.now()
    });
  }
  return sessions.get(sessionId);
}

// ==================== 房間容量資料庫 ====================
const roomCapacityData = {
  '標準雙人房': {
    maxAdults: 2,
    maxChildren: 1,
    maxTotal: 2,
    bedType: '1張雙人床',
    size: '28平方公尺',
    description: '舒適雙人床，基本設施齊全',
    price: 2800,
    breakfastIncluded: false,
    breakfastPrice: 300
  },
  '豪華雙人房': {
    maxAdults: 2,
    maxChildren: 2,
    maxTotal: 3,
    bedType: '1張加大雙人床',
    size: '35平方公尺',
    description: '加大雙人床，景觀較佳，可加嬰兒床',
    price: 3800,
    breakfastIncluded: true,
    breakfastPrice: 0
  },
  '套房': {
    maxAdults: 3,
    maxChildren: 2,
    maxTotal: 4,
    bedType: '1張雙人床 + 沙發床',
    size: '48平方公尺',
    description: '獨立客廳，豪華衛浴，空間寬敞',
    price: 5800,
    breakfastIncluded: true,
    breakfastPrice: 0
  },
  '家庭房': {
    maxAdults: 2,
    maxChildren: 3,
    maxTotal: 4,
    bedType: '2張雙人床',
    size: '42平方公尺',
    description: '兩張雙人床，專為家庭設計',
    price: 4500,
    breakfastIncluded: false,
    breakfastPrice: 250
  }
};

// ==================== 簡化版對話處理 ====================
function processMessage(message, session) {
  const cleanMessage = cleanInputMessage(message);
  const lowerMsg = cleanMessage.toLowerCase();
  
  // 記錄對話歷史
  session.conversationHistory.push({
    role: 'user',
    content: cleanMessage,
    timestamp: new Date().toISOString()
  });
  
  console.log('🔄 處理訊息:', { 
    original: message, 
    cleaned: cleanMessage, 
    step: session.step 
  });
  
  let response = null;
  let detectedIntent = 'unknown';

  // 重置會話指令
  if (lowerMsg.includes('重置') || lowerMsg.includes('重新開始') || lowerMsg.includes('restart')) {
    session.step = 'welcome';
    session.data = {};
    session.context = {};
    session.conversationHistory = [];
    response = {
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
    detectedIntent = 'reset';
  }
  
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help') || lowerMsg.includes('指令')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看各項優惠政策\n• 附近景點 - 推薦周邊景點\n• 飯店設施 - 介紹飯店設施\n• 兒童政策 - 了解兒童收費標準\n• 取消訂房 - 取消現有訂單\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇房間數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
    detectedIntent = 'help';
  }

  // ==================== 新增：兒童政策查詢處理 ====================
  else if (!response && (lowerMsg.includes('兒童') || lowerMsg.includes('小孩') || lowerMsg.includes('孩子') || 
      lowerMsg.includes('加價') || lowerMsg.includes('加費') || lowerMsg.includes('收費'))) {
    response = handleChildPolicyQuery(cleanMessage, session);
    detectedIntent = 'child_policy';
  }

  // ==================== 新增：價格查詢處理 ====================
  else if (!response && (lowerMsg.includes('價格') || lowerMsg.includes('價錢') || lowerMsg.includes('多少錢'))) {
    response = handlePriceQuery(cleanMessage, session);
    detectedIntent = 'price_query';
  }

  // 處理早餐相關查詢
  else if (!response && (lowerMsg.includes('早餐') || lowerMsg.includes('含早'))) {
    response = handleBreakfastQuery(cleanMessage, session);
    detectedIntent = 'breakfast_query';
  }
  
  // 處理入住日期
  else if (!response && (lowerMsg.includes('日期') || lowerMsg.includes('入住'))) {
    response = handleCheckInDate(cleanMessage, session);
    detectedIntent = 'checkin_date';
  }
  
  // 處理聯絡人資訊
  else if (!response && (lowerMsg.includes('聯絡') || lowerMsg.includes('聯繫'))) {
    response = handleContactInfo(cleanMessage, session);
    detectedIntent = 'contact_info';
  }
  
  // 處理取消訂房
  else if (!response && lowerMsg.includes('取消訂房')) {
    response = handleCancelBooking(cleanMessage, session);
    detectedIntent = 'cancel_booking';
  }
  
  // 處理感謝訊息
  else if (!response && (lowerMsg.includes('謝謝') || lowerMsg.includes('感謝'))) {
    response = handleThankYouMessage(cleanMessage, session);
    detectedIntent = 'thank_you';
  }

  // 處理訂房確認
  else if (!response && (lowerMsg.includes('確認訂房') || lowerMsg.includes('完成訂房'))) {
    response = handleBookingConfirmation(cleanMessage, session);
    detectedIntent = 'booking_confirmation';
  }

  // 確認處理
  else if (!response && lowerMsg.includes('確認') && session.step === 'confirm_booking') {
    response = handleBookingConfirmation(cleanMessage, session);
    detectedIntent = 'confirmation';
  }

  // 數字處理
  else if (!response) {
    response = handleNumberInput(cleanMessage, session, lowerMsg);
    if (response) detectedIntent = 'number_input';
  }
  
  // 訂房相關
  else if (!response) {
    response = handleBookingIntent(lowerMsg, session);
    if (response) detectedIntent = 'booking';
  }

  // 記錄回應到對話歷史
  if (response) {
    session.conversationHistory.push({
      role: 'assistant',
      content: response.reply,
      timestamp: new Date().toISOString()
    });
    
    n8nService.logCustomerInquiry(session.sessionId, cleanMessage, response, detectedIntent)
      .catch(error => console.error('n8n 記錄失敗:', error));
  } else {
    response = generateDefaultResponse(session);
    detectedIntent = 'default';
  }

  return response;
}

// ==================== 新增：處理兒童政策查詢 ====================
function handleChildPolicyQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `👶 **兒童入住政策**\n\n`;
  
  // 兒童年齡政策
  reply += `📋 **年齡分層收費**\n`;
  reply += `• 0-2歲: 🆓 免費同住 (可提供嬰兒床)\n`;
  reply += `• 3-5歲: 🆓 免費同住 (可加床 NT$500/晚)\n`;
  reply += `• 6-11歲: 💰 加床費 NT$800/晚\n`;
  reply += `• 12-17歲: 👨‍🦰 視同成人收費\n\n`;
  
  // 提取兒童數量（如果有的話）
  const childMatch = message.match(/(\d+)\s*個?\s*(小孩|兒童|孩子)/);
  if (childMatch) {
    const childCount = parseInt(childMatch[1]);
    reply += `根據您提到的 ${childCount} 位小孩：\n`;
    reply += `💡 建議選擇家庭房或套房，空間較寬敞\n\n`;
    
    // 記錄兒童數量
    session.data.children = childCount;
    session.data.hasChildren = true;
  }
  
  // 提取兒童年齡（如果有的話）
  const ageMatch = message.match(/(\d+)\s*歲/);
  if (ageMatch) {
    const childAge = parseInt(ageMatch[1]);
    let policy = '';
    let charge = '';
    
    if (childAge < 3) {
      policy = '免費同住';
      charge = '無額外費用';
    } else if (childAge < 6) {
      policy = '免費同住';
      charge = '加床費 NT$500/晚 (可選)';
    } else if (childAge < 12) {
      policy = '需加床';
      charge = '加床費 NT$800/晚';
    } else {
      policy = '視同成人';
      charge = '需預訂額外床位或房間';
    }
    
    reply += `👦 ${childAge}歲兒童: ${policy}\n`;
    reply += `💰 ${charge}\n\n`;
    
    // 記錄兒童年齡
    session.data.childAge = childAge;
  }
  
  reply += `🏨 **房型建議**\n`;
  reply += `• 家庭房: 最適合親子同住 (2張雙人床)\n`;
  reply += `• 套房: 空間寬敞，可加沙發床\n`;
  reply += `• 豪華雙人房: 可加嬰兒床 (限1位幼兒)\n\n`;
  
  reply += `💡 預訂時請告知兒童年齡，以便為您安排合適的房型`;
  
  // 如果正在訂房流程中，提供繼續選項
  if (session.data.roomType) {
    reply += `\n\n您選擇的 ${session.data.roomType} ${
      session.data.roomType === '家庭房' ? '很適合親子同住' : 
      session.data.roomType === '套房' ? '空間較為寬敞' : 
      '建議確認房間大小'
    }`;
    
    reply += `\n是否需要繼續訂房流程？`;
    session.step = 'child_policy_info';
  } else {
    session.step = 'child_policy';
  }
  
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理價格查詢 ====================
function handlePriceQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 提取房型
  let roomType = null;
  if (lowerMsg.includes('標準')) roomType = '標準雙人房';
  else if (lowerMsg.includes('豪華')) roomType = '豪華雙人房';
  else if (lowerMsg.includes('套房')) roomType = '套房';
  else if (lowerMsg.includes('家庭')) roomType = '家庭房';
  
  // 提取天數
  const nightsMatch = message.match(/(\d+)\s*晚/);
  const nights = nightsMatch ? parseInt(nightsMatch[1]) : 1;
  
  // 提取兒童數量
  const childMatch = message.match(/(\d+)\s*個?\s*(小孩|兒童|孩子)/);
  const children = childMatch ? parseInt(childMatch[1]) : 0;
  
  if (roomType) {
    const roomInfo = roomCapacityData[roomType];
    let totalPrice = roomInfo.price * nights;
    let extraCharges = [];
    
    // 計算兒童加價
    if (children > 0) {
      // 簡單計算：每個兒童加 500/晚
      const childCharge = 500 * children * nights;
      totalPrice += childCharge;
      extraCharges.push(`兒童加價 NT$${childCharge}`);
    }
    
    let reply = `💰 **價格查詢結果**\n\n`;
    reply += `🏨 ${roomType}\n`;
    reply += `📅 ${nights}晚\n`;
    if (children > 0) {
      reply += `👨‍👩‍👧‍👦 ${children}位小孩\n`;
    }
    reply += `💵 每晚: NT$${roomInfo.price}\n`;
    
    if (extraCharges.length > 0) {
      reply += `📊 額外費用: ${extraCharges.join('、')}\n`;
    }
    
    reply += `💰 總價: NT$${totalPrice.toLocaleString()}\n`;
    
    if (roomInfo.breakfastIncluded) {
      reply += `🍽️ 已包含免費早餐\n`;
    }
    
    // 更新會話數據
    session.data.roomType = roomType;
    session.data.nights = nights;
    if (children > 0) {
      session.data.children = children;
      session.data.hasChildren = true;
    }
    
    reply += `\n是否需要預訂？`;
    
    session.step = 'price_query';
    return {
      reply: reply,
      nextStep: 'price_query'
    };
  } else {
    // 沒有指定房型，顯示所有房型價格
    let reply = `💰 **各房型價格** (以${nights}晚計算${children > 0 ? `, ${children}位小孩` : ''})\n\n`;
    
    Object.entries(roomCapacityData).forEach(([room, info]) => {
      let roomPrice = info.price * nights;
      if (children > 0) {
        roomPrice += 500 * children * nights;
      }
      
      reply += `🏨 ${room}\n`;
      reply += `   💵 NT$${roomPrice.toLocaleString()}\n`;
      if (info.breakfastIncluded) {
        reply += `   🍽️ 含早餐\n`;
      }
      if (children > 0) {
        reply += `   👶 已計兒童費用\n`;
      }
      reply += `\n`;
    });
    
    reply += `請告訴我您想查詢哪種房型？`;
    
    return {
      reply: reply,
      nextStep: 'price_info'
    };
  }
}

// ==================== 處理早餐相關查詢 ====================
function handleBreakfastQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = '🍽️ **早餐資訊**\n\n';
  
  if (session.data.roomType) {
    const roomInfo = roomCapacityData[session.data.roomType];
    reply += `您選擇的 ${session.data.roomType}:\n`;
    
    if (roomInfo.breakfastIncluded) {
      reply += `✅ **已包含免費早餐**\n`;
      reply += `   • 自助式早餐 (06:30-10:00)\n`;
      reply += `   • 中西式餐點選擇\n`;
    } else {
      reply += `❌ **未包含早餐**\n`;
      reply += `   • 可加購早餐: NT$${roomInfo.breakfastPrice}/人\n`;
      reply += `   • 自助式早餐 (06:30-10:00)\n`;
    }
  } else {
    reply += `**各房型早餐政策：**\n\n`;
    Object.entries(roomCapacityData).forEach(([roomType, info]) => {
      reply += `🏨 ${roomType}: `;
      if (info.breakfastIncluded) {
        reply += `✅ 含免費早餐\n`;
      } else {
        reply += `💵 可加購 NT$${info.breakfastPrice}/人\n`;
      }
    });
  }
  
  return continueBookingProcess(session, reply);
}

// ==================== 處理入住日期 ====================
function handleCheckInDate(message, session) {
  const dateMatch = message.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/);
  
  let reply = '';
  if (dateMatch) {
    const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    session.data.checkInDate = dateStr;
    reply += `📅 已記錄入住日期: ${dateStr}\n\n`;
  } else {
    reply += `📅 **入住日期查詢**\n\n`;
  }
  
  reply += `💡 我們接受未來365天內的預訂\n`;
  reply += `⏰ 入住時間: 15:00\n`;
  reply += `⏰ 退房時間: 11:00\n`;
  
  return continueBookingProcess(session, reply);
}

// ==================== 處理聯絡人資訊 ====================
function handleContactInfo(message, session) {
  const nameMatch = message.match(/([王陳林李黃張劉][\u4e00-\u9fa5]{1,2})/);
  
  let reply = '';
  if (nameMatch) {
    session.data.contactPerson = nameMatch[1];
    reply += `👤 已記錄聯絡人: ${nameMatch[1]}\n\n`;
  } else {
    reply += `👤 **聯絡人資訊**\n\n`;
  }
  
  reply += `📞 訂房完成後，我們將：\n`;
  reply += `   • 發送確認簡訊\n`;
  reply += `   • 提供訂單詳細資訊\n`;
  
  return continueBookingProcess(session, reply);
}

// ==================== 處理取消訂房 ====================
function handleCancelBooking(message, session) {
  let reply = '❌ **取消訂房說明**\n\n';
  
  reply += `**取消訂房方式：**\n`;
  reply += `📱 **會員中心取消**\n`;
  reply += `   • 登入官網會員中心\n`;
  reply += `   • 找到「我的訂單」\n`;
  reply += `   • 點選取消訂房\n\n`;
  
  reply += `📞 **客服協助取消**\n`;
  reply += `   • 電話: 02-1234-5678\n`;
  reply += `   • Line: @hotelcancel\n`;
  reply += `   • 服務時間: 09:00-21:00\n\n`;
  
  reply += `💡 **取消政策**\n`;
  reply += `   • 入住前3天取消：全額退款\n`;
  reply += `   • 入住前1天取消：退款50%\n`;
  reply += `   • 當天取消：恕不退費\n`;
  
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 處理感謝訊息 ====================
function handleThankYouMessage(message, session) {
  let reply = '🙏 感謝您的使用！\n\n';
  
  if (session.data.orderNumber) {
    reply += `您的訂單 ${session.data.orderNumber} 已完成！\n\n`;
  }
  
  reply += `如有任何問題，隨時歡迎詢問。祝您有美好的一天！✨`;
  
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 處理訂房確認 ====================
function handleBookingConfirmation(message, session) {
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
    reply += `請選擇房型：標準雙人房、豪華雙人房、套房、家庭房`;
    return {
      reply: reply,
      nextStep: 'select_room'
    };
  } else if (!session.data.adults) {
    session.step = 'ask_guests';
    if (reply) reply += '\n\n';
    reply += `請問有幾位大人入住？`;
    return {
      reply: reply,
      nextStep: 'ask_guests'
    };
  } else if (!session.data.roomCount) {
    session.step = 'ask_room_count';
    if (reply) reply += '\n\n';
    reply += `了解，${session.data.adults}位大人。請問需要幾間${session.data.roomType}？`;
    return {
      reply: reply,
      nextStep: 'ask_room_count'
    };
  } else if (!session.data.nights) {
    session.step = 'ask_nights';
    if (reply) reply += '\n\n';
    reply += `好的，${session.data.roomCount}間${session.data.roomType}。請問打算入住幾晚？`;
    return {
      reply: reply,
      nextStep: 'ask_nights'
    };
  } else {
    return generateBookingSummary(session);
  }
}

// ==================== 引導完成訂房 ====================
function guideToCompleteBooking(session) {
  let missingInfo = [];
  
  if (!session.data.roomType) missingInfo.push('房型');
  if (!session.data.adults) missingInfo.push('大人人數');
  if (!session.data.roomCount) missingInfo.push('房間數量');
  if (!session.data.nights) missingInfo.push('入住天數');
  
  let reply = `📋 **訂房資訊確認**\n\n`;
  reply += `為了完成訂房，還需要以下資訊：\n`;
  missingInfo.forEach(info => {
    reply += `• ${info}\n`;
  });
  
  reply += `\n請提供缺少的資訊！`;
  
  return {
    reply: reply,
    nextStep: 'complete_booking'
  };
}

// ==================== 數字處理 ====================
function handleNumberInput(cleanMessage, session, lowerMsg) {
  const numberMatch = cleanMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  
  // 處理大人人數
  if ((session.step === 'ask_guests' || !session.data.adults) && 
      (cleanMessage.includes('大人') || cleanMessage.includes('位') || cleanMessage.includes('個'))) {
    session.data.adults = number;
    session.step = 'ask_room_count';
    
    let reply = `了解，${number}位大人`;
    if (session.data.children) {
      reply += `和${session.data.children}位小孩`;
    }
    reply += `。請問需要預訂幾間${session.data.roomType || '房間'}？`;
    
    return {
      reply: reply,
      nextStep: 'ask_room_count'
    };
  }
  
  // 處理房間數量
  if ((session.step === 'ask_room_count' || !session.data.roomCount) && 
      cleanMessage.includes('間')) {
    session.data.roomCount = number;
    session.step = 'ask_nights';
    return {
      reply: `好的，${number}間${session.data.roomType || '房間'}。請問打算入住幾晚？`,
      nextStep: 'ask_nights'
    };
  }
  
  // 處理天數
  if ((session.step === 'ask_nights' || !session.data.nights) && 
      (cleanMessage.includes('晚') || cleanMessage.includes('天'))) {
    session.data.nights = number;
    return generateBookingSummary(session);
  }
  
  return null;
}

// ==================== 訂房意圖處理 ====================
function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('我要訂')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '🏨 **開始訂房流程**\n\n請問您想要預訂哪種房型？\n\n' +
               '• 標準雙人房 - NT$2,800/晚\n' +
               '• 豪華雙人房 - NT$3,800/晚\n' +
               '• 套房 - NT$5,800/晚\n' +
               '• 家庭房 - NT$4,500/晚',
        nextStep: 'select_room'
      };
    } else {
      return continueBookingProcess(session);
    }
  }
  
  // 房型選擇
  const roomKeywords = {
    '標準': '標準雙人房',
    '豪華': '豪華雙人房', 
    '套房': '套房',
    '家庭': '家庭房'
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

// ==================== 生成訂單摘要 (更新版) ====================
function generateBookingSummary(session) {
  const priceInfo = calculateFinalPrice(session.data);
  
  session.step = 'confirm_booking';
  
  let summary = `📋 **訂單摘要**\n\n`;
  summary += `🏨 住宿資訊\n`;
  summary += `• 房型：${session.data.roomType}\n`;
  summary += `• 房間：${session.data.roomCount || 1}間\n`;
  summary += `• 人數：${session.data.adults}位大人`;
  if (session.data.children) {
    summary += ` + ${session.data.children}位小孩`;
    if (session.data.childAge) {
      summary += ` (${session.data.childAge}歲)`;
    }
  }
  summary += `\n• 天數：${session.data.nights}晚\n`;
  
  if (session.data.checkInDate) {
    summary += `• 入住日期：${session.data.checkInDate}\n`;
  }
  if (session.data.contactPerson) {
    summary += `• 聯絡人：${session.data.contactPerson}\n`;
  }
  
  summary += `\n💰 費用估算\n`;
  if (priceInfo.extraCharges && priceInfo.extraCharges.length > 0) {
    summary += `• 額外費用：${priceInfo.extraCharges.join('、')}\n`;
  }
  summary += `• 總金額：NT$ ${priceInfo.finalPrice.toLocaleString()}\n`;
  
  summary += `\n請確認以上資訊是否正確？回覆「確認」完成訂房。`;
  
  return {
    reply: summary,
    nextStep: 'confirm_booking'
  };
}

// ==================== 預設回應 (更新版) ====================
function generateDefaultResponse(session) {
  const currentStep = session.step;
  
  const stepPrompts = {
    'welcome': '您好！我是飯店客服助手，可以幫您：\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹\n\n請問需要什麼協助呢？',
    'select_room': '請選擇房型：標準雙人房、豪華雙人房、套房、家庭房',
    'ask_guests': '請問有幾位大人入住？',
    'ask_room_count': '請問需要預訂幾間房間？',
    'ask_nights': '請問打算入住幾晚？',
    'confirm_booking': '請確認訂房資訊是否正確？',
    'complete_booking': '請提供缺少的訂房資訊',
    'child_policy': '還需要了解其他兒童政策嗎？',
    'child_policy_info': '是否需要繼續訂房流程？',
    'price_query': '是否需要預訂？',
    'price_info': '請告訴我您想查詢哪種房型？'
  };
  
  return {
    reply: stepPrompts[currentStep] || '請問需要什麼協助呢？',
    nextStep: currentStep
  };
}

// ==================== 訂房完成相關函數 (更新版) ====================
async function completeBooking(session) {
  const finalPrice = calculateFinalPrice(session.data);
  const orderNumber = generateOrderNumber();
  
  session.step = 'booking_completed';
  session.data.orderNumber = orderNumber;
  session.data.finalPrice = finalPrice.finalPrice;

  await n8nService.sendBookingConfirmation(session.data);

  return {
    reply: `🎉 **訂房完成！**\n\n📋 訂單編號: ${orderNumber}\n💰 總金額: NT$${finalPrice.finalPrice.toLocaleString()}\n🏨 房型: ${session.data.roomType}\n📅 天數: ${session.data.nights}晚\n👥 人數: ${session.data.adults}位大人${session.data.children ? ` + ${session.data.children}位小孩` : ''}\n\n感謝您的預訂！我們期待為您服務！`,
    nextStep: 'booking_completed'
  };
}

function calculateFinalPrice(bookingData) {
  if (!bookingData.roomType) return { finalPrice: 0 };
  
  const roomInfo = roomCapacityData[bookingData.roomType];
  let finalPrice = roomInfo.price * (bookingData.nights || 1) * (bookingData.roomCount || 1);
  let extraCharges = [];
  
  // 計算兒童費用
  if (bookingData.children > 0 && bookingData.childAge >= 6) {
    const childCharge = 800 * bookingData.children * bookingData.nights;
    finalPrice += childCharge;
    extraCharges.push(`兒童加床費 NT$${childCharge}`);
  } else if (bookingData.children > 0 && bookingData.childAge >= 3) {
    const childCharge = 500 * bookingData.children * bookingData.nights;
    finalPrice += childCharge;
    extraCharges.push(`兒童加床費 NT$${childCharge}`);
  }
  
  return { 
    finalPrice: Math.round(finalPrice),
    extraCharges: extraCharges
  };
}

function generateOrderNumber() {
  return `HTL${Date.now().toString().slice(-6)}`;
}

// ==================== 會話清理 ====================
function cleanupOldSessions() {
  const now = Date.now();
  const MAX_AGE = 30 * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > MAX_AGE) {
      sessions.delete(sessionId);
      console.log(`🧹 清理過期會話: ${sessionId}`);
    }
  }
}
setInterval(cleanupOldSessions, 60 * 60 * 1000);

// ==================== API 路由 ====================
app.post('/api/chat', handleChat);
app.post('/chat', handleChat);

function handleChat(req, res) {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '訊息不能為空' });
  }
  
  try {
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    session.sessionId = sessionId;
    
    console.log(`💬 收到訊息: ${message} (會話: ${sessionId})`);
    
    const response = processMessage(message, session);
    
    if (response && response.nextStep) {
      session.step = response.nextStep;
    }
    
    res.json({
      reply: response.reply,
      sessionId: sessionId,
      step: session.step,
      timestamp: new Date().toISOString(),
      n8nEnabled: n8nService.enabled
    });
    
  } catch (error) {
    console.error('❌ 處理訊息時發生錯誤:', error);
    res.status(500).json({
      reply: '抱歉，處理您的請求時發生錯誤。請稍後再試或聯繫客服。',
      sessionId: sessionId || 'unknown',
      error: true
    });
  }
}

// 會話狀態查詢
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: '會話不存在' });
  }
  
  res.json({
    sessionId,
    step: session.step,
    data: session.data,
    lastActivity: new Date(session.lastActivity).toLocaleString('zh-TW')
  });
});

// 重置會話
app.post('/api/session/:sessionId/reset', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  
  res.json({ 
    success: true,
    message: '會話已重置'
  });
});

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '端點不存在',
    availableEndpoints: [
      'POST /api/chat',
      'POST /chat',
      'GET /api/session/:sessionId', 
      'POST /api/session/:sessionId/reset',
      'GET /health',
      'GET /api/health'
    ]
  });
});

// ==================== 啟動伺服器 ====================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 飯店客服機器人已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log(`🔗 n8n 整合: ${n8nService.enabled ? '已啟用' : '未啟用'}`);
  console.log(`💾 會話管理: 自動清理機制已啟用`);
});

// 優雅關機處理
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信號，開始關機...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 信號，開始關機...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

// 未處理的異常處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未處理的異常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

module.exports = app;

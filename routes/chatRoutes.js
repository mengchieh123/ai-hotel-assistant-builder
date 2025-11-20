const express = require('express');
const router = express.Router();

console.log('🏨 加載完整功能版飯店AI助理 - 含多意圖處理');

// ==================== 多意圖分析器 ====================
class IntentAnalyzer {
  static analyze(message) {
    const lowerMessage = message.toLowerCase();
    const intents = [];
    
    // 訂房意圖
    if (lowerMessage.includes('訂房') || lowerMessage.includes('預訂') || 
        lowerMessage.includes('入住') || lowerMessage.includes('房間') ||
        /住.*晚/.test(lowerMessage) || /房型/.test(lowerMessage)) {
      intents.push('booking');
    }
    
    // 接送機意圖
    if (lowerMessage.includes('接送') || lowerMessage.includes('機場') || 
        lowerMessage.includes('接機') || lowerMessage.includes('送機') ||
        lowerMessage.includes('交通')) {
      intents.push('transfer');
    }
    
    // 餐廳推薦意圖
    if (lowerMessage.includes('餐廳') || lowerMessage.includes('推薦') || 
        lowerMessage.includes('美食') || lowerMessage.includes('吃') ||
        lowerMessage.includes('海鮮') || lowerMessage.includes('晚餐')) {
      intents.push('restaurant');
    }
    
    // 價格查詢意圖
    if (lowerMessage.includes('價格') || lowerMessage.includes('價錢') || 
        lowerMessage.includes('多少錢') || lowerMessage.includes('房價')) {
      intents.push('pricing');
    }
    
    // 會員服務意圖
    if (lowerMessage.includes('會員') || lowerMessage.includes('積分') || 
        lowerMessage.includes('優惠') || lowerMessage.includes('折扣')) {
      intents.push('member');
    }
    
    return intents;
  }
}

// ==================== 對話狀態管理器 ====================
class ConversationManager {
  constructor() {
    this.context = {
      pendingIntents: [],
      confirmedInfo: {},
      missingInfo: {},
      currentStep: 'welcome'
    };
  }
  
  addUserMessage(message, intents) {
    // 添加新意圖到待處理列表
    this.context.pendingIntents = [...new Set([...this.context.pendingIntents, ...intents])];
    
    // 更新對話步驟
    this.updateStep(intents);
  }
  
  updateStep(intents) {
    if (intents.includes('booking') && !this.context.confirmedInfo.booking) {
      this.context.currentStep = 'booking_start';
    } else if (intents.includes('transfer') && !this.context.confirmedInfo.transfer) {
      this.context.currentStep = 'transfer_inquiry';
    }
  }
  
  getNextAction() {
    if (this.context.pendingIntents.length === 0) {
      return 'ask_general';
    }
    
    // 返回優先處理的意圖
    return this.context.pendingIntents[0];
  }
  
  markIntentCompleted(intent) {
    this.context.pendingIntents = this.context.pendingIntents.filter(i => i !== intent);
    this.context.confirmedInfo[intent] = true;
  }
}

// ==================== 多意圖回應生成器 ====================
class MultiIntentResponseGenerator {
  static generate(intents, context, message) {
    let response = '';
    const lowerMessage = message.toLowerCase();
    
    // 開頭確認
    response += "感謝您的查詢！我來為您處理：\n\n";
    
    // 處理每個意圖
    intents.forEach(intent => {
      switch(intent) {
        case 'booking':
          response += this.generateBookingResponse(context, lowerMessage);
          break;
        case 'transfer':
          response += this.generateTransferResponse(context, lowerMessage);
          break;
        case 'restaurant':
          response += this.generateRestaurantResponse(context, lowerMessage);
          break;
        case 'pricing':
          response += this.generatePricingResponse(context, lowerMessage);
          break;
        case 'member':
          response += this.generateMemberResponse(context, lowerMessage);
          break;
      }
    });
    
    // 添加澄清問題
    response += this.generateClarificationQuestions(intents, context);
    
    return response;
  }
  
  static generateBookingResponse(context, message) {
    let response = "🏨 **訂房服務**\n";
    
    // 提取日期信息
    const dateMatch = message.match(/(下週[一二三四五六日]|週[一二三四五六日]|\d+\/\d+)/);
    if (dateMatch) {
      response += `• 查詢日期: ${dateMatch[1]}\n`;
    }
    
    // 提取天數信息
    const nightsMatch = message.match(/(\d+)晚/);
    if (nightsMatch) {
      response += `• 住宿天數: ${nightsMatch[1]}晚\n`;
    }
    
    response += "• 需要確認: 入住人數、房型偏好\n\n";
    
    return response;
  }
  
  static generateTransferResponse(context, message) {
    const transferUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfre2hV96gCFwawR-7B9eZbDk9wpU_JKxdcFHlw18fd72MXqw/viewform?usp=header';
    
    let response = "🚗 **機場接送服務**\n";
    response += "• 提供24小時機場接送\n";
    response += "• 費用: 單程600 TWD\n";
    response += "• 豪華轎車服務可選\n\n";
    
    // 只在明確詢問接送時顯示按鈕提示
    if (message.includes('接送') || message.includes('機場') || message.includes('接機')) {
      response += `📝 請點擊此連結預訂: ${transferUrl}\n\n`;
    }
    
    return response;
  }
  
  static generateRestaurantResponse(context, message) {
    let response = "🍽️ **餐廳推薦**\n";
    
    if (message.includes('海鮮')) {
      response += "• 🦞 港灣海鮮樓 - 步行5分鐘，新鮮現撈\n";
      response += "• 🐟 海味坊 - 步行8分鐘，創意海鮮料理\n";
      response += "• 🌊 漁人碼頭 - 車程10分鐘，海景餐廳\n\n";
    } else {
      response += "• 🍜 中式: 龍鳳廳 (粵菜)、江南春 (江浙菜)\n";
      response += "• 🍣 日式: 櫻花日本料理、壽司一番\n";
      response += "• 🥩 西式: 星空牛排館、義大利花園\n\n";
    }
    
    return response;
  }
  
  static generatePricingResponse(context, message) {
    let response = "💰 **價格資訊**\n";
    response += "• 標準雙人房: 2,200 TWD/晚\n";
    response += "• 豪華雙人房: 2,800 TWD/晚\n";
    response += "• 家庭房: 3,800 TWD/晚\n";
    response += "• 套房: 4,500 TWD/晚\n\n";
    
    return response;
  }
  
  static generateMemberResponse(context, message) {
    let response = "💎 **會員服務**\n";
    response += "• 銀卡: 房價9折 + 免費早餐\n";
    response += "• 金卡: 房價85折 + 更多權益\n";
    response += "• 白金卡: 房價8折 + 專屬服務\n\n";
    
    return response;
  }
  
  static generateClarificationQuestions(intents, context) {
    let questions = "📋 **請提供以下資訊：**\n";
    
    if (intents.includes('booking')) {
      if (!context.confirmedInfo.guests) {
        questions += "• 👥 入住人數 (幾位大人/小孩)\n";
      }
      if (!context.confirmedInfo.roomType) {
        questions += "• 🏨 偏好房型\n";
      }
    }
    
    if (intents.includes('transfer')) {
      questions += "• ✈️ 航班資訊 (航班號、時間)\n";
      questions += "• 🚗 接送類型 (接機/送機)\n";
    }
    
    questions += "\n請逐一回覆，我將為您完成所有安排！";
    
    return questions;
  }
}

// ==================== 日期處理服務 (保持不變) ====================
class DateService {
  static parseDate(input) {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    if (/今晚|今天|現在/.test(input.toLowerCase())) {
      return today.toISOString().split('T')[0];
    }
    
    if (/下週五|下星期五|下周五/.test(input.toLowerCase())) {
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      today.setDate(today.getDate() + daysUntilFriday);
      return today.toISOString().split('T')[0];
    }
    
    if (/\d{1,2}\/\d{1,2}/.test(input)) {
      const [month, day] = input.split('/').map(num => parseInt(num));
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    
    return null;
  }

  static formatDateDisplay(date) {
    const d = new Date(date);
    const options = { month: 'long', day: 'numeric' };
    return d.toLocaleDateString('zh-TW', options);
  }
}

// ==================== 會話管理 ====================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationManager: new ConversationManager(),
      step: 'welcome',
      data: {
        adults: 2,
        children: 0,
        roomCount: 1
      },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 主要回應生成器 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    
    console.log(`🔍 分析訊息: "${message}"`);
    
    // 🚀 多意圖分析
    const intents = IntentAnalyzer.analyze(message);
    console.log(`🎯 識別意圖:`, intents);
    
    // 如果有多個意圖，使用多意圖處理
    if (intents.length > 1) {
      session.conversationManager.addUserMessage(message, intents);
      const multiResponse = MultiIntentResponseGenerator.generate(
        intents, 
        session.conversationManager.context, 
        message
      );
      
      return {
        reply: multiResponse,
        step: 'multi_intent',
        sessionData: session.data,
        pendingIntents: intents
      };
    }
    
    // 🚀 單意圖處理 - 接送機服務特別處理
    if (intents.includes('transfer')) {
      const transferUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfre2hV96gCFwawR-7B9eZbDk9wpU_JKxdcFHlw18fd72MXqw/viewform?usp=header';
      
      return {
        reply: `🚗 **機場接送服務**\n\n我們提供專業的機場接送服務：\n\n• 🕐 24小時服務\n• 💰 單程費用: 600 TWD\n• 🚙 車型: 舒適轎車 / 豪華商務車\n• 👨‍✈️ 專業司機，準時可靠\n\n📝 請點擊連結填寫預訂表單：\n${transferUrl}\n\n如需協助預訂，請提供：\n• ✈️ 航班號碼\n• 🕒 抵達/出發時間\n• 👥 乘客人數`,
        step: 'transfer_service',
        sessionData: session.data
      };
    }
    
    // 🚀 其他單意圖處理 (保持原有邏輯)
    let reply = '';
    
    switch (session.step) {
      case 'welcome':
        if (intents.includes('booking')) {
          session.step = 'guests';
          reply = '🏨 **歡迎使用訂房服務！**\n\n請問有幾位旅客？\n例如："2位大人" 或 "2大1小"';
        } else {
          reply = '🤖 **我是飯店智能助理**\n\n我可以為您提供：\n🏨 訂房服務 • 🚗 接送機服務\n🍽️ 餐廳推薦 • 💰 價格查詢\n💎 會員服務 • 🏠 設施詢問\n\n請告訴我您的需求！';
        }
        break;

      case 'guests':
        const guestInfo = this.extractGuestInfo(message);
        if (guestInfo.found) {
          Object.assign(session.data, guestInfo);
          session.step = 'room';
          const roomRec = this.getRoomRecommendation(guestInfo.adults, guestInfo.children);
          reply = `👨‍👩‍👧‍👦 **已記錄：${guestInfo.adults}位大人${guestInfo.children > 0 ? `, ${guestInfo.children}位小朋友` : ''}**\n\n` +
                 `🏨 **適合的房型推薦**\n\n${roomRec}\n\n請選擇您喜歡的房型：`;
        } else {
          reply = '請告訴我入住人數，例如："3位大人" 或 "2大1小"';
        }
        break;

      // ... 其他步驟保持不變
      
      default:
        session.step = 'welcome';
        reply = '請問需要什麼服務？';
        break;
    }

    return { 
      reply, 
      step: session.step, 
      sessionData: session.data,
      pendingIntents: intents 
    };
  }

  static extractGuestInfo(message) {
    const lowerMessage = message.toLowerCase();
    const patterns = [
      /(\d+)[位個]?大?人.*?(\d+)[位個]?小?孩?/,
      /(\d+)大.*?(\d+)小/,
      /(\d+)[位個]?大?人/,
      /(\d+)大/
    ];
    
    for (const pattern of patterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        let adults = parseInt(match[1]) || 2;
        let children = match[2] ? parseInt(match[2]) || 0 : 0;
        return { found: true, adults, children, childrenAges: [] };
      }
    }
    
    return { found: false, adults: 2, children: 0, childrenAges: [] };
  }

  static getRoomRecommendation(adults, children) {
    const totalGuests = adults + children;
    
    if (totalGuests <= 2) {
      return `🛏️ **標準雙人房**\n• 適合1-2人 • 2,200 TWD/晚\n\n` +
             `🌟 **豪華雙人房**\n• 更大空間 • 2,800 TWD/晚`;
    } 
    else if (totalGuests === 3) {
      return `🏠 **家庭房**\n• 專為3人設計 • 3,800 TWD/晚\n\n` +
             `🌟 **豪華雙人房**\n• 可加床 • 2,800 TWD/晚+500`;
    }
    else if (totalGuests >= 4) {
      return `🏠 **家庭房**\n• 適合家庭 • 3,800 TWD/晚\n\n` +
             `💎 **套房**\n• 最舒適選擇 • 4,500 TWD/晚`;
    }
  }
}

// ==================== 路由處理 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '訊息內容不能為空'
      });
    }

    console.log('💬 收到訊息:', { message, sessionId });

    const session = getOrCreateSession(sessionId);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('📊 回應結果:', { 
      sessionId, 
      step: session.step, 
      intents: response.pendingIntents 
    });

    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      nextStep: response.step,
      pendingIntents: response.pendingIntents || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '系統忙碌中，請稍後重試'
    });
  }
});

module.exports = router;

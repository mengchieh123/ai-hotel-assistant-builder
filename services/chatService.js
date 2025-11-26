const express = require('express');
const router = express.Router();
const OpenCC = require('opencc');
const converter = new OpenCC('s2t.json'); // 簡體轉繁體

console.log('🏨 加載完整功能版飯店AI助理 - 含多意圖處理和日期識別');

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
    
    // 🎯 新增：日期輸入意圖
    if (this.containsDatePatterns(message)) {
      intents.push('date_input');
    }
    
    return intents;
  }

  // 🆕 新增日期模式檢測方法
  static containsDatePatterns(message) {
    const datePatterns = [
      /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,    // 11/27-11/28
      /\d{1,2}\/\d{1,2}/,                     // 11/27
      /\d{1,2}月\d{1,2}日/,                   // 11月27日
      /\d{1,2}月\d{1,2}號/,                   // 11月27號
      /明天|後天|週末|下週|月底/
    ];
    return datePatterns.some(pattern => pattern.test(message));
  }
}

// ==================== 對話狀態管理器 ====================
class ConversationManager {
  constructor() {
    this.context = {
      pendingIntents: [],
      confirmedInfo: {},
      missingInfo: {},
      currentStep: 'welcome',
      bookingFlow: false
    };
  }
  
  addUserMessage(message, intents) {
    // 添加新意圖到待處理列表
    this.context.pendingIntents = [...new Set([...this.context.pendingIntents, ...intents])];
    
    // 更新對話步驟
    this.updateStep(intents, message);
  }
  
  updateStep(intents, message) {
    // 🎯 新增：如果收到日期輸入且在訂房流程中，更新步驟
    if (intents.includes('date_input') && this.context.bookingFlow) {
      this.context.currentStep = 'booking_date_received';
      return;
    }
    
    if (intents.includes('booking') && !this.context.confirmedInfo.booking) {
      this.context.currentStep = 'booking_start';
      this.context.bookingFlow = true;
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

  // 🆕 新增：處理日期輸入
  handleDateInput(dateMessage) {
    let dateInfo = "📅 ";
    
    // 解析日期格式 11/27-11/28
    const rangeMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/);
    if (rangeMatch) {
      const [_, startMonth, startDay, endMonth, endDay] = rangeMatch;
      const nights = (parseInt(endDay) - parseInt(startDay)) || 1;
      dateInfo += `好的！${startMonth}/${startDay} 到 ${endMonth}/${endDay}，共 ${nights} 晚住宿。`;
      this.context.confirmedInfo.checkInDate = `${startMonth}/${startDay}`;
      this.context.confirmedInfo.nights = nights;
    }
    // 解析單一日期 11/27
    else if (/\d{1,2}\/\d{1,2}/.test(dateMessage)) {
      const dateMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})/);
      if (dateMatch) {
        dateInfo += `收到入住日期 ${dateMatch[0]}！請問住幾晚？`;
        this.context.confirmedInfo.checkInDate = dateMatch[0];
      }
    }
    // 其他日期格式
    else {
      dateInfo += `收到您的日期資訊！`;
    }
    
    return dateInfo;
  }

  // 🆕 新增：檢查是否在訂房流程中
  isInBookingFlow() {
    return this.context.bookingFlow || 
           this.context.pendingIntents.includes('booking') ||
           this.context.currentStep.includes('booking');
  }
}

// ==================== 多意圖回應生成器 ====================
class MultiIntentResponseGenerator {
  static generate(intents, context, message) {
    let response = "";
    
    // 🎯 新增：優先處理日期輸入
    if (intents.includes('date_input') && context.isInBookingFlow()) {
      const dateResponse = context.handleDateInput(message);
      response += dateResponse + "\n\n";
      
      // 移除日期意圖，避免重複處理
      intents = intents.filter(i => i !== 'date_input');
      context.markIntentCompleted('date_input');
      
      // 如果還有其他意圖，繼續處理
      if (intents.length > 0) {
        response += "另外，";
      }
    }
    
    // 開頭確認（如果還沒有回應）
    if (!response.includes("好的！") && !response.includes("收到")) {
      response += "感謝您的查詢！我來為您處理：\n\n";
    }
    
    // 處理每個意圖
    intents.forEach(intent => {
      switch(intent) {
        case 'booking':
          response += this.generateBookingResponse(context, message);
          break;
        case 'transfer':
          response += this.generateTransferResponse(context, message);
          break;
        case 'restaurant':
          response += this.generateRestaurantResponse(context, message);
          break;
        case 'pricing':
          response += this.generatePricingResponse(context, message);
          break;
        case 'member':
          response += this.generateMemberResponse(context, message);
          break;
        case 'date_input':
          // 單獨的日期輸入，不在訂房流程中
          response += "📅 收到您的日期資訊！請問您需要什麼服務？訂房還是查詢空房？\n\n";
          break;
      }
    });
    
    // 添加澄清問題
    response += this.generateClarificationQuestions(intents, context);
    
    return response;
  }
  
  static generateBookingResponse(context, message) {
    let response = "🏨 **訂房服務**\n";
    
    // 如果有確認的日期資訊，顯示出來
    if (context.confirmedInfo.checkInDate) {
      response += `• 查詢日期: ${context.confirmedInfo.checkInDate}\n`;
      if (context.confirmedInfo.nights) {
        response += `• 住宿天數: ${context.confirmedInfo.nights}晚\n`;
      }
    } else {
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
      if (!context.confirmedInfo.checkInDate) {
        questions += "• 📅 入住日期\n";
      }
      if (!context.confirmedInfo.nights && !context.confirmedInfo.checkInDate?.includes('-')) {
        questions += "• ⏱️ 住宿天數\n";
      }
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
    
    // 🎯 新增：如果已經有日期資訊，調整問題順序
    if (context.confirmedInfo.checkInDate && context.confirmedInfo.nights) {
      questions = "📋 **請提供以下資訊完成訂房：**\n" +
                 "• 👥 入住人數 (幾位大人/小孩)\n" +
                 "• 🏨 偏好房型\n";
    }
    
    questions += "\n請逐一回覆，我將為您完成所有安排！";
    
    return questions;
  }
}

// ==================== 智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();

    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價格資訊：\n` +
        `• 標準雙人房：2,200 TWD/晚\n` +
        `• 豪華雙人房：2,800 TWD/晚\n` +
        `• 套房：4,500 TWD/晚\n` +
        `• 以上價格已含服務費及稅金\n` +
        `• 會員可享額外折扣`;
    }

    // 接送機相關問題
    if (/接送|機場|接機|送機|交通/.test(lowerMessage)) {
      const transferUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfre2hV96gCFwawR-7B9eZbDk9wpU_JKxdcFHlw18fd72MXqw/viewform?usp=header';
      return `🚗 **機場接送服務**\n\n` +
        `我們提供專業的機場接送服務：\n\n` +
        `• 🕐 24小時服務\n` +
        `• 💰 單程費用: 600 TWD\n` +
        `• 🚙 車型: 舒適轎車 / 豪華商務車\n` +
        `• 👨‍✈️ 專業司機，準時可靠\n\n` +
        `📝 請點擊連結填寫預訂表單：\n${transferUrl}\n\n` +
        `如需協助預訂，請提供：\n` +
        `• ✈️ 航班號碼\n` +
        `• 🕒 抵達/出發時間\n` +
        `• 👥 乘客人數`;
    }

    // 餐廳推薦相關問題
    if (/餐廳|推薦|美食|吃|海鮮|晚餐/.test(lowerMessage)) {
      let response = "🍽️ **餐廳推薦**\n\n";
      if (lowerMessage.includes('海鮮')) {
        response += "🦞 **海鮮餐廳推薦**：\n" +
          "• 港灣海鮮樓 - 步行5分鐘，新鮮現撈\n" +
          "• 海味坊 - 步行8分鐘，創意海鮮料理\n" +
          "• 漁人碼頭 - 車程10分鐘，海景餐廳\n\n";
      } else {
        response += "🍴 **各類餐廳推薦**：\n" +
          "• 中式: 龍鳳廳 (粵菜)、江南春 (江浙菜)\n" +
          "• 日式: 櫻花日本料理、壽司一番\n" +
          "• 西式: 星空牛排館、義大利花園\n\n";
      }
      return response;
    }

    return null;
  }
}

// ==================== 會話管理 ====================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationManager: new ConversationManager(),
      step: 'init',
      data: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 價格計算服務 ====================
const pricingService = {
  calculateRoomPrice(roomType, nights = 1, guestCount = 2, memberLevel = 'none') {
    const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
    const basePrice = (rates[roomType] || rates.standard) * nights;
    const extraGuestFee = guestCount > 2 ? (guestCount - 2) * 500 * nights : 0;

    const discountRates = { none: 0, silver: 0.05, gold: 0.1, platinum: 0.15 };
    const discount = discountRates[memberLevel] || 0;
    const discountAmount = basePrice * discount;

    const subtotal = basePrice + extraGuestFee;
    const totalPrice = subtotal - discountAmount;

    return {
      basePrice,
      extraGuestFee,
      subtotal,
      discountRate: discount * 100,
      discountAmount,
      totalPrice,
      currency: 'TWD'
    };
  }
};

// ==================== 需求檢測服務 ====================
class RequirementDetector {
  static async detectAllRequirements(message) {
    return {
      symbolCount: {
        count: (message.match(/[.!?,;:!！？，；：]/g) || []).length,
        level: 'normal'
      },
      accessible: {
        required: /(無障礙|殘障|輪椅|行動不便)/i.test(message)
      },
      family: {
        children: /(小孩|兒童|孩子|小朋友|嬰兒)/i.test(message),
        extraBed: /(加床|嬰兒床)/i.test(message)
      },
      service: {
        parking: /(停車|車位)/i.test(message),
        breakfast: /(早餐|用餐)/i.test(message),
        transfer: /(接送|機場|接機|送機)/i.test(message)
      }
    };
  }
}

// ==================== 提取入住日期與住宿晚數 ====================
function extractDateAndNights(message) {
  const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
  const nightsMatch = message.match(/共?(\d+)晚/);

  return {
    checkInDate: dateMatch ? dateMatch[0] : null,
    nights: nightsMatch ? parseInt(nightsMatch[1]) : null
  };
}

// ==================== 意圖與槽位偵測 ====================
async function detectIntentAndEntities(message) {
  const traditionalMsg = await converter.convertPromise(message);

  let intent = 'general_inquiry';
  let entities = {};

  if (/標準雙人房|豪華雙人房|套房/.test(traditionalMsg)) {
    intent = 'select_room_type';
    const match = traditionalMsg.match(/標準雙人房|豪華雙人房|套房/);
    entities.roomType = match ? match[0] : null;
  } else if (/訂房|預訂|預定/.test(traditionalMsg)) {
    intent = 'book_room';
  } else if (/優惠|折扣|促銷/.test(traditionalMsg)) {
    intent = 'ask_promotion';
  } else if (/取消|退訂/.test(traditionalMsg)) {
    intent = 'cancel_booking';
  } else if (/\d{4}-\d{2}-\d{2}/.test(traditionalMsg) && /共?\d+晚/.test(traditionalMsg)) {
    intent = 'check_availability';
    const { checkInDate, nights } = extractDateAndNights(traditionalMsg);
    entities.checkInDate = checkInDate;
    entities.nights = nights;
  } else if (/接送|機場|接機|送機/.test(traditionalMsg)) {
    intent = 'airport_transfer';
  } else if (/餐廳|美食|推薦/.test(traditionalMsg)) {
    intent = 'restaurant_recommendation';
  }

  return { intent, entities };
}

// ==================== 回應生成器 ====================
class ResponseGenerator {
  static async generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    console.log(`🔍 分析訊息: "${message}"`);
    
    // 🚀 多意圖分析
    const intents = IntentAnalyzer.analyze(message);
    console.log(`🎯 識別意圖:`, intents);
    
    // 如果有多個意圖，使用多意圖處理
    if (intents.length > 1 || (intents.length === 1 && intents.includes('date_input') && session.conversationManager.isInBookingFlow())) {
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
        sessionData: session.data,
        pendingIntents: intents
      };
    }

    let reply = '';

    // 先偵測意圖與槽位
    const { intent, entities } = await detectIntentAndEntities(message);

    switch (session.step) {
      case 'init':
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          break;
        }
        if (intent === 'check_availability' && entities.checkInDate && entities.nights) {
          session.data.checkInDate = entities.checkInDate;
          session.data.nights = entities.nights;
          session.step = 'guests';
          reply = `您想查詢${entities.checkInDate}起住${entities.nights}晚，請問有幾位旅客？`;
          break;
        }
        if (intent === 'select_room_type') {
          session.data.roomType = entities.roomType;
          session.step = 'date';
          reply = `您選擇的是 ${entities.roomType}，請告訴我入住日期（格式：YYYY-MM-DD）`;
          break;
        }
        if (intent === 'airport_transfer') {
          const transferUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfre2hV96gCFwawR-7B9eZbDk9wpU_JKxdcFHlw18fd72MXqw/viewform?usp=header';
          reply = `🚗 **機場接送服務**\n\n我們提供專業的機場接送服務：\n\n• 🕐 24小時服務\n• 💰 單程費用: 600 TWD\n• 🚙 車型: 舒適轎車 / 豪華商務車\n\n📝 請點擊連結填寫預訂表單：\n${transferUrl}`;
          break;
        }
        if (intent === 'restaurant_recommendation') {
          reply = `🍽️ **餐廳推薦**\n\n` +
            `🦞 **海鮮餐廳**：\n` +
            `• 港灣海鮮樓 - 步行5分鐘\n` +
            `• 海味坊 - 步行8分鐘\n` +
            `• 漁人碼頭 - 車程10分鐘\n\n` +
            `🍴 **其他推薦**：\n` +
            `• 龍鳳廳 (粵菜)\n` +
            `• 櫻花日本料理\n` +
            `• 星空牛排館`;
          break;
        }
        reply = '您好，歡迎使用 AI 訂房助理！我可以協助您：\n\n🏨 訂房服務 • 🚗 接送機服務\n🍽️ 餐廳推薦 • 💰 價格查詢\n💎 會員服務\n\n請問需要什麼幫助？';
        break;

      case 'date':
        const { checkInDate, nights } = extractDateAndNights(message);
        if (checkInDate && nights) {
          session.data.checkInDate = checkInDate;
          session.data.nights = nights;
          session.step = 'guests';
          reply = `已記錄入住日期：${checkInDate}，入住${nights}晚。請問有幾位旅客？`;
        } else if (dateRegex.test(message)) {
          session.data.checkInDate = message;
          session.step = 'nights';
          reply = '入住日期已記錄。請問您要入住幾晚？';
        } else {
          reply = '請輸入正確格式的入住日期，例如 2024-12-25，或提供「2024-12-25 共3晚」這樣的格式。';
        }
        break;

      case 'nights':
        const nightsInput = parseInt(message);
        if (nightsInput > 0 && nightsInput <= 30) {
          session.data.nights = nightsInput;
          session.step = 'guests';
          reply = '請問有幾位旅客？';
        } else {
          reply = '請輸入有效的住宿天數（1-30天）';
        }
        break;

      case 'guests':
        const guests = parseInt(message);
        if (guests > 0 && guests <= 6) {
          session.data.guestCount = guests;
          session.step = 'confirm';

          const priceResult = pricingService.calculateRoomPrice(
            session.data.roomType === '豪華雙人房' ? 'deluxe' :
            session.data.roomType === '套房' ? 'suite' : 'standard',
            session.data.nights, session.data.guestCount
          );
          session.data.totalPrice = priceResult.totalPrice;
          reply =
            `📋 **訂單摘要**\n\n` +
            `👥 旅客數：${guests}位\n` +
            `🏨 房型：${session.data.roomType}\n` +
            `📅 入住：${session.data.checkInDate}\n` +
            `⏱️ 住宿：${session.data.nights}晚\n` +
            `💰 總價：${priceResult.totalPrice} TWD\n\n` +
            `請回覆「確認」完成訂房，或「取消」重新開始。`;
        } else {
          reply = '請輸入有效的旅客人數（1-6位）';
        }
        break;

      case 'confirm':
        if (/確認|是的|確定|ok|yes/.test(lowerMessage)) {
          session.step = 'completed';
          reply = `🎉 訂房成功！感謝使用 AI 訂房助理。`;
        } else if (/取消|不要了|重新開始/.test(lowerMessage)) {
          session.step = 'init';
          session.data = {};
          reply = '訂房已取消，請問還需要什麼服務？';
        } else {
          reply = '請回覆「確認」完成訂房，或「取消」重新開始。';
        }
        break;

      case 'completed':
        reply = '您的訂單已完成，如需其他服務請告訴我！';
        break;

      default:
        session.step = 'init';
        reply = '會話重置，請問需要什麼服務？';
        break;
    }

    return { 
      reply, 
      step: session.step, 
      sessionData: session.data,
      pendingIntents: intents 
    };
  }
}

// ==================== 聊天路由 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: '訊息內容不能為空',
        suggestion: '請提供您的查詢或需求'
      });
    }

    const session = getOrCreateSession(sessionId);
    const requirements = await RequirementDetector.detectAllRequirements(message);
    const response = await ResponseGenerator.generateResponse(message, session);

    sessions.set(sessionId, session);

    res.json({
      success: true,
      reply: response.reply,
      sessionId,
      step: response.step,
      pendingIntents: response.pendingIntents || [],
      requirements: requirements.family.children ? {
        summary: {
          hasSpecialRequirements: true,
          mainPoints: ['兒童相關'],
          requirementCount: 1
        },
        details: requirements
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('聊天服務錯誤:', error);
    res.status(500).json({
      error: '處理您的請求時出現錯誤',
      suggestion: '請稍後重試或聯繫客服'
    });
  }
});

// ==================== 健康檢查 ====================
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '5.1',
    timestamp: new Date().toISOString(),
    features: [
      'multi_intent_processing',
      'airport_transfer_service',
      'restaurant_recommendation',
      'smart_qa_service',
      'booking_workflow',
      'family_travel_detection',
      'session_management',
      'date_pattern_recognition' // 🆕 新增功能
    ],
    activeSessions: sessions.size
  });
});

// ==================== 過期會話清理 ====================
setInterval(() => {
  const now = new Date();
  const expirationTime = 30 * 60 * 1000; // 30分鐘
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const sessionTime = new Date(session.lastActive);
    if (now - sessionTime > expirationTime) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🗑️ 清理了 ${cleanedCount} 個過期會話`);
  }
}, 60 * 60 * 1000); // 每小時清理一次

module.exports = router;

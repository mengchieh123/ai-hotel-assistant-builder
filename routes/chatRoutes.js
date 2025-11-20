const express = require('express');
const router = express.Router();
const OpenCC = require('opencc');
const converter = new OpenCC('s2t.json'); // 簡體轉繁體

console.log('🏨 加載完整功能版飯店AI助理 - 含多意圖處理');

// ==================== 智能意圖分類器 ====================
class SmartIntentClassifier {
  static classify(message) {
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

    // 新增：周邊景點意圖
    if (lowerMessage.includes('景點') || lowerMessage.includes('觀光') || 
        lowerMessage.includes('好玩') || lowerMessage.includes('旅遊') ||
        lowerMessage.includes('推薦') && lowerMessage.includes('地方')) {
      intents.push('attractions');
    }
    
    // 新增：購物意圖
    if (lowerMessage.includes('購物') || lowerMessage.includes('夜市') || 
        lowerMessage.includes('商店') || lowerMessage.includes('超市') ||
        lowerMessage.includes('便利商店')) {
      intents.push('shopping');
    }
    
    // 新增：醫療服務意圖
    if (lowerMessage.includes('醫院') || lowerMessage.includes('醫療') || 
        lowerMessage.includes('診所') || lowerMessage.includes('醫生') ||
        lowerMessage.includes('藥局')) {
      intents.push('medical');
    }
    
    // 新增：設施服務意圖
    if (lowerMessage.includes('設施') || lowerMessage.includes('泳池') || 
        lowerMessage.includes('健身房') || lowerMessage.includes('spa') ||
        lowerMessage.includes('按摩')) {
      intents.push('facilities');
    }

    return intents.length > 0 ? intents : ['general_inquiry'];
  }

  // 新增：用戶類型識別
  static detectUserType(message, conversationHistory = []) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('家庭') || lowerMessage.includes('小孩') || 
        lowerMessage.includes('兒童') || lowerMessage.includes('親子')) {
      return 'family';
    } else if (lowerMessage.includes('團體') || lowerMessage.includes('大型') || 
               lowerMessage.includes('多人') || lowerMessage.includes('公司')) {
      return 'group';
    } else if (lowerMessage.includes('商務') || lowerMessage.includes('會議') || 
               lowerMessage.includes('出差')) {
      return 'business';
    } else if (lowerMessage.includes('情侶') || lowerMessage.includes('夫妻') || 
               lowerMessage.includes('蜜月')) {
      return 'couple';
    }
    
    return 'individual';
  }
}

// ==================== 會話狀態管理器 ====================
class AdvancedSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        currentStep: 'welcome',
        userType: 'unknown',
        askedTopics: [],
        conversationHistory: [],
        userPreferences: {},
        pendingActions: [],
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
    }
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId, message, intents) {
    const session = this.getSession(sessionId);
    
    // 更新會話活動時間
    session.lastActive = new Date().toISOString();
    
    // 更新對話歷史
    session.conversationHistory.push({
      message,
      intents,
      timestamp: new Date().toISOString(),
      userType: SmartIntentClassifier.detectUserType(message, session.conversationHistory)
    });

    // 更新用戶類型
    session.userType = SmartIntentClassifier.detectUserType(message, session.conversationHistory);
    
    // 更新詢問過的話題
    intents.forEach(intent => {
      if (!session.askedTopics.includes(intent)) {
        session.askedTopics.push(intent);
      }
    });

    // 限制歷史記錄長度
    if (session.conversationHistory.length > 10) {
      session.conversationHistory = session.conversationHistory.slice(-10);
    }

    return session;
  }

  getSessionSummary(sessionId) {
    const session = this.getSession(sessionId);
    return {
      userType: session.userType,
      askedTopics: session.askedTopics,
      conversationLength: session.conversationHistory.length,
      lastActive: session.lastActive
    };
  }
}

// ==================== 增強型回應生成器 ====================
class EnhancedResponseGenerator {
  static generateResponse(intents, session, originalMessage) {
    // 如果有多個意圖，使用多意圖處理
    if (intents.length > 1) {
      return this.generateMultiIntentResponse(intents, session, originalMessage);
    }

    // 單意圖處理
    const intent = intents[0];
    switch(intent) {
      case 'booking':
        return this.generateBookingResponse(session, originalMessage);
      case 'transfer':
        return this.generateTransferResponse(session, originalMessage);
      case 'restaurant':
        return this.generateRestaurantResponse(session, originalMessage);
      case 'pricing':
        return this.generatePricingResponse(session, originalMessage);
      case 'member':
        return this.generateMemberResponse(session, originalMessage);
      case 'attractions':
        return this.generateAttractionsResponse(session, originalMessage);
      case 'shopping':
        return this.generateShoppingResponse(session, originalMessage);
      case 'medical':
        return this.generateMedicalResponse(session, originalMessage);
      case 'facilities':
        return this.generateFacilitiesResponse(session, originalMessage);
      default:
        return this.generateGeneralResponse(session, originalMessage);
    }
  }

  static generateMultiIntentResponse(intents, session, message) {
    let response = "感謝您的查詢！我來為您詳細介紹：\n\n";
    
    intents.forEach(intent => {
      switch(intent) {
        case 'booking':
          response += this.generateBookingResponse(session, message, true);
          break;
        case 'transfer':
          response += this.generateTransferResponse(session, message, true);
          break;
        case 'restaurant':
          response += this.generateRestaurantResponse(session, message, true);
          break;
        case 'pricing':
          response += this.generatePricingResponse(session, message, true);
          break;
        case 'member':
          response += this.generateMemberResponse(session, message, true);
          break;
        case 'attractions':
          response += this.generateAttractionsResponse(session, message, true);
          break;
        case 'shopping':
          response += this.generateShoppingResponse(session, message, true);
          break;
        case 'medical':
          response += this.generateMedicalResponse(session, message, true);
          break;
        case 'facilities':
          response += this.generateFacilitiesResponse(session, message, true);
          break;
      }
    });

    // 添加智能建議
    response += this.generateSmartSuggestions(intents, session);

    return response;
  }

  static generateBookingResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🏨 **訂房服務**\n" : "";
    
    let response = prefix;
    const lowerMessage = message.toLowerCase();

    // 提取日期信息
    const dateMatch = message.match(/(下週[一二三四五六日]|週[一二三四五六日]|\d+\/\d+|\d+月\d+日)/);
    if (dateMatch) {
      response += `• 查詢日期: ${dateMatch[1]}\n`;
    }

    // 提取天數信息
    const nightsMatch = message.match(/(\d+)晚/);
    if (nightsMatch) {
      response += `• 住宿天數: ${nightsMatch[1]}晚\n`;
    }

    // 根據用戶類型提供建議
    if (session.userType === 'family') {
      response += "• 推薦房型: 家庭房 (可容納2大2小)\n";
      response += "• 親子設施: 兒童遊樂區、嬰兒床租借\n";
    } else if (session.userType === 'group') {
      response += "• 團體優惠: 10人以上享85折\n";
      response += "• 推薦服務: 會議室租借、團體接送\n";
    }

    response += "• 需要確認: 入住人數、房型偏好\n";

    if (!isMultiIntent) {
      response += "\n請告訴我：\n• 👥 入住人數\n• 🏨 偏好房型\n• 📅 入住日期";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateTransferResponse(session, message, isMultiIntent = false) {
    const transferUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfre2hV96gCFwawR-7B9eZbDk9wpU_JKxdcFHlw18fd72MXqw/viewform?usp=header';
    const prefix = isMultiIntent ? "🚗 **機場接送服務**\n" : "";
    
    let response = prefix;
    response += "• 提供24小時機場接送\n";
    response += "• 費用: 單程600 TWD\n";
    response += "• 豪華轎車服務可選\n";

    // 只在明確詢問接送時顯示按鈕提示
    if (message.includes('接送') || message.includes('機場') || message.includes('接機')) {
      response += `• 預訂連結: ${transferUrl}\n`;
    }

    if (!isMultiIntent) {
      response += `\n📝 請點擊連結預訂: ${transferUrl}\n`;
      response += "\n如需協助，請提供：\n• ✈️ 航班資訊\n• 🕒 接送時間\n• 👥 乘客人數";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateRestaurantResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🍽️ **餐廳推薦**\n" : "";
    
    let response = prefix;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('海鮮')) {
      response += "• 🦞 港灣海鮮樓 - 步行5分鐘，新鮮現撈\n";
      response += "• 🐟 海味坊 - 步行8分鐘，創意海鮮料理\n";
      response += "• 🌊 漁人碼頭 - 車程10分鐘，海景餐廳\n";
    } else {
      response += "• 🍜 中式: 龍鳳廳 (粵菜)、江南春 (江浙菜)\n";
      response += "• 🍣 日式: 櫻花日本料理、壽司一番\n";
      response += "• 🥩 西式: 星空牛排館、義大利花園\n";
    }

    if (session.userType === 'family') {
      response += "• 👨‍👩‍👧‍👦 親子友善: 歡樂家庭餐廳 (兒童餐免費)\n";
    }

    if (!isMultiIntent) {
      response += "\n需要我幫您：\n• 📞 代為訂位\n• 🗺️ 提供地圖路線\n• 💰 查詢價格";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateAttractionsResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🏞️ **景點推薦**\n" : "";
    
    let response = prefix;

    if (session.userType === 'family') {
      response += "👨‍👩‍👧‍👦 **親子景點**:\n";
      response += "• 🎠 兒童樂園 - 車程15分鐘，適合各年齡層\n";
      response += "• 🐯 動物園 - 車程20分鐘，教育與娛樂兼具\n";
      response += "• 🌳 自然公園 - 步行10分鐘，免費入場\n";
    } else {
      response += "📸 **熱門景點**:\n";
      response += "• 🏛️ 歷史博物館 - 步行15分鐘\n";
      response += "• 🎨 藝術特區 - 車程10分鐘，文青必訪\n";
      response += "• 🌃 觀景台 - 車程25分鐘，夜景絕佳\n";
    }

    response += "• 🕒 建議遊玩時間: 2-4小時\n";
    response += "• 💰 門票: 大部分景點免費或低價\n";

    if (!isMultiIntent) {
      response += "\n需要：\n• 🗺️ 詳細路線規劃\n• 🎫 票券代訂服務\n• 🚗 交通安排";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateShoppingResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🛍️ **購物資訊**\n" : "";
    
    let response = prefix;
    response += "• 🏪 24小時便利商店 - 步行3分鐘\n";
    response += "• 🛒 大型超市 - 步行8分鐘，生鮮齊全\n";
    response += "• 🎪 夜市 - 車程15分鐘，18:00-24:00\n";
    response += "• 🏬 購物中心 - 車程20分鐘，品牌齊全\n";

    if (!isMultiIntent) {
      response += "\n服務包括：\n• 🗺️ 購物地圖\n• 🚗 購物專車接送\n• 💰 特價資訊提供";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateMedicalResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🏥 **醫療服務**\n" : "";
    
    let response = prefix;
    response += "• ⚕️ 24小時診所 - 步行10分鐘\n";
    response += "• 🏥 綜合醫院 - 車程15分鐘，急診服務\n";
    response += "• 💊 藥局 - 步行5分鐘，9:00-22:00\n";
    response += "• 🆘 緊急聯絡: 119 (救護車)\n";

    if (!isMultiIntent) {
      response += "\n飯店提供：\n• 🎗️ 基本急救設備\n• 📞 醫療機構代為聯絡\n• 🚗 緊急就醫交通協助";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateFacilitiesResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "🏊 **飯店設施**\n" : "";
    
    let response = prefix;
    response += "• 🏊 露天泳池 - 08:00-22:00 (免費)\n";
    response += "• 💪 健身房 - 06:00-23:00 (免費)\n";
    response += "• 🧖 SPA水療 - 10:00-21:00 (預約制)\n";
    response += "• 📚 商務中心 - 24小時開放\n";

    if (session.userType === 'family') {
      response += "• 🎠 兒童遊戲室 - 09:00-20:00\n";
    }

    if (!isMultiIntent) {
      response += "\n可預約：\n• 💆 SPA療程\n• 🏋️ 私人教練\n• 🎯 設施使用指導";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generatePricingResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "💰 **價格資訊**\n" : "";
    
    let response = prefix;
    response += "• 標準雙人房: 2,200 TWD/晚\n";
    response += "• 豪華雙人房: 2,800 TWD/晚\n";
    response += "• 家庭房: 3,800 TWD/晚\n";
    response += "• 套房: 4,500 TWD/晚\n";

    if (!isMultiIntent) {
      response += "\n💡 提示：\n• 以上價格含服務費及稅金\n• 會員享額外折扣\n• 連續住宿有優惠";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateMemberResponse(session, message, isMultiIntent = false) {
    const prefix = isMultiIntent ? "💎 **會員服務**\n" : "";
    
    let response = prefix;
    response += "• 銀卡: 房價9折 + 免費早餐\n";
    response += "• 金卡: 房價85折 + 專屬禮遇\n";
    response += "• 白金卡: 房價8折 + 管家服務\n";

    if (!isMultiIntent) {
      response += "\n立即加入享：\n• 🎁 迎賓禮物\n• 🔄 彈性取消\n• 🆙 免費房型升級機會";
    }

    return isMultiIntent ? response + "\n" : response;
  }

  static generateGeneralResponse(session, message) {
    return `您好！我是飯店AI助理，可以協助您：\n\n` +
      `🏨 訂房服務 • 🚗 接送服務 • 🍽️ 餐廳推薦\n` +
      `🏞️ 景點導覽 • 🛍️ 購物資訊 • 💰 價格查詢\n` +
      `🏥 醫療協助 • 🏊 設施使用 • 💎 會員服務\n\n` +
      `請告訴我您需要什麼協助？`;
  }

  static generateSmartSuggestions(intents, session) {
    const allIntents = ['booking', 'transfer', 'restaurant', 'attractions', 'shopping', 'facilities'];
    const unusedIntents = allIntents.filter(intent => !intents.includes(intent));
    
    if (unusedIntents.length === 0) return "";

    let suggestions = "\n💡 **您可能還會想知道**:\n";
    const suggestionMap = {
      'booking': "• 🏨 訂房流程與優惠",
      'transfer': "• 🚗 交通與接送服務", 
      'restaurant': "• 🍽️ 更多美食推薦",
      'attractions': "• 🏞️ 周邊景點介紹",
      'shopping': "• 🛍️ 購物指南",
      'facilities': "• 🏊 飯店設施使用"
    };

    unusedIntents.slice(0, 3).forEach(intent => {
      if (suggestionMap[intent]) {
        suggestions += suggestionMap[intent] + "\n";
      }
    });

    return suggestions;
  }
}

// ==================== 初始化會話管理器 ====================
const sessionManager = new AdvancedSessionManager();

// ==================== 保持你現有的所有函數不變 ====================
// 這裡保留你原有的所有類別和函數，包括：
// - IntentAnalyzer
// - ConversationManager  
// - MultiIntentResponseGenerator
// - QAService
// - RequirementDetector
// - 價格計算服務
// - 意圖與槽位偵測
// - 原有的 ResponseGenerator

// ==================== 智能聊天處理器 ====================
class SmartChatProcessor {
  static async processMessage(message, sessionId) {
    const session = sessionManager.getSession(sessionId);
    
    // 分析意圖
    const intents = SmartIntentClassifier.classify(message);
    console.log(`🎯 識別意圖:`, intents, `👤 用戶類型:`, session.userType);
    
    // 更新會話狀態
    sessionManager.updateSession(sessionId, message, intents);
    
    // 生成回應
    const response = EnhancedResponseGenerator.generateResponse(intents, session, message);
    
    // 更新步驟狀態
    this.updateSessionStep(session, intents);
    
    return {
      reply: response,
      step: session.currentStep,
      sessionData: sessionManager.getSessionSummary(sessionId),
      pendingIntents: intents,
      userType: session.userType
    };
  }

  static updateSessionStep(session, intents) {
    if (intents.includes('booking') && session.currentStep === 'welcome') {
      session.currentStep = 'booking_inquiry';
    } else if (intents.length > 0 && session.currentStep === 'welcome') {
      session.currentStep = 'service_inquiry';
    }
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

    // 使用智能聊天處理器
    const response = await SmartChatProcessor.processMessage(message, sessionId);

    // 保持你原有的需求檢測
    const requirements = await RequirementDetector.detectAllRequirements(message);

    res.json({
      success: true,
      reply: response.reply,
      sessionId,
      step: response.step,
      pendingIntents: response.pendingIntents,
      userType: response.userType,
      sessionSummary: response.sessionData,
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

// ==================== 新增會話查詢端點 ====================
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const summary = sessionManager.getSessionSummary(sessionId);
  
  res.json({
    success: true,
    sessionId,
    summary,
    timestamp: new Date().toISOString()
  });
});

// ==================== 保持你原有的健康檢查和清理功能 ====================
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '6.0',
    timestamp: new Date().toISOString(),
    features: [
      'smart_intent_classification',
      'user_type_detection', 
      'multi_intent_processing',
      'enhanced_response_generation',
      'session_analytics',
      'airport_transfer_service',
      'restaurant_recommendation',
      'attractions_guide',
      'shopping_assistance',
      'medical_support',
      'facilities_info',
      'smart_suggestions'
    ],
    activeSessions: sessionManager.sessions.size
  });
});

// ==================== 過期會話清理 ====================
setInterval(() => {
  const now = new Date();
  const expirationTime = 30 * 60 * 1000; // 30分鐘
  let cleanedCount = 0;

  for (const [sessionId, session] of sessionManager.sessions.entries()) {
    const sessionTime = new Date(session.lastActive);
    if (now - sessionTime > expirationTime) {
      sessionManager.sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🗑️ 清理了 ${cleanedCount} 個過期會話`);
  }
}, 60 * 60 * 1000); // 每小時清理一次

module.exports = router;

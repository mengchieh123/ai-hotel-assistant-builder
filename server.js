const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.86:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const PORT = process.env.PORT || 8081;
const HOST = '0.0.0.0';

app.use(express.static('public'));
app.use(express.static('.'));
app.use(express.json());

// 會話存儲
const sessions = new Map();

// 智能意圖分類器（優化） 
class SmartIntentClassifier {
  static classify(message) {
    const lowerMessage = message.toLowerCase();
    const intents = [];
    // 訂房意圖匹配更嚴謹，使用正則加聯合條件判斷
    if (/(訂房|預訂|入住|房間|住.*晚|房型)/.test(lowerMessage)) intents.push('booking');
    if (/(接送|機場|接機|送機|交通)/.test(lowerMessage)) intents.push('transfer');
    if (/(餐廳|推薦|美食|吃|海鮮|晚餐)/.test(lowerMessage)) intents.push('restaurant');
    if (/(價格|價錢|多少錢|房價)/.test(lowerMessage)) intents.push('pricing');
    if (/(會員|積分|優惠|折扣)/.test(lowerMessage)) intents.push('member');
    if (/(景點|觀光|好玩|旅遊|推薦.*地方)/.test(lowerMessage)) intents.push('attractions');
    if (/(購物|夜市|商店|超市|便利商店)/.test(lowerMessage)) intents.push('shopping');
    if (/(醫院|醫療|診所|醫生|藥局)/.test(lowerMessage)) intents.push('medical');
    if (/(設施|泳池|健身房|spa|按摩)/.test(lowerMessage)) intents.push('facilities');
    return intents.length ? intents : ['general_inquiry'];
  }

  static detectUserType(message) {
    const lowerMessage = message.toLowerCase();
    if (/(家庭|小孩|兒童|親子)/.test(lowerMessage)) return 'family';
    if (/(團體|大型|多人|公司)/.test(lowerMessage)) return 'group';
    if (/(商務|會議|出差)/.test(lowerMessage)) return 'business';
    if (/(情侶|夫妻|蜜月)/.test(lowerMessage)) return 'couple';
    return 'individual';
  }
}

// 會話狀態管理器（優化）
class SessionManager {
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
        lastActive: new Date().toISOString()
      });
    }
    return this.sessions.get(sessionId);
  }
  updateSession(sessionId, message, intents) {
    const session = this.getSession(sessionId);
    session.lastActive = new Date().toISOString();
    session.conversationHistory.push({ message, intents, timestamp: new Date().toISOString() });
    session.userType = SmartIntentClassifier.detectUserType(message);
    intents.forEach(intent => {
      if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
    });
    return session;
  }
}

// 回應生成器（優化）
class ResponseGenerator {
  static generateResponse(intents, session, message) {
    if (intents.length > 1) return this.generateMultiIntentResponse(intents, session, message);
    switch (intents[0]) {
      case 'booking': return this.generateBookingResponse(session, message);
      case 'transfer': return this.generateTransferResponse(session);
      case 'restaurant': return this.generateRestaurantResponse(session, message);
      case 'pricing': return this.generatePricingResponse(session);
      case 'member': return this.generateMemberResponse(session);
      case 'attractions': return this.generateAttractionsResponse(session);
      case 'shopping': return this.generateShoppingResponse(session);
      case 'medical': return this.generateMedicalResponse(session);
      case 'facilities': return this.generateFacilitiesResponse(session);
      default: return this.generateGeneralResponse();
    }
  }

  static generateMultiIntentResponse(intents, session, message) {
    let response = "感謝您的查詢！我來為您詳細介紹：\n\n";
    intents.forEach(intent => {
      switch (intent) {
        case 'booking': response += this.generateBookingResponse(session, message, true); break;
        case 'transfer': response += this.generateTransferResponse(session, true); break;
        case 'restaurant': response += this.generateRestaurantResponse(session, message, true); break;
        case 'pricing': response += this.generatePricingResponse(session, true); break;
        case 'member': response += this.generateMemberResponse(session, true); break;
        case 'attractions': response += this.generateAttractionsResponse(session, true); break;
        case 'shopping': response += this.generateShoppingResponse(session, true); break;
        case 'medical': response += this.generateMedicalResponse(session, true); break;
        case 'facilities': response += this.generateFacilitiesResponse(session, true); break;
      }
    });
    return response + this.generateSmartSuggestions(intents, session);
  }

  // 範例回應生成方法，其他保持一致並依照需要調整
  static generateBookingResponse(session, message, isMultiIntent = false) {
    let resp = isMultiIntent ? "🏨 **訂房服務**\n" : "";
    if(session.userType === 'family') resp += "• 推薦家庭房型及親子設施。\n";
    else if(session.userType === 'group') resp += "• 提供團體優惠。\n";
    resp += "請告訴我入住人數、房型與日期。";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateTransferResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "🚗 **機場接送服務**\n" : "";
    resp += "24小時機場接送，費用600 TWD單程";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateRestaurantResponse(session, message, isMultiIntent = false) {
    let resp = isMultiIntent ? "🍽️ **餐廳推薦**\n" : "";
    resp += message.includes('海鮮') ? "• 港灣海鮮樓\n• 海味坊\n" : "• 龍鳳廳\n• 櫻花日本料理\n• 星空牛排館\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generatePricingResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "💰 **價格資訊**\n" : "";
    resp += "• 標準雙人房: 2200 TWD/晚\n• 豪華雙人房: 2800 TWD/晚\n• 家庭房: 3800 TWD/晚\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateMemberResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "💎 **會員服務**\n" : "";
    resp += "銀卡九折 + 免費早餐\n金卡85折\n白金卡8折\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateAttractionsResponse(session, isMultiIntent = false) {
    if(session.userType==='family')
      return (isMultiIntent?"🏞️ **親子景點**\n":"") + "兒童樂園、動物園、自然公園\n" + (isMultiIntent?"\n":"");
    return (isMultiIntent?"🏞️ **熱門景點**\n":"") + "歷史博物館、藝術特區、觀景台\n" + (isMultiIntent?"\n":"");
  }
  static generateShoppingResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "🛍️ **購物指南**\n" : "";
    resp += "24H便利商店、大型超市、夜市\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateMedicalResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "🏥 **醫療服務**\n" : "";
    resp += "24H診所、綜合醫院、緊急119\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateFacilitiesResponse(session, isMultiIntent = false) {
    let resp = isMultiIntent ? "🏊 **飯店設施**\n" : "";
    resp += "泳池、健身房、SPA水療\n";
    return resp + (isMultiIntent ? "\n" : "");
  }
  static generateGeneralResponse() {
    return "您好！我是飯店AI助理，可協助您訂房、接送、餐廳、景點、購物等服務。";
  }

  static generateSmartSuggestions(intents, session) {
    const allIntents = ['booking', 'transfer', 'restaurant', 'attractions', 'shopping', 'facilities'];
    const unused = allIntents.filter(i => !intents.includes(i));
    if (unused.length===0) return "";
    let sugg = "\n💡 **您可能還想了解**:\n";
    for (let i=0; i< Math.min(3,unused.length); i++) {
      switch(unused[i]){
        case 'booking': sugg += "• 訂房流程與優惠\n"; break;
        case 'transfer': sugg += "• 交通與接送服務\n"; break;
        case 'restaurant': sugg += "• 更多美食推薦\n"; break;
        case 'attractions': sugg += "• 周邊景點介紹\n"; break;
        case 'shopping': sugg += "• 購物指南\n"; break;
        case 'facilities': sugg += "• 飯店設施使用\n"; break;
      }
    }
    return sugg;
  }
}

const sessionManager = new SessionManager();

// 主要對話路由
app.post('/chat', (req, res) => {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2,9)}` } = req.body;
  
  if (!message) return res.status(400).json({ error: "訊息內容不能為空", reply:"請輸入您想詢問的內容。"});

  try {
    console.log("💬 收到請求:", {sessionId, message});
    const intents = SmartIntentClassifier.classify(message);
    const session = sessionManager.updateSession(sessionId, message, intents);
    const reply = ResponseGenerator.generateResponse(intents, session, message);

    res.json({
      success: true,
      reply,
      sessionId,
      userType: session.userType,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    res.json({success:false, reply:"系統處理錯誤，請稍後再試", sessionId, timestamp:new Date().toISOString()})
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 伺服器已啟動，監聽 ${HOST}:${PORT}`);
});

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

// 會話存儲
const sessions = new Map();

// ==================== 會員資料庫 ====================
const memberData = {
  'gold': {
    level: 'Gold',
    discount: 0.1,
    benefits: ['房價9折', '免費早餐', '延遲退房至14:00', '房型升等機會'],
    minNights: 1
  },
  'platinum': {
    level: 'Platinum', 
    discount: 0.15,
    benefits: ['房價85折', '免費早餐', '延遲退房至15:00', '保證房型升等', '迎賓禮品'],
    minNights: 2
  },
  'diamond': {
    level: 'Diamond',
    discount: 0.2,
    benefits: ['房價8折', '免費早餐+晚餐', '延遲退房至16:00', '專屬樓層', '機場接送'],
    minNights: 2
  }
};

// 會員帳號範例 (實際應該從資料庫查詢)
const memberAccounts = {
  'gold123': { level: 'gold', name: '王小明', points: 1250 },
  'plat456': { level: 'platinum', name: '陳小美', points: 3500 },
  'dia789': { level: 'diamond', name: '林大為', points: 8900 }
};

// ==================== 基本健康檢查路由 ====================
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查請求收到');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    message: '服務正常運行中',
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    uptime: process.uptime()
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.status(200).json({ 
    service: 'Hotel Chatbot API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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

// ==================== 修復：完全禁用 n8n 整合服務 ====================
class N8NIntegrationService {
  constructor() {
    this.enabled = false; // 強制禁用 n8n
  }

  async sendToN8N(payload) {
    console.log('🔕 n8n 整合已禁用，跳過發送資料');
    return null;
  }

  async sendBookingConfirmation(bookingData) {
    console.log('🔕 n8n 整合已禁用，跳過訂房確認');
    return null;
  }

  async logCustomerInquiry(sessionId, userMessage, botResponse, intent) {
    console.log('🔕 n8n 整合已禁用，跳過客戶查詢記錄');
    // 完全不執行任何操作
    return;
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
      lastActivity: Date.now(),
      sessionId: sessionId
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

// ==================== 新增：處理家庭房型推薦 ====================
function handleFamilyRoomRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 提取大人和兒童數量
  const adultMatch = message.match(/(\d+)\s*大/);
  const childMatch = message.match(/(\d+)\s*小/);
  
  const adults = adultMatch ? parseInt(adultMatch[1]) : (session.data.adults || 2);
  const children = childMatch ? parseInt(childMatch[1]) : (session.data.children || 0);
  
  // 記錄到會話數據
  session.data.adults = adults;
  session.data.children = children;
  session.data.hasChildren = children > 0;
  
  let reply = `👨‍👩‍👧‍👦 **了解您有 ${adults}位大人${children > 0 ? `和${children}位小孩` : ''}！**\n\n`;
  
  reply += `🏨 **適合的房型推薦**\n\n`;
  
  // 根據人數推薦房型
  if (children >= 2) {
    reply += `⭐ **家庭房 (推薦)**\n`;
    reply += `   • 2張雙人床，空間寬敞\n`;
    reply += `   • 最適合${adults}大${children}小家庭\n`;
    reply += `   • 價格: NT$4,500/晚\n\n`;
  }
  
  if (children > 0) {
    reply += `🏠 **套房**\n`;
    reply += `   • 獨立客廳，空間較大\n`;
    reply += `   • 可加沙發床\n`;
    reply += `   • 價格: NT$5,800/晚\n\n`;
    
    reply += `💎 **豪華雙人房**\n`;
    reply += `   • 可加嬰兒床 (限1位幼兒)\n`;
    reply += `   • 價格: NT$3,800/晚\n\n`;
  } else {
    reply += `🛏️ **標準雙人房**\n`;
    reply += `   • 適合${adults}位大人\n`;
    reply += `   • 價格: NT$2,800/晚\n\n`;
  }
  
  // 如果沒有兒童年齡資訊，先詢問年齡
  if (children > 0 && !session.data.childAge) {
    reply += `📝 **為了給您更準確的建議**\n`;
    reply += `請問孩子們的年齡是？這會影響房型選擇和費用計算。`;
    session.step = 'ask_child_age';
  } else {
    reply += `請告訴我您想選擇哪種房型？`;
    session.step = 'select_family_room';
  }
  
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：檢查是否包含完整訂房資訊 ====================
function hasCompleteBookingInfo(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 檢查是否包含房型、天數、人數等關鍵資訊
  const hasRoomType = /(標準|豪華|套房|家庭房)/.test(message) || session.data.roomType;
  const hasNights = /(\d+)\s*晚/.test(message) || session.data.nights;
  const hasAdults = /(\d+)\s*大/.test(message) || session.data.adults;
  const hasChildren = /(\d+)\s*小/.test(message) || session.data.children;
  const hasPriceQuery = /(價格|價錢|多少錢|總價)/.test(lowerMsg);
  
  // 如果用戶詢問價格且已經有足夠的訂房資訊，直接回覆價格
  if (hasPriceQuery && (hasRoomType || hasNights || hasAdults)) {
    return true;
  }
  
  // 如果用戶提供了完整的訂房資訊組合
  if (hasRoomType && hasNights && (hasAdults || hasChildren)) {
    return true;
  }
  
  return false;
}

// ==================== 新增：處理完整訂房查詢 ====================
function handleCompleteBookingQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 提取房型
  let roomType = session.data.roomType;
  if (!roomType) {
    if (lowerMsg.includes('標準')) roomType = '標準雙人房';
    else if (lowerMsg.includes('豪華')) roomType = '豪華雙人房';
    else if (lowerMsg.includes('套房')) roomType = '套房';
    else if (lowerMsg.includes('家庭')) roomType = '家庭房';
    
    if (roomType) {
      session.data.roomType = roomType;
    }
  }
  
  // 提取天數
  const nightsMatch = message.match(/(\d+)\s*晚/);
  if (nightsMatch) {
    session.data.nights = parseInt(nightsMatch[1]);
  }
  
  // 提取大人人數
  const adultMatch = message.match(/(\d+)\s*大/);
  if (adultMatch) {
    session.data.adults = parseInt(adultMatch[1]);
  }
  
  // 提取兒童人數
  const childMatch = message.match(/(\d+)\s*小/);
  if (childMatch) {
    session.data.children = parseInt(childMatch[1]);
    session.data.hasChildren = true;
  }
  
  // 提取兒童年齡
  const ageMatch = message.match(/(\d+)\s*歲/);
  if (ageMatch) {
    session.data.childAge = parseInt(ageMatch[1]);
  }
  
  // 檢查是否所有必要資訊都已具備
  if (session.data.roomType && session.data.nights && session.data.adults) {
    // 直接生成訂單摘要
    return generateBookingSummary(session);
  } else {
    // 引導用戶提供缺少的資訊
    return guideToCompleteBooking(session);
  }
}

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
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 餐廳推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
    detectedIntent = 'reset';
  }
  
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help') || lowerMsg.includes('指令')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看各項優惠政策\n• 附近景點 - 推薦周邊景點\n• 餐廳推薦 - 推薦美食餐廳\n• 飯店設施 - 介紹飯店設施\n• 兒童政策 - 了解兒童收費標準\n• 取消訂房 - 取消現有訂單\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇房間數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
    detectedIntent = 'help';
  }

  // ==================== 優先處理：完整訂房資訊查詢 ====================
  else if (!response && hasCompleteBookingInfo(cleanMessage, session)) {
    response = handleCompleteBookingQuery(cleanMessage, session);
    detectedIntent = 'complete_booking_query';
  }

  // ==================== 新增：購物相關查詢 ====================
  else if (!response && (lowerMsg.includes('購物') || lowerMsg.includes('商場') || lowerMsg.includes('百貨') || lowerMsg.includes('買東西'))) {
    response = handleShoppingRecommendation(cleanMessage, session);
    detectedIntent = 'shopping_recommendation';
  }

  // ==================== 新增：夜市相關查詢 ====================
  else if (!response && (lowerMsg.includes('夜市') || lowerMsg.includes('夜市的'))) {
    response = handleNightMarketRecommendation(cleanMessage, session);
    detectedIntent = 'night_market_recommendation';
  }

  // ==================== 新增：娛樂活動查詢 ====================
  else if (!response && (lowerMsg.includes('娛樂') || lowerMsg.includes('活動') || lowerMsg.includes('晚上') || lowerMsg.includes('夜生活'))) {
    response = handleEntertainmentRecommendation(cleanMessage, session);
    detectedIntent = 'entertainment_recommendation';
  }

  // ==================== 新增：交通相關查詢 ====================
  else if (!response && (lowerMsg.includes('交通') || lowerMsg.includes('機場') || lowerMsg.includes('車站') || lowerMsg.includes('怎麼去'))) {
    response = handleTransportationInfo(cleanMessage, session);
    detectedIntent = 'transportation_info';
  }

  // ==================== 新增：便利設施查詢 ====================
  else if (!response && (lowerMsg.includes('便利商店') || lowerMsg.includes('超市') || lowerMsg.includes('藥局') || lowerMsg.includes('銀行'))) {
    response = handleAmenitiesInfo(cleanMessage, session);
    detectedIntent = 'amenities_info';
  }

  // ==================== 新增：景點推薦處理 ====================
  else if (!response && (lowerMsg.includes('景點') || lowerMsg.includes('景區') || lowerMsg.includes('觀光') || lowerMsg.includes('旅遊') || lowerMsg.includes('好玩'))) {
    response = handleAttractionsRecommendation(cleanMessage, session);
    detectedIntent = 'attractions_recommendation';
  }

  // ==================== 新增：餐廳推薦處理 ====================
  else if (!response && (lowerMsg.includes('餐廳') || lowerMsg.includes('美食') || lowerMsg.includes('吃飯') || lowerMsg.includes('餐飲') || lowerMsg.includes('推薦吃'))) {
    response = handleRestaurantRecommendation(cleanMessage, session);
    detectedIntent = 'restaurant_recommendation';
  }

  // ==================== 新增：飯店設施處理 ====================
  else if (!response && (lowerMsg.includes('設施') || lowerMsg.includes('健身房') || lowerMsg.includes('游泳池') || lowerMsg.includes('早餐'))) {
    response = handleHotelFacilities(cleanMessage, session);
    detectedIntent = 'hotel_facilities';
  }

  // ==================== 新增：兒童家庭房型處理 ====================
  else if (!response && (lowerMsg.includes('適合') || lowerMsg.includes('推薦') || 
         (session.data.hasChildren && !session.data.roomType))) {
    response = handleFamilyRoomRecommendation(cleanMessage, session);
    detectedIntent = 'family_recommendation';
  }

  // ==================== 新增：會員優惠處理 ====================
  else if (!response && (lowerMsg.includes('會員') || lowerMsg.includes('優惠') || lowerMsg.includes('折扣') || 
      lowerMsg.includes('vip') || lowerMsg.includes('福利'))) {
    response = handleMemberBenefitsQuery(cleanMessage, session);
    detectedIntent = 'member_benefits';
  }

  // ==================== 新增：會員登入處理 ====================
  else if (!response && (session.step === 'member_login' || lowerMsg.includes('登入') || 
      (session.context.awaitingMemberLogin && /^[a-zA-Z0-9]+$/.test(cleanMessage)))) {
    response = handleMemberLogin(cleanMessage, session);
    detectedIntent = 'member_login';
  }

  // ==================== 新增：兒童政策查詢處理 ====================
  else if (!response && (lowerMsg.includes('兒童') || lowerMsg.includes('小孩') || lowerMsg.includes('孩子') || 
      lowerMsg.includes('加價') || lowerMsg.includes('加費') || lowerMsg.includes('收費'))) {
    response = handleChildPolicyQuery(cleanMessage, session);
    detectedIntent = 'child_policy';
  }

  // ==================== 新增：價格查詢處理 ====================
  else if (!response && (lowerMsg.includes('價格') || lowerMsg.includes('價錢') || lowerMsg.includes('多少錢') || lowerMsg.includes('總價'))) {
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
    
    // 修復：完全跳過 n8n 記錄，避免任何錯誤
    // n8nService.logCustomerInquiry(session.sessionId, cleanMessage, response, detectedIntent);

  } else {
    response = generateDefaultResponse(session);
    detectedIntent = 'default';
  }

  return response;
}

// ==================== 新增：處理購物推薦 ====================
function handleShoppingRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🛍️ **購物推薦**\n\n`;
  
  if (lowerMsg.includes('奢侈品') || lowerMsg.includes('精品')) {
    reply += `💎 **精品購物中心**\n\n`;
    reply += `👜 **名品百貨**\n`;
    reply += `   • 距離: 車程15分鐘\n`;
    reply += `   • 品牌: LV, Gucci, Chanel, Hermès\n`;
    reply += `   • 營業時間: 11:00-21:30\n\n`;
    
    reply += `💍 **珠寶商城**\n`;
    reply += `   • 距離: 步行20分鐘\n`;
    reply += `   • 特色: 高級珠寶、手錶\n`;
    reply += `   • 營業時間: 10:30-20:00\n`;
    
  } else if (lowerMsg.includes('平價') || lowerMsg.includes('便宜')) {
    reply += `💰 **平價購物去處**\n\n`;
    reply += `👕 **服飾批發市場**\n`;
    reply += `   • 距離: 步行25分鐘\n`;
    reply += `   • 特色: 流行服飾、配件批發\n`;
    reply += `   • 營業時間: 09:00-18:00\n\n`;
    
    reply += `🛒 **大型量販店**\n`;
    reply += `   • 距離: 車程10分鐘\n`;
    reply += `   • 特色: 生活用品、食品\n`;
    reply += `   • 營業時間: 09:00-22:00\n`;
    
  } else {
    reply += `🏬 **熱門購物中心**\n\n`;
    reply += `🛍️ **市中心百貨**\n`;
    reply += `   • 距離: 步行8分鐘\n`;
    reply += `   • 樓層: B2-8F (美食、服飾、家電)\n`;
    reply += `   • 營業時間: 11:00-21:30\n\n`;
    
    reply += `🏪 **生活購物中心**\n`;
    reply += `   • 距離: 車程5分鐘\n`;
    reply += `   • 特色: 超市、餐廳、電影院\n`;
    reply += `   • 營業時間: 10:00-22:00\n\n`;
    
    reply += `🎁 **紀念品商店**\n`;
    reply += `   • 距離: 步行3分鐘\n`;
    reply += `   • 特色: 當地特產、手工藝品\n`;
    reply += `   • 營業時間: 09:00-20:00\n\n`;
    
    reply += `💡 **購物小貼士**\n`;
    reply += `• 持飯店房卡可享部分商店折扣\n`;
    reply += `• 滿額可辦理退稅\n`;
    reply += `• 提供購物袋租借服務\n`;
  }
  
  reply += `\n需要推薦特定類型的購物場所嗎？`;
  
  session.step = 'shopping_recommendation';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理夜市推薦 ====================
function handleNightMarketRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🌃 **夜市推薦**\n\n`;
  
  reply += `🍢 **觀光夜市**\n`;
  reply += `   • 距離: 步行12分鐘\n`;
  reply += `   • 營業時間: 17:00-24:00 (每日)\n`;
  reply += `   • 推薦美食: 蚵仔煎、臭豆腐、珍珠奶茶\n`;
  reply += `   • 特色: 200+攤位，遊戲區、表演\n\n`;
  
  reply += `🍜 **傳統夜市**\n`;
  reply += `   • 距離: 車程8分鐘\n`;
  reply += `   • 營業時間: 18:00-01:00 (週二休)\n`;
  reply += `   • 推薦美食: 牛肉麵、滷味、車輪餅\n`;
  reply += `   • 特色: 在地人推薦，價格實惠\n\n`;
  
  reply += `🎪 **文創夜市**\n`;
  reply += `   • 距離: 車程15分鐘\n`;
  reply += `   • 營業時間: 16:00-23:00 (週五-週日)\n`;
  reply += `   • 推薦: 手工藝品、創意小吃\n`;
  reply += `   • 特色: 文青風格，街頭表演\n\n`;
  
  reply += `📋 **夜市小知識**\n`;
  reply += `• 最佳時間: 19:00-21:00 (人潮適中)\n`;
  reply += `• 現金準備: 建議攜帶NT$500-1000現金\n`;
  reply += `• 推薦動線: 從入口開始順時針逛\n`;
  reply += `• 必吃美食: 大腸包小腸、雞排、芒果冰\n\n`;
  
  reply += `🚗 **交通建議**\n`;
  reply += `• 步行可達觀光夜市\n`;
  reply += `• 其他夜市建議搭乘計程車\n`;
  reply += `• 飯店可代叫計程車\n`;
  
  session.step = 'night_market_recommendation';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理娛樂活動推薦 ====================
function handleEntertainmentRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🎭 **娛樂活動推薦**\n\n`;
  
  if (lowerMsg.includes('晚上') || lowerMsg.includes('夜間') || lowerMsg.includes('夜生活')) {
    reply += `🌙 **夜間娛樂**\n\n`;
    reply += `🍷 **高空酒吧**\n`;
    reply += `   • 距離: 步行5分鐘\n`;
    reply += `   • 特色: 城市夜景、現場音樂\n`;
    reply += `   • 營業時間: 18:00-02:00\n`;
    reply += `   • 消費: NT$300-800/人\n\n`;
    
    reply += `🎤 **Live House**\n`;
    reply += `   • 距離: 車程10分鐘\n`;
    reply += `   • 特色: 樂團表演、獨立音樂\n`;
    reply += `   • 營業時間: 20:00-01:00\n`;
    reply += `   • 門票: NT$400-600\n\n`;
    
    reply += `🎬 **午夜電影**\n`;
    reply += `   • 距離: 步行15分鐘\n`;
    reply += `   • 特色: 最新上映、舒適影廳\n`;
    reply += `   • 場次: 23:00, 01:00\n`;
    reply += `   • 票價: NT$280-350\n`;
    
  } else if (lowerMsg.includes('文化') || lowerMsg.includes('藝術')) {
    reply += `🎨 **文化娛樂**\n\n`;
    reply += `🎪 **傳統戲曲**\n`;
    reply += `   • 距離: 車程20分鐘\n`;
    reply += `   • 特色: 京劇、歌仔戲表演\n`;
    reply += `   • 時間: 19:30-21:30 (週三、六)\n`;
    reply += `   • 票價: NT$200-500\n\n`;
    
    reply += `🎻 **音樂會**\n`;
    reply += `   • 距離: 步行25分鐘\n`;
    reply += `   • 特色: 古典音樂、交響樂\n`;
    reply += `   • 時間: 請洽官網節目表\n`;
    reply += `   • 票價: NT$600-1200\n`;
    
  } else {
    reply += `⭐ **多元娛樂選擇**\n\n`;
    reply += `🎳 **保齡球館**\n`;
    reply += `   • 距離: 車程8分鐘\n`;
    reply += `   • 營業時間: 10:00-24:00\n`;
    reply += `   • 費用: NT$120-180/局\n\n`;
    
    reply += `🎯 **射箭場**\n`;
    reply += `   • 距離: 車程12分鐘\n`;
    reply += `   • 營業時間: 13:00-22:00\n`;
    reply += `   • 體驗: NT$250/小時 (含教學)\n\n`;
    
    reply += `🕹️ **電玩中心**\n`;
    reply += `   • 距離: 步行10分鐘\n`;
    reply += `   • 營業時間: 11:00-23:00\n`;
    reply += `   • 代幣: NT$10/枚\n\n`;
    
    reply += `🎲 **桌遊店**\n`;
    reply += `   • 距離: 步行7分鐘\n`;
    reply += `   • 營業時間: 14:00-24:00\n`;
    reply += `   • 費用: NT$150/人 (不限時)\n`;
  }
  
  reply += `\n💡 **預約服務**\n`;
  reply += `• 飯店可協助預訂熱門活動\n`;
  reply += `• 部分娛樂場所提供專車接送\n`;
  reply += `• 持房卡享合作商家折扣\n`;
  
  session.step = 'entertainment_recommendation';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理交通資訊 ====================
function handleTransportationInfo(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🚗 **交通資訊**\n\n`;
  
  if (lowerMsg.includes('機場')) {
    reply += `✈️ **機場交通**\n\n`;
    reply += `🚕 **計程車**\n`;
    reply += `   • 時間: 約40分鐘\n`;
    reply += `   • 費用: NT$800-1000\n`;
    reply += `   • 備註: 24小時服務\n\n`;
    
    reply += `🚌 **機場巴士**\n`;
    reply += `   • 時間: 約60分鐘\n`;
    reply += `   • 費用: NT$150/人\n`;
    reply += `   • 班次: 每20分鐘一班\n\n`;
    
    reply += `🏨 **飯店接送**\n`;
    reply += `   • 時間: 需提前預約\n`;
    reply += `   • 費用: NT$600/車\n`;
    reply += `   • 預約: 請洽櫃檯\n`;
    
  } else if (lowerMsg.includes('車站') || lowerMsg.includes('火車') || lowerMsg.includes('高鐵')) {
    reply += `🚄 **車站交通**\n\n`;
    reply += `🚇 **捷運**\n`;
    reply += `   • 路線: 紅線往市中心\n`;
    reply += `   • 時間: 約15分鐘\n`;
    reply += `   • 票價: NT$25\n\n`;
    
    reply += `🚕 **計程車**\n`;
    reply += `   • 時間: 約10分鐘\n`;
    reply += `   • 費用: NT$150-200\n`;
    
  } else {
    reply += `📍 **周邊交通**\n\n`;
    reply += `🚶 **步行可達**\n`;
    reply += `   • 購物中心: 8分鐘\n`;
    reply += `   • 夜市: 12分鐘\n`;
    reply += `   • 捷運站: 5分鐘\n\n`;
    
    reply += `🚕 **計程車**\n`;
    reply += `   • 起跳: NT$70 (1.25公里)\n`;
    reply += `   • 叫車專線: 55688\n`;
    reply += `   • 飯店代叫: 免費服務\n\n`;
    
    reply += `🚇 **大眾運輸**\n`;
    reply += `   • 捷運: 紅線、藍線交會\n`;
    reply += `   • 首班車: 06:00, 末班車: 00:00\n`;
    reply += `   • 票價: NT$20-50\n\n`;
    
    reply += `🚌 **公車**\n`;
    reply += `   • 路線: 15條路線經過\n`;
    reply += `   • 班次: 10-15分鐘一班\n`;
    reply += `   • 票價: NT$15 (悠遊卡NT$12)\n`;
  }
  
  reply += `\n🗺️ **交通小貼士**\n`;
  reply += `• 下載"台灣等公車"APP查詢即時班次\n`;
  reply += `• 使用悠遊卡享轉乘優惠\n`;
  reply += `• 飯店提供免費市區地圖\n`;
  
  session.step = 'transportation_info';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理便利設施資訊 ====================
function handleAmenitiesInfo(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🏪 **周邊便利設施**\n\n`;
  
  if (lowerMsg.includes('便利商店') || lowerMsg.includes('超商')) {
    reply += `🛒 **便利商店**\n\n`;
    reply += `🏪 7-11\n`;
    reply += `   • 距離: 步行2分鐘 (飯店大廳)\n`;
    reply += `   • 營業時間: 24小時\n`;
    reply += `   • 服務: 取貨、影印、熱食\n\n`;
    
    reply += `🏪 FamilyMart\n`;
    reply += `   • 距離: 步行3分鐘\n`;
    reply += `   • 營業時間: 06:00-24:00\n`;
    reply += `   • 特色: 座位區、現煮咖啡\n`;
    
  } else if (lowerMsg.includes('超市') || lowerMsg.includes('賣場')) {
    reply += `🛍️ **超市賣場**\n\n`;
    reply += `🏬 頂好超市\n`;
    reply += `   • 距離: 步行8分鐘\n`;
    reply += `   • 營業時間: 08:00-23:00\n`;
    reply += `   • 特色: 生鮮食品、進口商品\n\n`;
    
    reply += `🏬 家樂福便利購\n`;
    reply += `   • 距離: 車程5分鐘\n`;
    reply += `   • 營業時間: 09:00-22:30\n`;
    reply += `   • 特色: 品項齊全、價格實惠\n`;
    
  } else if (lowerMsg.includes('藥局') || lowerMsg.includes('藥妝')) {
    reply += `💊 **藥局藥妝**\n\n`;
    reply += `🏥 康是美\n`;
    reply += `   • 距離: 步行5分鐘\n`;
    reply += `   • 營業時間: 10:00-22:00\n`;
    reply += `   • 特色: 藥妝、保健品、美妝\n\n`;
    
    reply += `🏥 屈臣氏\n`;
    reply += `   • 距離: 步行7分鐘\n`;
    reply += `   • 營業時間: 09:30-22:30\n`;
    reply += `   • 特色: 開架彩妝、醫藥用品\n`;
    
  } else if (lowerMsg.includes('銀行') || lowerMsg.includes('atm')) {
    reply += `🏦 **金融服務**\n\n`;
    reply += `💰 中國信託ATM\n`;
    reply += `   • 距離: 步行1分鐘 (飯店大廳)\n`;
    reply += `   • 服務: 提款、轉帳、外幣兌換\n\n`;
    
    reply += `🏦 台新銀行\n`;
    reply += `   • 距離: 步行5分鐘\n`;
    reply += `   • 營業時間: 09:00-15:30\n`;
    reply += `   • 服務: 外幣兌換、匯款\n`;
    
  } else {
    reply += `📍 **生活設施一覽**\n\n`;
    reply += `🛒 **便利商店**\n`;
    reply += `   • 7-11 (24小時) - 步行2分鐘\n`;
    reply += `   • FamilyMart - 步行3分鐘\n\n`;
    
    reply += `🛍️ **超市賣場**\n`;
    reply += `   • 頂好超市 - 步行8分鐘\n`;
    reply += `   • 家樂福 - 車程5分鐘\n\n`;
    
    reply += `💊 **藥局藥妝**\n`;
    reply += `   • 康是美 - 步行5分鐘\n`;
    reply += `   • 屈臣氏 - 步行7分鐘\n\n`;
    
    reply += `🏦 **金融服務**\n`;
    reply += `   • ATM (飯店大廳) - 步行1分鐘\n`;
    reply += `   • 台新銀行 - 步行5分鐘\n\n`;
    
    reply += `☕ **其他服務**\n`;
    reply += `   • 星巴克 - 步行6分鐘\n`;
    reply += `   • 郵局 - 步行10分鐘\n`;
    reply += `   • 洗衣店 - 步行8分鐘\n`;
  }
  
  reply += `\n💡 **便利服務**\n`;
  reply += `• 飯店提供代收包裹服務\n`;
  reply += `• 可協助叫外送服務\n`;
  reply += `• 提供周邊地圖導引\n`;
  
  session.step = 'amenities_info';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理景點推薦 ====================
function handleAttractionsRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🏞️ **景點推薦**\n\n`;
  
  if (lowerMsg.includes('自然') || lowerMsg.includes('公園') || lowerMsg.includes('戶外')) {
    reply += `🌳 **自然景觀**\n\n`;
    reply += `🏞️ 國家公園\n`;
    reply += `   • 距離: 車程30分鐘\n`;
    reply += `   • 特色: 登山步道、瀑布、野生動物\n`;
    reply += `   • 建議時間: 半天\n`;
    reply += `   • 門票: NT$100/人\n\n`;
    
    reply += `🌺 植物園\n`;
    reply += `   • 距離: 車程20分鐘\n`;
    reply += `   • 特色: 熱帶植物、溫室花園\n`;
    reply += `   • 建議時間: 2-3小時\n`;
    reply += `   • 門票: NT$50/人\n`;
    
  } else if (lowerMsg.includes('文化') || lowerMsg.includes('歷史') || lowerMsg.includes('古蹟')) {
    reply += `🏛️ **文化歷史**\n\n`;
    reply += `🎨 故宮博物院\n`;
    reply += `   • 距離: 車程25分鐘\n`;
    reply += `   • 特色: 中華文物、翠玉白菜\n`;
    reply += `   • 建議時間: 3-4小時\n`;
    reply += `   • 門票: NT$350/人\n\n`;
    
    reply += `🏯 歷史古蹟\n`;
    reply += `   • 距離: 步行15分鐘\n`;
    reply += `   • 特色: 百年建築、文化展覽\n`;
    reply += `   • 建議時間: 1-2小時\n`;
    reply += `   • 門票: 免費\n`;
    
  } else if (lowerMsg.includes('親子') || lowerMsg.includes('小孩') || lowerMsg.includes('兒童')) {
    reply += `👨‍👩‍👧‍👦 **親子景點**\n\n`;
    reply += `🎡 主題樂園\n`;
    reply += `   • 距離: 車程40分鐘\n`;
    reply += `   • 特色: 遊樂設施、表演秀\n`;
    reply += `   • 建議時間: 全天\n`;
    reply += `   • 門票: NT$899/人\n\n`;
    
    reply += `🐠 海洋公園\n`;
    reply += `   • 距離: 車程35分鐘\n`;
    reply += `   • 特色: 海洋生物、海豚表演\n`;
    reply += `   • 建議時間: 半天\n`;
    reply += `   • 門票: NT$650/人\n`;
    
  } else {
    reply += `⭐ **熱門景點精選**\n\n`;
    reply += `🏙️ 觀景台\n`;
    reply += `   • 距離: 步行10分鐘\n`;
    reply += `   • 特色: 城市全景、夜景\n`;
    reply += `   • 建議時間: 1小時\n`;
    reply += `   • 門票: NT$300/人\n\n`;
    
    reply += `🎭 文創園區\n`;
    reply += `   • 距離: 車程15分鐘\n`;
    reply += `   • 特色: 藝術展覽、文創市集\n`;
    reply += `   • 建議時間: 2-3小時\n`;
    reply += `   • 門票: 免費\n\n`;
    
    reply += `🛍️ 購物特區\n`;
    reply += `   • 距離: 步行8分鐘\n`;
    reply += `   • 特色: 精品商店、特色小店\n`;
    reply += `   • 建議時間: 2-4小時\n`;
    reply += `   • 門票: 免費\n\n`;
    
    reply += `🌃 河濱公園\n`;
    reply += `   • 距離: 步行20分鐘\n`;
    reply += `   • 特色: 自行車道、夜景\n`;
    reply += `   • 建議時間: 1-2小時\n`;
    reply += `   • 門票: 免費\n`;
  }
  
  reply += `\n📋 **旅遊建議**\n`;
  reply += `• 飯店提供景點導覽手冊\n`;
  reply += `• 可代訂景點門票享折扣\n`;
  reply += `• 建議提前預約熱門景點\n`;
  reply += `• 提供包車旅遊服務\n`;
  
  session.step = 'attractions_recommendation';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理餐廳推薦 ====================
function handleRestaurantRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🍽️ **餐廳推薦**\n\n`;
  
  if (lowerMsg.includes('中式') || lowerMsg.includes('台菜') || lowerMsg.includes('台灣')) {
    reply += `🥢 **中式料理**\n\n`;
    reply += `🏮 台菜餐廳\n`;
    reply += `   • 距離: 步行8分鐘\n`;
    reply += `   • 招牌: 三杯雞、滷肉飯、蚵仔煎\n`;
    reply += `   • 人均: NT$400-600\n`;
    reply += `   • 備註: 適合家庭聚餐\n\n`;
    
    reply += `🥟 點心專門店\n`;
    reply += `   • 距離: 步行12分鐘\n`;
    reply += `   • 招牌: 小籠包、燒賣、腸粉\n`;
    reply += `   • 人均: NT$300-500\n`;
    reply += `   • 備註: 米其林推薦\n`;
    
  } else if (lowerMsg.includes('西式') || lowerMsg.includes('牛排') || lowerMsg.includes('義大利')) {
    reply += `🍝 **西式料理**\n\n`;
    reply += `🥩 牛排館\n`;
    reply += `   • 距離: 步行5分鐘\n`;
    reply += `   • 招牌: 肋眼牛排、龍蝦\n`;
    reply += `   • 人均: NT$800-1200\n`;
    reply += `   • 備註: 浪漫氛圍，適合約會\n\n`;
    
    reply += `🍕 義式餐廳\n`;
    reply += `   • 距離: 步行10分鐘\n`;
    reply += `   • 招牌: 手工披薩、義大利麵\n`;
    reply += `   • 人均: NT$500-800\n`;
    reply += `   • 備註: 家庭友善，有兒童餐\n`;
    
  } else if (lowerMsg.includes('日式') || lowerMsg.includes('壽司') || lowerMsg.includes('拉麵')) {
    reply += `🍣 **日式料理**\n\n`;
    reply += `🎎 壽司店\n`;
    reply += `   • 距離: 步行15分鐘\n`;
    reply += `   • 招牌: 握壽司、生魚片\n`;
    reply += `   • 人均: NT$600-1000\n`;
    reply += `   • 備註: 新鮮食材，師傅現做\n\n`;
    
    reply += `🍜 拉麵店\n`;
    reply += `   • 距離: 步行8分鐘\n`;
    reply += `   • 招牌: 豚骨拉麵、沾麵\n`;
    reply += `   • 人均: NT$250-350\n`;
    reply += `   • 備註: 湯頭濃郁，排隊名店\n`;
    
  } else if (lowerMsg.includes('素食') || lowerMsg.includes('蔬食')) {
    reply += `🥗 **素食選擇**\n\n`;
    reply += `🌱 素食餐廳\n`;
    reply += `   • 距離: 步行12分鐘\n`;
    reply += `   • 招牌: 素食套餐、養生湯品\n`;
    reply += `   • 人均: NT$350-500\n`;
    reply += `   • 備註: 全素/蛋奶素可選\n\n`;
    
    reply += `🥬 健康輕食\n`;
    reply += `   • 距離: 步行6分鐘\n`;
    reply += `   • 招牌: 沙拉、蔬果汁、三明治\n`;
    reply += `   • 人均: NT$200-300\n`;
    reply += `   • 備註: 提供外帶服務\n`;
    
  } else {
    reply += `🎯 **精選餐廳**\n\n`;
    reply += `🍽️ 飯店餐廳\n`;
    reply += `   • 位置: 飯店2樓\n`;
    reply += `   • 菜系: 國際自助餐\n`;
    reply += `   • 人均: NT$880+10%\n`;
    reply += `   • 特色: 現場烹飪，多國料理\n\n`;
    
    reply += `🌃 景觀餐廳\n`;
    reply += `   • 距離: 步行10分鐘\n`;
    reply += `   • 菜系: 融合料理\n`;
    reply += `   • 人均: NT$600-900\n`;
    reply += `   • 特色: 高空夜景，浪漫氛圍\n\n`;
    
    reply += `🍻 居酒屋\n`;
    reply += `   • 距離: 步行5分鐘\n`;
    reply += `   • 菜系: 日式串燒\n`;
    reply += `   • 人均: NT$400-600\n`;
    reply += `   • 特色: 下班小酌，氣氛輕鬆\n`;
  }
  
  reply += `\n💡 **訂位服務**\n`;
  reply += `• 飯店可代訂熱門餐廳\n`;
  reply += `• 部分餐廳持房卡享折扣\n`;
  reply += `• 提供外送服務資訊\n`;
  reply += `• 推薦隱藏版美食地圖\n`;
  
  session.step = 'restaurant_recommendation';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 新增：處理飯店設施 ====================
function handleHotelFacilities(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let reply = `🏨 **飯店設施**\n\n`;
  
  if (lowerMsg.includes('健身房') || lowerMsg.includes('健身') || lowerMsg.includes('運動')) {
    reply += `💪 **健身中心**\n\n`;
    reply += `🏋️ 重量訓練區\n`;
    reply += `   • 位置: 3樓\n`;
    reply += `   • 設備: 啞鈴、槓鈴、重訓機\n`;
    reply += `   • 時間: 06:00-22:00\n\n`;
    
    reply += `🏃 有氧區\n`;
    reply += `   • 設備: 跑步機、飛輪、橢圓機\n`;
    reply += `   • 特色: 面對市景，電視娛樂\n`;
    reply += `   • 服務: 毛巾、飲用水提供\n\n`;
    
    reply += `🧘 伸展區\n`;
    reply += `   • 設備: 瑜伽墊、健身球\n`;
    reply += `   • 課程: 晨間瑜伽 (07:00-08:00)\n`;
    
  } else if (lowerMsg.includes('游泳池') || lowerMsg.includes('泳池') || lowerMsg.includes('游泳')) {
    reply += `🏊 **游泳池**\n\n`;
    reply += `🌊 主游泳池\n`;
    reply += `   • 位置: 頂樓\n`;
    reply += `   • 尺寸: 25公尺長\n`;
    reply += `   • 深度: 1.2-1.8公尺\n`;
    reply += `   • 時間: 07:00-21:00\n\n`;
    
    reply += `👶 兒童池\n`;
    reply += `   • 深度: 0.6公尺\n`;
    reply += `   • 特色: 滑水道、噴水設施\n`;
    reply += `   • 備註: 需家長陪同\n\n`;
    
    reply += `🛟 服務項目\n`;
    reply += `   • 免費: 毛巾、泳圈、浮板\n`;
    reply += `   • 租借: 泳鏡NT$50、泳帽NT$100\n`;
    reply += `   • 安全: 救生員值班\n`;
    
  } else if (lowerMsg.includes('早餐') || lowerMsg.includes('用餐')) {
    reply += `🍽️ **餐飲設施**\n\n`;
    reply += `🌅 早餐餐廳\n`;
    reply += `   • 位置: 1樓大廳旁\n`;
    reply += `   • 時間: 06:30-10:30\n`;
    reply += `   • 形式: 自助式早餐\n`;
    reply += `   • 價格: 房客NT$350/人\n\n`;
    
    reply += `☕ 大廳酒吧\n`;
    reply += `   • 時間: 10:00-23:00\n`;
    reply += `   • 提供: 咖啡、茶飲、輕食\n`;
    reply += `   • 特色: 現場鋼琴演奏\n\n`;
    
    reply += `🍸 頂樓酒吧\n`;
    reply += `   • 時間: 18:00-01:00\n`;
    reply += `   • 特色: 夜景、調酒、小點\n`;
    reply += `   • 備註: 需著正式服裝\n`;
    
  } else {
    reply += `⭐ **完整設施列表**\n\n`;
    reply += `🛏️ **客房設施**\n`;
    reply += `   • 免費WiFi\n`;
    reply += `   • 空調系統\n`;
    reply += `   • 液晶電視\n`;
    reply += `   • 迷你冰箱\n`;
    reply += `   • 保險箱\n\n`;
    
    reply += `🏋️ **休閒設施**\n`;
    reply += `   • 健身中心 (06:00-22:00)\n`;
    reply += `   • 游泳池 (07:00-21:00)\n`;
    reply += `   • 三溫暖 (14:00-22:00)\n`;
    reply += `   • 按摩服務 (需預約)\n\n`;
    
    reply += `🍽️ **餐飲設施**\n`;
    reply += `   • 早餐餐廳 (06:30-10:30)\n`;
    reply += `   • 大廳酒吧 (10:00-23:00)\n`;
    reply += `   • 頂樓酒吧 (18:00-01:00)\n\n`;
    
    reply += `💼 **商務設施**\n`;
    reply += `   • 商務中心 (24小時)\n`;
    reply += `   • 會議室 (需預約)\n`;
    reply += `   • 影印服務\n`;
  }
  
  reply += `\n📞 **使用須知**\n`;
  reply += `• 房客免費使用大部分設施\n`;
  reply += `• 部分設施需提前預約\n`;
  reply += `• 請遵守各設施使用規定\n`;
  reply += `• 詳細資訊請洽櫃檯\n`;
  
  session.step = 'hotel_facilities';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 缺少的函數定義 ====================
function generateBookingSummary(session) {
  const roomType = session.data.roomType;
  const roomInfo = roomCapacityData[roomType];
  const basePrice = roomInfo.price * session.data.nights;
  
  let reply = `📋 **訂單摘要**\n\n`;
  reply += `🏨 房型: ${roomType}\n`;
  reply += `📅 天數: ${session.data.nights}晚\n`;
  reply += `👥 人數: ${session.data.adults}位大人${session.data.children > 0 ? `, ${session.data.children}位小孩` : ''}\n`;
  reply += `💰 基礎價格: NT$${basePrice.toLocaleString()}\n\n`;
  
  reply += `請確認以上資訊是否正確？`;
  
  session.step = 'confirm_booking';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function guideToCompleteBooking(session) {
  let missingInfo = [];
  
  if (!session.data.roomType) missingInfo.push('房型');
  if (!session.data.nights) missingInfo.push('入住天數');
  if (!session.data.adults) missingInfo.push('大人人數');
  
  let reply = `📝 **請提供以下資訊完成訂房：**\n\n`;
  reply += `目前缺少: ${missingInfo.join(', ')}\n\n`;
  
  if (!session.data.roomType) {
    reply += `🏨 **請選擇房型：**\n`;
    reply += `• 標準雙人房 (NT$2,800/晚)\n`;
    reply += `• 豪華雙人房 (NT$3,800/晚)\n`;
    reply += `• 套房 (NT$5,800/晚)\n`;
    reply += `• 家庭房 (NT$4,500/晚)\n\n`;
  }
  
  if (!session.data.nights) {
    reply += `📅 **請輸入入住天數：**\n`;
    reply += `例如: 2晚、3晚\n\n`;
  }
  
  if (!session.data.adults) {
    reply += `👥 **請輸入大人人數：**\n`;
    reply += `例如: 2大、3大\n\n`;
  }
  
  session.step = 'complete_booking_info';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// 其他缺少的函數定義（簡化版）
function handleMemberBenefitsQuery(message, session) {
  let reply = `🎁 **會員優惠方案**\n\n`;
  
  reply += `⭐ **Gold 會員**\n`;
  reply += `   • 房價9折優惠\n`;
  reply += `   • 免費早餐\n`;
  reply += `   • 延遲退房至14:00\n`;
  reply += `   • 房型升等機會\n\n`;
  
  reply += `💎 **Platinum 會員**\n`;
  reply += `   • 房價85折優惠\n`;
  reply += `   • 免費早餐\n`;
  reply += `   • 延遲退房至15:00\n`;
  reply += `   • 保證房型升等\n`;
  reply += `   • 迎賓禮品\n\n`;
  
  reply += `👑 **Diamond 會員**\n`;
  reply += `   • 房價8折優惠\n`;
  reply += `   • 免費早餐+晚餐\n`;
  reply += `   • 延遲退房至16:00\n`;
  reply += `   • 專屬樓層\n`;
  reply += `   • 機場接送服務\n\n`;
  
  reply += `💳 **立即登入會員享優惠**\n`;
  reply += `請輸入您的會員帳號：`;
  
  session.step = 'member_login';
  session.context.awaitingMemberLogin = true;
  
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleMemberLogin(message, session) {
  const cleanMessage = cleanInputMessage(message);
  
  if (memberAccounts[cleanMessage]) {
    const member = memberAccounts[cleanMessage];
    const benefits = memberData[member.level];
    
    session.data.memberLevel = member.level;
    session.data.memberName = member.name;
    session.data.memberPoints = member.points;
    session.context.awaitingMemberLogin = false;
    
    let reply = `👋 歡迎回來，${member.name}！\n\n`;
    reply += `⭐ 您的會員等級: ${benefits.level}\n`;
    reply += `📊 累積點數: ${member.points}點\n`;
    reply += `🎁 專屬優惠: ${benefits.benefits.join('、')}\n\n`;
    reply += `現在訂房即可享受會員優惠！`;
    
    session.step = 'welcome';
    
    return {
      reply: reply,
      nextStep: session.step
    };
  } else {
    let reply = `❌ 會員帳號未找到\n\n`;
    reply += `請確認帳號是否正確，或聯繫客服協助。\n`;
    reply += `您也可以繼續以一般旅客身份訂房。`;
    
    session.context.awaitingMemberLogin = false;
    session.step = 'welcome';
    
    return {
      reply: reply,
      nextStep: session.step
    };
  }
}

function handleChildPolicyQuery(message, session) {
  let reply = `👶 **兒童政策說明**\n\n`;
  
  reply += `📋 **兒童收費標準**\n`;
  reply += `• 0-5歲: 免費 (不佔床)\n`;
  reply += `• 6-11歲: NT$500/晚 (加床)\n`;
  reply += `• 12歲以上: 視同成人\n\n`;
  
  reply += `🛏️ **房型兒童容納**\n`;
  reply += `• 標準雙人房: 最多1位兒童\n`;
  reply += `• 豪華雙人房: 最多2位兒童\n`;
  reply += `• 套房: 最多2位兒童\n`;
  reply += `• 家庭房: 最多3位兒童\n\n`;
  
  reply += `🎁 **兒童友善服務**\n`;
  reply += `• 免費提供嬰兒床\n`;
  reply += `• 兒童沐浴備品\n`;
  reply += `• 兒童專屬拖鞋\n`;
  reply += `• 親子活動推薦\n`;
  
  session.step = 'child_policy';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handlePriceQuery(message, session) {
  let reply = `💰 **房價查詢**\n\n`;
  
  if (session.data.roomType) {
    const roomInfo = roomCapacityData[session.data.roomType];
    const nights = session.data.nights || 1;
    const basePrice = roomInfo.price * nights;
    
    reply += `🏨 ${session.data.roomType}\n`;
    reply += `📅 ${nights}晚\n`;
    reply += `💵 總價: NT$${basePrice.toLocaleString()}\n\n`;
    
    if (session.data.memberLevel) {
      const discount = memberData[session.data.memberLevel].discount;
      const finalPrice = basePrice * (1 - discount);
      reply += `🎁 會員${memberData[session.data.memberLevel].level}折扣: ${discount * 100}%\n`;
      reply += `💰 折後價格: NT$${finalPrice.toLocaleString()}\n`;
    }
  } else {
    reply += `🏨 **房型價格表**\n\n`;
    reply += `🛏️ 標準雙人房: NT$2,800/晚\n`;
    reply += `💎 豪華雙人房: NT$3,800/晚\n`;
    reply += `🏠 套房: NT$5,800/晚\n`;
    reply += `👨‍👩‍👧‍👦 家庭房: NT$4,500/晚\n\n`;
    reply += `💡 請告訴我您想查詢哪種房型？`;
  }
  
  session.step = 'price_query';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleBreakfastQuery(message, session) {
  let reply = `🍽️ **早餐服務說明**\n\n`;
  
  reply += `🕒 **用餐時間**\n`;
  reply += `• 平日: 06:30-10:00\n`;
  reply += `• 假日: 06:30-10:30\n\n`;
  
  reply += `💰 **早餐費用**\n`;
  reply += `• 成人: NT$350/位\n`;
  reply += `• 兒童 (6-12歲): NT$200/位\n`;
  reply += `• 幼兒 (0-5歲): 免費\n\n`;
  
  reply += `🍴 **餐點內容**\n`;
  reply += `• 中西式自助早餐\n`;
  reply += `• 現煮咖啡、新鮮果汁\n`;
  reply += `• 麵包、沙拉、熱食\n`;
  reply += `• 素食選項\n\n`;
  
  reply += `💡 **貼心提醒**\n`;
  reply += `• 部分房型已含早餐\n`;
  reply += `• 會員享早餐優惠\n`;
  reply += `• 可預約房內用餐\n`;
  
  session.step = 'breakfast_query';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleCheckInDate(message, session) {
  let reply = `📅 **入住日期查詢**\n\n`;
  
  reply += `🏨 我們接受未來90天內的訂房\n\n`;
  reply += `📋 **入住須知**\n`;
  reply += `• 入住時間: 15:00後\n`;
  reply += `• 退房時間: 11:00前\n`;
  reply += `• 提早入住: 視房況安排\n`;
  reply += `• 延遲退房: 會員專屬優惠\n\n`;
  
  reply += `💡 **建議**\n`;
  reply += `• 旺季建議提前預訂\n`;
  reply += `• 連續假日有最低住宿天數要求\n`;
  reply += `• 特殊節日價格可能調整\n\n`;
  
  reply += `請告訴我您計劃的入住日期？`;
  
  session.step = 'checkin_date';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleContactInfo(message, session) {
  let reply = `📞 **聯絡資訊**\n\n`;
  
  reply += `🏨 **飯店總機**\n`;
  reply += `• 電話: (02) 1234-5678\n`;
  reply += `• 服務時間: 24小時\n\n`;
  
  reply += `📧 **電子郵件**\n`;
  reply += `• 訂房服務: reservation@hotel.com\n`;
  reply += `• 客服專線: service@hotel.com\n\n`;
  
  reply += `🌐 **線上服務**\n`;
  reply += `• 官方網站: www.hotel.com\n`;
  reply += `• LINE客服: @hotel_service\n`;
  reply += `• Facebook: Hotel Official\n\n`;
  
  reply += `📍 **地址**\n`;
  reply += `台北市信義區松仁路100號\n`;
  
  session.step = 'contact_info';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleCancelBooking(message, session) {
  let reply = `❌ **取消訂房政策**\n\n`;
  
  reply += `📋 **取消時程**\n`;
  reply += `• 入住前3天: 全額退款\n`;
  reply += `• 入住前1-2天: 退款50%\n`;
  reply += `• 入住當天: 恕不退費\n\n`;
  
  reply += `🔄 **更改訂房**\n`;
  reply += `• 可免費更改入住日期一次\n`;
  reply += `• 房型變更視房況安排\n`;
  reply += `• 價格差異需補差額\n\n`;
  
  reply += `📞 **取消方式**\n`;
  reply += `• 致電訂房組: (02) 1234-5678\n`;
  reply += `• 線上取消: 官網會員中心\n`;
  reply += `• Email取消: cancel@hotel.com\n\n`;
  
  reply += `請提供您的訂房編號以協助處理。`;
  
  session.step = 'cancel_booking';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleThankYouMessage(message, session) {
  let reply = `🙏 **感謝您的使用！**\n\n`;
  
  reply += `😊 很榮幸為您服務！\n\n`;
  reply += `💡 如果需要其他協助，請隨時告訴我：\n`;
  reply += `• 訂房服務\n`;
  reply += `• 優惠查詢\n`;
  reply += `• 景點推薦\n`;
  reply += `• 餐廳推薦\n\n`;
  
  reply += `祝您有美好的一天！✨`;
  
  session.step = 'welcome';
  return {
    reply: reply,
    nextStep: session.step
  };
}

function handleBookingConfirmation(message, session) {
  let reply = `✅ **訂房確認中...**\n\n`;
  
  reply += `📋 正在為您處理訂房：\n`;
  reply += `• 房型: ${session.data.roomType || '待確認'}\n`;
  reply += `• 天數: ${session.data.nights || '待確認'}晚\n`;
  reply += `• 人數: ${session.data.adults || '待確認'}大${session.data.children ? ` ${session.data.children}小` : ''}\n\n`;
  
  reply += `⏳ 請稍候，系統正在處理中...`;
  
  // 模擬處理時間
  setTimeout(() => {
    session.step = 'booking_completed';
  }, 2000);
  
  return {
    reply: reply,
    nextStep: 'processing_booking'
  };
}

function handleNumberInput(message, session, lowerMsg) {
  const numberMatch = message.match(/\d+/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[0]);
  
  switch (session.step) {
    case 'ask_child_age':
      session.data.childAge = number;
      return {
        reply: `📝 已記錄孩子年齡: ${number}歲\n\n請告訴我您想選擇哪種房型？`,
        nextStep: 'select_family_room'
      };
      
    case 'select_room_count':
      session.data.roomCount = number;
      return {
        reply: `🏨 已選擇 ${number} 間房間\n\n請輸入入住天數：`,
        nextStep: 'ask_nights'
      };
      
    case 'ask_nights':
      session.data.nights = number;
      return generateBookingSummary(session);
      
    default:
      return null;
  }
}

function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('訂房間')) {
    let reply = `🏨 **歡迎使用訂房服務！**\n\n`;
    
    reply += `📝 請告訴我您的需求：\n`;
    reply += `• 入住人數 (幾位大人、小孩)\n`;
    reply += `• 偏好房型\n`;
    reply += `• 入住天數\n\n`;
    
    reply += `💡 例如：\n`;
    reply += `"2大1小，住3晚" 或\n`;
    reply += `"想要家庭房，2大2小"`;
    
    session.step = 'start_booking';
    session.data = {}; // 重置訂房數據
    
    return {
      reply: reply,
      nextStep: session.step
    };
  }
  return null;
}

function generateDefaultResponse(session) {
  let reply = `🤖 **我是飯店智能助理**\n\n`;
  
  reply += `我可以為您提供以下服務：\n\n`;
  reply += `🏨 **訂房服務**\n`;
  reply += `• 房型選擇與價格查詢\n`;
  reply += `• 會員優惠說明\n`;
  reply += `• 訂房流程協助\n\n`;
  
  reply += `🎯 **旅遊資訊**\n`;
  reply += `• 周邊景點推薦\n`;
  reply += `• 餐廳美食介紹\n`;
  reply += `• 交通方式指引\n\n`;
  
  reply += `💎 **會員服務**\n`;
  reply += `• 會員優惠查詢\n`;
  reply += `• 點數累積說明\n`;
  reply += `• 專屬福利介紹\n\n`;
  
  reply += `請告訴我您需要什麼協助？`;
  
  session.step = 'welcome';
  return {
    reply: reply,
    nextStep: session.step
  };
}

// ==================== 主要對話路由 ====================
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;
  
  if (!message) {
    return res.status(400).json({ 
      error: '訊息內容不能為空',
      reply: '請輸入您想詢問的內容。'
    });
  }

  try {
    console.log('💬 收到聊天請求:', { sessionId, messageLength: message.length });
    
    // 獲取或創建會話
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    
    // 處理訊息
    const response = processMessage(message, session);
    
    // 更新會話步驟
    if (response.nextStep) {
      session.step = response.nextStep;
    }
    
    console.log('✅ 回應生成完成:', { 
      sessionId, 
      step: session.step,
      responseLength: response.reply.length 
    });
    
    // 關鍵修復：完全跳過 n8n 記錄
    // n8nService.logCustomerInquiry(session.sessionId, cleanMessage, response, detectedIntent);
    
    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      nextStep: session.step,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 聊天處理錯誤:', error);
    
    // 關鍵修復：錯誤時也返回用戶友好的回應
    res.json({
      success: false,
      reply: '抱歉，處理您的訊息時發生錯誤。請稍後再試。',
      sessionId: req.body.sessionId,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 會話管理路由 ====================
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, data]) => ({
    id,
    step: data.step,
    lastActivity: new Date(data.lastActivity).toISOString(),
    data: data.data,
    conversationLength: data.conversationHistory.length
  }));
  
  res.json({
    totalSessions: sessions.size,
    sessions: sessionList
  });
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.json({ 
      success: true, 
      message: `會話 ${sessionId} 已刪除` 
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: '會話不存在' 
    });
  }
});

// ==================== 啟動伺服器 ====================
console.log('🔄 正在啟動 Express 伺服器...');
console.log(`📁 當前工作目錄: ${process.cwd()}`);
console.log(`🔧 Node.js 版本: ${process.version}`);
console.log(`🌍 環境變數 PORT: ${process.env.PORT}`);
console.log(`🏠 監聽地址: 0.0.0.0:${PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 飯店客服系統已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`💬 聊天端點: http://0.0.0.0:${PORT}/api/chat`);
  console.log(`📊 會話管理: http://0.0.0.0:${PORT}/api/sessions`);
  console.log(`🔕 n8n 整合: ${n8nService.enabled ? '已啟用' : '未啟用'}`);
  console.log(`\n✅ 系統準備就緒，等待請求...\n`);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
  console.log('🔄 收到 SIGTERM 信號，開始優雅關閉...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 收到 SIGINT 信號，開始優雅關閉...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

// 未捕獲異常處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲異常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

// 導出 app 用於測試
module.exports = app;

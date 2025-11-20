const express = require('express');
const cors = require('cors');
const app = express();

// ==================== 重要：啟用 CORS ====================
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.86:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== Railway 端口配置 ====================
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// ==================== 靜態文件服務配置 ====================
app.use(express.static('public'));
app.use(express.static('.'));

// 中間件
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

const memberAccounts = {
  'gold123': { level: 'gold', name: '王小明', points: 1250 },
  'plat456': { level: 'platinum', name: '陳小美', points: 3500 },
  'dia789': { level: 'diamond', name: '林大為', points: 8900 }
};

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

// ==================== 定義 classifyIntent 函數 ====================
function classifyIntent(message) {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂')) {
    return 'booking';
  } else if (lowerMsg.includes('價格') || lowerMsg.includes('價錢') || lowerMsg.includes('多少錢')) {
    return 'price_query';
  } else if (lowerMsg.includes('景點') || lowerMsg.includes('觀光')) {
    return 'attractions';
  } else if (lowerMsg.includes('餐廳') || lowerMsg.includes('美食')) {
    return 'restaurant';
  } else if (lowerMsg.includes('會員') || lowerMsg.includes('折扣') || lowerMsg.includes('優惠')) {
    return 'membership';
  } else if (lowerMsg.includes('重置') || lowerMsg.includes('重新開始')) {
    return 'reset';
  } else {
    return 'unknown';
  }
}

// ==================== 補充定義 updateSessionState ====================
function updateSessionState(sessionId, intent, message) {
  const session = sessions.get(sessionId);
  if (!session) return;

  switch(intent) {
    case 'reset':
      session.step = 'welcome';
      session.data = {};
      session.context = {};
      break;
    case 'booking':
      session.step = 'start_booking';
      break;
    case 'membership':
      session.step = 'member_login';
      break;
    default:
      // 不改變現有狀態
      break;
  }
  session.lastActivity = Date.now();
}

// ==================== 健康檢查路由 ====================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'AI Hotel Assistant', 
    version: '5.5.0',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    features: ['booking', 'pricing', 'cancellation', 'attractions', 'chat']
  });
});

app.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    service: 'Hotel Chatbot API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== 前端頁面路由 ====================
app.get('/:page', (req, res) => {
  const page = req.params.page;
  if (page.endsWith('.html')) {
    res.sendFile(__dirname + '/public/' + page);
  } else {
    res.sendFile(__dirname + '/public/' + page + '.html');
  }
});

// ==================== 核心功能函數 ====================
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

function cleanInputMessage(message) {
  if (!message) return '';
  return message.replace(/\[translate:\s*|\]/g, '')
               .replace(/\[.*?\]/g, '')
               .replace(/\(.*?\)/g, '')
               .replace(/\s+/g, ' ')
               .trim() || message;
}

// ==================== 處理家庭房型推薦 ====================
function handleFamilyRoomRecommendation(message, session) {
  const lowerMsg = message.toLowerCase();
  
  const adultMatch = message.match(/(\d+)\s*大/);
  const childMatch = message.match(/(\d+)\s*小/);
  
  const adults = adultMatch ? parseInt(adultMatch[1]) : (session.data.adults || 2);
  const children = childMatch ? parseInt(childMatch[1]) : (session.data.children || 0);
  
  session.data.adults = adults;
  session.data.children = children;
  session.data.hasChildren = children > 0;
  
  let reply = `👨‍👩‍👧‍👦 **了解您有 ${adults}位大人${children > 0 ? `和${children}位小孩` : ''}！**\n\n`;
  reply += `🏨 **適合的房型推薦**\n\n`;
  
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
  
  if (children > 0 && !session.data.childAge) {
    reply += `📝 **為了給您更準確的建議**\n`;
    reply += `請問孩子們的年齡是？這會影響房型選擇和費用計算。`;
    session.step = 'ask_child_age';
  } else {
    reply += `請告訴我您想選擇哪種房型？`;
    session.step = 'select_family_room';
  }
  
  return { reply, nextStep: session.step };
}

// ==================== 檢查完整訂房資訊 ====================
function hasCompleteBookingInfo(message, session) {
  const lowerMsg = message.toLowerCase();
  const hasRoomType = /(標準|豪華|套房|家庭房)/.test(message) || session.data.roomType;
  const hasNights = /(\d+)\s*晚/.test(message) || session.data.nights;
  const hasAdults = /(\d+)\s*大/.test(message) || session.data.adults;
  const hasChildren = /(\d+)\s*小/.test(message) || session.data.children;
  const hasPriceQuery = /(價格|價錢|多少錢|總價)/.test(lowerMsg);
  
  if (hasPriceQuery && (hasRoomType || hasNights || hasAdults)) {
    return true;
  }
  
  return (hasRoomType && hasNights && (hasAdults || hasChildren));
}

// ==================== 處理完整訂房查詢 ====================
function handleCompleteBookingQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  let roomType = session.data.roomType;
  if (!roomType) {
    if (lowerMsg.includes('標準')) roomType = '標準雙人房';
    else if (lowerMsg.includes('豪華')) roomType = '豪華雙人房';
    else if (lowerMsg.includes('套房')) roomType = '套房';
    else if (lowerMsg.includes('家庭')) roomType = '家庭房';
    
    if (roomType) session.data.roomType = roomType;
  }
  
  const nightsMatch = message.match(/(\d+)\s*晚/);
  if (nightsMatch) session.data.nights = parseInt(nightsMatch[1]);
  
  const adultMatch = message.match(/(\d+)\s*大/);
  if (adultMatch) session.data.adults = parseInt(adultMatch[1]);
  
  const childMatch = message.match(/(\d+)\s*小/);
  if (childMatch) {
    session.data.children = parseInt(childMatch[1]);
    session.data.hasChildren = true;
  }
  
  const ageMatch = message.match(/(\d+)\s*歲/);
  if (ageMatch) session.data.childAge = parseInt(ageMatch[1]);
  
  if (session.data.roomType && session.data.nights && session.data.adults) {
    return generateBookingSummary(session);
  } else {
    return guideToCompleteBooking(session);
  }
}

function generateBookingSummary(session) {
  const roomType = session.data.roomType;
  const roomInfo = roomCapacityData[roomType];
  const basePrice = roomInfo.price * session.data.nights;
  
  let reply = `📋 **訂單摘要**\n\n`;
  reply += `🏨 房型: ${roomType}\n`;
  reply += `📅 天數: ${session.data.nights}晚\n`;
  reply += `👥 人數: ${session.data.adults}位大人${session.data.children > 0 ? `, ${session.data.children}位小孩` : ''}\n`;
  reply += `💰 基礎價格: NT$${basePrice.toLocaleString()}\n\n`;
  
  if (session.data.memberLevel) {
    const discount = memberData[session.data.memberLevel].discount;
    const finalPrice = basePrice * (1 - discount);
    reply += `🎁 會員${memberData[session.data.memberLevel].level}折扣: ${discount * 100}%\n`;
    reply += `💰 折後價格: NT$${finalPrice.toLocaleString()}\n`;
  }
  
  reply += `請確認以上資訊是否正確？`;
  
  session.step = 'confirm_booking';
  return { reply, nextStep: session.step };
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
  return { reply, nextStep: session.step };
}

// ==================== 各種服務處理函數 ====================
function handleMemberBenefitsQuery(message, session) {
  let reply = `🎁 **會員優惠方案**\n\n`;
  reply += `⭐ **Gold 會員**\n• 房價9折優惠\n• 免費早餐\n• 延遲退房至14:00\n• 房型升等機會\n\n`;
  reply += `💎 **Platinum 會員**\n• 房價85折優惠\n• 免費早餐\n• 延遲退房至15:00\n• 保證房型升等\n• 迎賓禮品\n\n`;
  reply += `👑 **Diamond 會員**\n• 房價8折優惠\n• 免費早餐+晚餐\n• 延遲退房至16:00\n• 專屬樓層\n• 機場接送服務\n\n`;
  reply += `💳 **立即登入會員享優惠**\n請輸入您的會員帳號：`;
  
  session.step = 'member_login';
  session.context.awaitingMemberLogin = true;
  return { reply, nextStep: session.step };
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
    return { reply, nextStep: session.step };
  } else {
    let reply = `❌ 會員帳號未找到\n\n`;
    reply += `請確認帳號是否正確，或聯繫客服協助。\n`;
    reply += `您也可以繼續以一般旅客身份訂房。`;
    
    session.context.awaitingMemberLogin = false;
    session.step = 'welcome';
    return { reply, nextStep: session.step };
  }
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
  return { reply, nextStep: session.step };
}

function handleAttractionsRecommendation(message, session) {
  let reply = `🏞️ **景點推薦**\n\n`;
  reply += `⭐ **熱門景點精選**\n\n`;
  reply += `🏙️ 觀景台\n• 距離: 步行10分鐘\n• 特色: 城市全景、夜景\n• 建議時間: 1小時\n• 門票: NT$300/人\n\n`;
  reply += `🎭 文創園區\n• 距離: 車程15分鐘\n• 特色: 藝術展覽、文創市集\n• 建議時間: 2-3小時\n• 門票: 免費\n\n`;
  reply += `🛍️ 購物特區\n• 距離: 步行8分鐘\n• 特色: 精品商店、特色小店\n• 建議時間: 2-4小時\n• 門票: 免費\n\n`;
  reply += `📋 **旅遊建議**\n• 飯店提供景點導覽手冊\n• 可代訂景點門票享折扣\n• 建議提前預約熱門景點\n• 提供包車旅遊服務\n`;
  
  session.step = 'attractions_recommendation';
  return { reply, nextStep: session.step };
}

function handleRestaurantRecommendation(message, session) {
  let reply = `🍽️ **餐廳推薦**\n\n`;
  reply += `🎯 **精選餐廳**\n\n`;
  reply += `🍽️ 飯店餐廳\n• 位置: 飯店2樓\n• 菜系: 國際自助餐\n• 人均: NT$880+10%\n• 特色: 現場烹飪，多國料理\n\n`;
  reply += `🌃 景觀餐廳\n• 距離: 步行10分鐘\n• 菜系: 融合料理\n• 人均: NT$600-900\n• 特色: 高空夜景，浪漫氛圍\n\n`;
  reply += `🍻 居酒屋\n• 距離: 步行5分鐘\n• 菜系: 日式串燒\n• 人均: NT$400-600\n• 特色: 下班小酌，氣氛輕鬆\n\n`;
  reply += `💡 **訂位服務**\n• 飯店可代訂熱門餐廳\n• 部分餐廳持房卡享折扣\n• 提供外送服務資訊\n• 推薦隱藏版美食地圖\n`;
  
  session.step = 'restaurant_recommendation';
  return { reply, nextStep: session.step };
}

// ==================== 其他服務處理函數 ====================
function handleShoppingRecommendation(message, session) {
  let reply = `🛍️ **購物推薦**\n\n`;
  reply += `🏬 **熱門購物中心**\n\n`;
  reply += `🛍️ **市中心百貨**\n• 距離: 步行8分鐘\n• 樓層: B2-8F (美食、服飾、家電)\n• 營業時間: 11:00-21:30\n\n`;
  reply += `🏪 **生活購物中心**\n• 距離: 車程5分鐘\n• 特色: 超市、餐廳、電影院\n• 營業時間: 10:00-22:00\n\n`;
  reply += `💡 **購物小貼士**\n• 持飯店房卡可享部分商店折扣\n• 滿額可辦理退稅\n• 提供購物袋租借服務\n`;
  
  session.step = 'shopping_recommendation';
  return { reply, nextStep: session.step };
}

function handleNightMarketRecommendation(message, session) {
  let reply = `🌃 **夜市推薦**\n\n`;
  reply += `🍢 **觀光夜市**\n• 距離: 步行12分鐘\n• 營業時間: 17:00-24:00 (每日)\n• 推薦美食: 蚵仔煎、臭豆腐、珍珠奶茶\n• 特色: 200+攤位，遊戲區、表演\n\n`;
  reply += `📋 **夜市小知識**\n• 最佳時間: 19:00-21:00 (人潮適中)\n• 現金準備: 建議攜帶NT$500-1000現金\n• 必吃美食: 大腸包小腸、雞排、芒果冰\n`;
  
  session.step = 'night_market_recommendation';
  return { reply, nextStep: session.step };
}

function handleEntertainmentRecommendation(message, session) {
  let reply = `🎭 **娛樂活動推薦**\n\n`;
  reply += `⭐ **多元娛樂選擇**\n\n`;
  reply += `🎳 **保齡球館**\n• 距離: 車程8分鐘\n• 營業時間: 10:00-24:00\n• 費用: NT$120-180/局\n\n`;
  reply += `🎯 **射箭場**\n• 距離: 車程12分鐘\n• 營業時間: 13:00-22:00\n• 體驗: NT$250/小時 (含教學)\n\n`;
  reply += `💡 **預約服務**\n• 飯店可協助預訂熱門活動\n• 持房卡享合作商家折扣\n`;
  
  session.step = 'entertainment_recommendation';
  return { reply, nextStep: session.step };
}

function handleTransportationInfo(message, session) {
  let reply = `🚗 **交通資訊**\n\n`;
  reply += `📍 **周邊交通**\n\n`;
  reply += `🚶 **步行可達**\n• 購物中心: 8分鐘\n• 夜市: 12分鐘\n• 捷運站: 5分鐘\n\n`;
  reply += `🚕 **計程車**\n• 起跳: NT$70 (1.25公里)\n• 叫車專線: 55688\n• 飯店代叫: 免費服務\n\n`;
  reply += `🗺️ **交通小貼士**\n• 下載"台灣等公車"APP查詢即時班次\n• 使用悠遊卡享轉乘優惠\n• 飯店提供免費市區地圖\n`;
  
  session.step = 'transportation_info';
  return { reply, nextStep: session.step };
}

function handleHotelFacilities(message, session) {
  let reply = `🏨 **飯店設施**\n\n`;
  reply += `⭐ **完整設施列表**\n\n`;
  reply += `🛏️ **客房設施**\n• 免費WiFi\n• 空調系統\n• 液晶電視\n• 迷你冰箱\n• 保險箱\n\n`;
  reply += `🏋️ **休閒設施**\n• 健身中心 (06:00-22:00)\n• 游泳池 (07:00-21:00)\n• 三溫暖 (14:00-22:00)\n• 按摩服務 (需預約)\n\n`;
  reply += `📞 **使用須知**\n• 房客免費使用大部分設施\n• 部分設施需提前預約\n• 請遵守各設施使用規定\n`;
  
  session.step = 'hotel_facilities';
  return { reply, nextStep: session.step };
}

// ==================== 主要對話處理邏輯 ====================
function processMessage(message, session) {
  const cleanMessage = cleanInputMessage(message);
  const lowerMsg = cleanMessage.toLowerCase();
  
  session.conversationHistory.push({
    role: 'user',
    content: cleanMessage,
    timestamp: new Date().toISOString()
  });
  
  console.log('🔄 處理訊息:', { original: message, cleaned: cleanMessage, step: session.step });
  
  let response = null;

  // 重置會話
  if (lowerMsg.includes('重置') || lowerMsg.includes('重新開始')) {
    session.step = 'welcome';
    session.data = {};
    session.context = {};
    session.conversationHistory = [];
    response = {
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 餐廳推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
  }
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help') || lowerMsg.includes('指令')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看各項優惠政策\n• 附近景點 - 推薦周邊景點\n• 餐廳推薦 - 推薦美食餐廳\n• 飯店設施 - 介紹飯店設施\n• 兒童政策 - 了解兒童收費標準\n• 取消訂房 - 取消現有訂單\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇房間數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
  }
  // 完整訂房資訊
  else if (hasCompleteBookingInfo(cleanMessage, session)) {
    response = handleCompleteBookingQuery(cleanMessage, session);
  }
  // 家庭推薦
  else if (lowerMsg.includes('適合') || lowerMsg.includes('推薦') || 
         (session.data.hasChildren && !session.data.roomType)) {
    response = handleFamilyRoomRecommendation(cleanMessage, session);
  }
  // 會員相關
  else if (lowerMsg.includes('會員') || lowerMsg.includes('優惠') || lowerMsg.includes('折扣')) {
    response = handleMemberBenefitsQuery(cleanMessage, session);
  }
  // 會員登入
  else if (session.step === 'member_login' || lowerMsg.includes('登入') || 
      (session.context.awaitingMemberLogin && /^[a-zA-Z0-9]+$/.test(cleanMessage))) {
    response = handleMemberLogin(cleanMessage, session);
  }
  // 價格查詢
  else if (lowerMsg.includes('價格') || lowerMsg.includes('價錢') || lowerMsg.includes('多少錢')) {
    response = handlePriceQuery(cleanMessage, session);
  }
  // 景點推薦
  else if (lowerMsg.includes('景點') || lowerMsg.includes('觀光')) {
    response = handleAttractionsRecommendation(cleanMessage, session);
  }
  // 餐廳推薦
  else if (lowerMsg.includes('餐廳') || lowerMsg.includes('美食')) {
    response = handleRestaurantRecommendation(cleanMessage, session);
  }
  // 購物推薦
  else if (lowerMsg.includes('購物') || lowerMsg.includes('商場')) {
    response = handleShoppingRecommendation(cleanMessage, session);
  }
  // 夜市推薦
  else if (lowerMsg.includes('夜市')) {
    response = handleNightMarketRecommendation(cleanMessage, session);
  }
  // 娛樂活動
  else if (lowerMsg.includes('娛樂') || lowerMsg.includes('活動')) {
    response = handleEntertainmentRecommendation(cleanMessage, session);
  }
  // 交通資訊
  else if (lowerMsg.includes('交通') || lowerMsg.includes('機場')) {
    response = handleTransportationInfo(cleanMessage, session);
  }
  // 飯店設施
  else if (lowerMsg.includes('設施') || lowerMsg.includes('健身房')) {
    response = handleHotelFacilities(cleanMessage, session);
  }
  // 訂房相關
  else if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂')) {
    response = {
      reply: '🏨 **歡迎使用訂房服務！**\n\n請告訴我：\n• 入住人數 (幾位大人、小孩)\n• 偏好房型\n• 入住天數\n\n例如："2大1小，住3晚" 或 "想要家庭房，2大2小"',
      nextStep: 'start_booking'
    };
    session.data = {};
  }
  // 默認回應
  else {
    response = {
      reply: '🤖 **我是飯店智能助理**\n\n我可以為您提供：\n🏨 訂房服務\n💰 價格查詢\n🎯 景點推薦\n🍽️ 餐廳推薦\n💎 會員服務\n\n請告訴我您需要什麼協助？',
      nextStep: 'welcome'
    };
  }

  if (response) {
    session.conversationHistory.push({
      role: 'assistant',
      content: response.reply,
      timestamp: new Date().toISOString()
    });
  }

  return response || {
    reply: '抱歉，我還在學習中。請嘗試：訂房、價格查詢、景點推薦等服務。',
    nextStep: session.step
  };
}

// ==================== 主要對話路由 ====================
app.post('/chat', async (req, res) => {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;
    
// 新增：意圖分類
  const intent = classifyIntent(message);
  console.log(`🎯 識別意圖: ${intent}`, { message });
  
  // 新增：會話狀態管理
  updateSessionState(sessionId, intent, message);
  
    if (!message) {
    return res.status(400).json({ 
      error: '訊息內容不能為空',
      reply: '請輸入您想詢問的內容。'
    });
  }

  try {
    console.log('💬 收到聊天請求:', { sessionId, message });
    
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    
    const response = processMessage(message, session);
    
    if (response.nextStep) {
      session.step = response.nextStep;
    }
    
    console.log('✅ 回應生成完成:', { sessionId, step: session.step });
    
    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      nextStep: session.step,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 聊天處理錯誤:', error);
    res.json({
      success: false,
      reply: '抱歉，處理您的訊息時發生錯誤。請稍後再試。',
      sessionId: req.body.sessionId,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== 啟動伺服器 ====================
console.log('🔄 正在啟動 Express 伺服器...');
console.log(`🔧 Node.js 版本: ${process.version}`);
console.log(`🌍 環境變數 PORT: ${process.env.PORT}`);
console.log(`🏠 監聽地址: ${HOST}:${PORT}`);

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 飯店客服系統已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`💬 聊天端點: http://0.0.0.0:${PORT}/chat`);
  console.log(`✅ CORS 已啟用: 允許 localhost:3000 訪問`);
  console.log(`\n🎯 系統準備就緒，等待請求...\n`);
});

process.on('SIGINT', () => {
  console.log('🔄 收到 SIGINT 信號，開始優雅關閉...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

// 導出 app 用於測試
module.exports = app;

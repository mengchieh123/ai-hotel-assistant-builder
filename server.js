const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

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
    this.baseUrl = process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.railway.app';
    this.apiKey = process.env.N8N_API_KEY;
    this.enabled = !!process.env.N8N_WEBHOOK_URL;
  }

  // 發送訂房確認到 n8n
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
        discounts: bookingData.discounts || [],
        extraCharges: bookingData.extraCharges || [],
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

  // 記錄客戶查詢到 n8n
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

  // 發送優惠查詢到 n8n
  async logPromotionInquiry(sessionId, promotionType, userMessage) {
    if (!this.enabled) return null;

    try {
      const payload = {
        action: 'promotion_inquiry',
        sessionId,
        promotionType,
        userMessage,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      fetch(`${this.baseUrl}/webhook/promotion-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload)
      }).catch(console.error);

    } catch (error) {
      console.error('❌ n8n 優惠查詢記錄錯誤:', error.message);
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
    suitableFor: ['情侶', '單人', '商務旅客'],
    notSuitableFor: ['2大2小家庭', '需要多床的團體']
  },
  '豪華雙人房': {
    maxAdults: 2,
    maxChildren: 2,
    maxTotal: 3,
    bedType: '1張加大雙人床',
    size: '35平方公尺',
    description: '加大雙人床，景觀較佳，可加嬰兒床',
    price: 3800,
    suitableFor: ['情侶', '小家庭(2大1小)', '蜜月旅客'],
    notSuitableFor: ['2大2小(較大兒童)']
  },
  '套房': {
    maxAdults: 3,
    maxChildren: 2,
    maxTotal: 4,
    bedType: '1張雙人床 + 沙發床',
    size: '48平方公尺',
    description: '獨立客廳，豪華衛浴，空間寬敞',
    price: 5800,
    suitableFor: ['家庭(2大2小)', '商務旅客', '需要額外空間的旅客'],
    notSuitableFor: []
  },
  '家庭房': {
    maxAdults: 2,
    maxChildren: 3,
    maxTotal: 4,
    bedType: '2張雙人床',
    size: '42平方公尺',
    description: '兩張雙人床，專為家庭設計',
    price: 4500,
    suitableFor: ['家庭(2大2小)', '帶小孩的家庭', '需要多床的團體'],
    notSuitableFor: ['單人旅客']
  }
};

// ==================== 優惠政策資料庫 ====================
const promotionPolicies = {
  senior: {
    name: "長者優惠",
    description: "65歲以上長者專屬優惠",
    discount: 0.1,
    conditions: ["需出示身份證件", "限本人使用", "需提前預訂"],
    applicable: ["所有房型"],
    blackout_dates: ["國定假日", "連續假期"],
    questions: ["老人有優惠嗎？", "65歲以上有什麼折扣？", "長者優惠", "銀髮族優惠"]
  },
  
  long_stay: {
    name: "長住優惠", 
    description: "長期住宿專屬優惠",
    tiers: [
      { nights: 7, discount: 0.15 },
      { nights: 14, discount: 0.2 },
      { nights: 30, discount: 0.3 }
    ],
    conditions: ["需連續住宿", "需提前預訂", "不含餐飲"],
    questions: ["長住優惠", "住一個月有優惠嗎？", "長期住宿折扣", "住一週以上優惠"]
  },
  
  group: {
    name: "團體優惠",
    description: "多間房間團體優惠",
    tiers: [
      { rooms: 3, discount: 0.1 },
      { rooms: 5, discount: 0.15 },
      { rooms: 10, discount: 0.2 }
    ],
    conditions: ["需同時入住", "需同一訂單", "需提前14天預訂"],
    questions: ["團體優惠", "多間房折扣", "3間房間優惠", "團體訂房"]
  },
  
  member: {
    name: "會員優惠",
    description: "會員專屬優惠方案",
    benefits: [
      "房價9折優惠",
      "免費延遲退房至14:00", 
      "入住迎賓水果",
      "累積點數兌換免費住宿",
      "會員專屬活動"
    ],
    join_conditions: [
      "免費加入",
      "需提供基本資料", 
      "首次入住即可申請",
      "累積住宿 nights 升級會籍"
    ],
    questions: ["會員優惠", "怎麼成為會員？", "會員有什麼好處？", "VIP優惠"]
  },
  
  children: {
    name: "兒童政策",
    description: "兒童收費及加床政策",
    policies: [
      {
        age: "0-2",
        policy: "嬰兒免費同住",
        conditions: ["需與父母同房", "不提供額外備品", "可提供嬰兒床（需預訂）"],
        extraCharge: 0,
        requiresExtraBed: false
      },
      {
        age: "3-5", 
        policy: "幼兒免費同住",
        conditions: ["需與父母同房", "提供兒童備品", "可提供加床（NT$500/晚）"],
        extraCharge: 0,
        requiresExtraBed: false
      },
      {
        age: "6-11",
        policy: "兒童可選擇加床或免費同住", 
        conditions: ["加床費用 NT$800/晚", "免費同住不提供額外備品", "建議加床以確保舒適度"],
        extraCharge: 800,
        requiresExtraBed: true
      },
      {
        age: "12-17",
        policy: "視同成人收費", 
        conditions: ["需加床或訂額外房間", "可享兒童優惠價", "需成人陪同"],
        extraCharge: 0, // 直接算成人
        requiresExtraBed: true
      }
    ],
    questions: ["小孩要加價嗎？", "兒童收費", "小朋友住宿", "加床費用", "嬰兒要錢嗎？", "孩子幾歲要收費？"]
  }
};

// ==================== 景點資料庫 ====================
const attractionsData = {
  food: [
    {
      name: "鼎泰豐",
      type: "美食",
      cuisine: "台灣菜",
      rating: 4.5,
      distance: "0.3km",
      address: "信義區市府路45號",
      description: "知名小籠包專賣店，米其林一星"
    }
  ],
  shopping: [
    {
      name: "台北101購物中心",
      type: "購物",
      category: "百貨公司",
      rating: 4.6,
      distance: "0.5km",
      address: "信義區市府路45號",
      description: "知名地標購物中心，國際精品齊全"
    }
  ],
  sightseeing: [
    {
      name: "台北101觀景台",
      type: "觀光",
      category: "地標",
      rating: 4.7,
      distance: "0.5km",
      address: "信義區市府路45號89樓",
      description: "台北地標建築，俯瞰全市美景"
    }
  ]
};

// ==================== 飯店設施資料 ====================
const hotelFacilities = {
  dining: [
    {
      name: "頂樓景觀餐廳",
      type: "餐廳",
      hours: "06:00-22:00",
      description: "提供自助早餐和晚餐，可欣賞城市夜景",
      location: "頂樓"
    }
  ],
  recreation: [
    {
      name: "室外游泳池",
      type: "泳池",
      hours: "07:00-21:00",
      description: "25公尺溫水泳池，附設按摩池",
      location: "三樓"
    }
  ],
  services: [
    {
      name: "商務中心",
      type: "商務",
      hours: "24小時",
      description: "提供電腦、印表機、會議室租借",
      location: "二樓"
    }
  ]
};

// ==================== 增強版對話處理 ====================
function processMessage(message, session) {
  const cleanMessage = cleanInputMessage(message);
  const lowerMsg = cleanMessage.toLowerCase();
  
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
    response = {
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
    detectedIntent = 'reset';
  }
  
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help') || lowerMsg.includes('指令')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看各項優惠政策\n• 附近景點 - 推薦周邊景點\n• 飯店設施 - 介紹飯店設施\n• 兒童政策 - 了解兒童收費標準\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇房間數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
    detectedIntent = 'help';
  }

  // === 優先處理確認動作 ===
  else if (!response) {
    response = handleConfirmation(lowerMsg, session);
    if (response) detectedIntent = 'confirmation';
  }
  
  // === 優先處理家庭人數查詢 (2大2小等) ===
  if (!response) {
    response = handleFamilySizeQuery(cleanMessage, session);
    if (response) detectedIntent = 'family_size_query';
  }
  
  // === 優惠政策查詢 ===
  if (!response) {
    response = handlePromotionQuery(lowerMsg, session);
    if (response) detectedIntent = 'promotion';
  }
  
  // === 景點相關查詢 ===
  if (!response && (lowerMsg.includes('附近') || lowerMsg.includes('景點') || lowerMsg.includes('好玩') || 
      lowerMsg.includes('推薦') || lowerMsg.includes('美食') || lowerMsg.includes('購物'))) {
    response = handleAttractionsQuery(lowerMsg, session);
    detectedIntent = 'attractions';
  }
  
  // === 設施相關查詢 ===
  if (!response && (lowerMsg.includes('設施') || lowerMsg.includes('設備') || lowerMsg.includes('服務') ||
      lowerMsg.includes('泳池') || lowerMsg.includes('健身房') || lowerMsg.includes('早餐'))) {
    response = handleFacilitiesQuery(lowerMsg, session);
    detectedIntent = 'facilities';
  }
  
  // === 數字處理 ===
  if (!response) {
    response = handleNumberInputEnhanced(cleanMessage, session, lowerMsg);
    if (response) detectedIntent = 'number_input';
  }
  
  // === 訂房相關 ===
  if (!response) {
    response = handleBookingIntent(lowerMsg, session);
    if (response) detectedIntent = 'booking';
  }

  // 記錄客戶查詢到 n8n（異步）
  if (response) {
    n8nService.logCustomerInquiry(session.sessionId, cleanMessage, response, detectedIntent)
      .catch(error => console.error('n8n 記錄失敗:', error));
  } else {
    response = generateDefaultResponse(session);
    detectedIntent = 'default';
  }

  return response;
}

// ==================== 家庭人數查詢處理 ====================
function handleFamilySizeQuery(message, session) {
  // 匹配各種家庭人數格式
  const familyPatterns = [
    /(\d+)\s*大\s*(\d+)\s*小/,           // 2大2小
    /(\d+)\s*個?\s*大人\s*(\d+)\s*個?\s*小孩/, // 2個大人2個小孩
    /(\d+)\s*個?\s*大人.*?(\d+)\s*個?\s*小孩/, // 2個大人和2個小孩
    /(\d+)\s*adults?\s*(\d+)\s*kids?/i   // 2 adults 2 kids
  ];
  
  let adults = 0;
  let children = 0;
  
  for (const pattern of familyPatterns) {
    const match = message.match(pattern);
    if (match) {
      adults = parseInt(match[1]);
      children = parseInt(match[2]);
      break;
    }
  }
  
  // 如果沒有匹配到標準格式，嘗試其他關鍵詞
  if (adults === 0 && children === 0) {
    if (message.includes('兩大兩小') || message.includes('2大2小') || 
        message.includes('兩個大人兩個小孩')) {
      adults = 2;
      children = 2;
    } else if (message.includes('適合') && (message.includes('家庭') || message.includes('小孩'))) {
      // 通用家庭查詢
      adults = 2;
      children = 2;
    }
  }
  
  if (adults > 0 && children > 0) {
    console.log(`👨‍👩‍👧‍👦 檢測到家庭查詢: ${adults}大${children}小`);
    
    session.data.adults = adults;
    session.data.children = children;
    session.data.hasChildren = true;
    session.context.familyQuery = true;
    
    // 尋找適合的房型
    const suitableRooms = findSuitableRooms(adults, children);
    
    if (suitableRooms.length > 0) {
      let reply = `👨‍👩‍👧‍👦 根據 ${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''}，推薦以下房型：\n\n`;
      
      suitableRooms.forEach(room => {
        const roomInfo = roomCapacityData[room.roomType];
        reply += `🏨 **${room.roomType}**\n`;
        reply += `   💰 NT$${roomInfo.price}/晚\n`;
        reply += `   🛏️ ${roomInfo.bedType}\n`;
        reply += `   📏 ${roomInfo.size}\n`;
        reply += `   📝 ${roomInfo.description}\n`;
        
        if (room.recommendation) {
          reply += `   💡 ${room.recommendation}\n`;
        }
        
        reply += `   ✅ ${room.suitability}\n\n`;
      });
      
      // 詢問兒童年齡以提供更精確的建議
      reply += `為了提供更準確的費用資訊，請問小孩的年齡是？`;
      
      session.step = 'ask_child_age_for_family';
      session.context.lastQuestion = 'child_age';
      
      return {
        reply: reply,
        nextStep: 'ask_child_age_for_family'
      };
    } else {
      // 沒有合適的單一房型，建議多間房間
      return suggestMultipleRooms(adults, children, session);
    }
  }
  
  return null;
}

// 尋找適合的房型
function findSuitableRooms(adults, children) {
  const suitable = [];
  const totalGuests = adults + children;
  
  for (const [roomType, capacity] of Object.entries(roomCapacityData)) {
    const canAccommodateAdults = adults <= capacity.maxAdults;
    const canAccommodateChildren = children <= capacity.maxChildren;
    const canAccommodateTotal = totalGuests <= capacity.maxTotal;
    
    if (canAccommodateAdults && canAccommodateChildren && canAccommodateTotal) {
      let suitability = '';
      let recommendation = '';
      
      if (roomType === '家庭房') {
        suitability = '👍 最適合家庭入住';
        recommendation = '專為家庭設計，兩張雙人床';
      } else if (roomType === '套房') {
        suitability = '👍 適合家庭，空間寬敞';
        recommendation = '有獨立客廳，可加沙發床';
      } else if (roomType === '豪華雙人房' && children <= 1) {
        suitability = '👌 可接受，建議嬰兒或幼兒';
        recommendation = '可加嬰兒床，適合小家庭';
      } else {
        suitability = '⚠️ 基本符合，請確認舒適度';
      }
      
      suitable.push({
        roomType,
        suitability,
        recommendation
      });
    }
  }
  
  return suitable;
}

// 建議多間房間
function suggestMultipleRooms(adults, children, session) {
  const totalGuests = adults + children;
  let reply = `👨‍👩‍👧‍👦 針對 ${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''} 的組合：\n\n`;
  
  reply += `目前沒有單一房型可以容納所有成員，建議方案：\n\n`;
  
  // 計算需要的房間組合
  const roomCombinations = calculateRoomCombinations(adults, children);
  
  roomCombinations.forEach((combo, index) => {
    reply += `**方案 ${index + 1}:** ${combo.description}\n`;
    reply += `   💰 估算費用: NT$${combo.estimatedPrice.toLocaleString()}\n`;
    reply += `   ✅ ${combo.advantages.join('、')}\n\n`;
  });
  
  reply += `請告訴我您偏好哪種方案，或需要其他協助？`;
  
  session.step = 'suggest_multiple_rooms';
  return {
    reply: reply,
    nextStep: 'suggest_multiple_rooms'
  };
}

// 計算房間組合
function calculateRoomCombinations(adults, children) {
  const combinations = [];
  
  // 方案1: 家庭房 + 標準房
  if (adults <= 4 && children <= 3) {
    const familyRoomPrice = roomCapacityData['家庭房'].price;
    const standardRoomPrice = roomCapacityData['標準雙人房'].price;
    combinations.push({
      description: '1間家庭房 + 1間標準雙人房',
      rooms: ['家庭房', '標準雙人房'],
      estimatedPrice: familyRoomPrice + standardRoomPrice,
      advantages: ['家庭房適合帶小孩', '標準房給其他成人', '靈活分配']
    });
  }
  
  // 方案2: 兩間家庭房
  combinations.push({
    description: '2間家庭房',
    rooms: ['家庭房', '家庭房'],
    estimatedPrice: roomCapacityData['家庭房'].price * 2,
    advantages: ['每間都有兩張雙人床', '隱私性佳', '適合大家庭']
  });
  
  // 方案3: 套房 + 豪華房
  combinations.push({
    description: '1間套房 + 1間豪華雙人房',
    rooms: ['套房', '豪華雙人房'],
    estimatedPrice: roomCapacityData['套房'].price + roomCapacityData['豪華雙人房'].price,
    advantages: ['套房空間寬敞', '豪華房舒適', '品質較高']
  });
  
  return combinations;
}

// ==================== 確認處理函數 ====================
function handleConfirmation(message, session) {
  const confirmKeywords = ['確認', '是的', '沒錯', '對', '好', 'ok', 'okay', 'yes', 'y', 'correct'];
  const cancelKeywords = ['取消', '不要', '不對', '錯誤', 'no', 'n', '重新輸入'];
  
  const isConfirmation = confirmKeywords.some(keyword => message.includes(keyword));
  const isCancellation = cancelKeywords.some(keyword => message.includes(keyword));
  
  if (!isConfirmation && !isCancellation) return null;
  
  console.log('✅ 處理確認動作:', { isConfirmation, isCancellation, step: session.step });
  
  switch(session.step) {
    case 'confirm_booking':
      if (isConfirmation) {
        return completeBooking(session);
      } else {
        return restartBookingProcess(session);
      }
      
    case 'ask_child_age':
    case 'ask_child_age_for_family':
    case 'ask_guests':
    case 'ask_room_count':
    case 'ask_nights':
      return handleStepConfirmation(message, session);
      
    case 'booking_completed':
      if (isConfirmation) {
        session.step = 'welcome';
        session.data = {};
        return {
          reply: '感謝您的使用！請問還有其他需要協助的嗎？',
          nextStep: 'welcome'
        };
      }
      return null;
      
    default:
      return null;
  }
}

// ==================== 完成訂房流程 ====================
async function completeBooking(session) {
  const finalPrice = calculateFinalPrice(session.data);
  const orderNumber = generateOrderNumber();
  const confirmation = generateConfirmationLetter(session.data, finalPrice, orderNumber);
  
  session.step = 'booking_completed';
  session.data.orderNumber = orderNumber;
  session.data.finalPrice = finalPrice.finalPrice;
  session.data.basePrice = finalPrice.basePrice;
  session.data.discounts = finalPrice.discounts;
  session.data.extraCharges = finalPrice.extraCharges;
  session.data.bookingTime = new Date().toISOString();
  session.data.sessionId = session.sessionId;

  // 發送到 n8n（異步）
  n8nService.sendBookingConfirmation(session.data)
    .then(result => {
      if (result) {
        console.log('🎉 n8n 訂房處理完成');
      }
    })
    .catch(error => {
      console.error('❌ n8n 訂房處理失敗:', error);
    });

  return {
    reply: confirmation,
    nextStep: 'booking_completed'
  };
}

// 計算最終價格
function calculateFinalPrice(bookingData) {
  const roomType = bookingData.roomType;
  if (!roomType || !roomCapacityData[roomType]) {
    return {
      basePrice: 0,
      totalPrice: 0,
      discounts: [],
      extraCharges: [],
      finalPrice: 0
    };
  }
  
  const roomPrice = roomCapacityData[roomType].price;
  let basePrice = roomPrice * (bookingData.roomCount || 1) * (bookingData.nights || 1);
  let totalPrice = basePrice;
  let discounts = [];
  let extraCharges = [];
  
  // 應用長住優惠
  if (bookingData.nights >= 7) {
    const longStayDiscount = bookingData.nights >= 30 ? 0.3 : 
                            bookingData.nights >= 14 ? 0.2 : 0.15;
    totalPrice *= (1 - longStayDiscount);
    discounts.push(`長住優惠 ${longStayDiscount * 100}%`);
  }
  
  // 應用團體優惠
  if (bookingData.roomCount >= 3) {
    const groupDiscount = bookingData.roomCount >= 10 ? 0.2 :
                         bookingData.roomCount >= 5 ? 0.15 : 0.1;
    totalPrice *= (1 - groupDiscount);
    discounts.push(`團體優惠 ${groupDiscount * 100}%`);
  }
  
  // 兒童加床費用
  if (bookingData.childAge >= 6 && bookingData.childAge < 12 && bookingData.children > 0) {
    const childPolicy = getChildPolicy(bookingData.childAge);
    if (childPolicy && childPolicy.extraCharge > 0) {
      const extraBedCost = childPolicy.extraCharge * bookingData.nights * bookingData.children;
      totalPrice += extraBedCost;
      extraCharges.push(`兒童加床費 NT$${extraBedCost}`);
    }
  }
  
  // 寵物清潔費
  if (bookingData.hasPets) {
    const petFee = 500 * bookingData.nights * bookingData.roomCount;
    totalPrice += petFee;
    extraCharges.push(`寵物清潔費 NT$${petFee}`);
  }
  
  return {
    basePrice: Math.round(basePrice),
    totalPrice: Math.round(totalPrice),
    discounts: discounts,
    extraCharges: extraCharges,
    finalPrice: Math.round(totalPrice)
  };
}

// 獲取兒童政策
function getChildPolicy(age) {
  for (const policy of promotionPolicies.children.policies) {
    const ageRange = policy.age.split('-');
    const minAge = parseInt(ageRange[0]);
    const maxAge = parseInt(ageRange[1]);
    
    if (age >= minAge && age <= maxAge) {
      return policy;
    }
  }
  return null;
}

// 生成訂單編號
function generateOrderNumber() {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `HTL${timestamp}${random}`;
}

// 生成訂房確認信
function generateConfirmationLetter(bookingData, priceInfo, orderNumber) {
  const checkInTime = "15:00";
  const checkOutTime = "11:00";
  const paymentLink = `https://booking.hotel.com/pay/${orderNumber}`;
  
  let confirmation = `
🎉 **訂房確認完成！**

📋 **訂單資訊**
• 訂單編號：${orderNumber}
• 訂房時間：${new Date().toLocaleString('zh-TW')}

🏨 **住宿詳情`
  
  if (Array.isArray(bookingData.rooms)) {
    bookingData.rooms.forEach(room => {
      confirmation += `\n• ${room}`;
    });
  } else {
    confirmation += `\n• 房型：${bookingData.roomType}`;
    confirmation += `\n• 房間數量：${bookingData.roomCount}間`;
  }
  
  confirmation += `\n• 入住人數：${bookingData.adults}位大人${bookingData.children ? ` + ${bookingData.children}位小孩` : ''}`;
  
  if (bookingData.childAge) {
    confirmation += ` (小孩${bookingData.childAge}歲)`;
  }
  
  confirmation += `\n• 住宿天數：${bookingData.nights}晚`;
  confirmation += `\n• 入住時間：${checkInTime}`;
  confirmation += `\n• 退房時間：${checkOutTime}`;

  confirmation += `\n\n💰 **費用明細`;
  
  if (priceInfo.discounts.length > 0) {
    confirmation += `\n• 適用優惠：${priceInfo.discounts.join('、')}`;
  }
  
  if (priceInfo.extraCharges.length > 0) {
    confirmation += `\n• 額外費用：${priceInfo.extraCharges.join('、')}`;
  }
  
  confirmation += `
• 總金額：NT$ ${priceInfo.finalPrice.toLocaleString()}

🔗 **下一步驟**
請點擊連結完成付款：${paymentLink}

📞 **客服資訊**
如有任何問題，請聯繫客服：
• 電話：02-1234-5678
• Line：@hotelbooking

感謝您的預訂！我們期待為您服務 🏨
  `;
  
  return confirmation;
}

// 重新開始訂房流程
function restartBookingProcess(session) {
  session.data = {};
  session.step = 'select_room';
  
  return {
    reply: '好的，我們重新開始訂房流程。請問您想要預訂哪種房型？\n\n' +
           '🏨 可選房型：\n' +
           '• 標準雙人房 (NT$2,800/晚)\n' +
           '• 豪華雙人房 (NT$3,800/晚)\n' + 
           '• 套房 (NT$5,800/晚)\n' +
           '• 家庭房 (NT$4,500/晚)',
    nextStep: 'select_room'
  };
}

// 處理步驟確認
function handleStepConfirmation(message, session) {
  switch(session.step) {
    case 'ask_child_age':
    case 'ask_child_age_for_family':
      if (!session.data.childAge) {
        return {
          reply: '請告訴我小孩的年齡，這樣我才能提供準確的費用資訊。',
          nextStep: session.step
        };
      }
      
      // 根據兒童年齡提供具體建議
      const childPolicy = getChildPolicy(session.data.childAge);
      let reply = `了解，小孩${session.data.childAge}歲。`;
      
      if (childPolicy) {
        reply += ` ${childPolicy.policy}`;
        if (childPolicy.extraCharge > 0) {
          reply += `，加床費用 NT$${childPolicy.extraCharge}/晚`;
        }
      }
      
      if (session.context.familyQuery) {
        // 家庭查詢流程
        session.step = 'ask_room_count';
        reply += `\n\n請問需要預訂幾間房間？`;
        return {
          reply: reply,
          nextStep: 'ask_room_count'
        };
      } else {
        // 一般訂房流程
        session.step = 'ask_room_count';
        reply += `\n\n請問需要預訂幾間${session.data.roomType || '房間'}？`;
        return {
          reply: reply,
          nextStep: 'ask_room_count'
        };
      }
      
    case 'ask_guests':
      if (!session.data.adults) {
        return {
          reply: '請告訴我有幾位大人入住？',
          nextStep: 'ask_guests'
        };
      }
      session.step = 'ask_room_count';
      return {
        reply: `了解，${session.data.adults}位大人。請問需要幾間${session.data.roomType || '房間'}？`,
        nextStep: 'ask_room_count'
      };
      
    case 'ask_room_count':
      if (!session.data.roomCount) {
        return {
          reply: '請告訴我需要預訂幾間房間？',
          nextStep: 'ask_room_count'
        };
      }
      session.step = 'ask_nights';
      return {
        reply: `好的，${session.data.roomCount}間房間。請問打算入住幾晚？`,
        nextStep: 'ask_nights'
      };
      
    case 'ask_nights':
      if (!session.data.nights) {
        return {
          reply: '請告訴我打算入住幾晚？',
          nextStep: 'ask_nights'
        };
      }
      return generateBookingSummary(session);
      
    default:
      return null;
  }
}

// ==================== 修復版數字處理 ====================
function handleNumberInputEnhanced(cleanMessage, session, lowerMsg) {
  const numberMatch = cleanMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  console.log(`🔢 識別到數字: ${number}, 當前步驟: ${session.step}`);
  
  // 防止年份等大數字被誤解
  if (number > 100 && !cleanMessage.includes('歲')) {
    console.log('⚠️  忽略過大數字，可能是年份或其他資訊');
    return null;
  }
  
  // 兒童年齡處理
  if (session.step === 'ask_child_age' || session.step === 'ask_child_age_for_family' || 
      (cleanMessage.includes('歲') && session.data.hasChildren)) {
    session.data.childAge = number;
    session.data.hasChildren = true;
    
    if (!session.data.children) {
      session.data.children = 1;
    }
    
    return generateChildPolicyResponse(number, session.data.children, session);
  }
  
  // 其他數字處理邏輯
  const stepHandlers = {
    'ask_guests': () => {
      if (cleanMessage.includes('大人') || cleanMessage.includes('位') || cleanMessage.includes('個') || 
          cleanMessage.includes('人') || session.context.lastQuestion === 'guests') {
        session.data.adults = number;
        session.step = 'ask_room_count';
        session.context.lastQuestion = 'room_count';
        
        const childMatch = cleanMessage.match(/(\d+)\s*個?\s*(小孩|兒童|孩子)/);
        if (childMatch) {
          session.data.children = parseInt(childMatch[1]);
          session.data.hasChildren = true;
        }
        
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
      return null;
    },
    
    'ask_room_count': () => {
      if (cleanMessage.includes('間') || session.context.lastQuestion === 'room_count') {
        session.data.roomCount = number;
        
        if (session.data.hasChildren && !session.data.childAge) {
          session.step = 'ask_child_age';
          session.context.lastQuestion = 'child_age';
          return {
            reply: `好的，${number}間${session.data.roomType || '房間'}。請問小孩的年齡是？`,
            nextStep: 'ask_child_age'
          };
        } else {
          session.step = 'ask_nights';
          session.context.lastQuestion = 'nights';
          return {
            reply: `好的，${number}間${session.data.roomType || '房間'}。請問打算入住幾晚？`,
            nextStep: 'ask_nights'
          };
        }
      }
      return null;
    },
    
    'ask_nights': () => {
      if (cleanMessage.includes('晚') || cleanMessage.includes('天') || session.context.lastQuestion === 'nights') {
        session.data.nights = number;
        session.step = 'confirm_booking';
        return generateBookingSummary(session);
      }
      return null;
    }
  };
  
  const handler = stepHandlers[session.step];
  return handler ? handler() : null;
}

// 生成兒童政策回應
function generateChildPolicyResponse(childAge, childCount, session) {
  const childPolicy = getChildPolicy(childAge);
  
  let reply = `👨‍👩‍👧‍👦 **兒童政策說明**\n\n`;
  reply += `根據 ${childAge} 歲小孩：\n`;
  reply += `📋 ${childPolicy.policy}\n`;
  
  if (childPolicy.conditions && childPolicy.conditions.length > 0) {
    reply += `\n💡 注意事項：\n`;
    childPolicy.conditions.forEach(condition => {
      reply += `• ${condition}\n`;
    });
  }
  
  if (childAge < 6) {
    reply += `\n🎯 建議：可選擇家庭房，空間較寬敞`;
  } else if (childAge >= 6 && childAge < 12) {
    reply += `\n🎯 建議：可考慮加床或選擇套房`;
    if (childPolicy.extraCharge > 0) {
      reply += ` (加床費 NT$${childPolicy.extraCharge}/晚)`;
    }
  } else {
    reply += `\n🎯 建議：建議預訂額外房間`;
  }
  
  if (session.data.roomType) {
    const roomInfo = roomCapacityData[session.data.roomType];
    if (roomInfo) {
      reply += `\n\n您選擇的 ${session.data.roomType} ${
        session.data.roomType === '家庭房' ? '很適合親子同住' : 
        session.data.roomType === '套房' ? '空間較為寬敞' : 
        '建議確認房間大小是否合適'
      }`;
      
      // 檢查容量
      const totalGuests = (session.data.adults || 0) + (session.data.children || 0);
      if (totalGuests > roomInfo.maxTotal) {
        reply += `\n⚠️ **注意**: ${session.data.roomType} 最多容納 ${roomInfo.maxTotal} 人，您目前有 ${totalGuests} 人，建議考慮其他房型`;
      }
    }
  }
  
  reply += `\n\n是否需要開始訂房流程？`;
  
  session.step = 'child_policy_info';
  return {
    reply: reply,
    nextStep: 'child_policy_info'
  };
}

// 更新訂單摘要生成函數
function generateBookingSummary(session) {
  const priceInfo = calculateFinalPrice(session.data);
  
  session.step = 'confirm_booking';
  
  const summary = `
📋 **訂單摘要**

🏨 住宿資訊
• 房型：${session.data.roomType}
• 房間：${session.data.roomCount}間
• 人數：${session.data.adults}位大人${session.data.children ? ` + ${session.data.children}位小孩` : ''}${session.data.childAge ? ` (小孩${session.data.childAge}歲)` : ''}
• 天數：${session.data.nights}晚

💰 費用估算
${priceInfo.discounts.length > 0 ? `• 適用優惠：${priceInfo.discounts.join('、')}\n` : ''}
${priceInfo.extraCharges.length > 0 ? `• 額外費用：${priceInfo.extraCharges.join('、')}\n` : ''}
• 總金額：NT$ ${priceInfo.finalPrice.toLocaleString()}

請確認以上資訊是否正確？回覆「確認」完成訂房。
  `;
  
  return {
    reply: summary,
    nextStep: 'confirm_booking'
  };
}

// ==================== 其他處理函數 (保持不變) ====================
function handlePromotionQuery(message, session) {
  // ... (保持原有邏輯不變)
}

function handleAttractionsQuery(message, session) {
  // ... (保持原有邏輯不變)
}

function handleFacilitiesQuery(message, session) {
  // ... (保持原有邏輯不變)
}

function handleBookingIntent(lowerMsg, session) {
  // ... (保持原有邏輯不變)
}

function generateDefaultResponse(session) {
  // ... (保持原有邏輯不變)
}

// ==================== 會話清理機制 ====================
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

// ==================== API 路由 (保持不變) ====================
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
      sessionId: sessionId,
      error: true
    });
  }
}

// 健康檢查和其他路由保持不變
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    n8nIntegration: {
      enabled: n8nService.enabled,
      baseUrl: n8nService.baseUrl
    },
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    n8nIntegration: {
      enabled: n8nService.enabled,
      baseUrl: n8nService.baseUrl
    }
  });
});

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

app.get('/api/promotions', (req, res) => {
  const simplifiedPromotions = {};
  
  Object.entries(promotionPolicies).forEach(([key, policy]) => {
    simplifiedPromotions[key] = {
      name: policy.name,
      description: policy.description,
      questions: policy.questions.slice(0, 3)
    };
  });
  
  res.json(simplifiedPromotions);
});

app.get('/api/room-capacity', (req, res) => {
  res.json(roomCapacityData);
});

app.get('/api/n8n-status', (req, res) => {
  res.json({
    enabled: n8nService.enabled,
    baseUrl: n8nService.baseUrl,
    apiKey: n8nService.apiKey ? '已設置' : '未設置'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: '端點不存在',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      'POST /api/chat',
      'POST /chat',
      'GET /api/session/:sessionId', 
      'POST /api/session/:sessionId/reset',
      'GET /api/promotions',
      'GET /api/room-capacity',
      'GET /api/n8n-status',
      'GET /health',
      'GET /api/health'
    ],
    method: req.method
  });
});

// ==================== 啟動伺服器 ====================
app.listen(PORT, () => {
  console.log(`🚀 飯店客服機器人已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log(`🔗 n8n 整合: ${n8nService.enabled ? '已啟用' : '未啟用'}`);
  if (n8nService.enabled) {
    console.log(`   n8n URL: ${n8nService.baseUrl}`);
  }
  console.log(`💾 會話管理: 自動清理機制已啟用`);
  console.log(`🏨 房間容量: ${Object.keys(roomCapacityData).length} 種房型資料已載入`);
});

process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信號，開始關機...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 信號，開始關機...');
  process.exit(0);
});

module.exports = app;

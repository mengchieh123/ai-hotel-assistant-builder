const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

// 會話存儲
const sessions = new Map();

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
        timeout: 10000 // 10秒超時
      });

      if (!response.ok) {
        throw new Error(`n8n 響應錯誤: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ n8n 訂房確認發送成功');
      return result;

    } catch (error) {
      console.error('❌ n8n 訂房確認發送失敗:', error.message);
      // 不拋出錯誤，避免影響主要訂房流程
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
        conditions: ["需與父母同房", "不提供額外備品", "可提供嬰兒床（需預訂）"]
      },
      {
        age: "3-5", 
        policy: "幼兒免費同住",
        conditions: ["需與父母同房", "提供兒童備品", "可提供加床（NT$500/晚）"]
      },
      {
        age: "6-11",
        policy: "兒童可選擇加床或免費同住", 
        conditions: ["加床費用 NT$800/晚", "免費同住不提供額外備品", "建議加床以確保舒適度"]
      },
      {
        age: "12-17",
        policy: "視同成人收費", 
        conditions: ["需加床或訂額外房間", "可享兒童優惠價", "需成人陪同"]
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
    },
    {
      name: "林東芳牛肉麵",
      type: "美食", 
      cuisine: "台灣菜",
      rating: 4.3,
      distance: "0.8km",
      address: "中山區八德路二段322號",
      description: "傳統牛肉麵老店，湯頭濃郁"
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
  console.log('🔄 處理訊息:', message, '當前步驟:', session.step);
  
  const lowerMsg = message.toLowerCase().trim();
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
  
  // === 優先處理兒童相關查詢 ===
  if (!response) {
    response = handleChildPolicyQuery(lowerMsg, session);
    if (response) detectedIntent = 'child_policy';
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
  
  // === 數字處理 - 修復版 ===
  if (!response) {
    response = handleNumberInputEnhanced(message, session, lowerMsg);
    if (response) detectedIntent = 'number_input';
  }
  
  // === 訂房相關 ===
  if (!response) {
    response = handleBookingIntent(lowerMsg, session);
    if (response) detectedIntent = 'booking';
  }

  // 記錄客戶查詢到 n8n（異步）
  if (response) {
    n8nService.logCustomerInquiry(session.sessionId, message, response, detectedIntent)
      .catch(error => console.error('n8n 記錄失敗:', error));
  } else {
    response = generateDefaultResponse(session);
    detectedIntent = 'default';
  }

  return response;
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
  // 計算最終價格（考慮所有優惠）
  const finalPrice = calculateFinalPrice(session.data);
  
  // 生成訂單編號
  const orderNumber = generateOrderNumber();
  
  // 生成訂房確認信
  const confirmation = generateConfirmationLetter(session.data, finalPrice, orderNumber);
  
  // 更新會話數據
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
  const prices = { 
    '標準雙人房': 2800, 
    '豪華雙人房': 3800, 
    '套房': 5800,
    '家庭房': 4500
  };
  
  let basePrice = prices[bookingData.roomType] * bookingData.roomCount * bookingData.nights;
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
  if (bookingData.childAge >= 6 && bookingData.childAge < 12) {
    const extraBedCost = 800 * bookingData.nights * (bookingData.children || 0);
    totalPrice += extraBedCost;
    extraCharges.push(`兒童加床費 NT$${extraBedCost}`);
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

🏨 **住宿詳情**
• 房型：${bookingData.roomType}
• 房間數量：${bookingData.roomCount}間
• 入住人數：${bookingData.adults}位大人${bookingData.children ? ` + ${bookingData.children}位小孩` : ''}
• 住宿天數：${bookingData.nights}晚
• 入住時間：${checkInTime}
• 退房時間：${checkOutTime}

💰 **費用明細`;
  
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
      if (!session.data.childAge) {
        return {
          reply: '請告訴我小孩的年齡，這樣我才能提供準確的費用資訊。',
          nextStep: 'ask_child_age'
        };
      }
      session.step = 'ask_room_count';
      return {
        reply: `了解。請問需要預訂幾間${session.data.roomType || '房間'}？`,
        nextStep: 'ask_room_count'
      };
      
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

// ==================== 兒童政策處理函數 ====================
function handleChildPolicyQuery(message, session) {
  const childKeywords = [
    '小孩', '兒童', '孩子', '小朋友', '嬰兒', '寶寶',
    '加價', '加費', '加床', '收費', '費用', '要不要錢',
    '幾歲', '年齡', '年紀', '歲'
  ];
  
  const hasChildReference = childKeywords.some(keyword => message.includes(keyword));
  if (!hasChildReference) return null;
  
  console.log('👶 檢測到兒童相關查詢:', message);
  
  // 提取兒童數量
  const childMatch = message.match(/(\d+)\s*個?\s*(小孩|兒童|孩子)/);
  const adultMatch = message.match(/(\d+)\s*個?\s*(大人|成人)/);
  
  const childCount = childMatch ? parseInt(childMatch[1]) : 1;
  const adultCount = adultMatch ? parseInt(adultMatch[1]) : (session.data.adults || 2);
  
  session.data.children = childCount;
  session.data.adults = adultCount;
  session.data.hasChildren = true;
  
  // 如果訊息中已經包含年齡信息
  const ageMatch = message.match(/(\d+)\s*歲/);
  if (ageMatch) {
    const childAge = parseInt(ageMatch[1]);
    session.data.childAge = childAge;
    return generateChildPolicyResponse(childAge, childCount, session);
  }
  
  // 沒有年齡信息，主動詢問
  session.step = 'ask_child_age';
  session.context.lastQuestion = 'child_age';
  
  return {
    reply: `了解，${adultCount}位大人${childCount > 0 ? ` + ${childCount}位小孩` : ''}。\n\n請問小孩的年齡是？這會影響是否需要加床或額外費用。`,
    nextStep: 'ask_child_age'
  };
}

// 生成兒童政策回應
function generateChildPolicyResponse(childAge, childCount, session) {
  const policies = promotionPolicies.children.policies;
  
  let applicablePolicy = null;
  for (const policy of policies) {
    const ageRange = policy.age.split('-');
    const minAge = parseInt(ageRange[0]);
    const maxAge = parseInt(ageRange[1]);
    
    if (childAge >= minAge && childAge <= maxAge) {
      applicablePolicy = policy;
      break;
    }
  }
  
  if (!applicablePolicy) {
    applicablePolicy = policies[policies.length - 1];
  }
  
  let reply = `👨‍👩‍👧‍👦 **兒童政策說明**\n\n`;
  reply += `根據 ${childAge} 歲小孩：\n`;
  reply += `📋 ${applicablePolicy.policy}\n`;
  
  if (applicablePolicy.conditions && applicablePolicy.conditions.length > 0) {
    reply += `\n💡 注意事項：\n`;
    applicablePolicy.conditions.forEach(condition => {
      reply += `• ${condition}\n`;
    });
  }
  
  if (childAge < 6) {
    reply += `\n🎯 建議：可選擇家庭房，空間較寬敞`;
  } else if (childAge >= 6 && childAge < 12) {
    reply += `\n🎯 建議：可考慮加床或選擇套房`;
  } else {
    reply += `\n🎯 建議：建議預訂額外房間`;
  }
  
  if (session.data.roomType) {
    reply += `\n\n您選擇的 ${session.data.roomType} ${
      session.data.roomType === '家庭房' ? '很適合親子同住' : 
      session.data.roomType === '套房' ? '空間較為寬敞' : 
      '建議確認房間大小是否合適'
    }`;
  }
  
  reply += `\n\n是否需要開始訂房流程？`;
  
  session.step = 'child_policy_info';
  return {
    reply: reply,
    nextStep: 'child_policy_info'
  };
}

// ==================== 優惠政策查詢 ====================
function handlePromotionQuery(message, session) {
  session.context.lastIntent = 'promotion';
  
  // 檢查每個優惠類型的關鍵字
  for (const [promoType, promoData] of Object.entries(promotionPolicies)) {
    const hasMatch = promoData.questions.some(question => message.includes(question.toLowerCase()));
    
    if (hasMatch) {
      // 記錄優惠查詢到 n8n
      n8nService.logPromotionInquiry(session.sessionId, promoType, message)
        .catch(console.error);
      
      return generatePromotionResponse(promoType, message, session);
    }
  }
  
  // 通用優惠查詢
  if (message.includes('優惠') || message.includes('折扣') || message.includes('促銷')) {
    let reply = '🎫 **所有優惠政策**\n\n';
    
    Object.values(promotionPolicies).forEach(policy => {
      reply += `⭐ ${policy.name}\n`;
      reply += `   ${policy.description}\n\n`;
    });
    
    reply += '請告訴我您想了解哪種優惠的詳細資訊？';
    
    session.step = 'promotion_overview';
    return {
      reply: reply,
      nextStep: 'promotion_overview'
    };
  }
  
  return null;
}

// 生成優惠政策回應
function generatePromotionResponse(promoType, originalMessage, session) {
  const promo = promotionPolicies[promoType];
  
  switch(promoType) {
    case 'senior':
      return {
        reply: `👴 **長者優惠 (65歲以上)**\n\n🎯 優惠內容：房價${(promo.discount * 100)}%折扣\n📝 ${promo.description}\n\n📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n🏠 適用房型：${promo.applicable.join('、')}\n🚫 不適用日期：${promo.blackout_dates.join('、')}\n\n💡 預訂時請告知並出示證件`,
        nextStep: 'promotion_info'
      };
      
    case 'long_stay':
      const stayTiers = promo.tiers.map(tier => `• 住${tier.nights}晚以上：${(tier.discount * 100)}%折扣`).join('\n');
      return {
        reply: `📅 **長住優惠**\n\n🎯 優惠內容：\n${stayTiers}\n\n📝 ${promo.description}\n\n📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n💡 如需長期住宿，建議提前聯繫訂房組`,
        nextStep: 'promotion_info'
      };
      
    case 'group':
      const groupTiers = promo.tiers.map(tier => `• ${tier.rooms}間房以上：${(tier.discount * 100)}%折扣`).join('\n');
      
      const roomMatch = originalMessage.match(/(\d+)\s*間/);
      if (roomMatch) {
        const roomCount = parseInt(roomMatch[1]);
        const applicableTier = promo.tiers.slice().reverse().find(tier => roomCount >= tier.rooms);
        
        if (applicableTier) {
          return {
            reply: `👥 **團體優惠**\n\n🎯 ${roomCount}間房可享：${(applicableTier.discount * 100)}%折扣\n\n📋 適用條件：\n` +
                   promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n💡 建議提前14天預訂以確保房況`,
            nextStep: 'promotion_info'
          };
        }
      }
      
      return {
        reply: `👥 **團體優惠**\n\n🎯 優惠內容：\n${groupTiers}\n\n📝 ${promo.description}\n\n📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n💡 請告知房間數量，我可為您計算具體優惠`,
        nextStep: 'promotion_info'
      };
      
    case 'member':
      return {
        reply: `⭐ **會員優惠**\n\n🎯 會員專屬福利：\n` +
               promo.benefits.map(benefit => `• ${benefit}`).join('\n') + `\n\n📝 如何成為會員：\n` +
               promo.join_conditions.map(condition => `• ${condition}`).join('\n') + `\n\n💡 首次入住即可免費申請會員`,
        nextStep: 'promotion_info'
      };
      
    case 'children':
      const childPolicies = promo.policies.map(policy => 
        `👶 **${policy.age}**：${policy.policy}\n   ${policy.conditions.map(cond => `• ${cond}`).join('\n   ')}`
      ).join('\n\n');
      
      const childMatch = originalMessage.match(/(\d+)\s*個?\s*小孩/);
      if (childMatch) {
        const childCount = parseInt(childMatch[1]);
        return {
          reply: `👨‍👩‍👧‍👦 **兒童政策**\n\n根據您提到的${childCount}位小孩：\n\n${childPolicies}\n\n💡 預訂時請告知兒童年齡，以便為您安排合適的房型`,
          nextStep: 'promotion_info'
        };
      }
      
      return {
        reply: `👨‍👩‍👧‍👦 **兒童政策**\n\n${childPolicies}\n\n💡 預訂時請告知兒童年齡`,
        nextStep: 'promotion_info'
      };
  }
}

// 修復版數字處理
function handleNumberInputEnhanced(originalMessage, session, lowerMsg) {
  const numberMatch = originalMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  console.log(`🔢 識別到數字: ${number}, 當前步驟: ${session.step}, 原始訊息: "${originalMessage}"`);
  
  if (number > 100 && !lowerMsg.includes('歲')) {
    console.log('⚠️  忽略過大數字，可能是年份或其他資訊');
    return null;
  }
  
  if (session.step === 'ask_child_age' || (lowerMsg.includes('歲') && session.data.hasChildren)) {
    session.data.childAge = number;
    session.data.hasChildren = true;
    
    if (!session.data.children) {
      session.data.children = 1;
    }
    
    return generateChildPolicyResponse(number, session.data.children, session);
  }
  
  const stepHandlers = {
    'ask_guests': () => {
      if (lowerMsg.includes('大人') || lowerMsg.includes('位') || lowerMsg.includes('個') || 
          lowerMsg.includes('人') || session.context.lastQuestion === 'guests') {
        session.data.adults = number;
        session.step = 'ask_room_count';
        session.context.lastQuestion = 'room_count';
        return {
          reply: `了解，${number}位大人。請問需要預訂幾間${session.data.roomType || '房間'}？`,
          nextStep: 'ask_room_count'
        };
      }
      return null;
    },
    
    'ask_room_count': () => {
      if (lowerMsg.includes('間') || session.context.lastQuestion === 'room_count') {
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
      if (lowerMsg.includes('晚') || lowerMsg.includes('天') || session.context.lastQuestion === 'nights') {
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

// 更新訂單摘要生成函數
function generateBookingSummary(session) {
  const priceInfo = calculateFinalPrice(session.data);
  
  session.step = 'confirm_booking';
  
  const summary = `
📋 **訂單摘要**

🏨 住宿資訊
• 房型：${session.data.roomType}
• 房間：${session.data.roomCount}間
• 人數：${session.data.adults}位大人${session.data.children ? ` + ${session.data.children}位小孩` : ''}
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

// 景點查詢
function handleAttractionsQuery(message, session) {
  session.context.lastIntent = 'attractions';
  
  let category = 'all';
  let specificQuery = '';
  
  if (message.includes('美食') || message.includes('餐廳') || message.includes('吃')) {
    category = 'food';
    specificQuery = '美食';
  } else if (message.includes('購物') || message.includes('逛街') || message.includes('買')) {
    category = 'shopping'; 
    specificQuery = '購物';
  }
  
  let reply = '🏞️ 附近推薦景點：\n\n';
  
  if (category === 'all') {
    const categories = ['food', 'sightseeing', 'shopping'];
    categories.forEach(cat => {
      const items = attractionsData[cat].slice(0, 2);
      items.forEach(item => {
        reply += `⭐ ${item.name} (${item.type})\n`;
        reply += `   📍 ${item.distance} | ⭐ ${item.rating}/5\n`;
        reply += `   ${item.description}\n\n`;
      });
    });
    reply += '需要特定類別的推薦嗎？例如：美食、購物、觀光';
  } else {
    const items = attractionsData[category].slice(0, 3);
    reply += `📍 ${specificQuery}推薦：\n\n`;
    items.forEach((item, index) => {
      reply += `${index + 1}. ${item.name}\n`;
      reply += `   📍 ${item.distance} | ⭐ ${item.rating}/5\n`;
      reply += `   🏠 ${item.address}\n`;
      reply += `   📝 ${item.description}\n\n`;
    });
    reply += '需要其他類別的推薦嗎？';
  }
  
  session.step = 'attractions_recommendation';
  return {
    reply: reply,
    nextStep: 'attractions_recommendation'
  };
}

// 設施查詢
function handleFacilitiesQuery(message, session) {
  session.context.lastIntent = 'facilities';
  
  let reply = '🏨 飯店設施介紹：\n\n';
  
  reply += '🍽️ **餐飲設施**\n';
  hotelFacilities.dining.forEach(facility => {
    reply += `• ${facility.name} (${facility.hours})\n`;
  });
  
  reply += '\n💪 **休閒設施**\n';
  hotelFacilities.recreation.forEach(facility => {
    reply += `• ${facility.name} (${facility.hours})\n`;
  });
  
  reply += '\n🔧 **服務設施**\n';
  hotelFacilities.services.forEach(facility => {
    reply += `• ${facility.name} (${facility.hours})\n`;
  });
  
  reply += '\n需要了解特定設施的詳細資訊嗎？';
  
  session.step = 'facilities_info';
  return {
    reply: reply,
    nextStep: 'facilities_info'
  };
}

// 訂房意圖處理
function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('我要訂') || 
      lowerMsg.includes('book') || lowerMsg.includes('reservation')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '🏨 **開始訂房流程**\n\n請問您想要預訂哪種房型？\n\n' +
               '• 標準雙人房 - NT$2,800/晚\n' +
               '• 豪華雙人房 - NT$3,800/晚\n' +
               '• 套房 - NT$5,800/晚\n' +
               '• 家庭房 - NT$4,500/晚\n\n' +
               '請直接告訴我您想要的房型名稱。',
        nextStep: 'select_room'
      };
    } else if (!session.data.adults) {
      session.step = 'ask_guests';
      session.context.lastQuestion = 'guests';
      return {
        reply: `您選擇了 ${session.data.roomType}，請問有幾位大人入住？`,
        nextStep: 'ask_guests'
      };
    } else if (!session.data.roomCount) {
      session.step = 'ask_room_count';
      session.context.lastQuestion = 'room_count';
      return {
        reply: `了解，${session.data.adults}位大人，請問需要幾間${session.data.roomType}？`,
        nextStep: 'ask_room_count'
      };
    } else if (!session.data.nights) {
      session.step = 'ask_nights';
      session.context.lastQuestion = 'nights';
      return {
        reply: `好的，${session.data.roomCount}間${session.data.roomType}，請問打算入住幾晚？`,
        nextStep: 'ask_nights'
      };
    } else {
      return generateBookingSummary(session);
    }
  }
  
  // 房型選擇
  if (lowerMsg.includes('標準') || lowerMsg.includes('豪華') || lowerMsg.includes('套房') || lowerMsg.includes('家庭')) {
    let roomType = '';
    let roomDescription = '';
    let roomPrice = 0;
    
    if (lowerMsg.includes('標準')) {
      roomType = '標準雙人房';
      roomDescription = '舒適雙人床，基本設施齊全';
      roomPrice = 2800;
    } else if (lowerMsg.includes('豪華')) {
      roomType = '豪華雙人房';
      roomDescription = '加大雙人床，景觀較佳';
      roomPrice = 3800;
    } else if (lowerMsg.includes('套房')) {
      roomType = '套房';
      roomDescription = '獨立客廳，豪華衛浴';
      roomPrice = 5800;
    } else if (lowerMsg.includes('家庭')) {
      roomType = '家庭房';
      roomDescription = '兩張雙人床，適合家庭';
      roomPrice = 4500;
    }
    
    session.data.roomType = roomType;
    session.data.roomPrice = roomPrice;
    session.step = 'ask_guests';
    session.context.lastQuestion = 'guests';
    
    return {
      reply: `🏨 您選擇了 ${roomType}\n` +
             `📝 ${roomDescription}\n` +
             `💰 每晚價格：NT$ ${roomPrice.toLocaleString()}\n\n` +
             `請問有幾位大人入住？`,
      nextStep: 'ask_guests'
    };
  }
  
  // 預設回應
  return generateDefaultResponse(session);
}

// ==================== 預設回應函數 ====================
function generateDefaultResponse(session) {
  const currentStep = session.step;
  
  const stepPrompts = {
    'welcome': '您好！我是飯店客服助手，可以幫您：\n• 查詢訂房資訊\n• 了解優惠政策\n• 推薦附近景點\n• 介紹飯店設施\n\n請問需要什麼協助呢？',
    'select_room': '請選擇房型：標準雙人房、豪華雙人房、套房、家庭房',
    'ask_guests': '請問有幾位大人入住？',
    'ask_room_count': '請問需要預訂幾間房間？',
    'ask_nights': '請問打算入住幾晚？',
    'ask_child_age': '請問小孩的年齡是？這會影響是否需要加床或額外費用。',
    'promotion_info': '還需要了解其他優惠政策嗎？或是想要開始訂房？',
    'attractions_recommendation': '需要其他類別的景點推薦嗎？或是想要開始訂房？',
    'facilities_info': '需要了解特定設施的詳細資訊嗎？或是想要開始訂房？',
    'booking_completed': '訂房已完成！請問還需要其他協助嗎？'
  };
  
  const defaultPrompt = stepPrompts[currentStep] || 
    '我可以幫您：\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹\n\n請問需要什麼協助呢？';
  
  return {
    reply: defaultPrompt,
    nextStep: currentStep
  };
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
    session.sessionId = sessionId; // 確保 sessionId 在 session 中可用
    
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

// 健康檢查
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

// 優惠政策
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

// n8n 狀態檢查
app.get('/api/n8n-status', (req, res) => {
  res.json({
    enabled: n8nService.enabled,
    baseUrl: n8nService.baseUrl,
    apiKey: n8nService.apiKey ? '已設置' : '未設置'
  });
});

// 更新 404 處理
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

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

// 會話存儲
const sessions = new Map();

// 獲取或創建會話
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {}
    });
  }
  return sessions.get(sessionId);
}

// ==================== 優惠政策資料庫 ====================
const promotionPolicies = {
  // 長者優惠
  senior: {
    name: "長者優惠",
    description: "65歲以上長者專屬優惠",
    discount: 0.1, // 9折
    conditions: ["需出示身份證件", "限本人使用", "需提前預訂"],
    applicable: ["所有房型"],
    blackout_dates: ["國定假日", "連續假期"],
    questions: [
      "老人有優惠嗎？",
      "65歲以上有什麼折扣？",
      "長者優惠",
      "銀髮族優惠"
    ]
  },
  
  // 長住優惠
  long_stay: {
    name: "長住優惠", 
    description: "長期住宿專屬優惠",
    tiers: [
      { nights: 7, discount: 0.15 },   // 住7天85折
      { nights: 14, discount: 0.2 },   // 住14天8折
      { nights: 30, discount: 0.3 }    // 住30天7折
    ],
    conditions: ["需連續住宿", "需提前預訂", "不含餐飲"],
    questions: [
      "長住優惠",
      "住一個月有優惠嗎？", 
      "長期住宿折扣",
      "住一週以上優惠"
    ]
  },
  
  // 團體優惠
  group: {
    name: "團體優惠",
    description: "多間房間團體優惠",
    tiers: [
      { rooms: 3, discount: 0.1 },     // 3間房9折
      { rooms: 5, discount: 0.15 },    // 5間房85折
      { rooms: 10, discount: 0.2 }     // 10間房8折
    ],
    conditions: ["需同時入住", "需同一訂單", "需提前14天預訂"],
    questions: [
      "團體優惠",
      "多間房折扣", 
      "3間房間優惠",
      "團體訂房"
    ]
  },
  
  // 會員優惠
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
    questions: [
      "會員優惠",
      "怎麼成為會員？",
      "會員有什麼好處？",
      "VIP優惠"
    ]
  },
  
  // 兒童政策
  children: {
    name: "兒童政策",
    description: "兒童收費及加床政策",
    policies: [
      {
        age: "0-5歲",
        policy: "不加床免費同住",
        conditions: ["需與父母同房", "不提供額外備品"]
      },
      {
        age: "6-11歲", 
        policy: "可選擇加床或免費同住",
        conditions: ["加床費用 NT$800/晚", "免費同住不提供額外備品"]
      },
      {
        age: "12歲以上",
        policy: "視同成人收費", 
        conditions: ["需加床或訂額外房間"]
      }
    ],
    questions: [
      "小孩要加價嗎？",
      "兒童收費",
      "小朋友住宿",
      "加床費用"
    ]
  }
};

// ==================== 增強版對話處理 ====================
function processMessage(message, session) {
  console.log('🔄 處理訊息:', message, '當前步驟:', session.step);
  
  const lowerMsg = message.toLowerCase().trim();
  
  // === 優惠政策查詢 ===
  const promotionResponse = handlePromotionQuery(lowerMsg, session);
  if (promotionResponse) return promotionResponse;
  
  // === 景點相關查詢 ===
  if (lowerMsg.includes('附近') || lowerMsg.includes('景點') || lowerMsg.includes('好玩') || 
      lowerMsg.includes('推薦') || lowerMsg.includes('美食') || lowerMsg.includes('購物')) {
    return handleAttractionsQuery(lowerMsg, session);
  }
  
  // === 設施相關查詢 ===
  if (lowerMsg.includes('設施') || lowerMsg.includes('設備') || lowerMsg.includes('服務') ||
      lowerMsg.includes('泳池') || lowerMsg.includes('健身房') || lowerMsg.includes('早餐')) {
    return handleFacilitiesQuery(lowerMsg, session);
  }
  
  // === 數字處理 - 修復版 ===
  const numberResponse = handleNumberInputEnhanced(message, session, lowerMsg);
  if (numberResponse) return numberResponse;
  
  // === 訂房相關 ===
  return handleBookingIntent(lowerMsg, session);
}

// 處理優惠政策查詢
function handlePromotionQuery(message, session) {
  session.context.lastIntent = 'promotion';
  
  // 檢查每個優惠類型的關鍵字
  for (const [promoType, promoData] of Object.entries(promotionPolicies)) {
    const hasMatch = promoData.questions.some(question => 
      message.includes(question.toLowerCase())
    );
    
    if (hasMatch) {
      return generatePromotionResponse(promoType, message, session);
    }
  }
  
  return null;
}

// 生成優惠政策回應
function generatePromotionResponse(promoType, originalMessage, session) {
  const promo = promotionPolicies[promoType];
  
  switch(promoType) {
    case 'senior':
      return {
        reply: `👴 **長者優惠 (65歲以上)**\n\n` +
               `🎯 優惠內容：房價${(promo.discount * 100)}%折扣\n` +
               `📝 ${promo.description}\n\n` +
               `📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n` +
               `🏠 適用房型：${promo.applicable.join('、')}\n` +
               `🚫 不適用日期：${promo.blackout_dates.join('、')}\n\n` +
               `💡 預訂時請告知並出示證件`,
        nextStep: 'promotion_info'
      };
      
    case 'long_stay':
      const stayTiers = promo.tiers.map(tier => 
        `• 住${tier.nights}晚以上：${(tier.discount * 100)}%折扣`
      ).join('\n');
      
      return {
        reply: `📅 **長住優惠**\n\n` +
               `🎯 優惠內容：\n${stayTiers}\n\n` +
               `📝 ${promo.description}\n\n` +
               `📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n` +
               `💡 如需長期住宿，建議提前聯繫訂房組`,
        nextStep: 'promotion_info'
      };
      
    case 'group':
      const groupTiers = promo.tiers.map(tier => 
        `• ${tier.rooms}間房以上：${(tier.discount * 100)}%折扣`
      ).join('\n');
      
      // 如果訊息中包含房間數量，提供具體計算
      const roomMatch = originalMessage.match(/(\d+)\s*間/);
      if (roomMatch) {
        const roomCount = parseInt(roomMatch[1]);
        const applicableTier = promo.tiers.find(tier => roomCount >= tier.rooms);
        
        if (applicableTier) {
          return {
            reply: `👥 **團體優惠**\n\n` +
                   `🎯 ${roomCount}間房可享：${(applicableTier.discount * 100)}%折扣\n\n` +
                   `📋 適用條件：\n` +
                   promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n` +
                   `💡 建議提前14天預訂以確保房況`,
            nextStep: 'promotion_info'
          };
        }
      }
      
      return {
        reply: `👥 **團體優惠**\n\n` +
               `🎯 優惠內容：\n${groupTiers}\n\n` +
               `📝 ${promo.description}\n\n` +
               `📋 適用條件：\n` +
               promo.conditions.map(cond => `• ${cond}`).join('\n') + `\n\n` +
               `💡 請告知房間數量，我可為您計算具體優惠`,
        nextStep: 'promotion_info'
      };
      
    case 'member':
      return {
        reply: `⭐ **會員優惠**\n\n` +
               `🎯 會員專屬福利：\n` +
               promo.benefits.map(benefit => `• ${benefit}`).join('\n') + `\n\n` +
               `📝 如何成為會員：\n` +
               promo.join_conditions.map(condition => `• ${condition}`).join('\n') + `\n\n` +
               `💡 首次入住即可免費申請會員`,
        nextStep: 'promotion_info'
      };
      
    case 'children':
      const childPolicies = promo.policies.map(policy => 
        `👶 **${policy.age}**：${policy.policy}\n   ${policy.conditions.map(cond => `• ${cond}`).join('\n   ')}`
      ).join('\n\n');
      
      // 如果訊息中包含兒童數量，提供具體建議
      const childMatch = originalMessage.match(/(\d+)\s*個?\s*小孩/);
      if (childMatch) {
        const childCount = parseInt(childMatch[1]);
        return {
          reply: `👨‍👩‍👧‍👦 **兒童政策**\n\n` +
                 `根據您提到的${childCount}位小孩：\n\n` +
                 childPolicies + `\n\n` +
                 `💡 預訂時請告知兒童年齡，以便為您安排合適的房型`,
          nextStep: 'promotion_info'
        };
      }
      
      return {
        reply: `👨‍👩‍👧‍👦 **兒童政策**\n\n${childPolicies}\n\n💡 預訂時請告知兒童年齡`,
        nextStep: 'promotion_info'
      };
  }
}

// 修復版數字處理 - 防止錯誤解析
function handleNumberInputEnhanced(originalMessage, session, lowerMsg) {
  const numberMatch = originalMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  console.log(`🔢 識別到數字: ${number}, 當前步驟: ${session.step}, 原始訊息: "${originalMessage}"`);
  
  // 防止年份等大數字被誤解
  if (number > 1000) {
    console.log('⚠️  忽略過大數字，可能是年份或其他資訊');
    return null;
  }
  
  // 根據上下文理解數字含義
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
        session.step = 'ask_nights';
        session.context.lastQuestion = 'nights';
        return {
          reply: `好的，${number}間${session.data.roomType || '房間'}。請問打算入住幾晚？`,
          nextStep: 'ask_nights'
        };
      }
      return null;
    },
    
    'ask_nights': () => {
      if (lowerMsg.includes('晚') || lowerMsg.includes('天') || session.context.lastQuestion === 'nights') {
        session.data.nights = number;
        session.step = 'confirm_booking';
        return {
          reply: `好的，入住${number}晚。讓我為您確認訂單資訊...`,
          nextStep: 'confirm_booking'
        };
      }
      return null;
    }
  };
  
  const handler = stepHandlers[session.step];
  return handler ? handler() : null;
}

// 保持其他功能不變（景點、設施、訂房等）
function handleAttractionsQuery(message, session) {
  // ... (保持之前的景點處理邏輯)
  session.context.lastIntent = 'attractions';
  return {
    reply: "🏞️ 附近推薦景點：\n• 台北101觀景台 (0.5km)\n• 國父紀念館 (1.0km)\n• 信義商圈 (0.3km)\n\n需要特定類別的推薦嗎？",
    nextStep: 'attractions_recommendation'
  };
}

function handleFacilitiesQuery(message, session) {
  // ... (保持之前的設施處理邏輯)
  session.context.lastIntent = 'facilities';
  return {
    reply: "🏨 飯店設施：\n• 室外游泳池 (07:00-21:00)\n• 健身中心 (24小時)\n• 三溫暖 (06:00-23:00)\n\n需要了解特定設施嗎？",
    nextStep: 'facilities_info'
  };
}

function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('我要訂')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '請問您想要預訂哪種房型？我們有：標準雙人房、豪華雙人房、套房。',
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
  if (lowerMsg.includes('標準') || lowerMsg.includes('豪華') || lowerMsg.includes('套房')) {
    if (lowerMsg.includes('標準')) session.data.roomType = '標準雙人房';
    else if (lowerMsg.includes('豪華')) session.data.roomType = '豪華雙人房';
    else session.data.roomType = '套房';
    
    session.step = 'ask_guests';
    session.context.lastQuestion = 'guests';
    return {
      reply: `好的，您選擇${session.data.roomType}。請問有幾位大人入住？`,
      nextStep: 'ask_guests'
    };
  }
  
  return getGuidanceResponse(session);
}

function generateBookingSummary(session) {
  const prices = { '標準雙人房': 2800, '豪華雙人房': 3800, '套房': 5800 };
  const total = prices[session.data.roomType] * session.data.roomCount * session.data.nights;
  
  session.step = 'confirm_booking';
  
  const summary = [
    '📋 訂單摘要：',
    `• 房型：${session.data.roomType}`,
    `• 房間：${session.data.roomCount}間`,
    `• 人數：${session.data.adults}位大人`,
    `• 天數：${session.data.nights}晚`,
    `• 總價：NT$ ${total.toLocaleString()}`,
    '',
    '請確認以上資訊是否正確？'
  ].join('\n');
  
  return {
    reply: summary,
    nextStep: 'confirm_booking'
  };
}

function getGuidanceResponse(session) {
  const guidance = {
    'welcome': '您好！我是訂房助理，可以幫您：\n• 預訂房間\n• 查詢優惠政策\n• 推薦附近景點\n• 介紹飯店設施\n請問需要什麼協助？',
    'select_room': '請問您想要預訂哪種房型？標準雙人房、豪華雙人房，還是套房？',
    'promotion_info': '需要了解其他優惠政策嗎？',
    'default': '您好！我可以幫您查詢優惠、預訂房間、推薦景點。請問需要什麼協助？'
  };
  
  return {
    reply: guidance[session.step] || guidance.default,
    nextStep: session.step
  };
}

// 🎯 聊天接口
app.post('/chat', (req, res) => {
  try {
    console.log('📨 收到請求:', JSON.stringify(req.body, null, 2));
    
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.json({
        success: false,
        reply: '請提供訊息和會話ID',
        timestamp: new Date().toISOString()
      });
    }
    
    const session = getOrCreateSession(sessionId);
    console.log('👤 會話狀態:', session.step, '數據:', session.data);
    
    const result = processMessage(message, session);
    
    session.step = result.nextStep;
    sessions.set(sessionId, session);
    
    const response = {
      success: true,
      reply: result.reply,
      sessionId: sessionId,
      step: session.step,
      data: session.data,
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 發送回應:', response.reply.substring(0, 100) + '...');
    res.json(response);
    
  } catch (error) {
    console.error('💥 錯誤:', error);
    
    res.json({
      success: false,
      reply: '系統暫時遇到問題，請稍後再試',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`\n🎉 完整優惠政策版訂房助理啟動成功！`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🕐 ${new Date().toISOString()}`);
});

module.exports = app;

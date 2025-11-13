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
    },
    {
      name: "阜杭豆漿",
      type: "美食",
      cuisine: "早餐",
      rating: 4.4,
      distance: "1.2km", 
      address: "中正區忠孝東路一段108號",
      description: "知名傳統早餐店，厚燒餅很有名"
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
    },
    {
      name: "信義新天地",
      type: "購物",
      category: "購物中心", 
      rating: 4.4,
      distance: "0.7km",
      address: "信義區松壽路12號",
      description: "大型購物商圈，多家百貨公司"
    },
    {
      name: "誠品信義店",
      type: "購物",
      category: "書店",
      rating: 4.5,
      distance: "0.6km",
      address: "信義區松高路11號",
      description: "24小時書店，文青必訪"
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
    },
    {
      name: "國父紀念館",
      type: "觀光",
      category: "文化",
      rating: 4.3,
      distance: "1.0km",
      address: "信義區仁愛路四段505號",
      description: "歷史文化紀念館，衛兵交接很精彩"
    },
    {
      name: "松山文創園區",
      type: "觀光",
      category: "文創",
      rating: 4.4,
      distance: "1.5km",
      address: "信義區光復南路133號",
      description: "文創基地，展覽和市集很多"
    }
  ],
  entertainment: [
    {
      name: "信義威秀影城",
      type: "娛樂",
      category: "電影院",
      rating: 4.2,
      distance: "0.6km",
      address: "信義區松壽路18號",
      description: "現代化電影院，設備新穎"
    },
    {
      name: "KTV 錢櫃",
      type: "娛樂",
      category: "KTV",
      rating: 4.1,
      distance: "0.9km",
      address: "信義區松壽路12號",
      description: "連鎖KTV，歌單更新快"
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
    },
    {
      name: "大廳酒吧",
      type: "酒吧", 
      hours: "14:00-24:00",
      description: "提供調酒和輕食，有現場音樂表演",
      location: "一樓大廳"
    }
  ],
  recreation: [
    {
      name: "室外游泳池",
      type: "泳池",
      hours: "07:00-21:00",
      description: "25公尺溫水泳池，附設按摩池",
      location: "三樓"
    },
    {
      name: "健身中心",
      type: "健身房",
      hours: "24小時",
      description: "全新健身設備，有專業教導",
      location: "三樓"
    },
    {
      name: "三溫暖",
      type: "水療",
      hours: "06:00-23:00", 
      description: "乾濕蒸氣、烤箱、冷水池",
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
    },
    {
      name: "停車場",
      type: "停車",
      hours: "24小時", 
      description: "地下停車場，住客免費停車",
      location: "B1-B3"
    },
    {
      name: "洗衣服務",
      type: "洗衣",
      hours: "08:00-20:00",
      description: "自助洗衣和乾洗服務",
      location: "B1"
    }
  ]
};

// ==================== 增強版對話處理 ====================
function processMessage(message, session) {
  console.log('🔄 處理訊息:', message, '當前步驟:', session.step);
  
  const lowerMsg = message.toLowerCase().trim();
  
  // === 景點相關查詢 ===
  if (lowerMsg.includes('附近') || lowerMsg.includes('景點') || lowerMsg.includes('好玩') || 
      lowerMsg.includes('推薦') || lowerMsg.includes('美食') || lowerMsg.includes('購物') ||
      lowerMsg.includes('餐廳') || lowerMsg.includes('逛街')) {
    return handleAttractionsQuery(lowerMsg, session);
  }
  
  // === 設施相關查詢 ===
  if (lowerMsg.includes('設施') || lowerMsg.includes('設備') || lowerMsg.includes('服務') ||
      lowerMsg.includes('泳池') || lowerMsg.includes('健身房') || lowerMsg.includes('早餐') ||
      lowerMsg.includes('wifi') || lowerMsg.includes('停車') || lowerMsg.includes('網路')) {
    return handleFacilitiesQuery(lowerMsg, session);
  }
  
  // === 數字處理 ===
  const numberMatch = lowerMsg.match(/(\d+)/);
  const hasNumber = numberMatch ? parseInt(numberMatch[1]) : null;
  
  if (hasNumber !== null) {
    return handleNumberInput(hasNumber, session, lowerMsg);
  }
  
  // === 訂房相關 ===
  return handleBookingIntent(lowerMsg, session);
}

// 處理景點查詢
function handleAttractionsQuery(message, session) {
  session.context.lastIntent = 'attractions';
  
  let category = 'all';
  let specificQuery = '';
  
  // 識別具體需求
  if (message.includes('美食') || message.includes('餐廳') || message.includes('吃')) {
    category = 'food';
    specificQuery = '美食';
  } else if (message.includes('購物') || message.includes('逛街') || message.includes('買')) {
    category = 'shopping'; 
    specificQuery = '購物';
  } else if (message.includes('觀光') || message.includes('景點') || message.includes('觀光')) {
    category = 'sightseeing';
    specificQuery = '觀光景點';
  } else if (message.includes('娛樂') || message.includes('電影') || message.includes('ktv')) {
    category = 'entertainment';
    specificQuery = '娛樂';
  }
  
  // 生成推薦
  let reply = '🏞️ 附近推薦景點：\n\n';
  
  if (category === 'all') {
    // 推薦各類別前2名
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
    // 特定類別推薦
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

// 處理設施查詢
function handleFacilitiesQuery(message, session) {
  session.context.lastIntent = 'facilities';
  
  let facilityType = 'all';
  
  // 識別具體需求
  if (message.includes('泳池')) {
    facilityType = 'recreation';
  } else if (message.includes('健身')) {
    facilityType = 'recreation'; 
  } else if (message.includes('餐廳') || message.includes('早餐') || message.includes('吃')) {
    facilityType = 'dining';
  } else if (message.includes('停車')) {
    facilityType = 'services';
  } else if (message.includes('商務') || message.includes('會議')) {
    facilityType = 'services';
  } else if (message.includes('洗衣')) {
    facilityType = 'services';
  }
  
  // 生成設施介紹
  let reply = '🏨 飯店設施介紹：\n\n';
  
  if (facilityType === 'all') {
    // 所有設施概覽
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
  } else {
    // 特定設施詳細介紹
    const facilities = hotelFacilities[facilityType];
    const typeNames = {
      'dining': '餐飲設施',
      'recreation': '休閒設施', 
      'services': '服務設施'
    };
    
    reply += `📍 ${typeNames[facilityType]}：\n\n`;
    facilities.forEach(facility => {
      reply += `🏷️ ${facility.name}\n`;
      reply += `   ⏰ 營業時間：${facility.hours}\n`;
      reply += `   📍 位置：${facility.location}\n`;
      reply += `   📝 ${facility.description}\n\n`;
    });
  }
  
  session.step = 'facilities_info';
  return {
    reply: reply,
    nextStep: 'facilities_info'
  };
}

// 處理數字輸入（保持不變）
function handleNumberInput(number, session, originalMessage) {
  console.log(`🔢 識別到數字: ${number}, 當前步驟: ${session.step}`);
  
  const stepHandlers = {
    'ask_guests': () => {
      session.data.adults = number;
      session.step = 'ask_room_count';
      session.context.lastQuestion = 'room_count';
      return {
        reply: `了解，${number}位大人。請問需要預訂幾間${session.data.roomType || '房間'}？`,
        nextStep: 'ask_room_count'
      };
    },
    
    'ask_room_count': () => {
      session.data.roomCount = number;
      session.step = 'ask_nights';
      session.context.lastQuestion = 'nights';
      return {
        reply: `好的，${number}間${session.data.roomType || '房間'}。請問打算入住幾晚？`,
        nextStep: 'ask_nights'
      };
    },
    
    'ask_nights': () => {
      session.data.nights = number;
      session.step = 'confirm_booking';
      return {
        reply: `好的，入住${number}晚。讓我為您確認訂單資訊...`,
        nextStep: 'confirm_booking'
      };
    }
  };
  
  const handler = stepHandlers[session.step] || stepHandlers.default;
  return handler ? handler() : getGuidanceResponse(session);
}

// 處理訂房意圖（保持不變）
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

// 生成訂單摘要（保持不變）
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

// 引導回應（更新）
function getGuidanceResponse(session) {
  const guidance = {
    'welcome': '您好！我是訂房助理，可以幫您：\n• 預訂房間\n• 推薦附近景點\n• 介紹飯店設施\n請問需要什麼協助？',
    'select_room': '請問您想要預訂哪種房型？標準雙人房、豪華雙人房，還是套房？',
    'ask_guests': `您選擇了 ${session.data.roomType}，請問有幾位大人入住？`,
    'ask_room_count': `了解，${session.data.adults}位大人，請問需要幾間${session.data.roomType}？`,
    'ask_nights': `好的，${session.data.roomCount}間${session.data.roomType}，請問打算入住幾晚？`,
    'confirm_booking': '請確認訂單資訊是否正確？',
    'attractions_recommendation': '需要其他景點推薦嗎？',
    'facilities_info': '需要了解其他設施嗎？',
    'default': '您好！我可以幫您預訂房間、推薦景點、介紹設施。請問需要什麼協助？'
  };
  
  return {
    reply: guidance[session.step] || guidance.default,
    nextStep: session.step
  };
}

// 🎯 聊天接口（保持不變）
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
    
    console.log('📤 發送回應:', JSON.stringify(response, null, 2));
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
  console.log(`\n🎉 完整功能版訂房助理啟動成功！`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🕐 ${new Date().toISOString()}`);
});

module.exports = app;

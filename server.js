const express = require('express');

console.log('🚀 Starting AI Hotel Assistant on PORT 8080...');

const app = express();
const PORT = 8080;

console.log('🔧 Using fixed PORT:', PORT);

app.use(express.json());

// ==================== 智能酒店知識庫 ====================
const hotelKnowledgeBase = {
  hotelInfo: {
    name: "台北晶華酒店",
    address: "台北市中山區中山北路二段39巷3號",
    phone: "+886-2-2523-8000",
    email: "reservation@regenttaipei.com"
  },
  
  rooms: {
    '豪華客房': { 
      price: 3800, 
      size: '28-32㎡', 
      features: ['市景', '免費WiFi', '迷你吧', 'Nespresso咖啡機', '乾濕分離衛浴'],
      capacity: "2位成人"
    },
    '行政套房': { 
      price: 6800, 
      size: '48-52㎡', 
      features: ['101景觀', '行政酒廊', '獨立客廳', '按摩浴缸', '專屬管家服務'],
      capacity: "2位成人+1兒童"
    },
    '家庭套房': { 
      price: 8800, 
      size: '65㎡', 
      features: ['兩間臥室', '兒童遊戲區', '小廚房', '家庭電影院', '陽台'],
      capacity: "2位成人+2兒童"
    },
    '總統套房': { 
      price: 25000, 
      size: '120㎡', 
      features: ['私人管家', '專屬電梯', '會議室', '私人SPA', '全景露台'],
      capacity: "4位成人"
    }
  },
  
  facilities: {
    '泳池': { description: '室外恆溫游泳池', hours: '06:00-22:00', location: '3樓', fee: '免費' },
    '健身中心': { description: '24小時健身中心', hours: '00:00-24:00', location: '4樓', fee: '免費' },
    'SPA': { description: '沐蘭 SPA 水療', hours: '10:00-22:00', location: '5樓', fee: '需預約付費' },
    '商務中心': { description: '商務中心與會議室', hours: '08:00-20:00', location: '2樓', fee: '住客免費' }
  },
  
  restaurants: {
    '蘭亭中餐廳': { cuisine: '粵菜料理', hours: '11:30-14:30, 18:00-22:00', reservation: '建議預約' },
    '義大利餐廳': { cuisine: '地中海美食', hours: '12:00-15:00, 18:00-22:30', reservation: '建議預約' },
    '大廳酒廊': { cuisine: '下午茶與輕食', hours: '14:00-17:00', reservation: '現場候位' }
  },
  
  policies: {
    checkIn: '15:00後',
    checkOut: '12:00前',
    cancellation: '入住前24小時免費取消',
    pets: '可攜帶寵物，清潔費500元/晚',
    children: '12歲以下兒童免費同住',
    payment: '接受信用卡、現金、Apple Pay'
  }
};

// ==================== 智能意圖分析 ====================
function analyzeUserIntent(message) {
  const lowerMsg = message.toLowerCase();
  
  const intents = {
    roomInquiry: /房型|房間|價格|價錢|多少錢|住宿|住|room|price|rate/i,
    facilityInquiry: /設施|設備|游泳池|健身|spa|按摩|gym|pool|facility/i,
    restaurantInquiry: /餐廳|美食|吃飯|餐飲|早餐|晚餐|午餐|dining|food|restaurant/i,
    bookingInquiry: /訂房|預訂|預約|訂|booking|reserve|book/i,
    policyInquiry: /入住|退房|時間|政策|規定|取消|policy|check.in|check.out|cancel/i,
    locationInquiry: /位置|地址|交通|怎麼去|地圖|location|address|map|transport/i,
    serviceInquiry: /服務|幫忙|協助|help|service|support/i
  };
  
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(lowerMsg)) return intent;
  }
  return 'generalInquiry';
}

// ==================== 智能回應生成 ====================
function generateSmartHotelResponse(message) {
  const intent = analyzeUserIntent(message);
  const lowerMsg = message.toLowerCase();
  
  const responses = {
    roomInquiry: () => {
      let response = "🏨 **房型與價格資訊**\n\n";
      Object.entries(hotelKnowledgeBase.rooms).forEach(([room, info]) => {
        response += `⭐ **${room}** - ${info.price}元/晚\n`;
        response += `   📏 面積: ${info.size} | 👥 ${info.capacity}\n`;
        response += `   🎯 特色: ${info.features.slice(0, 3).join(' · ')}\n\n`;
      });
      response += "💡 需要為您查詢特定日期的空房情況嗎？";
      return response;
    },
    
    facilityInquiry: () => {
      let response = "🏊 **酒店設施與服務**\n\n";
      Object.entries(hotelKnowledgeBase.facilities).forEach(([facility, info]) => {
        response += `• **${facility}**: ${info.description}\n`;
        response += `  ⏰ ${info.hours} | 📍 ${info.location} | 💰 ${info.fee}\n\n`;
      });
      response += "所有住客均可免費使用基本設施！";
      return response;
    },
    
    restaurantInquiry: () => {
      let response = "🍽️ **餐廳與餐飲資訊**\n\n";
      Object.entries(hotelKnowledgeBase.restaurants).forEach(([name, info]) => {
        response += `• **${name}** - ${info.cuisine}\n`;
        response += `  ⏰ 營業: ${info.hours} | 📞 ${info.reservation}\n\n`;
      });
      response += "需要為您預約餐廳座位嗎？";
      return response;
    },
    
    bookingInquiry: () => {
      return `📅 **預訂協助**\n\n感謝您選擇預訂！請提供以下資訊：\n\n` +
             `• 入住日期與退房日期\n` +
             `• 入住人數與兒童年齡\n` +
             `• 偏好房型\n` +
             `• 特殊需求 (慶祝活動等)\n\n` +
             `📞 或直接致電訂房組: ${hotelKnowledgeBase.hotelInfo.phone}\n` +
             `✉️ 郵箱: ${hotelKnowledgeBase.hotelInfo.email}`;
    },
    
    policyInquiry: () => {
      return `📋 **酒店政策**\n\n` +
             `⏰ 入住時間: ${hotelKnowledgeBase.policies.checkIn}\n` +
             `⏰ 退房時間: ${hotelKnowledgeBase.policies.checkOut}\n` +
             `❌ 取消政策: ${hotelKnowledgeBase.policies.cancellation}\n` +
             `🐶 寵物政策: ${hotelKnowledgeBase.policies.pets}\n` +
             `👶 兒童政策: ${hotelKnowledgeBase.policies.children}\n` +
             `💳 支付方式: ${hotelKnowledgeBase.policies.payment}`;
    },
    
    locationInquiry: () => {
      return `📍 **位置與交通**\n\n` +
             `🏨 ${hotelKnowledgeBase.hotelInfo.name}\n` +
             `📮 ${hotelKnowledgeBase.hotelInfo.address}\n\n` +
             `🚕 **交通方式**:\n` +
             `• 桃園機場: 計程車約50分鐘\n` +
             `• 台北車站: 捷運10分鐘 (中山站)\n` +
             `• 提供機場接送服務 (需預約)\n\n` +
             `📞 ${hotelKnowledgeBase.hotelInfo.phone}`;
    },
    
    generalInquiry: () => {
      return `👋 **您好！歡迎光臨${hotelKnowledgeBase.hotelInfo.name}**\n\n` +
             `我是您的AI酒店助理，可以為您提供：\n\n` +
             `• 🏨 房型介紹與價格查詢\n` +
             `• 🏊 設施服務詳細說明\n` +
             `• 🍽️ 餐廳預約與菜單資訊\n` +
             `• 📅 訂房協助與空房查詢\n` +
             `• 📍 交通指引與位置資訊\n\n` +
             `請告訴我您想了解什麼？例如：「我想訂房」或「有什麼設施？」`;
    }
  };
  
  return responses[intent] ? responses[intent]() : responses.generalInquiry();
}

// ==================== 現有端點保持不變 ====================
// Railway 健康檢查端點
app.get('/health', (req, res) => {
  console.log('✅ Health check received on port', PORT);
  res.status(200).json({
    status: 'ok',
    message: 'AI Hotel Assistant - PORT 8080',
    port: PORT,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 完整健康檢查端點
app.get('/api/health', (req, res) => {
  console.log('✅ API Health check on port', PORT);
  res.status(200).json({
    status: 'healthy',
    service: 'AI Hotel Assistant Builder',
    timestamp: new Date().toISOString(),
    port: PORT,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant Builder',
    version: '1.0.0',
    status: 'active',
    port: PORT,
    endpoints: {
      'GET /health': '健康檢查',
      'GET /api/health': '完整健康檢查',
      'POST /api/ai/chat': 'AI對話處理',
      'POST /api/chat': '簡化聊天端點',
      'POST /api/assistant/chat': '智能酒店助理',
      'GET /api/hotels/search': '飯店搜尋'
    }
  });
});

// ==================== 升級的智能聊天端點 ====================
app.post('/api/assistant/chat', (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '請輸入詢問內容',
        example: {
          "message": "我想預訂明晚的豪華客房",
          "session_id": "optional_session_id"
        }
      });
    }

    console.log('🤖 智能助理收到訊息:', message);
    
    // 使用智能酒店助理
    const aiReply = generateSmartHotelResponse(message);
    
    res.json({
      success: true,
      reply: aiReply,
      session_id: session_id || 'session_' + Date.now(),
      timestamp: new Date().toISOString(),
      response_type: 'hotel_assistant',
      hotel: hotelKnowledgeBase.hotelInfo.name
    });
    
  } catch (error) {
    console.error('❌ 智能助理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務暫時不可用',
      timestamp: new Date().toISOString()
    });
  }
});

// 保持現有其他端點不變
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  console.log('🤖 AI Chat on port', PORT, ':', message);
  
  res.json({
    success: true,
    response: `🧠 已理解您的需求：${message}`,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/chat', (req, res) => {
  const { message, session_id } = req.body;
  console.log('💬 Simple Chat on port', PORT, ':', message);
  
  res.json({
    status: 'success',
    reply: `💬 已收到您的訊息：${message}`,
    session_id: session_id || 'sess_' + Date.now(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/hotels/search', (req, res) => {
  const { location = '台北' } = req.query;
  
  res.json({
    success: true,
    hotels: [
      {
        id: 'hotel_1',
        name: `${location}君悅大飯店`,
        price: 4500,
        rating: 4.8,
        stars: 5,
        available: true
      }
    ],
    totalResults: 1
  });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🎯 智能酒店助理服務已啟動');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 External: https://ai-hotel-assistant-builder-production.up.railway.app`);
  console.log('✅ 智能功能已啟用');
  console.log('='.repeat(60));
});

// 保持運行
setInterval(() => {
  console.log('💓 智能助理運行中 -', new Date().toISOString());
}, 30000);

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
      data: {}
    });
  }
  return sessions.get(sessionId);
}

// 簡單可靠的對話處理
function processMessage(message, session) {
  console.log('🔄 處理訊息:', message);
  
  const lowerMsg = message.toLowerCase();
  
  // 訂房流程
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('我要訂')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '請問您想要預訂哪種房型？我們有：標準雙人房、豪華雙人房、套房。',
        nextStep: 'select_room'
      };
    } else if (!session.data.adults) {
      session.step = 'ask_guests';
      return {
        reply: `您選擇了 ${session.data.roomType}，請問有幾位大人入住？`,
        nextStep: 'ask_guests'
      };
    } else if (!session.data.roomCount) {
      session.step = 'ask_room_count';
      return {
        reply: `了解，${session.data.adults}位大人，請問需要幾間房間？`,
        nextStep: 'ask_room_count'
      };
    } else if (!session.data.nights) {
      session.step = 'ask_nights';
      return {
        reply: `好的，${session.data.roomCount}間房間，請問打算入住幾晚？`,
        nextStep: 'ask_nights'
      };
    } else {
      session.step = 'complete';
      return {
        reply: `完美！${session.data.roomCount}間${session.data.roomType}，${session.data.adults}位大人，入住${session.data.nights}晚。需要為您計算價格嗎？`,
        nextStep: 'complete'
      };
    }
  }
  
  // 房型選擇
  if (lowerMsg.includes('標準')) {
    session.data.roomType = '標準雙人房';
    session.step = 'ask_guests';
    return {
      reply: '好的，您選擇標準雙人房。請問有幾位大人入住？',
      nextStep: 'ask_guests'
    };
  }
  
  if (lowerMsg.includes('豪華')) {
    session.data.roomType = '豪華雙人房';
    session.step = 'ask_guests';
    return {
      reply: '好的，您選擇豪華雙人房。請問有幾位大人入住？',
      nextStep: 'ask_guests'
    };
  }
  
  if (lowerMsg.includes('套房')) {
    session.data.roomType = '套房';
    session.step = 'ask_guests';
    return {
      reply: '好的，您選擇套房。請問有幾位大人入住？',
      nextStep: 'ask_guests'
    };
  }
  
  // 人數
  const peopleMatch = lowerMsg.match(/(\d+)\s*位?/);
  if (peopleMatch && session.step === 'ask_guests') {
    session.data.adults = parseInt(peopleMatch[1]);
    session.step = 'ask_room_count';
    return {
      reply: `了解，${peopleMatch[1]}位大人。請問需要幾間房間？`,
      nextStep: 'ask_room_count'
    };
  }
  
  // 房間數量
  const roomMatch = lowerMsg.match(/(\d+)\s*間/);
  if (roomMatch && session.step === 'ask_room_count') {
    session.data.roomCount = parseInt(roomMatch[1]);
    session.step = 'ask_nights';
    return {
      reply: `好的，${roomMatch[1]}間房間。請問打算入住幾晚？`,
      nextStep: 'ask_nights'
    };
  }
  
  // 天數
  const nightMatch = lowerMsg.match(/(\d+)\s*晚/);
  if (nightMatch && session.step === 'ask_nights') {
    session.data.nights = parseInt(nightMatch[1]);
    session.step = 'complete';
    
    // 計算價格
    const prices = { '標準雙人房': 2800, '豪華雙人房': 3800, '套房': 5800 };
    const total = prices[session.data.roomType] * session.data.roomCount * session.data.nights;
    
    return {
      reply: `完美！${session.data.roomCount}間${session.data.roomType}，${session.data.adults}位大人，入住${session.data.nights}晚，總價格 NT$ ${total.toLocaleString()}。需要為您確認預訂嗎？`,
      nextStep: 'complete'
    };
  }
  
  // 預設回應
  return {
    reply: '您好！我是訂房助理，可以幫您預訂房間。請問您想要預訂嗎？',
    nextStep: 'welcome'
  };
}

// 🎯 保證正確的聊天接口
app.post('/chat', (req, res) => {
  try {
    console.log('📨 收到請求:', JSON.stringify(req.body, null, 2));
    
    const { message, sessionId } = req.body;
    
    // 輸入驗證
    if (!message || !sessionId) {
      console.log('❌ 缺少參數');
      return res.json({
        success: false,
        reply: '請提供訊息和會話ID',
        timestamp: new Date().toISOString()
      });
    }
    
    // 獲取會話
    const session = getOrCreateSession(sessionId);
    console.log('👤 會話狀態:', session.step, session.data);
    
    // 處理訊息
    const result = processMessage(message, session);
    
    // 更新會話
    session.step = result.nextStep;
    sessions.set(sessionId, session);
    
    // 🎯 關鍵：構建正確的回應格式
    const response = {
      success: true,
      reply: result.reply,        // ✅ 必須是 reply
      sessionId: sessionId,
      step: session.step,         // ✅ 必須是 step
      data: session.data,         // ✅ 必須是 data
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 發送回應:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (error) {
    console.error('💥 錯誤:', error);
    
    // 錯誤時也確保格式正確
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
  console.log(`\n🎉 穩定版訂房助理啟動成功！`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🕐 ${new Date().toISOString()}`);
  console.log('\n💡 測試命令:');
  console.log('curl -X POST http://localhost:8080/chat \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"message":"我要訂房","sessionId":"test123"}\'');
});

module.exports = app;

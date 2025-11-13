const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// ==================== 載入對話流程配置 ====================
let dialogFlow;
try {
  dialogFlow = require('./config/dialog-flow.json');
  console.log('✅ 載入對話流程配置成功');
} catch (error) {
  console.error('❌ 載入對話流程配置失敗:', error.message);
  dialogFlow = {
    states: {
      init: {
        prompt: '您好，歡迎使用 AI 訂房助理！請問您需要什麼幫助？'
      }
    }
  };
}

// 會話狀態管理
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// ==================== 服務就緒狀態 ====================
let serverReady = false;

// 中間件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 請求日誌
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body || req.query);
  next();
});

// ==================== 會話操作函數 ====================
async function loadSessions() {
  try {
    const exists = await fs.access(SESSION_FILE).then(() => true).catch(() => false);
    if (exists) {
      const data = await fs.readFile(SESSION_FILE, 'utf8');
      const savedSessions = JSON.parse(data);
      for (const [sessionId, sessionData] of savedSessions) {
        sessions.set(sessionId, sessionData);
      }
      console.log(`✅ 成功加載 ${sessions.size} 個會話`);
    }
  } catch (error) {
    console.error('❌ 加載會話失敗:', error.message);
  }
}

async function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    await fs.writeFile(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
  } catch (error) {
    console.error('❌ 保存會話失敗:', error.message);
  }
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
    saveSessions().catch(console.error);
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 分層意圖識別系統 ====================

// 第一層：主要意圖識別
function detectMainIntent(message) {
  const lowerMsg = message.toLowerCase();
  
  if (/(訂房|預訂|預定|訂房間|想要訂|我要訂)/.test(lowerMsg)) {
    return 'book_room';
  } else if (/(價格|價錢|多少錢|費用|房價)/.test(lowerMsg)) {
    return 'ask_price';
  } else if (/(優惠|折扣|促銷|特價|會員價)/.test(lowerMsg)) {
    return 'ask_promotion';
  } else if (/(取消|退訂|退房)/.test(lowerMsg)) {
    return 'cancel_booking';
  } else if (/(寵物|帶狗|帶貓|動物)/.test(lowerMsg)) {
    return 'ask_pet_policy';
  } else if (/(設施|設備|服務|wifi|停車|早餐)/.test(lowerMsg)) {
    return 'ask_facilities';
  } else if (/(附近|景點|餐廳|美食|購物)/.test(lowerMsg)) {
    return 'ask_attractions';
  } else {
    return 'general_inquiry';
  }
}

// 第二層：實體提取
function extractEntities(message) {
  const lowerMsg = message.toLowerCase();
  const entities = {};

  // 房型提取
  const roomTypeMatch = lowerMsg.match(/(標準雙人房|豪華雙人房|套房|家庭房|雙人房|單人房)/);
  if (roomTypeMatch) entities.roomType = roomTypeMatch[1];

  // 人數提取
  const peopleMatch = lowerMsg.match(/(\d+)\s*(個|位|人)?\s*(大人|成人)/);
  const childMatch = lowerMsg.match(/(\d+)\s*(個|位)?\s*(小孩|兒童|孩子)/);
  if (peopleMatch) entities.adults = parseInt(peopleMatch[1]);
  if (childMatch) entities.children = parseInt(childMatch[1]);

  // 房間數量
  const roomCountMatch = lowerMsg.match(/(\d+)\s*(間|房)/);
  if (roomCountMatch) entities.roomCount = parseInt(roomCountMatch[1]);

  // 日期相關
  const dateMatch = lowerMsg.match(/(今天|明天|後天|\d+月\d+日|\d+\/\d+)/);
  if (dateMatch) entities.date = dateMatch[1];

  // 天數
  const nightsMatch = lowerMsg.match(/(\d+)\s*(晚|天|夜)/);
  if (nightsMatch) entities.nights = parseInt(nightsMatch[1]);

  // 會員相關
  if (/(會員|vip|金卡|銀卡)/.test(lowerMsg)) entities.isMember = true;

  // 寵物相關
  if (/(寵物|狗|貓)/.test(lowerMsg)) entities.hasPets = true;

  // 年齡相關（兒童年齡）
  const ageMatch = lowerMsg.match(/(\d+)\s*歲/);
  if (ageMatch) entities.childAge = parseInt(ageMatch[1]);

  return entities;
}

// 第三層：上下文理解
function understandContext(message, session) {
  const context = {
    needsClarification: false,
    clarificationType: null,
    missingInfo: []
  };

  const currentStep = session.step;
  const currentData = session.data;

  // 檢查必要信息是否完整
  if (currentStep === 'room_selected' && !currentData.roomCount) {
    context.needsClarification = true;
    context.clarificationType = 'room_count';
    context.missingInfo.push('房間數量');
  }

  if (currentStep === 'room_selected' && !currentData.adults) {
    context.needsClarification = true;
    context.clarificationType = 'guest_count';
    context.missingInfo.push('入住人數');
  }

  if (currentStep === 'room_selected' && !currentData.nights) {
    context.needsClarification = true;
    context.clarificationType = 'stay_duration';
    context.missingInfo.push('住宿天數');
  }

  return context;
}

// ==================== 智能回應生成 ====================

function generateRoomSelectionReply(entities, session) {
  if (entities.roomType) {
    session.data.roomType = entities.roomType;
    session.step = 'room_selected';
    
    let reply = `好的，您選擇的是 ${entities.roomType}。`;
    
    // 根據房型提供建議
    if (entities.roomType === '家庭房') {
      reply += ' 家庭房適合帶小孩的家庭入住，請問有幾位大人和小孩？';
    } else if (entities.roomType.includes('雙人房')) {
      reply += ' 請問有幾位大人入住？';
    }
    
    return reply;
  }
  
  return '請問您想要預訂哪種房型？我們有：標準雙人房、豪華雙人房、套房、家庭房。';
}

function generateGuestInfoReply(entities, session) {
  let reply = '';
  
  if (entities.adults) {
    session.data.adults = entities.adults;
    reply += `了解，${entities.adults}位大人。`;
  }
  
  if (entities.children) {
    session.data.children = entities.children;
    session.data.hasChildren = true;
    reply += ` ${entities.children}位小孩。`;
    
    // 詢問兒童年齡以判斷是否需要加床或額外費用
    if (!session.data.childAges && entities.children > 0) {
      session.step = 'ask_child_ages';
      reply += ' 請問小孩的年齡分別是？這會影響是否需要加床或額外費用。';
      return reply;
    }
  }
  
  if (entities.roomCount) {
    session.data.roomCount = entities.roomCount;
    reply += ` ${entities.roomCount}間房間。`;
  }
  
  // 檢查是否還需要更多信息
  if (!session.data.adults) {
    session.step = 'ask_guest_count';
    reply += ' 請問有幾位大人入住？';
  } else if (!session.data.roomCount) {
    session.step = 'ask_room_count';
    reply += ' 請問需要幾間房間？';
  } else if (!session.data.nights) {
    session.step = 'ask_stay_duration';
    reply += ' 請問打算入住幾晚？';
  } else {
    session.step = 'ready_to_book';
    reply += ' 信息已完整！需要我為您計算價格嗎？';
  }
  
  return reply;
}

function generatePetPolicyReply(entities, session) {
  session.context.petInquiry = true;
  
  let reply = '關於寵物入住政策：\n';
  reply += '• 我們歡迎小型寵物入住（15公斤以下）\n';
  reply += '• 每房限帶1隻寵物\n';
  reply += '• 需支付清潔費 NT$500/晚\n';
  reply += '• 請自備寵物用品\n';
  reply += '• 寵物不可單獨留在房內\n\n';
  
  if (entities.hasPets) {
    session.data.hasPets = true;
    reply += '了解您會帶寵物，已為您備註。請問還有其他需求嗎？';
  } else {
    reply += '請問您還有其他問題嗎？';
  }
  
  return reply;
}

function generatePromotionReply(entities, session) {
  let reply = '我們目前有以下優惠：\n';
  
  if (entities.isMember) {
    reply += '🎯 **會員專屬優惠**\n';
    reply += '• 會員享房價9折優惠\n';
    reply += '• 免費延遲退房至14:00\n';
    reply += '• 入住禮：迎賓水果\n';
    reply += '• 累積點數兌換免費住宿\n\n';
  }
  
  reply += '💰 **一般優惠**\n';
  reply += '• 連住3晚以上享85折\n';
  reply += '• 預訂2間房以上享團體優惠\n';
  reply += '• 長者（65歲以上）享9折\n';
  reply += '• 學生證享95折\n\n';
  
  reply += '👨‍👩‍👧‍👦 **家庭優惠**\n';
  reply += '• 12歲以下兒童不加床免費\n';
  reply += '• 提供嬰兒床租借服務\n';
  
  session.context.promotionInquiry = true;
  return reply;
}

function generateChildAgeReply(entities, session) {
  if (entities.childAge) {
    if (!session.data.childAges) session.data.childAges = [];
    session.data.childAges.push(entities.childAge);
    
    const remainingChildren = session.data.children - session.data.childAges.length;
    
    if (remainingChildren > 0) {
      return `已記錄 ${entities.childAge} 歲，請問其他小孩的年齡是？`;
    } else {
      // 所有兒童年齡都已記錄，計算費用影響
      const hasExtraBed = session.data.childAges.some(age => age >= 6);
      const hasFreeChild = session.data.childAges.some(age => age < 6);
      
      let reply = '感謝提供年齡信息！\n';
      if (hasFreeChild) reply += '• 6歲以下兒童不加床免費\n';
      if (hasExtraBed) reply += '• 6歲以上兒童可能需要加床（NT$800/晚）\n';
      
      session.step = 'ask_room_count';
      reply += ' 請問需要幾間房間？';
      return reply;
    }
  }
  
  return '請問小孩的年齡是？這會影響住宿費用。';
}

// ==================== 主對話處理邏輯 ====================
function processDialog(message, session) {
  const mainIntent = detectMainIntent(message);
  const entities = extractEntities(message);
  const context = understandContext(message, session);
  
  console.log('🎯 意圖分析:', { mainIntent, entities, context });
  
  let reply = '';
  let nextStep = session.step;
  
  // 處理澄清問題優先
  if (context.needsClarification) {
    switch (context.clarificationType) {
      case 'room_count':
        reply = '請問需要預訂幾間房間？';
        nextStep = 'ask_room_count';
        break;
      case 'guest_count':
        reply = '請問有幾位大人入住？';
        nextStep = 'ask_guest_count';
        break;
      case 'stay_duration':
        reply = '請問打算入住幾晚？';
        nextStep = 'ask_stay_duration';
        break;
    }
    return { reply, nextStep };
  }
  
  // 根據當前步驟處理
  switch (session.step) {
    case 'welcome':
    case 'init':
      if (mainIntent === 'book_room') {
        reply = generateRoomSelectionReply(entities, session);
      } else {
        reply = '您好！我是訂房助理，可以幫您預訂房間、查詢價格、了解優惠等。請問您需要什麼協助？';
      }
      break;
      
    case 'ask_child_ages':
      reply = generateChildAgeReply(entities, session);
      break;
      
    case 'ask_guest_count':
    case 'ask_room_count':
    case 'ask_stay_duration':
    case 'room_selected':
      reply = generateGuestInfoReply(entities, session);
      break;
      
    default:
      // 根據主要意圖處理
      switch (mainIntent) {
        case 'book_room':
          reply = generateRoomSelectionReply(entities, session);
          break;
        case 'ask_pet_policy':
          reply = generatePetPolicyReply(entities, session);
          break;
        case 'ask_promotion':
          reply = generatePromotionReply(entities, session);
          break;
        case 'ask_price':
          if (session.data.roomType) {
            reply = '好的，我來為您計算價格。請問入住日期和天數是？';
            nextStep = 'ask_stay_duration';
          } else {
            reply = '請問您想了解哪種房型的價格？我們有標準雙人房、豪華雙人房、套房、家庭房。';
            nextStep = 'ask_room_type';
          }
          break;
        default:
          reply = '抱歉，我不太理解您的問題。您可以問我關於訂房、價格、優惠、寵物政策等方面的問題。';
      }
  }
  
  return { reply, nextStep };
}

// ==================== 聊天接口 ====================
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ success: false, error: '缺少 message 或 sessionId' });
    }

    const session = getOrCreateSession(sessionId);
    const { reply, nextStep } = processDialog(message, session);
    session.step = nextStep;

    sessions.set(sessionId, session);
    await saveSessions();

    res.json({
      success: true,
      reply,
      sessionId,
      step: session.step,
      data: session.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('聊天處理錯誤:', error);
    res.status(500).json({ success: false, error: '聊天處理失敗', message: error.message });
  }
});

// ==================== 健康檢查接口 ====================
app.get('/health', (req, res) => {
  const healthStatus = {
    status: serverReady ? 'healthy' : 'starting',
    service: 'AI Hotel Assistant - Advanced',
    version: '8.0.0',
    timestamp: new Date().toISOString(),
    serverReady: serverReady,
    sessionsCount: sessions.size,
    uptime: process.uptime()
  };
  
  const statusCode = serverReady ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.get('/ready', (req, res) => {
  res.json({
    status: serverReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString()
  });
});

app.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// ==================== 價格計算系統 ====================
const roomPrices = {
  '標準雙人房': { basePrice: 2800, capacity: 2 },
  '豪華雙人房': { basePrice: 3800, capacity: 2 },
  '套房': { basePrice: 5800, capacity: 3 },
  '家庭房': { basePrice: 4500, capacity: 4 }
};

app.post('/api/price', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: '缺少 sessionId' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.data.roomType) {
      return res.status(400).json({ success: false, error: '請先選擇房型' });
    }

    const { roomType, adults = 2, children = 0, roomCount = 1, nights = 1, hasPets = false, isMember = false } = session.data;
    const roomConfig = roomPrices[roomType];
    
    if (!roomConfig) {
      return res.status(400).json({ success: false, error: '不支援的房型' });
    }

    // 計算基礎價格
    let totalPrice = roomConfig.basePrice * nights * roomCount;
    
    // 應用折扣
    let discountInfo = [];
    if (isMember) {
      totalPrice *= 0.9;
      discountInfo.push('會員9折');
    }
    if (nights >= 3) {
      totalPrice *= 0.85;
      discountInfo.push('連住3晚85折');
    }
    if (roomCount >= 2) {
      totalPrice *= 0.9;
      discountInfo.push('多間房9折');
    }
    
    // 額外費用
    let extraCharges = [];
    if (hasPets) {
      const petFee = 500 * nights * roomCount;
      totalPrice += petFee;
      extraCharges.push(`寵物清潔費 NT$${petFee}`);
    }
    
    // 兒童加床費用
    const childAges = session.data.childAges || [];
    const extraBedChildren = childAges.filter(age => age >= 6).length;
    if (extraBedChildren > 0) {
      const extraBedFee = 800 * extraBedChildren * nights;
      totalPrice += extraBedFee;
      extraCharges.push(`兒童加床費 NT$${extraBedFee}`);
    }

    const priceResult = {
      roomType,
      adults,
      children,
      roomCount,
      nights,
      basePrice: Math.round(roomConfig.basePrice * roomCount * nights),
      totalPrice: Math.round(totalPrice),
      currency: 'TWD',
      discounts: discountInfo,
      extraCharges: extraCharges,
      finalPrice: Math.round(totalPrice)
    };

    let reply = `🏨 ${roomType} 價格明細：\n`;
    reply += `• 房間：${roomCount}間 x ${nights}晚\n`;
    reply += `• 人數：${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''}\n`;
    reply += `• 基礎房價：NT$ ${priceResult.basePrice.toLocaleString()}\n`;
    
    if (discountInfo.length > 0) {
      reply += `• 適用優惠：${discountInfo.join(' + ')}\n`;
    }
    if (extraCharges.length > 0) {
      reply += `• 額外費用：${extraCharges.join(' + ')}\n`;
    }
    
    reply += `• 💰 總價格：NT$ ${priceResult.finalPrice.toLocaleString()}`;

    res.json({
      success: true,
      data: priceResult,
      reply,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 價格查詢錯誤:', error);
    res.status(500).json({
      success: false,
      error: '價格查詢失敗',
      message: error.message
    });
  }
});

// ==================== 啟動伺服器 ====================
(async () => {
  try {
    await loadSessions();

    const server = app.listen(PORT, () => {
      console.log(`\n🎉 智能訂房助理服務已啟動！`);
      console.log(`📍 服務地址: http://localhost:${PORT}`);
      console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
      console.log(`📊 初始會話數: ${sessions.size}`);
      console.log(`🔧 服務狀態: 啟動完成\n`);
      
      serverReady = true;
    });

    server.on('error', (error) => {
      console.error('💥 伺服器啟動錯誤:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('💥 啟動過程失敗:', error);
    process.exit(1);
  }
})();

// ==================== 優雅關閉 ====================
async function gracefulShutdown() {
  console.log('📦 收到終止信號，優雅關閉中...');
  serverReady = false;
  await saveSessions();
  console.log('👋 服務已優雅關閉');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;

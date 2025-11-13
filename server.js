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
  console.log('ℹ️  使用默認對話流程');
  dialogFlow = {
    states: {
      init: {
        prompt: '您好，歡迎使用 AI 訂房助理！請問您需要什麼幫助？'
      }
    }
  };
}

// 會話狀態管理（sessionId -> { step, data }）
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// ==================== 進程信號與優雅關閉 ====================
console.log('🔧 初始化信號處理...');

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
      console.log(`📂 從文件加載會話: ${savedSessions.length} 個會話`);
      for (const [sessionId, sessionData] of savedSessions) {
        sessions.set(sessionId, sessionData);
      }
      console.log(`✅ 成功加載 ${sessions.size} 個會話`);
    } else {
      console.log('📂 會話文件不存在，創建新文件');
    }
  } catch (error) {
    console.error('❌ 加載會話失敗:', error.message);
  }
}

async function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    await fs.writeFile(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
    console.log(`💾 會話已保存: ${sessions.size} 個會話`);
  } catch (error) {
    console.error('❌ 保存會話失敗:', error.message);
  }
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'init',
      data: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
    saveSessions().catch(console.error);
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 意圖與槽位偵測 ====================
function detectIntentAndEntities(message) {
  const lowerMsg = message.toLowerCase();
  let intent = null;
  let entities = {};

  if (/標準雙人房|豪華雙人房|套房/.test(lowerMsg)) {
    intent = 'select_room_type';
    const match = lowerMsg.match(/標準雙人房|豪華雙人房|套房/);
    entities.roomType = match ? match[0] : null;
  } else if (/訂房|預訂|預定/.test(lowerMsg)) {
    intent = 'book_room';
  } else if (/優惠|促銷|折扣/.test(lowerMsg)) {
    intent = 'ask_promotion';
  } else if (/取消|退訂/.test(lowerMsg)) {
    intent = 'cancel_booking';
  } else {
    intent = 'general_inquiry';
  }

  return { intent, entities };
}

// ==================== 對話邏輯決定與回覆生成 ====================
function decideStateAndReply(intent, entities, session) {
  let nextStep = session.step;
  let reply = '';

  switch (intent) {
    case 'select_room_type':
      session.data.roomType = entities.roomType;
      nextStep = 'check_booking_details';
      reply = `您選擇的是 ${entities.roomType}，請問您打算訂多少間房間，入住多久？`;
      break;
    case 'book_room':
      nextStep = 'check_booking_details';
      reply = '請問您打算訂多少間房間，入住多久？';
      break;
    case 'ask_promotion':
      nextStep = 'handle_promotion_query';
      reply = '請問您想了解哪一類優惠？長者優惠、企業優惠或其他？';
      break;
    case 'cancel_booking':
      nextStep = 'cancel_init';
      reply = '請提供訂單編號，我們將為您處理取消訂房。';
      break;
    default:
      nextStep = 'init';
      reply = dialogFlow.states[nextStep]?.prompt || '您好，歡迎使用 AI 訂房助理！請問您需要什麼幫助？';
      break;
  }

  return { nextStep, reply };
}

// ==================== 聊天接口 ====================
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ success: false, error: '缺少 message 或 sessionId' });
    }

    const session = getOrCreateSession(sessionId);
    const { intent, entities } = detectIntentAndEntities(message);
    const { nextStep, reply } = decideStateAndReply(intent, entities, session);
    session.step = nextStep;

    sessions.set(sessionId, session);
    await saveSessions();

    res.json({
      success: true,
      reply,
      sessionId,
      step: session.step,
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
    service: 'AI Hotel Assistant',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    serverReady: serverReady,
    sessionsCount: sessions.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  };
  
  const statusCode = serverReady ? 200 : 503;
  
  console.log(`🔍 健康檢查請求 - 狀態: ${healthStatus.status}, 就緒: ${serverReady}`);
  
  res.status(statusCode).json(healthStatus);
});

// 添加就緒檢查接口
app.get('/ready', (req, res) => {
  if (serverReady) {
    res.json({
      status: 'ready',
      message: '服務已就緒',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready', 
      message: '服務啟動中',
      timestamp: new Date().toISOString()
    });
  }
});

// 添加存活檢查接口（更簡單的檢查）
app.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// ==================== 價格計算邏輯 ====================
const roomPrices = {
  '標準雙人房': {
    basePrice: 2800,
    weekdayDiscount: 0.9,
    weekendSurcharge: 1.2,
    capacity: 2
  },
  '豪華雙人房': {
    basePrice: 3800,
    weekdayDiscount: 0.9,
    weekendSurcharge: 1.2,
    capacity: 2
  },
  '套房': {
    basePrice: 5800,
    weekdayDiscount: 0.85,
    weekendSurcharge: 1.3,
    capacity: 3
  }
};

function calculateRoomPrice(roomType, checkInDate, nights, roomCount, guestCount) {
  const roomConfig = roomPrices[roomType];
  if (!roomConfig) {
    throw new Error(`不支援的房型: ${roomType}`);
  }

  const checkIn = new Date(checkInDate);
  const dayOfWeek = checkIn.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  
  let pricePerRoom = roomConfig.basePrice;
  if (isWeekend) {
    pricePerRoom *= roomConfig.weekendSurcharge;
  } else {
    pricePerRoom *= roomConfig.weekdayDiscount;
  }
  
  const totalPrice = Math.round(pricePerRoom * nights * roomCount);
  
  return {
    roomType,
    basePrice: roomConfig.basePrice,
    pricePerRoom: Math.round(pricePerRoom),
    nights,
    roomCount,
    guestCount,
    totalPrice,
    isWeekend,
    checkInDate: checkIn.toISOString().split('T')[0],
    currency: 'TWD',
    priceBreakdown: {
      單晚單間價格: Math.round(pricePerRoom),
      住宿晚數: nights,
      房間數量: roomCount,
      週末加成: isWeekend ? `${Math.round((roomConfig.weekendSurcharge - 1) * 100)}%` : '無',
      平日折扣: !isWeekend ? `${Math.round((1 - roomConfig.weekdayDiscount) * 100)}%` : '無'
    }
  };
}

// ==================== 價格查詢API ====================
app.post('/api/price', (req, res) => {
  try {
    const { message, sessionId, roomType, checkInDate, nights, roomCount, guestCount } = req.body;
    
    console.log(`💰 價格查詢請求:`, {
      sessionId,
      roomType,
      checkInDate,
      nights,
      roomCount,
      guestCount
    });

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: '缺少會話ID',
        message: '請提供 sessionId'
      });
    }

    let detectedRoomType = roomType;
    if (!detectedRoomType && message) {
      const roomMatch = message.match(/標準雙人房|豪華雙人房|套房/);
      if (roomMatch) {
        detectedRoomType = roomMatch[0];
      }
    }

    if (!detectedRoomType) {
      return res.status(400).json({
        success: false,
        error: '請提供房型參數',
        message: '請指定房型：標準雙人房、豪華雙人房 或 套房',
        supportedRoomTypes: Object.keys(roomPrices)
      });
    }

    if (!roomPrices[detectedRoomType]) {
      return res.status(400).json({
        success: false,
        error: '不支援的房型',
        message: `不支援的房型: ${detectedRoomType}`,
        supportedRoomTypes: Object.keys(roomPrices)
      });
    }

    const defaultCheckIn = new Date();
    defaultCheckIn.setDate(defaultCheckIn.getDate() + 7);
    
    const finalCheckInDate = checkInDate || defaultCheckIn.toISOString().split('T')[0];
    const finalNights = parseInt(nights) || 1;
    const finalRoomCount = parseInt(roomCount) || 1;
    const finalGuestCount = parseInt(guestCount) || roomPrices[detectedRoomType].capacity;

    const priceResult = calculateRoomPrice(
      detectedRoomType,
      finalCheckInDate,
      finalNights,
      finalRoomCount,
      finalGuestCount
    );

    let replyMessage = `🏨 ${detectedRoomType} 價格資訊：\n`;
    replyMessage += `• 入住日期：${finalCheckInDate} (${priceResult.isWeekend ? '週末' : '平日'})\n`;
    replyMessage += `• 住宿天數：${finalNights} 晚\n`;
    replyMessage += `• 房間數量：${finalRoomCount} 間\n`;
    replyMessage += `• 建議人數：最多 ${finalGuestCount} 人\n`;
    replyMessage += `• 單晚單間：NT$ ${priceResult.pricePerRoom.toLocaleString()}\n`;
    replyMessage += `• 總價格：NT$ ${priceResult.totalPrice.toLocaleString()}\n`;
    
    if (priceResult.isWeekend) {
      replyMessage += `💡 注意：週末價格已包含${Math.round((roomPrices[detectedRoomType].weekendSurcharge - 1) * 100)}%加成`;
    } else {
      replyMessage += `💡 優惠：平日享受${Math.round((1 - roomPrices[detectedRoomType].weekdayDiscount) * 100)}%折扣`;
    }

    res.json({
      success: true,
      data: priceResult,
      reply: replyMessage,
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

// ==================== 獲取可用房型API ====================
app.get('/api/room-types', (req, res) => {
  try {
    const roomTypes = Object.keys(roomPrices).map(roomType => ({
      name: roomType,
      basePrice: roomPrices[roomType].basePrice,
      capacity: roomPrices[roomType].capacity,
      description: `${roomType} - 可容納 ${roomPrices[roomType].capacity} 人`
    }));

    res.json({
      success: true,
      data: {
        roomTypes,
        count: roomTypes.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 獲取房型錯誤:', error);
    res.status(500).json({
      success: false,
      error: '獲取房型失敗',
      message: error.message
    });
  }
});

// ==================== 景點數據 ====================
const attractionsData = {
  food: [
    {
      id: 1,
      name: "鼎泰豐",
      type: "food",
      cuisine: "台灣菜",
      rating: 4.5,
      distance: "0.3km",
      address: "信義區市府路45號",
      priceLevel: "$$",
      openingHours: "11:00-21:30",
      description: "知名小籠包專賣店"
    },
    {
      id: 2,
      name: "林東芳牛肉麵",
      type: "food",
      cuisine: "台灣菜",
      rating: 4.3,
      distance: "0.8km",
      address: "中山區八德路二段322號",
      priceLevel: "$",
      openingHours: "11:00-23:00",
      description: "傳統牛肉麵老店"
    }
  ],
  shopping: [
    {
      id: 3,
      name: "台北101購物中心",
      type: "shopping",
      category: "百貨公司",
      rating: 4.6,
      distance: "0.5km",
      address: "信義區市府路45號",
      openingHours: "11:00-21:30",
      description: "知名地標購物中心"
    }
  ],
  sightseeing: [
    {
      id: 4,
      name: "台北101觀景台",
      type: "sightseeing",
      category: "地標",
      rating: 4.7,
      distance: "0.5km",
      address: "信義區市府路45號89樓",
      ticketPrice: 600,
      openingHours: "09:00-22:00",
      description: "台北地標建築觀景台"
    }
  ]
};

// ==================== 附近景點API ====================
app.get('/api/attractions/nearby', (req, res) => {
  try {
    const { type, limit = 10, maxDistance = 5 } = req.query;
    
    console.log(`🔍 查詢附近景點: type=${type}, limit=${limit}, maxDistance=${maxDistance}`);
    
    if (!type) {
      return res.status(400).json({
        success: false,
        error: '缺少類型參數',
        message: '請提供景點類型 (type)，例如: food, shopping, sightseeing'
      });
    }

    const supportedTypes = ['food', 'shopping', 'sightseeing', 'all'];
    if (!supportedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: '不支援的景點類型',
        message: `支援的類型: ${supportedTypes.join(', ')}`,
        supportedTypes
      });
    }

    let results = [];
    
    if (type === 'all') {
      Object.values(attractionsData).forEach(category => {
        results = results.concat(category);
      });
    } else {
      results = attractionsData[type] || [];
    }

    const filteredResults = results.filter(attraction => {
      const distanceNum = parseFloat(attraction.distance);
      return distanceNum <= parseFloat(maxDistance);
    });

    const limitedResults = filteredResults.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        type,
        count: limitedResults.length,
        totalCount: filteredResults.length,
        attractions: limitedResults
      },
      pagination: {
        limit: parseInt(limit),
        returned: limitedResults.length,
        hasMore: filteredResults.length > limitedResults.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 景點查詢錯誤:', error);
    res.status(500).json({
      success: false,
      error: '景點查詢失敗',
      message: error.message
    });
  }
});

// ==================== 分層測試框架 ====================
const TEST_STRATEGY = {
  LEVEL1_BASIC: [
    { 
      name: "初始對話測試",
      input: "你好", 
      expectedKeywords: ["歡迎", "幫助", "您好"],
      sessionId: "test_basic_1"
    },
    { 
      name: "訂房意圖測試",
      input: "我想訂房", 
      expectedKeywords: ["房型", "房間", "標準", "豪華"],
      sessionId: "test_basic_2"
    }
  ],
  
  LEVEL2_INTENT: [
    { 
      name: "選擇標準雙人房",
      input: "我要標準雙人房", 
      expectedKeywords: ["標準雙人房", "多少間", "入住多久"],
      expectedStep: "check_booking_details",
      sessionId: "test_intent_1"
    },
    { 
      name: "優惠詢問意圖", 
      input: "有什麼優惠嗎",
      expectedKeywords: ["優惠", "折扣", "長者", "企業"],
      expectedStep: "handle_promotion_query",
      sessionId: "test_intent_2"
    }
  ],
  
  LEVEL3_FLOW: [
    {
      name: "完整訂房流程",
      sessionId: "test_flow_1",
      steps: [
        { input: "你好，我想預訂房間", expectedKeywords: ["歡迎", "幫助"] },
        { input: "標準雙人房", expectedKeywords: ["標準雙人房", "多少間", "入住多久"] }
      ]
    }
  ]
};

// ==================== 測試輔助函數 ====================
async function testSingleMessage(input, sessionId, expectedKeywords, expectedStep) {
  return new Promise((resolve) => {
    const req = {
      body: { 
        message: input, 
        sessionId: sessionId || `test_${Date.now()}`
      }
    };
    
    const res = {
      json: (data) => {
        const keywordResults = expectedKeywords.map(keyword => ({
          keyword,
          found: data.reply.includes(keyword)
        }));
        
        const keywordPassed = keywordResults.every(result => result.found);
        const stepPassed = !expectedStep || data.step === expectedStep;
        const passed = keywordPassed && stepPassed;
        
        resolve({ 
          passed, 
          data,
          keywordResults,
          stepCheck: { expected: expectedStep, actual: data.step, passed: stepPassed }
        });
      },
      status: (code) => ({
        json: (data) => {
          resolve({ 
            passed: false, 
            data,
            error: { code, message: data.error }
          });
        }
      })
    };
    
    try {
      const session = getOrCreateSession(req.body.sessionId);
      const { intent, entities } = detectIntentAndEntities(req.body.message);
      const { nextStep, reply } = decideStateAndReply(intent, entities, session);
      session.step = nextStep;
      
      sessions.set(req.body.sessionId, session);
      saveSessions().catch(console.error);
      
      res.json({
        success: true,
        reply,
        sessionId: req.body.sessionId,
        step: session.step,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '處理失敗',
        message: error.message
      });
    }
  });
}

async function runTests(testLevel = 'LEVEL1_BASIC') {
  console.log(`\n🧪 開始執行 ${testLevel} 測試...`);
  const tests = TEST_STRATEGY[testLevel];
  let passed = 0;
  let failed = 0;
  const details = [];

  for (const test of tests) {
    try {
      let testPassed = false;
      let testDetails = {};

      if (test.steps) {
        const flowResults = await testFlow(test.steps, test.sessionId);
        testPassed = flowResults.allPassed;
        testDetails = flowResults;
      } else {
        const result = await testSingleMessage(
          test.input, 
          test.sessionId, 
          test.expectedKeywords, 
          test.expectedStep
        );
        testPassed = result.passed;
        testDetails = result;
      }

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }

      details.push({
        name: test.name,
        passed: testPassed,
        details: testDetails
      });

    } catch (error) {
      failed++;
      details.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
  }
  
  return { passed, failed, total: tests.length, details };
}

async function testFlow(steps, sessionId) {
  let allPassed = true;
  const results = [];
  const flowSessionId = sessionId || `flow_${Date.now()}`;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = await testSingleMessage(step.input, flowSessionId, step.expectedKeywords);
    results.push({
      step: i + 1,
      input: step.input,
      ...result
    });
    
    if (!result.passed) {
      allPassed = false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return { allPassed, results, sessionId: flowSessionId };
}

// ==================== 測試API接口 ====================
app.get('/api/test/run', async (req, res) => {
  try {
    const { level = 'LEVEL1_BASIC' } = req.query;
    
    if (!TEST_STRATEGY[level]) {
      return res.status(400).json({
        success: false,
        error: '不支援的測試等級',
        supportedLevels: Object.keys(TEST_STRATEGY)
      });
    }
    
    const results = await runTests(level);
    
    res.json({
      success: true,
      level,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
    res.status(500).json({
      success: false,
      error: '測試執行失敗',
      message: error.message
    });
  }
});

app.get('/api/test/levels', (req, res) => {
  const levels = Object.keys(TEST_STRATEGY).map(level => ({
    name: level,
    description: getLevelDescription(level),
    testCount: TEST_STRATEGY[level].length
  }));
  
  res.json({
    success: true,
    levels,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0)
  });
});

function getLevelDescription(level) {
  const descriptions = {
    'LEVEL1_BASIC': '基礎功能測試 - 驗證基本對話能力和服務響應',
    'LEVEL2_INTENT': '意圖識別測試 - 驗證意圖偵測和狀態轉換正確性', 
    'LEVEL3_FLOW': '完整流程測試 - 驗證多輪對話流程和會話狀態保持'
  };
  return descriptions[level] || '未知測試等級';
}

app.get('/api/test/health', (req, res) => {
  const testStats = {
    totalLevels: Object.keys(TEST_STRATEGY).length,
    totalTestCases: Object.values(TEST_STRATEGY).reduce((sum, tests) => sum + tests.length, 0)
  };
  
  res.json({
    success: true,
    service: 'AI Hotel Assistant - 分層測試框架',
    status: 'active',
    ...testStats,
    timestamp: new Date().toISOString()
  });
});

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
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲異常:', error);
  serverReady = false;
  saveSessions().then(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
  serverReady = false;
});

// ==================== 啟動伺服器 ====================
(async () => {
  try {
    console.log('🔄 開始載入會話數據...');
    await loadSessions();

    console.log('🚀 啟動 Express 伺服器...');
    const server = app.listen(PORT, () => {
      console.log(`\n🎉 AI 訂房助理服務已啟動！`);
      console.log(`📍 服務地址: http://localhost:${PORT}`);
      console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
      console.log(`📊 初始會話數: ${sessions.size}`);
      console.log(`🔧 服務狀態: 啟動完成\n`);
      
      serverReady = true;
      console.log('✅ 服務就緒標記已設置');
    });

    server.on('error', (error) => {
      console.error('💥 伺服器啟動錯誤:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，請使用其他端口`);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('💥 啟動過程失敗:', error);
    process.exit(1);
  }
})();

console.log('✅ 分層測試框架已載入');
console.log('📋 測試等級:', Object.keys(TEST_STRATEGY));

module.exports = app;

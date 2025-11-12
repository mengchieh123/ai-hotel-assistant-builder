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
  process.exit(1);
}

// 會話狀態管理（sessionId -> { step, data }）
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// ==================== 進程信號與優雅關閉 ====================
console.log('🔧 初始化信號處理...');
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲異常:', error);
  saveSessions().then(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
});

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
  if (!serverReady) {
    return res.status(503).json({
      status: 'starting',
      message: '服務啟動中...',
      timestamp: new Date().toISOString()
    });
  }
  res.json({
    status: 'healthy',
    service: 'AI Hotel Assistant',
    version: '7.0.0',
    timestamp: new Date().toISOString()
  });
});

// ==================== 優雅關閉 ====================
async function gracefulShutdown() {
  console.log('📦 收到終止信號，優雅關閉中...');
  await saveSessions();
  console.log('👋 服務已優雅關閉');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ==================== 啟動伺服器 ====================
(async () => {
  await loadSessions();

  app.listen(PORT, () => {
    console.log(`\n🎉 AI 訂房助理服務已啟動！`);
    console.log(`📍 服務地址: http://localhost:${PORT}`);
    console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
    console.log(`📊 初始會話數: ${sessions.size}`);
    console.log(`🔧 服務狀態: 啟動完成\n`);

    serverReady = true;
  });
})();

module.exports = app;

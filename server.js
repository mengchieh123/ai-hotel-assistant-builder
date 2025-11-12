const express = require('express');
const cors = require('cors');
const fs = require('fs/promises'); // 使用 promise 版本的 fs
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

// ==================== 導入服務模組 ====================
const chatService = require('./services/chatService');

// ==================== 進程信號處理 ====================
console.log('🔧 初始化信號處理...');

// 處理容器信號
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

// 中間件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 請求日誌中間件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`, req.body || req.query);
  next();
});

// ==================== 會話管理 ====================
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
      step: 'init', // 初始狀態
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

// 取得當前狀態配置
function getStateConfig(step) {
  return dialogFlow.states[step] || dialogFlow.states['init'];
}

// 根據用戶輸入決定下一狀態（示範簡單）
function determineNextState(currentState, userMessage) {
  const stateConfig = getStateConfig(currentState);
  return stateConfig.next_state || 'init';
}

// 產生回覆
function generateReply(step) {
  const stateConfig = getStateConfig(step);
  return stateConfig.prompt || "抱歉，無法處理您的請求。";
}

// 優雅關閉處理
async function gracefulShutdown() {
  console.log('📦 收到終止信號，優雅關閉中...');
  await saveSessions();
  console.log('👋 服務已優雅關閉');
  process.exit(0);
}

// ==================== 健康檢查路由 ====================
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

// ==================== 聊天接口 ====================
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ success: false, error: '缺少 message 或 sessionId' });
    }

    const session = getOrCreateSession(sessionId);

    const currentStep = session.step;
    const nextStep = determineNextState(currentStep, message);
    session.step = nextStep;

    const reply = generateReply(nextStep);

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

// ==================== 其他 API 路由保持不變 ====================
// 這裡可以保留你原有的價格、訂房、取消訂房、景點、會員等 API 路由和函數

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

process.on('beforeExit', async () => {
  console.log('🔄 服務即將關閉，保存會話數據...');
  await saveSessions();
});

module.exports = app;

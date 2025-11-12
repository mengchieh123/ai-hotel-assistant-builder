const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// ==================== 載入對話流程配置 ====================
const dialogFlow = require('./config/dialog-flow.json'); // 請確保此文件存在並符合格式

// 會話狀態管理（sessionId -> { step, data }）
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// ==================== 導入服務模組 ====================
const chatService = require('./services/chatService');

// ==================== 進程信號處理 ====================
console.log('🔧 初始化信號處理...');

// 處理容器信號
// (省略，保持你原有的 SIGTERM、SIGINT、uncaughtException 處理)

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

// 基本路由與其他服務模組代碼參考你現有版本，不重複貼出

// 會話管理（增補：結合 dialog-flow.json 驅動狀態轉換與回覆）

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
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

function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
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
    saveSessions();
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// 依據流程文件取得當前狀態配置
function getStateConfig(step) {
  return dialogFlow.states[step] || dialogFlow.states['init'];
}

// 從用戶輸入決定下一狀態（示範可依照意圖識別擴充）
function determineNextState(currentState, userMessage) {
  // 優先示範，根據意圖判斷可放在此
  // 目前簡單帶過，直接使用流程檔 next_state
  const stateConfig = getStateConfig(currentState);
  return stateConfig.next_state || 'init';
}

// 產生回覆訊息（你也可以依意圖及槽位做更複雜的生成）
function generateReply(step) {
  const stateConfig = getStateConfig(step);
  return stateConfig.prompt || "抱歉，無法處理您的請求。";
}

// ==================== 聊天接口 ====================
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ success: false, error: '缺少 message 或 sessionId' });
    }

    const session = getOrCreateSession(sessionId);

    // 使用對話流程驅動狀態轉換和回覆
    const currentStep = session.step;
    
    // 這裡可以放你的意圖識別、槽位填充邏輯，示意先跳過
    // 更新狀態
    const nextStep = determineNextState(currentStep, message);
    session.step = nextStep;

    // 產生回覆
    const reply = generateReply(nextStep);

    // 更新 session 保存
    sessions.set(sessionId, session);
    saveSessions();

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
// (省略，保持你現有的價格、訂房、取消訂房、景點、會員等服務 API)

// ==================== 啟動伺服器 ====================
app.listen(PORT, () => {
  console.log(`\n🎉 AI 訂房助理服務已啟動！`);
  console.log(`📍 服務地址: http://localhost:${PORT}`);
  console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
  console.log(`📊 初始會話數: ${sessions.size}`);
  console.log(`🔧 服務狀態: 啟動完成\n`);

  serverReady = true;
});

// 優雅關閉處理
process.on('beforeExit', () => {
  console.log('🔄 服務即將關閉，保存會話數據...');
  saveSessions();
});

module.exports = app;

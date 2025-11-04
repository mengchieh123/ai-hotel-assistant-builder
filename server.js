const express = require('express');
const app = express();

// 極簡中間件 - 減少內存使用
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// 立即響應的健康檢查 - Railway 需要快速響應
app.get('/health', (req, res) => {
  console.log('🔍 Health check received');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant',
    version: '3.3.0-railway-ultimate',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// 根路徑重定向到健康檢查
app.get('/', (req, res) => {
  res.redirect('/health');
});

// 極簡 AI 路由
const aiRoutes = express.Router();

// 基礎意圖識別
function recognizeIntent(message) {
  const msg = message.toLowerCase().trim();
  
  const intents = {
    greeting: ['你好', '嗨', 'hello', '您好', 'hi'],
    price: ['價格', '房價', '多少錢', '價錢', '住宿費用'],
    room: ['房型', '房間', '套房', '行政房', '豪華房'],
    booking: ['訂房', '預訂', 'booking', 'reservation'],
    promotion: ['優惠', '折扣', '促銷', 'promotion'],
    breakfast: ['早餐', 'meal', '吃飯'],
    policy: ['取消', '政策', '退款', '取消政策']
  };

  for (const [intent, patterns] of Object.entries(intents)) {
    if (patterns.some(pattern => msg.includes(pattern))) {
      return intent;
    }
  }
  return 'fallback';
}

// 響應生成
function generateResponse(intent) {
  const responses = {
    greeting: '🏨 歡迎光臨台北晶華酒店！我是您的訂房助理，可以幫您查詢房價、介紹房型、協助訂房。請問需要什麼服務呢？',
    
    price: `💰 **參考價格範圍**（實際價格依日期調整）：
• 豪華客房：NT$7,500 - 9,500/晚
• 行政客房：NT$10,500 - 13,500/晚  
• 套房：NT$16,000 - 21,000/晚

請提供入住日期，我可以為您查詢精確報價！`,

    room: `🏨 **精選房型介紹**：

1. **豪華客房** (35㎡)
   • 適合：2位成人
   • 景觀：市景
   • 早餐：可加購

2. **行政客房** (42㎡)
   • 適合：2位成人
   • 含免費早餐
   • 行政酒廊使用權

3. **套房** (68㎡)
   • 適合：3位成人
   • 獨立客廳
   • 含免費早餐`,

    booking: '📅 好的！請告訴我：\n1. 入住日期（月/日）\n2. 退房日期（月/日）\n3. 入住人數\n我來為您查詢空房！',

    promotion: `🎉 **當前優惠活動**：

🐦 早鳥優惠：提前30天預訂享8折
🏠 連住優惠：3晚95折，5晚9折，7晚85折
🎓 學生專案：憑學生證享85折
👴 銀髮專案：65歲以上享85折`,

    breakfast: `🍳 **早餐資訊**：
• 供應時間：06:30-10:30（平日），06:30-11:00（週末）
• 地點：栢麗廳（2樓）
• 價格：NT$650/人/天
• 行政客房以上房型含免費早餐`,

    policy: `📋 **取消政策**：
• 入住前7天：免費取消
• 入住前3-7天：收取50%費用
• 入住前3天內：收取100%費用
• 特殊促銷方案依活動規定`,

    fallback: '🤖 我可以協助您：查詢房價、房型介紹、優惠活動、協助訂房。請告訴我您需要什麼幫助？'
  };

  return responses[intent] || responses.fallback;
}

// AI 聊天端點
aiRoutes.post('/chat', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message',
        message: '請提供有效的訊息內容'
      });
    }

    console.log(`💬 Received message: ${message.substring(0, 50)}...`);
    
    const intent = recognizeIntent(message);
    const response = generateResponse(intent);
    
    const result = {
      message: response,
      intent: intent,
      timestamp: new Date().toISOString(),
      version: '3.3.0'
    };

    console.log(`✅ Responded with intent: ${intent}`);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Service temporarily unavailable',
      message: '服務暫時不可用，請稍後再試'
    });
  }
});

// 註冊 AI 路由
app.use('/api/ai', aiRoutes);

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: '請求的端點不存在'
  });
});

// 全局錯誤處理
app.use((err, req, res, next) => {
  console.error('💥 Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: '系統發生錯誤，請稍後再試'
  });
});

// 優雅關閉處理
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`📡 Received ${signal}, starting graceful shutdown...`);
  
  // 立即修改健康檢查為不健康
  app.get('/health', (req, res) => {
    res.status(503).json({
      status: 'SHUTTING_DOWN',
      message: 'Service is shutting down',
      timestamp: new Date().toISOString()
    });
  });

  setTimeout(() => {
    console.log('🛑 Graceful shutdown completed');
    process.exit(0);
  }, 5000);
};

// 信號處理
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未處理的異常和拒絕
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // 不退出，保持服務運行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // 不退出，保持服務運行
});

// 啟動服務
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 =================================');
  console.log('✅ Server running on port', PORT);
  console.log('✅ AI Hotel Assistant v3.3.0');
  console.log('✅ Railway Optimized Version');
  console.log('✅ Health check: /health');
  console.log('✅ AI endpoint: /api/ai/chat');
  console.log('🚀 =================================');
  
  // 立即進行自我健康檢查
  const http = require('http');
  const check = http.get(`http://localhost:${PORT}/health`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('❤️  Self health check:', res.statusCode);
    });
  });
  
  check.on('error', (err) => {
    console.log('💔 Self health check failed:', err.message);
  });
});

// 定期心跳日誌
setInterval(() => {
  if (!isShuttingDown) {
    const used = process.memoryUsage();
    const memoryUsage = Math.round(used.heapUsed / 1024 / 1024 * 100) / 100;
    console.log(`💓 Heartbeat - Memory: ${memoryUsage} MB, Uptime: ${Math.round(process.uptime())}s`);
  }
}, 60000); // 每分鐘一次

module.exports = server;

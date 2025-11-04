const express = require('express');
const app = express();

// 極簡中間件 - 減少內存使用
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 立即響應的健康檢查 - Railway 需要快速響應
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant',
    version: '3.2-railway-optimized'
  });
});

// 根路徑也響應健康檢查
app.get('/', (req, res) => {
  res.redirect('/health');
});

// 核心 AI 聊天端點 - 極簡實現
app.post('/api/ai/chat', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 極簡意圖識別
    const userMessage = message.toLowerCase().trim();
    let response = '';

    if (userMessage.includes('你好') || userMessage.includes('嗨') || userMessage.includes('hello')) {
      response = '🏨 歡迎光臨！我是您的訂房助理。請問需要查詢房價、房型介紹還是協助訂房呢？';
    } else if (userMessage.includes('價格') || userMessage.includes('房價') || userMessage.includes('多少錢')) {
      response = '💰 我們的參考價格：\n• 豪華客房：NT$7,500-9,500/晚\n• 行政客房：NT$10,500-13,500/晚\n• 套房：NT$16,000-21,000/晚\n\n請提供入住日期獲取精確報價！';
    } else if (userMessage.includes('房型') || userMessage.includes('房間') || userMessage.includes('套房')) {
      response = '🏨 主要房型：\n1. 豪華客房 (35㎡) - 2人\n2. 行政客房 (42㎡) - 2人，含早餐\n3. 套房 (68㎡) - 3人，含早餐\n\n需要詳細介紹嗎？';
    } else if (userMessage.includes('訂房') || userMessage.includes('預訂') || userMessage.includes('booking')) {
      response = '📅 好的！請告訴我：\n1. 入住日期\n2. 退房日期\n3. 入住人數\n\n我來為您查詢空房！';
    } else if (userMessage.includes('優惠') || userMessage.includes('折扣') || userMessage.includes('promotion')) {
      response = '🎉 當前優惠：\n🐦 早鳥優惠：30天前預訂8折\n🏠 連住優惠：3晚95折，5晚9折\n🎓 學生專案：憑證85折';
    } else {
      response = '🤖 我可以協助您：查詢房價、房型介紹、優惠活動、協助訂房。請告訴我您需要什麼幫助？';
    }

    res.json({
      message: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: '服務暫時不可用，請稍後再試',
      message: '抱歉，系統暫時遇到問題，請重新嘗試或聯絡客服。'
    });
  }
});

// 優雅的錯誤處理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: '系統暫時遇到問題，請稍後再試。'
  });
});

// 優雅關閉處理
const gracefulShutdown = (signal) => {
  console.log(`📡 Received ${signal}, starting graceful shutdown...`);
  
  // 立即響應健康檢查為不健康
  app.get('/health', (req, res) => {
    res.status(503).json({ 
      status: 'SHUTTING_DOWN',
      message: 'Service is shutting down'
    });
  });

  setTimeout(() => {
    console.log('🛑 Graceful shutdown completed');
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 啟動服務
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服務器運行在端口 ${PORT}`);
  console.log(`🤖 Railway 優化版 AI v3.2 初始化`);
  console.log(`🔍 健康檢查: http://0.0.0.0:${PORT}/health`);
  
  // 立即進行自我健康檢查
  const http = require('http');
  const check = http.get(`http://localhost:${PORT}/health`, (res) => {
    console.log(`✅ 自我健康檢查: ${res.statusCode}`);
  });
  check.on('error', (err) => {
    console.log('❌ 自我健康檢查失敗:', err.message);
  });
});

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error);
  // 不退出進程，保持服務運行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  // 不退出進程，保持服務運行
});

module.exports = server;

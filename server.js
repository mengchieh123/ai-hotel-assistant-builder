const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 從環境變數讀取 PORT，Railway 會自動設定
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 健康檢查端點 - 必須快速響應
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.send('AI Hotel Assistant API is running');
});

// AI 聊天路由
const aiRoutes = require('./routes/ai-routes');
app.use('/api/ai', aiRoutes);

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 優雅關閉處理
let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // 強制關閉超時
    setTimeout(() => {
      console.log('Forcing shutdown');
      process.exit(1);
    }, 10000);
  }
});

// 啟動服務器
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI Chat: http://localhost:${PORT}/api/ai/chat`);
});

// 處理未捕獲的錯誤
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;

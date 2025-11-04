const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 健康檢查 - 快速響應
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路徑
app.get('/', (req, res) => {
  res.send('AI Hotel Assistant API');
});

// AI 路由
try {
  const aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
} catch (err) {
  console.warn('AI routes not found, using fallback');
  app.post('/api/ai/chat', (req, res) => {
    res.json({ message: '服務正在啟動中，請稍後再試' });
  });
}

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal error' });
});

// 優雅關閉
let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM - closing gracefully');
  if (server) {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  }
});

// 啟動
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// 錯誤處理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});

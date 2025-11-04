const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('🚀 啟動服務器...');

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: 'AI Hotel Assistant API',
    version: '2.1.0',
    status: 'running'
  });
});

// 健康檢查 - 最優先最簡單
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// AI 路由 - 安全加載
let aiRoutes = null;
try {
  aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
  console.log('✅ AI 路由已加載');
} catch (error) {
  console.error('⚠️  AI 路由加載失敗:', error.message);
  
  // 提供後備路由
  app.get('/api/ai/status', (req, res) => {
    res.json({ available: false, error: 'AI service not loaded' });
  });
  
  app.post('/api/ai/chat', (req, res) => {
    res.json({ 
      success: false, 
      message: '服務正在啟動中，請稍後再試'
    });
  });
}

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('服務器錯誤:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 啟動服務器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 服務器已啟動');
  console.log('📍 端口: ' + PORT);
  console.log('🔗 健康檢查: http://0.0.0.0:' + PORT + '/health');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('⏹️  收到 SIGTERM，優雅關閉...');
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏹️  收到 SIGINT，優雅關閉...');
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});

// 未捕獲錯誤
process.on('uncaughtException', (error) => {
  console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// 最優先：健康檢查（不依賴任何模塊）
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 基本中間件
app.use(express.json());
app.use(express.static('public'));

// 根路徑
app.get('/', (req, res) => {
  res.json({ status: 'running', service: 'AI Hotel Assistant API' });
});

// 延遲加載 AI 路由（不阻塞啟動）
setImmediate(() => {
  try {
    const aiRoutes = require('./routes/ai-routes');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI 路由已加載');
  } catch (error) {
    console.error('⚠️  AI 路由加載失敗:', error.message);
  }
});

// 立即啟動服務器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 服務器運行在端口 ' + PORT);
});

// 優雅關閉
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('⏹️  收到 ' + signal + '，優雅關閉...');
  
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
  
  // 強制超時
  setTimeout(() => {
    console.error('強制關閉');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('未捕獲異常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未處理的 Promise:', reason);
});

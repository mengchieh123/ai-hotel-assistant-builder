const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 根路徑 - API 資訊
app.get('/', (req, res) => {
  res.json({
    message: '🏨 AI Hotel Assistant API',
    version: '2.1.0',
    status: 'running',
    endpoints: {
      health: '/health',
      aiStatus: '/api/ai/status',
      chat: '/api/ai/chat',
      recommendRooms: '/api/ai/recommend-room',
      demo: '/ai-chat-demo.html'
    }
  });
});

// 健康檢查
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查被調用');
  res.json({
    status: 'healthy',
    service: 'AI Hotel Assistant',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 8080,
    features: {
      speckit: '✅ 已啟用',
      mockAI: '✅ 已啟用',
      staticFiles: '✅ 已啟用'
    }
  });
});

// 載入 AI 路由
try {
  const aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
  console.log('✅ AI 路由已加載');
} catch (error) {
  console.error('⚠️  AI 路由加載失敗:', error.message);
}

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: '請求的路徑不存在',
    path: req.path,
    availablePaths: [
      '/ - API 資訊',
      '/health - 健康檢查',
      '/api/ai/status - AI 服務狀態',
      '/api/ai/chat - AI 對話',
      '/api/ai/recommend-room - 房型推薦',
      '/ai-chat-demo.html - 測試頁面'
    ]
  });
});

// 啟動服務器
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 啟動 AI Hotel Assistant 服務器...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 啟動端口: ' + PORT);
  console.log('✅ 服務器運行在: http://0.0.0.0:' + PORT);
  console.log('🔍 健康檢查: http://0.0.0.0:' + PORT + '/health');
  console.log('🎨 測試頁面: http://0.0.0.0:' + PORT + '/ai-chat-demo.html');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('⏹️  收到 SIGTERM 信號，正在關閉服務器...');
  process.exit(0);
});

// 心跳日誌（每30秒）
setInterval(() => {
  console.log('💓 服務器運行中 - ' + new Date().toISOString());
}, 30000);

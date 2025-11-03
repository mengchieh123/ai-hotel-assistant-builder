const express = require('express');
const path = require('path');
const app = express();

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS（如果需要）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// 日誌中間件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// 加載路由
// ============================================

// AI 路由（必須在其他路由之前）
let aiRoutes = null;
try {
  aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
  console.log('✅ AI 路由已加載');
} catch (error) {
  console.error('⚠️  AI 路由加載失敗:', error.message);
}

// ============================================
// 基礎路由
// ============================================

// 根路徑 - API 信息
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant API',
    version: '2.1.0',
    status: 'running',
    endpoints: {
      health: '/health',
      demo: '/demo',
      ai: {
        status: '/api/ai/status',
        chat: '/api/ai/chat',
        recommendRoom: '/api/ai/recommend-room',
        translate: '/api/ai/translate'
      }
    },
    documentation: 'https://github.com/mengchieh123/ai-hotel-assistant-builder'
  });
});

// 健康檢查
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查被調用');
  
  // 檢查 OpenAI 配置
  let openaiStatus = '❌ 未配置';
  try {
    const openaiService = require('./services/openai-service');
    if (openaiService && openaiService.isAvailable && openaiService.isAvailable()) {
      openaiStatus = '✅ 已配置';
    }
  } catch (error) {
    openaiStatus = '❌ 服務未找到';
  }
  
  res.json({
    status: 'healthy',
    service: 'AI Hotel Assistant',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || '8080',
    features: {
      speckit: '✅ 已啟用',
      openai: openaiStatus,
      staticFiles: '✅ 已啟用'
    }
  });
});

// 演示頁面
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// 產品經理演示頁面
app.get('/product-manager-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product-manager-demo.html'));
});

// ============================================
// 錯誤處理
// ============================================

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: '請求的路徑不存在',
    availablePaths: [
      '/ - API 信息',
      '/health - 健康檢查',
      '/demo - 演示頁面',
      '/api/ai/status - AI 服務狀態',
      '/api/ai/chat - AI 對話',
      '/api/ai/recommend-room - 智能推薦',
      '/api/ai/translate - 多語言翻譯'
    ]
  });
});

// 全局錯誤處理
app.use((err, req, res, next) => {
  console.error('服務器錯誤:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ============================================
// 啟動服務器
// ============================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 啟動 AI Hotel Assistant 生產服務器...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 啟動端口: ${PORT}`);
  console.log(`✅ 服務器運行在: http://0.0.0.0:${PORT}`);
  console.log(`🔍 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`🎨 演示頁面: http://0.0.0.0:${PORT}/demo`);
  
  // 檢查 OpenAI
  try {
    const openaiService = require('./services/openai-service');
    if (openaiService && openaiService.isAvailable && openaiService.isAvailable()) {
      console.log('🤖 OpenAI 狀態: ✅ 已配置');
    } else {
      console.log('🤖 OpenAI 狀態: ❌ 未配置');
    }
  } catch (error) {
    console.log('🤖 OpenAI 狀態: ❌ 未配置');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// 心跳日誌（每30秒）
setInterval(() => {
  console.log(`💓 服務器運行中 - ${new Date().toISOString()}`);
}, 30000);

module.exports = app;

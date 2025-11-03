console.log('🚀 啟動 AI Hotel Assistant 生產服務器...');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(express.json());

// 健康檢查端點 - 必須返回 200 狀態碼
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查被調用');
  res.status(200).json({ 
    status: 'healthy',
    service: 'AI Hotel Assistant',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: '🏨 AI Hotel Assistant API',
    version: '2.0.0',
    status: 'running'
  });
});

// 啟動服務器
console.log(`📍 啟動端口: ${PORT}`);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服務器運行在: http://0.0.0.0:${PORT}`);
  console.log(`🔍 健康檢查: http://0.0.0.0:${PORT}/health`);
  
  // 立即記錄啟動成功
  setInterval(() => {
    console.log('💓 服務器運行中 - ' + new Date().toISOString());
  }, 30000);
});

// 錯誤處理
server.on('error', (error) => {
  console.error('❌ 服務器錯誤:', error.message);
  process.exit(1);
});

module.exports = app;

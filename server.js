// ultra-stable-server.js
const express = require('express');

console.log('🔧 Starting server initialization...');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 最簡單的健康檢查
app.get('/health', (req, res) => {
  console.log('✅ Health check received');
  res.json({ 
    status: 'ok', 
    message: 'AI Hotel Assistant - ULTRA STABLE',
    timestamp: new Date().toISOString()
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant',
    status: 'active',
    message: 'Server is running!'
  });
});

// 錯誤處理 - 防止崩潰
app.use((err, req, res, next) => {
  console.error('🚨 Error caught:', err.message);
  res.status(500).json({ 
    error: 'Something went wrong',
    message: err.message 
  });
});

console.log('🔧 Server configured, starting listen...');

// 啟動伺服器
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🎉 ULTRA STABLE SERVER STARTED!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
    console.log('✅ Health check: /health');
    console.log('='.repeat(60));
    
    // 定期心跳日誌
    setInterval(() => {
      console.log('💓 Heartbeat:', new Date().toISOString());
    }, 30000);
  });
} catch (error) {
  console.error('💥 CRITICAL: Failed to start server:', error);
  process.exit(1);
}

console.log('🔧 Listen call completed, server should be starting...');

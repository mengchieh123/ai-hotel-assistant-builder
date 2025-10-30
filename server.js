const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  console.log('Health check - OK');
  res.json({ 
    status: 'ok', 
    message: 'AI Hotel Assistant API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant',
    status: 'active'
  });
});

// 啟動伺服器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('✅ SERVER STARTED SUCCESSFULLY');
  console.log(`📍 Port: ${PORT}`);
  console.log('='.repeat(50));
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// 保持進程運行
setInterval(() => {
  console.log('🔄 Heartbeat:', new Date().toISOString());
}, 30000);

console.log('🚀 Application initialization complete');

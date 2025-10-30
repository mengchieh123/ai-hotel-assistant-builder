const express = require('express');

console.log('🚀 Starting AI Hotel Assistant Server...');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Railway 健康檢查端點（必須有）
app.get('/health', (req, res) => {
  console.log('✅ Health check passed');
  res.status(200).json({
    status: 'ok',
    message: 'AI Hotel Assistant API - Railway Ready',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant Builder',
    status: 'active',
    endpoints: {
      'GET /health': '健康檢查',
      'POST /api/ai/chat': 'AI對話',
      'GET /api/hotels/search': '飯店搜尋'
    }
  });
});

// AI 對話
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  console.log('🤖 AI Chat:', message);
  
  res.json({
    response: `已理解: ${message}`,
    analysis: { location: '台北', budget: '5000元' },
    timestamp: new Date().toISOString()
  });
});

// 飯店搜尋
app.get('/api/hotels/search', (req, res) => {
  const { location = '台北' } = req.query;
  console.log('🔍 Hotel search:', location);
  
  res.json({
    hotels: [
      { id: '1', name: `${location}君悅`, price: 4500, rating: 4.8 }
    ],
    total: 1
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 啟動伺服器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('✅ SERVER STARTED AND READY FOR RAILWAY!');
  console.log(`📍 Port: ${PORT}`);
  console.log('🌐 Endpoints:');
  console.log('   GET  /health');
  console.log('   GET  /');
  console.log('   POST /api/ai/chat');
  console.log('   GET  /api/hotels/search');
  console.log('='.repeat(50));
});

// Railway 健康檢查通過信號
console.log('🚄 Railway: Application is ready for health checks');

// 保持進程運行
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => {
    console.log('Server closed');
  });
});

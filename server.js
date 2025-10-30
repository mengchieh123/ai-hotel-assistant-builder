const express = require('express');

console.log('🚀 Starting AI Hotel Assistant on PORT 8080...');

const app = express();
// 明確使用 8080 端口
const PORT = 8080;

console.log('🔧 Using fixed PORT:', PORT);

app.use(express.json());

// Railway 健康檢查端點
app.get('/health', (req, res) => {
  console.log('✅ Health check received on port', PORT);
  res.status(200).json({
    status: 'ok',
    message: 'AI Hotel Assistant - PORT 8080',
    port: PORT,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant Builder',
    version: '1.0.0',
    status: 'active',
    port: PORT,
    endpoints: {
      'GET /health': '健康檢查',
      'POST /api/ai/chat': 'AI對話處理',
      'GET /api/hotels/search': '飯店搜尋'
    }
  });
});

// AI 對話端點
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  console.log('🤖 AI Chat on port', PORT, ':', message);
  
  res.json({
    success: true,
    response: `🧠 已理解您的需求：${message}`,
    analysis: {
      location: '台北',
      budget: '5000元',
      timeFrame: '週末',
      starRating: '五星級'
    },
    timestamp: new Date().toISOString()
  });
});

// 飯店搜尋端點
app.get('/api/hotels/search', (req, res) => {
  const { location = '台北' } = req.query;
  console.log('🔍 Hotel search on port', PORT, ':', location);
  
  res.json({
    success: true,
    hotels: [
      {
        id: 'hotel_1',
        name: `${location}君悅大飯店`,
        price: 4500,
        rating: 4.8,
        stars: 5,
        available: true
      },
      {
        id: 'hotel_2',
        name: `${location}W飯店`, 
        price: 4800,
        rating: 4.9,
        stars: 5,
        available: true
      }
    ],
    totalResults: 2
  });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🎯 SERVER STARTED ON PORT 8080');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Internal: http://0.0.0.0:${PORT}`);
  console.log(`🌐 External: https://ai-hotel-assistant-builder-production.up.railway.app`);
  console.log('✅ Ready for Railway health checks');
  console.log('='.repeat(60));
});

// 保持運行
setInterval(() => {
  console.log('💓 Heartbeat - Port 8080 -', new Date().toISOString());
}, 30000);

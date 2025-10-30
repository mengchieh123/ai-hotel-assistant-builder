// 最簡單的可用版本 - 確保 Railway 部署成功
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ 
    status: 'ok', 
    message: 'AI Hotel Assistant API is running',
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
      health: 'GET /health',
      aiChat: 'POST /api/ai/chat',
      hotelSearch: 'GET /api/hotels/search'
    }
  });
});

// AI 對話端點
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  
  console.log('AI Chat request:', message);
  
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
  const { location = '台北', guests = 2 } = req.query;
  
  console.log('Hotel search request:', { location, guests });
  
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

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal Server Error',
    message: err.message 
  });
});

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// 啟動伺服器 - 關鍵修改！
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 AI Hotel Assistant 啟動成功!');
  console.log(`📍 端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'production'}`);
  console.log('='.repeat(50));
});

// 處理未捕獲的異常
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// AI Hotel Assistant - Railway 兼容版本
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  console.log('✅ Health check accessed');
  res.json({
    status: 'ok',
    message: '🏨 AI Hotel Assistant API - Railway Deployment',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// 根路徑 - API 文檔
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant Builder',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      'GET /health': '系統健康檢查',
      'POST /api/ai/chat': 'AI對話處理',
      'GET /api/hotels/search': '飯店搜尋',
      'POST /api/bookings/create': '創建預訂'
    }
  });
});

// AI 對話處理
app.post('/api/ai/chat', (req, res) => {
  const { message, context } = req.body;
  
  console.log('🤖 AI Chat Request:', { message, context });
  
  const response = {
    success: true,
    response: `🧠 已理解您的需求：${message}`,
    analysis: {
      intent: "hotel-booking",
      requirements: {
        location: "台北",
        budget: "5000元",
        timeFrame: "週末",
        starRating: "五星級"
      }
    },
    nextSteps: [
      "為您搜尋符合條件的五星級飯店",
      "過濾預算範圍內的選項"
    ],
    timestamp: new Date().toISOString()
  };
  
  res.json(response);
});

// 飯店搜尋
app.get('/api/hotels/search', (req, res) => {
  const { location = '台北', guests = 2 } = req.query;
  
  console.log('🔍 Hotel Search:', req.query);
  
  const hotels = [
    {
      id: 'hotel_1',
      name: `${location}君悅大飯店`,
      location: location,
      price: 4500,
      rating: 4.8,
      stars: 5,
      available: true,
      amenities: ['免費WiFi', '游泳池', '健身房', '早餐']
    },
    {
      id: 'hotel_2',
      name: `${location}W飯店`,
      location: location,
      price: 4800,
      rating: 4.9,
      stars: 5,
      available: true,
      amenities: ['海景房', 'SPA', '餐廳', '酒吧']
    }
  ];
  
  res.json({
    success: true,
    hotels: hotels,
    totalResults: hotels.length,
    searchParams: { location, guests: parseInt(guests) }
  });
});

// 創建預訂
app.post('/api/bookings/create', (req, res) => {
  const { hotelId, roomType, guestInfo } = req.body;
  
  console.log('📋 Booking Creation:', req.body);
  
  const booking = {
    bookingId: `book_${Date.now()}`,
    status: 'confirmed',
    hotelId,
    roomType: roomType || 'standard',
    guestInfo,
    totalAmount: 4500,
    confirmationNumber: `CNF${Date.now()}`,
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    message: '🎉 預訂成功！感謝使用 AI Hotel Assistant',
    booking: booking
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
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

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🚀 AI Hotel Assistant Builder 啟動成功!');
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'production'}`);
  console.log('📋 可用端點:');
  console.log('   GET  /');
  console.log('   GET  /health');
  console.log('   POST /api/ai/chat');
  console.log('   GET  /api/hotels/search');
  console.log('   POST /api/bookings/create');
  console.log('='.repeat(60));
});

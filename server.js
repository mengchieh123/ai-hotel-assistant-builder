const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;  // 使用環境變數或固定 8080

app.use(cors());
app.use(express.json());

// 導入服務層
const {
  bookingService,
  pricingService,
  memberService,
  roomStatusService,
  promotionService,
  paymentService,
  invoiceService
} = require('./services');

// 從日期或訊息中計算入住晚數 (保留原有功能)
function calculateNights(checkIn, checkOut, message) {
  if (checkIn && checkOut) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffTime = endDate.getTime() - startDate.getTime();
    const nights = Math.round(diffTime / (1000 * 3600 * 24));
    return nights > 0 ? nights : 1;
  }

  const nightMatch = message.match(/(\d+)[天晚]/);
  if (nightMatch) {
    const n = parseInt(nightMatch[1], 10);
    return n > 0 ? n : 1;
  }

  return 1;
}

// 價格計算 (保留原有功能，用於聊天端點)
function calculatePrice(nights, memberType, specialDate) {
  const basePrice = 3800;
  const holidaySurcharge = specialDate ? 500 : 0;
  const totalBasePrice = (basePrice + holidaySurcharge) * nights;

  let discountRate = 1;
  if (memberType === '金卡會員') discountRate = 0.9;
  else if (memberType === '銀卡會員') discountRate = 0.95;

  const discountedPrice = Math.round(totalBasePrice * discountRate);

  return { basePrice, holidaySurcharge, totalBasePrice, discountRate, discountedPrice };
}

// ==================== 端點定義 ====================

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Hotel Assistant',
    version: '5.4.2-ADVANCED',
    timestamp: new Date().toISOString()
  });
});

// 根端點 - 顯示服務資訊
app.get('/', (req, res) => {
  res.json({
    service: "AI Hotel Assistant - Advanced",
    version: "5.4.2-ADVANCED",
    status: "operational",
    features: [
      "智能訂房系統",
      "會員等級優惠", 
      "促銷碼折扣",
      "長期住宿優惠",
      "多房型支援"
    ],
    endpoints: [
      "GET /health",
      "GET /",
      "POST /api/booking (進階訂房)",
      "POST /chat (智能對話)",
      "GET /api/services/status",
      "GET /debug/routes"
    ]
  });
});

// 服務狀態檢查
app.get('/api/services/status', async (req, res) => {
  try {
    const services = [
      { name: 'bookingService', instance: bookingService },
      { name: 'pricingService', instance: pricingService },
      { name: 'memberService', instance: memberService },
      { name: 'roomStatusService', instance: roomStatusService },
      { name: 'promotionService', instance: promotionService },
      { name: 'paymentService', instance: paymentService }
    ];

    const statusResults = await Promise.all(
      services.map(async (service) => {
        try {
          const status = await service.instance.getStatus?.() || { status: 'active' };
          return {
            service: service.name,
            status: status.status || 'active',
            initialized: status.initialized || true
          };
        } catch (error) {
          return {
            service: service.name,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      services: statusResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 智能聊天端點 (保留原有功能並增強)
app.post('/chat', (req, res) => {
  try {
    const { message, guestName, checkIn, checkOut, memberType, specialRequest } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '訊息不能為空',
        response: null
      });
    }

    const isSpecialDate = /聖誕節|12月25日/.test(message);
    const nights = calculateNights(checkIn, checkOut, message);
    const pricing = calculatePrice(nights, memberType, isSpecialDate);

    const responseLines = [];

    responseLines.push(`${guestName || '您好'}，感謝您的訂房需求。`);
    responseLines.push(`您預計入住 ${nights} 晚（${checkIn || '未指定起始日期'} 至 ${checkOut || '未指定結束日期'}）。`);
    
    if (isSpecialDate) {
      responseLines.push(`包含聖誕節加價每晚 ${pricing.holidaySurcharge} 元。`);
    }
    
    responseLines.push(`基礎房價為 ${pricing.basePrice} 元/晚，總計 ${pricing.totalBasePrice} 元。`);
    responseLines.push(`會員等級：${memberType || '非會員'}，享有折扣 ${(1 - pricing.discountRate) * 100}% ，折後價格為 ${pricing.discountedPrice} 元。`);
    
    if (specialRequest && specialRequest.trim() !== '') {
      responseLines.push(`特殊要求：${specialRequest}。`);
    }
    
    responseLines.push('兒童政策：6歲以下不占床免費，6-12歲不占床半價。');
    responseLines.push('房間安排：可安排高樓層安靜房間。');
    responseLines.push('如需更多協助，請隨時告知！');

    const response = responseLines.join('\n');

    res.json({
      success: true,
      response,
      version: '5.4.2-ADVANCED',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('處理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '處理請求時發生錯誤',
      response: null,
      details: error.message
    });
  }
});

// 進階訂房端點 - 使用服務層
app.post('/api/booking', async (req, res) => {
  try {
    console.log('📦 進階訂房請求:', req.body);
    
    const {
      checkInDate,
      nights,
      roomType,
      guestCount = 1,
      guestName,
      contactInfo,
      memberLevel = 'none',
      promoCode,
      specialRequests = []
    } = req.body;
    
    // 輸入驗證
    if (!checkInDate || !nights || !roomType) {
      return res.status(400).json({
        success: false,
        message: "缺少必要資訊：入住日期、住宿天數、房型",
        requiredFields: ['checkInDate', 'nights', 'roomType']
      });
    }
    
    // 使用 pricingService 計算價格
    const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    if (!priceResult.success) {
      return res.status(400).json(priceResult);
    }
    
    // 應用促銷碼
    const promoResult = pricingService.applyPromotion(priceResult.pricing, promoCode, nights);
    if (!promoResult.success) {
      return res.status(400).json(promoResult);
    }
    
    const finalPricing = promoResult.pricing;
    
    // 使用 bookingService 建立訂房
    const bookingData = {
      checkInDate,
      nights,
      roomType,
      guestCount,
      guestName,
      contactInfo,
      memberLevel,
      promoCode,
      specialRequests,
      pricing: finalPricing
    };
    
    const bookingResult = await bookingService.createBooking(bookingData);
    if (!bookingResult.success) {
      return res.status(400).json(bookingResult);
    }
    
    // 會員點數計算
    let pointsResult = null;
    if (memberLevel !== 'none') {
      pointsResult = await memberService.calculatePoints(finalPricing.finalPrice || finalPricing.totalPrice);
    }
    
    // 建構回應
    const response = {
      success: true,
      message: "訂房成功完成！",
      bookingReference: bookingResult.bookingId,
      bookingDetails: {
        checkIn: checkInDate,
        nights: nights,
        roomType: roomType,
        guests: guestCount,
        status: 'confirmed'
      },
      pricing: finalPricing,
      guestInfo: {
        name: guestName || '未提供',
        contact: contactInfo || '未提供'
      },
      memberBenefits: pointsResult ? {
        pointsEarned: pointsResult.points,
        message: pointsResult.message
      } : null,
      timestamp: new Date().toISOString(),
      version: '5.4.2-ADVANCED'
    };
    
    // 長期住宿優惠
    if (nights >= 5) {
      response.longStayBonus = {
        message: `感謝您的長期住宿（${nights}晚）！`,
        benefits: [
          "每日免費早餐",
          "迎賓水果",
          "免費延遲退房至14:00"
        ]
      };
    }
    
    console.log('✅ 進階訂房成功:', bookingResult.bookingId);
    res.json(response);
    
  } catch (error) {
    console.error('❌ 進階訂房錯誤:', error);
    res.status(500).json({
      success: false,
      message: "訂房處理失敗",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 測試服務端點
app.get('/api/test-services', async (req, res) => {
  try {
    // 測試價格服務
    const priceTest = pricingService.calculateRoomPrice('deluxe', 3, 2, 'gold');
    
    // 測試會員服務
    const memberTest = await memberService.getMemberLevel('M001');
    
    // 測試促銷服務
    const promoTest = pricingService.applyPromotion(priceTest.pricing, 'SUMMER2024', 3);
    
    // 測試訂房服務
    const bookingTest = await bookingService.createBooking({
      checkInDate: '2024-03-15',
      nights: 2,
      roomType: 'standard',
      guestCount: 2,
      guestName: '測試用戶'
    });
    
    res.json({
      success: true,
      tests: {
        pricing: priceTest,
        member: memberTest,
        promotion: promoTest,
        booking: bookingTest
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 除錯用，列出註冊的所有路由
app.get('/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    }
  });
  res.json({ 
    service: "AI Hotel Assistant",
    routes,
    timestamp: new Date().toISOString()
  });
});

// 錯誤處理中間件
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "端點不存在",
    availableEndpoints: [
      "GET /health",
      "GET /",
      "POST /api/booking",
      "POST /chat",
      "GET /api/services/status",
      "GET /api/test-services",
      "GET /debug/routes"
    ]
  });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AI 訂房助理服務（進階版）運行於端口 ${PORT}，版本 5.4.2-ADVANCED`);
  console.log(`📍 健康檢查: http://localhost:${PORT}/health`);
  console.log(`📍 服務狀態: http://localhost:${PORT}/api/services/status`);
  console.log(`📍 訂房測試: http://localhost:${PORT}/api/test-services`);
  console.log(`📍 除錯路由: http://localhost:${PORT}/debug/routes`);
});

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

console.log('🚀 啟動 AI 訂房助理服務...');

// 直接導入服務檔案
let bookingService, pricingService, memberService;

try {
  bookingService = require('./services/bookingService');
  console.log('✅ bookingService 導入成功');
} catch (error) {
  console.log('🔄 使用內建 bookingService');
  bookingService = {
    async createBooking(bookingData) {
      return {
        success: true,
        bookingId: 'BKG-' + Date.now(),
        message: '訂房成功'
      };
    }
  };
}

try {
  pricingService = require('./services/pricingService');
  console.log('✅ pricingService 導入成功');
} catch (error) {
  console.log('🔄 使用內建 pricingService');
  pricingService = {
    calculateRoomPrice(roomType, nights, guestCount, memberLevel = 'none') {
      const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
      const basePrice = (rates[roomType] || rates.standard) * nights;
      return {
        success: true,
        pricing: { basePrice, totalPrice: basePrice, currency: 'TWD' }
      };
    },
    applyPromotion(pricing, promoCode) {
      return { success: true, pricing: { ...pricing, finalPrice: pricing.totalPrice } };
    }
  };
}

try {
  memberService = require('./services/memberService');
  console.log('✅ memberService 導入成功');
} catch (error) {
  console.log('🔄 使用內建 memberService');
  memberService = {
    async calculatePoints(amount) {
      return { success: true, points: Math.floor(amount / 100) };
    }
  };
}

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI Hotel Assistant',
    version: '5.4.2-CLEAN-FIX',
    timestamp: new Date().toISOString()
  });
});

// 根端點
app.get('/', (req, res) => {
  res.json({
    service: 'AI Hotel Assistant',
    version: '5.4.2-CLEAN-FIX',
    status: 'operational',
    endpoints: ['GET /health', 'POST /api/booking', 'POST /chat']
  });
});

// 訂房端點
app.post('/api/booking', async (req, res) => {
  try {
    const { checkInDate, nights, roomType, guestCount = 1, guestName, memberLevel, promoCode } = req.body;
    
    if (!checkInDate || !nights || !roomType) {
      return res.status(400).json({
        success: false,
        message: '缺少必要資訊'
      });
    }

    const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    const promoResult = pricingService.applyPromotion(priceResult.pricing, promoCode);
    const bookingResult = await bookingService.createBooking(req.body);

    const response = {
      success: true,
      message: '訂房成功！',
      bookingReference: bookingResult.bookingId,
      bookingDetails: { checkIn: checkInDate, nights, roomType, guests: guestCount },
      pricing: promoResult.pricing,
      timestamp: new Date().toISOString()
    };

    if (nights >= 5) {
      response.longStayBonus = {
        message: `感謝長期住宿${nights}晚！`,
        benefits: ['免費早餐', '迎賓水果', '延遲退房']
      };
    }

    res.json(response);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '訂房處理失敗',
      error: error.message
    });
  }
});

// 聊天端點
app.post('/chat', (req, res) => {
  try {
    const { message, guestName } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '訊息不能為空'
      });
    }

    res.json({
      success: true,
      response: `${guestName || '您好'}，感謝您的諮詢！訊息: "${message}"`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '處理請求時發生錯誤'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ AI 訂房助理服務運行於端口 ${PORT}`);
});

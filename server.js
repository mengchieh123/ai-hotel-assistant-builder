const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// ==================== 進程信號處理 ====================
console.log('🔧 初始化信號處理...');

// 處理容器信號
process.on('SIGTERM', () => {
  console.log('📦 收到 SIGTERM 信號，優雅關閉中...');
  saveSessions();
  setTimeout(() => {
    console.log('👋 服務已優雅關閉');
    process.exit(0);
  }, 1000);
});

process.on('SIGINT', () => {
  console.log('📦 收到 SIGINT 信號，優雅關閉中...');
  saveSessions();
  setTimeout(() => {
    console.log('👋 服務已優雅關閉');
    process.exit(0);
  }, 1000);
});

process.on('uncaughtException', (error) => {
  console.error('💥 未捕獲異常:', error);
  saveSessions();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未處理的 Promise 拒絕:', reason);
});

// ==================== 服務就緒狀態 ====================
let serverReady = false;

// 中間件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 請求日誌中間件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`, req.body || req.query);
  next();
});

// 根路徑處理
app.get('/', (req, res) => {
  res.json({
    message: '🏨 AI 訂房助理 API 服務',
    version: '6.0.0',
    timestamp: new Date().toISOString(),
    status: serverReady ? 'ready' : 'starting',
    endpoints: {
      health: '/health',
      chat: '/chat (POST)',
      pricing: '/api/price (POST)',
      booking: '/api/booking (POST)',
      cancel: '/api/cancel-booking (POST)',
      attractions: {
        nearby: '/api/attractions/nearby',
        search: '/api/attractions/search',
        categories: '/api/attractions/categories',
        details: '/api/attractions/details/:name'
      },
      sessions: {
        stats: '/api/sessions/stats',
        management: '/api/sessions/:sessionId',
        backup: '/api/sessions/backup'
      }
    },
    documentation: '請查看 README.md 了解詳細 API 使用方法'
  });
});

console.log('🚀 啟動 AI 訂房助理服務...');

// 服務模組
function loadService(serviceName, fallbackImplementation) {
  try {
    const service = require(`./services/${serviceName}`);
    console.log(`✅ ${serviceName} 導入成功`);
    return service;
  } catch (error) {
    console.log(`🔄 使用內建 ${serviceName}`);
    return fallbackImplementation;
  }
}

const bookingService = loadService('bookingService', {
  async createBooking(bookingData) {
    return { 
      success: true, 
      bookingId: 'BKG-' + Date.now(), 
      ...bookingData,
      createdAt: new Date().toISOString(),
      status: 'confirmed'
    };
  },
  async cancelBooking(bookingId) {
    return {
      success: true,
      bookingId,
      status: 'cancelled',
      refundAmount: 0,
      cancelledAt: new Date().toISOString()
    };
  },
  async getBooking(bookingId) {
    return {
      success: true,
      bookingId,
      status: 'confirmed',
      roomType: '標準雙人房',
      checkInDate: '2024-01-01',
      nights: 2,
      totalPrice: 4400,
      guestCount: 2
    };
  }
});

const pricingService = loadService('pricingService', {
  calculateRoomPrice(roomType, nights = 1, guestCount = 2, memberLevel = 'none') {
    const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
    const basePrice = (rates[roomType] || rates.standard) * nights;
    const extraGuestFee = guestCount > 2 ? (guestCount - 2) * 500 : 0;
    
    // 會員折扣
    const discountRates = { none: 0, silver: 0.05, gold: 0.1, platinum: 0.15 };
    const discount = discountRates[memberLevel] || 0;
    const discountAmount = basePrice * discount;
    
    const subtotal = basePrice + extraGuestFee;
    const totalPrice = subtotal - discountAmount;

    return {
      success: true,
      pricing: {
        basePrice,
        extraGuestFee,
        subtotal,
        discountRate: discount * 100,
        discountAmount,
        totalPrice,
        currency: 'TWD',
        roomName: roomType,
        memberLevel
      }
    };
  },
  applyPromotion(pricing, promoCode) {
    const promotions = {
      'WELCOME10': 0.1,
      'SUMMER20': 0.2,
      'VIP15': 0.15
    };
    
    const discount = promotions[promoCode] || 0;
    const discountAmount = pricing.totalPrice * discount;
    const finalPrice = pricing.totalPrice - discountAmount;

    return { 
      success: true, 
      pricing: { 
        ...pricing, 
        promoCode,
        promoDiscount: discount * 100,
        promoDiscountAmount: discountAmount,
        finalPrice 
      } 
    };
  },
  calculateRefund(totalPrice, cancellationPolicy = 'standard') {
    const refundRates = { 
      standard: 0.8, 
      flexible: 0.9, 
      strict: 0.5 
    };
    const refundRate = refundRates[cancellationPolicy] || 0.8;
    return { 
      success: true, 
      refundAmount: Math.floor(totalPrice * refundRate),
      refundRate: refundRate * 100
    };
  }
});

const memberService = loadService('memberService', {
  async calculatePoints(amount) {
    return { success: true, points: Math.floor(amount / 100) };
  },
  async getMemberBenefits(level) {
    const benefits = {
      none: { 
        discount: 0, 
        description: '非會員',
        benefits: ['房價 98 折優惠']
      },
      silver: { 
        discount: 0.1, 
        description: '銀卡會員',
        benefits: ['房價 9 折優惠', '免費早餐', '提前入住']
      },
      gold: { 
        discount: 0.15, 
        description: '金卡會員',
        benefits: ['房價 85 折優惠', '免費早餐', '延遲退房', '房型升級機會']
      },
      platinum: { 
        discount: 0.2, 
        description: '白金會員',
        benefits: ['房價 8 折優惠', '免費早餐+晚餐', '24小時彈性入住', '專屬管家服務']
      }
    };
    return { success: true, benefits: benefits[level] || benefits.none };
  }
});

// 需求檢測服務 - 內建實現
const RequirementDetector = {
  async detectAllRequirements(message) {
    const requirements = {
      accessibility: {
        wheelchair: /輪椅|無障礙|行動不便/.test(message),
        elevator: /電梯|升降機/.test(message),
        braille: /盲人|點字/.test(message)
      },
      family: {
        children: /兒童|小孩|寶寶|嬰兒/.test(message),
        extraBed: /加床|嬰兒床/.test(message),
        familyRoom: /家庭房|親子/.test(message)
      },
      special: {
        smoking: /吸煙|抽煙|吸菸/.test(message),
        pet: /寵物|狗|貓/.test(message),
        view: /海景|山景|景觀/.test(message)
      },
      service: {
        breakfast: /早餐|餐點/.test(message),
        parking: /停車|車位/.test(message),
        wifi: /網路|wifi|上網/.test(message)
      }
    };

    const mainPoints = [];
    if (requirements.accessibility.wheelchair) mainPoints.push('無障礙需求');
    if (requirements.family.children) mainPoints.push('兒童相關');
    if (requirements.special.smoking) mainPoints.push('吸煙需求');
    if (requirements.service.breakfast) mainPoints.push('早餐服務');

    return {
      summary: {
        hasSpecialRequirements: mainPoints.length > 0,
        mainPoints: mainPoints,
        requirementCount: mainPoints.length
      },
      details: requirements
    };
  }
};

// 景點服務
let attractionsService;
try {
  const AttractionsService = require('./services/attractionsService');
  attractionsService = new AttractionsService();
  console.log('✅ attractionsService 導入成功');
} catch {
  attractionsService = {
    recommendByType(type, maxDistance = 200) {
      const mockData = {
        food: [
          { 
            name: '鼎泰豐', 
            distance: '150m', 
            type: '餐廳', 
            rating: 4.8, 
            description: '知名小籠包專賣店', 
            address: '台北市大安區信義路二段194號', 
            openingHours: '10:00-21:00', 
            priceLevel: '$$',
            features: ['小籠包', '炒飯', '點心'],
            contact: '02-2321-4848'
          }
        ],
        shopping: [
          { 
            name: '新光三越', 
            distance: '100m', 
            type: '購物', 
            rating: 4.5, 
            description: '大型百貨公司',
            address: '台北市信義區松高路19號',
            openingHours: '11:00-21:30',
            priceLevel: '$$$'
          }
        ],
        nature: [
          { 
            name: '大安森林公園', 
            distance: '200m', 
            type: '公園', 
            rating: 4.9, 
            description: '都市中的綠洲',
            features: ['散步道', '兒童遊樂場', '露天音樂台']
          }
        ]
      };
      const attractions = mockData[type] || [];
      const filtered = attractions.filter(a => parseInt(a.distance) <= maxDistance);
      return { 
        success: true, 
        type, 
        maxDistance: `${maxDistance}公尺`, 
        attractions: filtered, 
        count: filtered.length 
      };
    },
    searchAttractions(keyword, maxDistance = 200) {
      const allAttractions = [
        { name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8, description: '知名小籠包專賣店' },
        { name: '林東芳牛肉麵', distance: '180m', type: '餐廳', rating: 4.6, description: '老字號牛肉麵' },
        { name: '新光三越', distance: '100m', type: '購物', rating: 4.5, description: '大型百貨公司' }
      ];
      const results = allAttractions.filter(a => 
        a.name.includes(keyword) || 
        a.description.includes(keyword) || 
        a.type.includes(keyword)
      );
      return { 
        success: true, 
        keyword, 
        maxDistance: `${maxDistance}公尺`, 
        attractions: results, 
        count: results.length 
      };
    },
    getAllNearby(maxDistance = 200) {
      const allAttractions = [
        { name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8 },
        { name: '新光三越', distance: '100m', type: '購物', rating: 4.5 },
        { name: '大安森林公園', distance: '200m', type: '公園', rating: 4.9 }
      ];
      return { 
        success: true, 
        maxDistance: `${maxDistance}公尺`, 
        attractions: allAttractions, 
        count: allAttractions.length 
      };
    },
    getAttractionDetails(name) {
      const attractions = {
        '鼎泰豐': { 
          name: '鼎泰豐', 
          distance: '150m', 
          type: '餐廳', 
          rating: 4.8, 
          description: '知名小籠包專賣店', 
          address: '台北市大安區信義路二段194號', 
          openingHours: '10:00-21:00', 
          priceLevel: '$$', 
          features: ['小籠包', '炒飯', '點心'], 
          contact: '02-2321-4848',
          recommendedDishes: ['小籠包', '蝦仁炒飯', '紅油抄手'],
          averageCost: '300-600 TWD'
        }
      };
      const attraction = attractions[name];
      if (attraction) return { success: true, attraction }; 
      else return { success: false, error: '找不到該景點' };
    },
    getCategories() {
      return { 
        success: true, 
        categories: { 
          food: '美食餐廳', 
          shopping: '購物中心', 
          nature: '自然景觀', 
          culture: '文化古蹟', 
          nightmarket: '夜市小吃', 
          convenience: '便利商店' 
        } 
      };
    }
  };
  console.log('🔄 使用內建 attractionsService');
}

// 會話管理
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const savedSessions = JSON.parse(data);
      console.log(`📂 從文件加載會話: ${savedSessions.length} 個會話`);
      for (const [sessionId, sessionData] of savedSessions) {
        sessions.set(sessionId, sessionData);
      }
      console.log(`✅ 成功加載 ${sessions.size} 個會話`);
    } else {
      console.log('📂 會話文件不存在，創建新文件');
    }
  } catch (error) {
    console.error('❌ 加載會話失敗:', error.message);
  }
}

function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
    console.log(`💾 會話已保存: ${sessions.size} 個會話`);
  } catch (error) {
    console.error('❌ 保存會話失敗:', error.message);
  }
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { 
      step: 'init', 
      data: {}, 
      createdAt: new Date().toISOString(), 
      lastActive: new Date().toISOString() 
    });
    saveSessions();
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

function validateAndFixSession(session, sessionId) {
  const validSteps = [
    'init', 'room', 'date', 'nights', 'guests', 'confirm', 'completed', 
    'cancel_init', 'cancel_confirm', 'cancel_completed', 
    'attractions_init', 'attractions_details', 'attractions_search'
  ];
  
  if (session.step === 'completed' && Object.keys(session.data).length === 0) {
    session.step = 'init';
    session.data = {};
    return true;
  }
  if (session.step === 'confirm' && (!session.data.roomType || !session.data.checkInDate || !session.data.nights)) {
    session.step = 'init';
    session.data = {};
    return true;
  }
  if ((session.step === 'cancel_confirm' || session.step === 'cancel_completed') && !session.data.cancelBookingId) {
    session.step = 'init';
    session.data = {};
    return true;
  }
  if (!validSteps.includes(session.step)) {
    session.step = 'init';
    session.data = {};
    return true;
  }
  return false;
}

// 清理過期會話
function cleanupExpiredSessions() {
  const now = new Date();
  const expirationTime = 30 * 60 * 1000; // 30分鐘
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    const sessionTime = new Date(session.lastActive || session.createdAt || now);
    if (now - sessionTime > expirationTime) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🗑️ 總共清理了 ${cleanedCount} 個過期會話`);
    saveSessions();
  }
}

// 初始化
loadSessions();
setInterval(cleanupExpiredSessions, 60 * 60 * 1000); // 每小時清理一次

// ==================== API 路由 ====================

// 改進的健康檢查
app.get('/health', (req, res) => {
  if (!serverReady) {
    return res.status(503).json({
      status: 'starting',
      message: '服務啟動中...',
      timestamp: new Date().toISOString()
    });
  }
  
  const memoryUsage = process.memoryUsage();
  res.json({ 
    status: 'healthy', 
    service: 'AI Hotel Assistant', 
    version: '6.0.0',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    features: [
      'booking', 'pricing', 'cancellation', 'attractions', 'chat', 
      'requirement_detection', 'member_services', 'session_management'
    ]
  });
});

// 存活檢查
app.get('/live', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant',
    uptime: Math.floor(process.uptime())
  });
});

// 就緒檢查
app.get('/ready', (req, res) => {
  if (!serverReady) {
    return res.status(503).json({
      status: 'starting',
      message: '服務啟動中...',
      timestamp: new Date().toISOString()
    });
  }
  res.json({ 
    status: 'ready', 
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant'
  });
});

// 會話狀態統計
app.get('/api/sessions/stats', (req, res) => {
  const sessionStats = {
    totalSessions: sessions.size,
    activeSessions: sessions.size,
    sessionsByStep: {
      init: 0, room: 0, date: 0, nights: 0, guests: 0, confirm: 0, completed: 0,
      cancel_init: 0, cancel_confirm: 0, cancel_completed: 0,
      attractions_init: 0, attractions_details: 0, attractions_search: 0
    },
    requirementsAnalysis: {
      withSpecialRequirements: 0,
      commonRequirements: {}
    }
  };
  
  for (const session of sessions.values()) {
    if (sessionStats.sessionsByStep[session.step] !== undefined) {
      sessionStats.sessionsByStep[session.step]++;
    }
    
    // 分析需求數據
    if (session.data.requirements) {
      sessionStats.requirementsAnalysis.withSpecialRequirements++;
    }
  }
  
  res.json({ 
    success: true, 
    stats: sessionStats, 
    timestamp: new Date().toISOString() 
  });
});

// 會話管理API
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: '會話不存在' });
  }
  res.json({ 
    success: true, 
    sessionId, 
    step: session.step, 
    data: session.data, 
    createdAt: session.createdAt, 
    lastActive: session.lastActive 
  });
});

// 重置會話API
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    saveSessions();
    res.json({ success: true, message: '會話已重置' });
  } else {
    res.status(404).json({ success: false, error: '會話不存在' });
  }
});

// 會話備份API
app.get('/api/sessions/backup', (req, res) => {
  try {
    saveSessions();
    res.json({ 
      success: true, 
      message: `會話已備份，共 ${sessions.size} 個會話`, 
      backupFile: SESSION_FILE,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '備份失敗', 
      message: error.message 
    });
  }
});

// 價格查詢 API
app.post('/api/price', (req, res) => {
  try {
    const { roomType, nights = 1, guestCount = 2, memberLevel = 'none', promoCode } = req.body;
    
    if (!roomType) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供房型參數',
        availableRoomTypes: ['standard', 'deluxe', 'suite']
      });
    }
    
    const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    
    // 如果有促銷代碼，應用折扣
    let finalPricing = priceResult.pricing;
    if (promoCode) {
      const promoResult = pricingService.applyPromotion(priceResult.pricing, promoCode);
      finalPricing = promoResult.pricing;
    }
    
    const roomNames = { 
      standard: '標準雙人房', 
      deluxe: '豪華雙人房', 
      suite: '套房' 
    };
    
    res.json({ 
      success: true, 
      roomType: roomNames[roomType] || roomType, 
      nights, 
      guestCount,
      memberLevel,
      promoCode: promoCode || null,
      pricing: finalPricing, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '價格查詢失敗', 
      message: error.message 
    });
  }
});

// 取消訂單 API
app.post('/api/cancel-booking', async (req, res) => {
  try {
    const { bookingId, cancellationPolicy = 'standard' } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供訂單編號' 
      });
    }
    
    const bookingResult = await bookingService.getBooking(bookingId);
    if (!bookingResult.success) {
      return res.status(404).json({ 
        success: false, 
        error: '訂單不存在' 
      });
    }
    
    const refundResult = pricingService.calculateRefund(bookingResult.totalPrice, cancellationPolicy);
    const cancelResult = await bookingService.cancelBooking(bookingId);
    
    res.json({ 
      success: true, 
      message: '訂單取消成功', 
      bookingId: cancelResult.bookingId, 
      status: cancelResult.status, 
      refundAmount: refundResult.refundAmount,
      refundRate: refundResult.refundRate,
      originalAmount: bookingResult.totalPrice, 
      cancellationPolicy,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '取消訂單失敗', 
      message: error.message 
    });
  }
});

// 傳統訂房 API
app.post('/api/booking', async (req, res) => {
  try {
    const { 
      checkInDate, 
      nights, 
      roomType, 
      guestCount = 1, 
      guestName, 
      memberLevel = 'none', 
      promoCode,
      specialRequirements 
    } = req.body;
    
    if (!checkInDate || !nights || !roomType) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要資訊：入住日期、住宿天數、房型' 
      });
    }
    
    const price = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    const promo = pricingService.applyPromotion(price.pricing, promoCode);
    const booking = await bookingService.createBooking(req.body);
    
    res.json({ 
      success: true, 
      message: '訂房成功！', 
      bookingReference: booking.bookingId, 
      bookingDetails: { 
        checkIn: checkInDate, 
        nights, 
        roomType, 
        guests: guestCount, 
        guestName,
        memberLevel
      }, 
      pricing: promo.pricing, 
      specialRequirements: specialRequirements || null,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '訂房處理失敗', 
      error: error.message 
    });
  }
});

// 景點服務 API
app.get('/api/attractions/nearby', (req, res) => {
  try {
    const { type, maxDistance = 200 } = req.query;
    let result;
    
    if (type) {
      result = attractionsService.recommendByType(type, parseInt(maxDistance));
    } else {
      result = attractionsService.getAllNearby(parseInt(maxDistance));
    }
    
    res.json({ 
      success: true, 
      ...result, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '景點查詢失敗', 
      message: error.message 
    });
  }
});

app.get('/api/attractions/search', (req, res) => {
  try {
    const { keyword, maxDistance = 200 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供搜索關鍵字' 
      });
    }
    
    const result = attractionsService.searchAttractions(keyword, parseInt(maxDistance));
    res.json({ 
      success: true, 
      ...result, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '搜索失敗', 
      message: error.message 
    });
  }
});

app.get('/api/attractions/categories', (req, res) => {
  try {
    const result = attractionsService.getCategories();
    res.json({ 
      success: true, 
      ...result, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '獲取分類失敗', 
      message: error.message 
    });
  }
});

app.get('/api/attractions/details/:name', (req, res) => {
  try {
    const { name } = req.params;
    const result = attractionsService.getAttractionDetails(name);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json({ 
      success: true, 
      ...result, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '獲取詳細資訊失敗', 
      message: error.message 
    });
  }
});

// 需求檢測 API
app.post('/api/analyze-requirements', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '請提供要分析的訊息內容'
      });
    }
    
    const requirements = await RequirementDetector.detectAllRequirements(message);
    
    res.json({
      success: true,
      message: message,
      requirements: requirements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '需求分析失敗',
      message: error.message
    });
  }
});

// 會員服務 API
app.get('/api/member/benefits/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const result = await memberService.getMemberBenefits(level);
    
    res.json({
      success: true,
      level,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '獲取會員權益失敗',
      message: error.message
    });
  }
});

// 修復後的聊天對話 API - 完整的 switch 語句
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default-session' } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供訊息內容' 
      });
    }

    const session = getOrCreateSession(sessionId);
    const wasFixed = validateAndFixSession(session, sessionId);

    let reply = '';
    const lowerMessage = message.toLowerCase();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // ========== 需求檢測處理 ==========
    const requirements = await RequirementDetector.detectAllRequirements(message);
    if (requirements.summary.hasSpecialRequirements) {
      session.data.requirements = requirements;
      console.log(`🔍 檢測到特殊需求: ${requirements.summary.mainPoints.join(', ')}`);
    }

    if (/價格|價錢|多少錢|查詢價格|房價|報價/.test(lowerMessage)) {
      let roomType = 'standard';
      if (/標準/.test(lowerMessage)) roomType = 'standard';
      else if (/豪華/.test(lowerMessage)) roomType = 'deluxe';
      else if (/套房/.test(lowerMessage)) roomType = 'suite';

      const priceResult = pricingService.calculateRoomPrice(roomType, 1, 2);
      const roomNames = { standard: '標準雙人房', deluxe: '豪華雙人房', suite: '套房' };

      reply = `💰 ${roomNames[roomType]}價格：\n` +
        `• 平日價格: ${priceResult.pricing.basePrice} TWD/晚\n` +
        `• 住宿1晚總價: ${priceResult.pricing.totalPrice} TWD\n` +
        `• 貨幣: ${priceResult.pricing.currency}\n\n` +
        `需要為您預訂嗎？`;

    } else {
      switch (session.step) {
        case 'init':
          if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
            session.step = 'room';
            reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
          } else if (/取消|取消訂單|取消預訂|退訂|不要了/.test(lowerMessage)) {
            session.step = 'cancel_init';
            reply = '請問您要取消哪筆訂單？請提供訂單編號。';
          } else if (/會員|優惠|折扣|促銷/.test(lowerMessage)) {
            reply = '我們提供金卡、銀卡會員優惠，請問您想了解哪種會員權益？';
          } else if (/附近|周邊|景點|好玩|旅遊|觀光|推薦|哪裡玩|有什麼好玩的/.test(lowerMessage)) {
            session.step = 'attractions_init';
            reply = '🏞️ 想了解酒店附近的好玩景點嗎！請問您對什麼類型的景點感興趣？\n（例如：美食餐廳、購物中心、自然景觀、文化古蹟、夜市、便利商店）';
          } else {
            reply = '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
          }
          break;

        case 'room':
          if (/標準|豪華|套房/.test(lowerMessage)) {
            const roomMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
            const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
            session.data.roomType = roomMap[matchedKey] || 'standard';
            session.step = 'date';
            reply = `您選擇的是 ${matchedKey} 房型。請告訴我入住日期（格式：YYYY-MM-DD）`;
          } else {
            reply = '請選擇有效的房型：標準雙人房、豪華雙人房或套房。';
          }
          break;

        case 'date':
          if (dateRegex.test(message)) {
            session.data.checkInDate = message;
            session.step = 'nights';
            reply = '入住日期已記錄。請問您要入住幾晚？';
          } else {
            reply = '請輸入正確格式的入住日期，例如 2024-12-25。';
          }
          break;

        case 'nights':
          const nights = parseInt(message);
          if (nights > 0 && nights <= 30) {
            session.data.nights = nights;
            session.step = 'guests';
            reply = `已設定住宿 ${nights} 晚！請問有幾位旅客？`;
          } else {
            reply = '請輸入有效的住宿天數（1-30天）';
          }
          break;

        case 'guests':
          const guests = parseInt(message);
          if (guests > 0 && guests <= 6) {
            session.data.guestCount = guests;
            session.step = 'confirm';
            
            // 計算總價
            const priceResult = pricingService.calculateRoomPrice(
              session.data.roomType, 
              session.data.nights, 
              session.data.guestCount
            );
            
            session.data.totalPrice = priceResult.pricing.totalPrice;
            
            reply = `👥 旅客數: ${guests} 位\n\n` +
                    `📋 訂房摘要：\n` +
                    `• 房型: ${session.data.roomType === 'standard' ? '標準雙人房' : session.data.roomType === 'deluxe' ? '豪華雙人房' : '套房'}\n` +
                    `• 入住: ${session.data.checkInDate}\n` +
                    `• 住宿: ${session.data.nights} 晚\n` +
                    `• 旅客: ${session.data.guestCount} 位\n` +
                    `• 總價: ${session.data.totalPrice} TWD\n\n` +
                    `請回覆「確認」完成訂房，或「取消」重新開始。`;
          } else {
            reply = '請輸入有效的旅客人數（1-6位）';
          }
          break;

        case 'confirm':
          if (/確認|是的|確定|ok|yes|完成訂房/.test(lowerMessage)) {
            // 創建訂單
            const bookingData = {
              checkInDate: session.data.checkInDate,
              nights: session.data.nights,
              roomType: session.data.roomType,
              guestCount: session.data.guestCount,
              totalPrice: session.data.totalPrice
            };
            
            const bookingResult = await bookingService.createBooking(bookingData);
            
            session.step = 'completed';
            session.data.bookingId = bookingResult.bookingId;
            
            reply = `🎉 訂房成功！\n\n` +
                    `📄 訂單編號: ${bookingResult.bookingId}\n` +
                    `• 房型: ${session.data.roomType === 'standard' ? '標準雙人房' : session.data.roomType === 'deluxe' ? '豪華雙人房' : '套房'}\n` +
                    `• 入住: ${session.data.checkInDate}\n` +
                    `• 住宿: ${session.data.nights} 晚\n` +
                    `• 旅客: ${session.data.guestCount} 位\n` +
                    `• 總價: ${session.data.totalPrice} TWD\n\n` +
                    `感謝您的預訂！需要其他服務嗎？`;
          } else if (/取消|不要了|重新開始/.test(lowerMessage)) {
            session.step = 'init';
            session.data = {};
            reply = '訂房已取消。請問需要什麼其他服務？';
          } else {
            reply = '請回覆「確認」完成訂房，或「取消」重新開始。';
          }
          break;

        case 'completed':
          if (/訂房|預訂|再訂/.test(lowerMessage)) {
            session.step = 'init';
            session.data = {};
            reply = '🏨 開始新的訂房流程！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
          } else {
            reply = '請問還需要什麼服務嗎？例如：再次訂房、查詢景點、會員服務等。';
          }
          break;

        case 'cancel_init':
          if (/BKG-/.test(message)) {
            session.data.cancelBookingId = message;
            session.step = 'cancel_confirm';
            
            const bookingResult = await bookingService.getBooking(message);
            if (bookingResult.success) {
              reply = `找到訂單 ${message}：\n` +
                      `• 房型: ${bookingResult.roomType}\n` +
                      `• 入住: ${bookingResult.checkInDate}\n` +
                      `• 總價: ${bookingResult.totalPrice} TWD\n\n` +
                      `確定要取消此訂單嗎？請回覆「確認取消」或「取消操作」。`;
            } else {
              reply = '找不到該訂單編號，請確認後重新輸入。';
              session.step = 'cancel_init';
            }
          } else {
            reply = '請提供有效的訂單編號（格式：BKG-數字）';
          }
          break;

        case 'cancel_confirm':
          if (/確認取消|確定取消|是的/.test(lowerMessage)) {
            const cancelResult = await bookingService.cancelBooking(session.data.cancelBookingId);
            session.step = 'cancel_completed';
            
            reply = `✅ 訂單 ${session.data.cancelBookingId} 已成功取消！\n\n` +
                    `我們會盡快處理您的退款。需要其他服務嗎？`;
          } else if (/取消操作|不要了/.test(lowerMessage)) {
            session.step = 'init';
            session.data = {};
            reply = '取消操作已中止。請問需要什麼其他服務？';
          } else {
            reply = '請回覆「確認取消」來取消訂單，或「取消操作」中止。';
          }
          break;

        case 'attractions_init':
          const attractionTypes = {
            '美食': 'food', '餐廳': 'food', '食物': 'food',
            '購物': 'shopping', '商場': 'shopping', '百貨': 'shopping',
            '自然': 'nature', '公園': 'nature', '風景': 'nature',
            '文化': 'culture', '古蹟': 'culture', '歷史': 'culture',
            '夜市': 'nightmarket', '小吃': 'nightmarket',
            '便利': 'convenience', '商店': 'convenience'
          };
          
          const matchedType = Object.keys(attractionTypes).find(key => lowerMessage.includes(key));
          if (matchedType) {
            const type = attractionTypes[matchedType];
            const result = attractionsService.recommendByType(type);
            
            if (result.attractions.length > 0) {
              session.step = 'attractions_details';
              session.data.attractionType = type;
              
              let attractionsList = '🏞️ 推薦景點：\n';
              result.attractions.forEach((attr, index) => {
                attractionsList += `\n${index + 1}. ${attr.name} (${attr.distance}) - ${attr.description}\n   評分: ${attr.rating}⭐`;
              });
              
              attractionsList += '\n\n請輸入景點名稱查看詳細資訊，或輸入「重新搜尋」找其他類型景點。';
              reply = attractionsList;
            } else {
              reply = `抱歉，附近沒有找到${matchedType}類型的景點。請嘗試其他類型。`;
            }
          } else if (/全部|所有|隨便/.test(lowerMessage)) {
            const result = attractionsService.getAllNearby();
            
            let allAttractions = '🏞️ 附近所有景點：\n';
            result.attractions.forEach((attr, index) => {
              allAttractions += `\n${index + 1}. ${attr.name} (${attr.distance}) - ${attr.type} - 評分: ${attr.rating}⭐`;
            });
            
            reply = allAttractions + '\n\n請輸入景點名稱查看詳細資訊。';
          } else {
            reply = '請選擇景點類型：美食餐廳、購物中心、自然景觀、文化古蹟、夜市小吃、便利商店，或輸入「全部」查看所有景點。';
          }
          break;

        case 'attractions_details':
          if (/重新搜尋|重新選擇|換一個/.test(lowerMessage)) {
            session.step = 'attractions_init';
            reply = '🏞️ 請選擇新的景點類型：美食餐廳、購物中心、自然景觀、文化古蹟、夜市小吃、便利商店';
          } else {
            const result = attractionsService.getAttractionDetails(message);
            if (result.success) {
              const attr = result.attraction;
              reply = `📍 ${attr.name}\n\n` +
                      `📝 ${attr.description}\n` +
                      `📍 地址: ${attr.address}\n` +
                      `⏰ 營業時間: ${attr.openingHours}\n` +
                      `💰 價格等級: ${attr.priceLevel}\n` +
                      `⭐ 評分: ${attr.rating}\n` +
                      `📞 電話: ${attr.contact}\n` +
                      `🚶 距離: ${attr.distance}\n`;
                      
              if (attr.features) {
                reply += `✨ 特色: ${attr.features.join(', ')}\n`;
              }
              if (attr.recommendedDishes) {
                reply += `🍽️ 推薦菜色: ${attr.recommendedDishes.join(', ')}\n`;
              }
              if (attr.averageCost) {
                reply += `💵 平均消費: ${attr.averageCost}\n`;
              }
              
              reply += '\n需要搜尋其他景點嗎？';
            } else {
              reply = '找不到該景點，請確認名稱是否正确，或輸入「重新搜尋」選擇其他類型。';
            }
          }
          break;

        default:
          session.step = 'init';
          session.data = {};
          reply = '會話已重置。請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
          break;
      }
    }

    // 保存會話狀態
    saveSessions();

    res.json({
      success: true,
      reply: reply,
      sessionId: sessionId,
      step: session.step,
      requirements: requirements.summary.hasSpecialRequirements ? requirements : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 聊天處理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '聊天處理失敗',
      message: error.message
    });
  }
});

// 啟動服務器
const server = app.listen(PORT, () => {
  console.log(`\n🎉 AI 訂房助理服務已啟動！`);
  console.log(`📍 服務地址: http://localhost:${PORT}`);
  console.log(`⏰ 啟動時間: ${new Date().toISOString()}`);
  console.log(`📊 初始會話數: ${sessions.size}`);
  console.log(`🔧 服務狀態: 啟動完成\n`);
  
  // 標記服務為就緒狀態
  serverReady = true;
});

// 優雅關閉處理
process.on('beforeExit', () => {
  console.log('🔄 服務即將關閉，保存會話數據...');
  saveSessions();
});

module.exports = app;

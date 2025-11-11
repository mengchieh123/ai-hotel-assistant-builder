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

// 根路徑處理
app.get('/', (req, res) => {
  res.json({
    message: '🏨 AI 訂房助理 API 服務',
    version: '5.5.0',
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
    return { success: true, bookingId: 'BKG-' + Date.now(), ...bookingData };
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
    const totalPrice = basePrice + extraGuestFee;

    return {
      success: true,
      pricing: {
        basePrice,
        extraGuestFee,
        subtotal: basePrice,
        discountRate: 0,
        discountAmount: 0,
        totalPrice,
        currency: 'TWD',
        roomName: roomType
      }
    };
  },
  applyPromotion(pricing, promoCode) {
    return { success: true, pricing: { ...pricing, finalPrice: pricing.totalPrice } };
  },
  calculateRefund(totalPrice, cancellationPolicy = 'standard') {
    const refundRate = cancellationPolicy === 'flexible' ? 0.9 : 0.8;
    return { success: true, refundAmount: Math.floor(totalPrice * refundRate) };
  }
});

const memberService = loadService('memberService', {
  async calculatePoints(amount) {
    return { success: true, points: Math.floor(amount / 100) };
  },
  async getMemberBenefits(level) {
    const benefits = {
      none: { discount: 0, description: '非會員' },
      silver: { discount: 0.1, description: '銀卡會員' },
      gold: { discount: 0.15, description: '金卡會員' },
      platinum: { discount: 0.2, description: '白金會員' }
    };
    return { success: true, benefits: benefits[level] || benefits.none };
  }
});

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
        food: [{ name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8, description: '知名小籠包專賣店', address: '台北市大安區信義路二段194號', openingHours: '10:00-21:00', priceLevel: '$$'}],
        shopping: [{ name: '新光三越', distance: '100m', type: '購物', rating: 4.5, description: '大型百貨公司'}],
        nature: [{ name: '大安森林公園', distance: '200m', type: '公園', rating: 4.9, description: '都市中的綠洲'}]
      };
      const attractions = mockData[type] || [];
      const filtered = attractions.filter(a => parseInt(a.distance) <= maxDistance);
      return { success: true, type, maxDistance: `${maxDistance}公尺`, attractions: filtered, count: filtered.length };
    },
    searchAttractions(keyword, maxDistance = 200) {
      const allAttractions = [
        { name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8, description: '知名小籠包專賣店' },
        { name: '林東芳牛肉麵', distance: '180m', type: '餐廳', rating: 4.6, description: '老字號牛肉麵' },
        { name: '新光三越', distance: '100m', type: '購物', rating: 4.5, description: '大型百貨公司' }
      ];
      const results = allAttractions.filter(a => a.name.includes(keyword) || a.description.includes(keyword) || a.type.includes(keyword));
      return { success: true, keyword, maxDistance: `${maxDistance}公尺`, attractions: results, count: results.length };
    },
    getAllNearby(maxDistance = 200) {
      const allAttractions = [
        { name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8 },
        { name: '新光三越', distance: '100m', type: '購物', rating: 4.5 },
        { name: '大安森林公園', distance: '200m', type: '公園', rating: 4.9 }
      ];
      return { success: true, maxDistance: `${maxDistance}公尺`, attractions: allAttractions, count: allAttractions.length };
    },
    getAttractionDetails(name) {
      const attractions = {
        '鼎泰豐': { name: '鼎泰豐', distance: '150m', type: '餐廳', rating: 4.8, description: '知名小籠包專賣店', address: '台北市大安區信義路二段194號', openingHours: '10:00-21:00', priceLevel: '$$', features: ['小籠包', '炒飯', '點心'], contact: '02-2321-4848' }
      };
      const attraction = attractions[name];
      if (attraction) return { success: true, attraction }; else return { success: false, error: '找不到該景點' };
    },
    getCategories() {
      return { success: true, categories: { food: '美食餐廳', shopping: '購物中心', nature: '自然景觀', culture: '文化古蹟', nightmarket: '夜市小吃', convenience: '便利商店' } };
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
    sessions.set(sessionId, { step: 'init', data: {}, createdAt: new Date().toISOString(), lastActive: new Date().toISOString() });
    saveSessions();
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

function validateAndFixSession(session, sessionId) {
  const validSteps = ['init', 'room', 'date', 'nights', 'guests', 'confirm', 'completed', 'cancel_init', 'cancel_confirm', 'cancel_completed', 'attractions_init', 'attractions_details', 'attractions_search'];
  
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
  const expirationTime = 30 * 60 * 1000;
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
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

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
  
  // 快速響應健康檢查
  res.set('Connection', 'close');
  res.json({ 
    status: 'healthy', 
    service: 'AI Hotel Assistant', 
    version: '5.5.0',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    features: ['booking', 'pricing', 'cancellation', 'attractions', 'chat']
  });
});

// 存活檢查
app.get('/live', (req, res) => {
  res.set('Connection', 'close');
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant'
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
  res.set('Connection', 'close');
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
    }
  };
  for (const session of sessions.values()) {
    if (sessionStats.sessionsByStep[session.step] !== undefined) {
      sessionStats.sessionsByStep[session.step]++;
    }
  }
  res.json({ success: true, stats: sessionStats, timestamp: new Date().toISOString() });
});

// 會話管理API
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: '會話不存在' });
  }
  res.json({ success: true, sessionId, step: session.step, data: session.data, createdAt: session.createdAt, lastActive: session.lastActive });
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
    res.json({ success: true, message: `會話已備份，共 ${sessions.size} 個會話`, backupFile: SESSION_FILE });
  } catch (error) {
    res.status(500).json({ success: false, error: '備份失敗', message: error.message });
  }
});

// 價格查詢 API
app.post('/api/price', (req, res) => {
  try {
    const { roomType, nights = 1, guestCount = 2 } = req.body;
    if (!roomType) return res.status(400).json({ success: false, error: '請提供房型參數' });
    const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount);
    const roomNames = { standard: '標準雙人房', deluxe: '豪華雙人房', suite: '套房' };
    res.json({ success: true, roomType: roomNames[roomType] || roomType, nights, guestCount, pricing: priceResult.pricing, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '價格查詢失敗', message: error.message });
  }
});

// 取消訂單 API
app.post('/api/cancel-booking', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, error: '請提供訂單編號' });
    const bookingResult = await bookingService.getBooking(bookingId);
    if (!bookingResult.success) return res.status(404).json({ success: false, error: '訂單不存在' });
    const refundResult = pricingService.calculateRefund(bookingResult.totalPrice);
    const cancelResult = await bookingService.cancelBooking(bookingId);
    res.json({ success: true, message: '訂單取消成功', bookingId: cancelResult.bookingId, status: cancelResult.status, refundAmount: refundResult.refundAmount, originalAmount: bookingResult.totalPrice, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '取消訂單失敗', message: error.message });
  }
});

// 傳統訂房 API
app.post('/api/booking', async (req, res) => {
  try {
    const { checkInDate, nights, roomType, guestCount = 1, guestName, memberLevel, promoCode } = req.body;
    if (!checkInDate || !nights || !roomType) return res.status(400).json({ success: false, message: '缺少必要資訊：入住日期、住宿天數、房型' });
    const price = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    const promo = pricingService.applyPromotion(price.pricing, promoCode);
    const booking = await bookingService.createBooking(req.body);
    res.json({ success: true, message: '訂房成功！', bookingReference: booking.bookingId, bookingDetails: { checkIn: checkInDate, nights, roomType, guests: guestCount, guestName }, pricing: promo.pricing, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: '訂房處理失敗', error: error.message });
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
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '景點查詢失敗', message: error.message });
  }
});

app.get('/api/attractions/search', (req, res) => {
  try {
    const { keyword, maxDistance = 200 } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: '請提供搜索關鍵字' });
    const result = attractionsService.searchAttractions(keyword, parseInt(maxDistance));
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '搜索失敗', message: error.message });
  }
});

app.get('/api/attractions/categories', (req, res) => {
  try {
    const result = attractionsService.getCategories();
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '獲取分類失敗', message: error.message });
  }
});

app.get('/api/attractions/details/:name', (req, res) => {
  try {
    const { name } = req.params;
    const result = attractionsService.getAttractionDetails(name);
    if (!result.success) return res.status(404).json(result);
    res.json({ success: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '獲取詳細資訊失敗', message: error.message });
  }
});

// 更新後的聊天對話 API
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default-session' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: '請提供訊息內容' });
    }

    const session = getOrCreateSession(sessionId);
    const wasFixed = validateAndFixSession(session, sessionId);

    let reply = '';
    const lowerMessage = message.toLowerCase();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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

        case 'attractions_init':
          const attractionTypes = {
            '美食': 'food', '餐廳': 'food', '吃的': 'food', '食物': 'food',
            '購物': 'shopping', '商場': 'shopping', '買東西': 'shopping', '百貨': 'shopping',
            '自然': 'nature', '公園': 'nature', '風景': 'nature', '散步': 'nature',
            '文化': 'culture', '古蹟': 'culture', '歷史': 'culture', '博物館': 'culture',
            '夜市': 'nightmarket', '小吃': 'nightmarket', '夜市小吃': 'nightmarket',
            '便利': 'convenience', '便利商店': 'convenience', '超市': 'convenience', '商店': 'convenience'
          };
          const matchedType = Object.keys(attractionTypes).find(key => lowerMessage.includes(key));
          if (matchedType) {
            const typeKey = attractionTypes[matchedType];
            const result = attractionsService.recommendByType(typeKey, 200);
            if (result.attractions.length > 0) {
              let replyText = `🏞️ 酒店${result.maxDistance}內的${matchedType}推薦：\n\n`;
              result.attractions.forEach((attr, index) => {
                replyText += `${index + 1}. **${attr.name}** (${attr.distance})\n`;
                replyText += `   ⭐ 評分: ${attr.rating}/5\n`;
                replyText += `   📍 ${attr.description}\n\n`;
              });
              replyText += `需要了解某個景點的詳細資訊嗎？或者想查詢其他類型的景點？`;
              session.step = 'attractions_details';
              session.data.lastAttractionType = typeKey;
              session.data.lastAttractions = result.attractions;
              reply = replyText;
            } else {
              reply = `抱歉，${result.maxDistance}內沒有找到${matchedType}類型的景點。要不要試試其他類型？`;
            }
          } else {
            reply = '請告訴我您對什麼類型的景點感興趣？\n（美食餐廳、購物中心、自然景觀、文化古蹟、夜市小吃、便利商店）';
          }
          break;

        default:
          reply = '系統錯誤，請稍後再試或聯繫客服。';
      }
    }
    if (wasFixed) saveSessions();
    res.json({
      success: true,
      response: reply,
      sessionData: session.data,
      currentStep: session.step
    });
  } catch (error) {
    console.error('❌ 聊天處理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '聊天處理失敗',
      message: error.message
    });
  }
});

// 404 處理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '路由不存在',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /live',
      'GET /ready',
      'POST /chat',
      'POST /api/price',
      'POST /api/booking',
      'POST /api/cancel-booking',
      'GET /api/attractions/nearby',
      'GET /api/attractions/search',
      'GET /api/attractions/categories',
      'GET /api/attractions/details/:name',
      'GET /api/sessions/stats',
      'GET /api/sessions/:sessionId',
      'DELETE /api/sessions/:sessionId',
      'GET /api/sessions/backup'
    ]
  });
});

// 全局錯誤處理
app.use((err, req, res, next) => {
  console.error('❌ 服務器錯誤:', err);
  res.status(500).json({ 
    success: false, 
    error: '伺服器內部錯誤',
    message: err.message 
  });
});

// ==================== 服務啟動 ====================
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ 服務已啟動，監聽 ${HOST}:${PORT}`);
  console.log(`🔧 健康檢查網址: http://${HOST}:${PORT}/health`);
  console.log(`🔧 存活檢查網址: http://${HOST}:${PORT}/live`);
  console.log(`🔧 就緒檢查網址: http://${HOST}:${PORT}/ready`);
  
  // 設置服務就緒標誌
  setTimeout(() => {
    serverReady = true;
    console.log('🎯 服務完全就緒，接受請求');
    console.log(`📊 當前會話數量: ${sessions.size}`);
    
    console.log('\n🎯 可用端點:');
    console.log('  GET  /                    - API 資訊');
    console.log('  GET  /health              - 健康檢查');
    console.log('  GET  /live                - 存活檢查');
    console.log('  GET  /ready               - 就緒檢查');
    console.log('  POST /chat                - 聊天對話');
    console.log('  POST /api/price           - 價格查詢');
    console.log('  POST /api/booking         - 直接訂房');
    console.log('  POST /api/cancel-booking  - 取消訂單');
    console.log('  GET  /api/attractions/*   - 景點服務');
    console.log('  GET  /api/sessions/*      - 會話管理');
  }, 3000);
}).on('error', (err) => {
  console.error('❌ 服務啟動失敗:', err.message);
  process.exit(1);
});

server.on('listening', () => {
  console.log('📡 服務正在監聽端口:', PORT);
});

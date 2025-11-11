const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

console.log('🚀 啟動 AI 訂房助理服務...');

// 導入服務模組
let bookingService, pricingService, memberService, attractionsService;

try {
  bookingService = require('./services/bookingService');
  console.log('✅ bookingService 導入成功');
} catch (error) {
  console.log('🔄 使用內建 bookingService');
  bookingService = {
    async createBooking(bookingData) {
      return { success: true, bookingId: 'BKG-' + Date.now() };
    },
    async cancelBooking(bookingId) {
      return { success: true, bookingId, status: 'cancelled', refundAmount: 0 };
    },
    async getBooking(bookingId) {
      return { 
        success: true, 
        bookingId, 
        status: 'confirmed',
        roomType: '標準雙人房',
        checkInDate: '2024-01-01',
        nights: 2,
        totalPrice: 4400
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
      return { success: true, pricing: { basePrice, totalPrice: basePrice, currency: 'TWD' } };
    },
    applyPromotion(pricing, promoCode) {
      return { success: true, pricing: { ...pricing, finalPrice: pricing.totalPrice } };
    },
    calculateRefund(totalPrice, cancellationPolicy = 'standard') {
      const refundRate = cancellationPolicy === 'flexible' ? 0.9 : 0.8;
      return { success: true, refundAmount: Math.floor(totalPrice * refundRate) };
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

try {
  const AttractionsService = require('./services/attractionsService');
  attractionsService = new AttractionsService();
  console.log('✅ attractionsService 導入成功');
} catch (error) {
  console.log('🔄 使用內建 attractionsService');
  attractionsService = {
    recommendByType(type) {
      const mockData = {
        food: [{ name: '測試餐廳', distance: '150m', type: '餐廳', rating: 4.5, description: '美味餐點' }],
        shopping: [{ name: '測試商場', distance: '100m', type: '購物', rating: 4.3, description: '購物好去處' }],
        nature: [{ name: '測試公園', distance: '200m', type: '公園', rating: 4.7, description: '休閒散步' }]
      };
      return { success: true, attractions: mockData[type] || [] };
    },
    searchAttractions(keyword) {
      return { 
        success: true, 
        attractions: [{ name: `搜索結果: ${keyword}`, distance: '150m', type: '景點', rating: 4.0 }] 
      };
    },
    getAllNearby() {
      return { 
        success: true, 
        attractions: [
          { name: '附近景點1', distance: '100m', type: '景點', rating: 4.2 },
          { name: '附近景點2', distance: '180m', type: '景點', rating: 4.5 }
        ] 
      };
    },
    getAttractionDetails(name) {
      return { 
        success: true, 
        attraction: { name, distance: '150m', type: '景點', rating: 4.3, description: '詳細資訊' } 
      };
    },
    getCategories() {
      return {
        success: true,
        categories: {
          'food': '美食餐廳',
          'shopping': '購物中心',
          'nature': '自然景觀',
          'culture': '文化古蹟',
          'nightmarket': '夜市小吃',
          'convenience': '便利商店'
        }
      };
    }
  };
}

// 會話暫存接口
const sessions = new Map();
const SESSION_FILE = path.join(__dirname, 'sessions.json');

// 加載保存的會話
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

// 保存會話到文件
function saveSessions() {
  try {
    const sessionsArray = Array.from(sessions.entries());
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsArray, null, 2));
    console.log(`💾 會話已保存: ${sessions.size} 個會話`);
  } catch (error) {
    console.error('❌ 保存會話失敗:', error.message);
  }
}

// 應用啟動時加載會話
loadSessions();

function getOrCreateSession(sessionId) {
  console.log(`🔍 獲取會話: ${sessionId}`);
  
  if (!sessions.has(sessionId)) {
    console.log(`🆕 創建新會話: ${sessionId}`);
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
  
  console.log(`📊 會話狀態: step=${session.step}, data=${JSON.stringify(session.data)}`);
  
  return session;
}

// 會話狀態檢查和修復函數
function validateAndFixSession(session, sessionId) {
  console.log(`🔧 檢查會話狀態: ${sessionId}`);
  console.log(`   當前步驟: ${session.step}`);
  console.log(`   當前數據: ${JSON.stringify(session.data)}`);
  
  const validSteps = ['init', 'room', 'date', 'nights', 'guests', 'confirm', 'completed', 'cancel_init', 'cancel_confirm', 'cancel_completed', 'attractions_init', 'attractions_details', 'attractions_search'];
  
  if (session.step === 'completed' && Object.keys(session.data).length === 0) {
    console.log('🛠️ 檢測到異常會話：已完成狀態但無數據，重置為初始狀態');
    session.step = 'init';
    session.data = {};
    return true;
  }
  
  if (session.step === 'confirm' && (!session.data.roomType || !session.data.checkInDate || !session.data.nights)) {
    console.log('🛠️ 檢測到數據不完整的確認狀態，重置為初始狀態');
    session.step = 'init';
    session.data = {};
    return true;
  }
  
  if ((session.step === 'cancel_confirm' || session.step === 'cancel_completed') && !session.data.cancelBookingId) {
    console.log('🛠️ 檢測到取消流程數據不完整，重置為初始狀態');
    session.step = 'init';
    session.data = {};
    return true;
  }
  
  if (!validSteps.includes(session.step)) {
    console.log(`🛠️ 檢測到無效步驟: ${session.step}，重置為初始狀態`);
    session.step = 'init';
    session.data = {};
    return true;
  }
  
  console.log('✅ 會話狀態正常');
  return false;
}

// 清除過期會話的函數
function cleanupExpiredSessions() {
  const now = new Date();
  const expirationTime = 30 * 60 * 1000;
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    const sessionTime = new Date(session.lastActive || session.createdAt || now);
    if (now - sessionTime > expirationTime) {
      console.log(`🧹 清除過期會話: ${sessionId}`);
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🗑️ 總共清理了 ${cleanedCount} 個過期會話`);
    saveSessions();
  }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// ==================== API 路由 ====================

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'AI Hotel Assistant', 
    version: '5.5.0',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString()
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
    console.log(`🗑️ 手動刪除會話: ${sessionId}`);
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
      backupFile: SESSION_FILE
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '備份失敗',
      message: error.message
    });
  }
});

// ==================== 價格查詢 API ====================
app.post('/api/price', (req, res) => {
  try {
    const { roomType, nights = 1, guestCount = 2 } = req.body;
    
    if (!roomType) {
      return res.status(400).json({ 
        success: false, 
        error: '請提供房型參數' 
      });
    }

    const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount);
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
      pricing: priceResult.pricing,
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

// ==================== 取消訂單 API ====================
app.post('/api/cancel-booking', async (req, res) => {
  try {
    const { bookingId } = req.body;
    
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

    const refundResult = pricingService.calculateRefund(bookingResult.totalPrice);
    const cancelResult = await bookingService.cancelBooking(bookingId);

    res.json({
      success: true,
      message: '訂單取消成功',
      bookingId: cancelResult.bookingId,
      status: cancelResult.status,
      refundAmount: refundResult.refundAmount,
      originalAmount: bookingResult.totalPrice,
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

// ==================== 傳統訂房 API ====================
app.post('/api/booking', async (req, res) => {
  try {
    const { checkInDate, nights, roomType, guestCount = 1, guestName, memberLevel, promoCode } = req.body;
    if (!checkInDate || !nights || !roomType) return res.status(400).json({ success: false, message: '缺少必要資訊' });

    const price = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
    const promo = pricingService.applyPromotion(price.pricing, promoCode);
    const booking = await bookingService.createBooking(req.body);

    res.json({
      success: true,
      message: '訂房成功！',
      bookingReference: booking.bookingId,
      bookingDetails: { checkIn: checkInDate, nights, roomType, guests: guestCount },
      pricing: promo.pricing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '訂房處理失敗', error: error.message });
  }
});

// ==================== 景點服務 API ====================
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

// ==================== 聊天對話 API ====================
app.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  
  console.log('\n🔍 === 意圖識別診斷 ===');
  console.log('輸入訊息:', message);
  console.log('sessionId:', sessionId);
  
  const session = getOrCreateSession(sessionId);
  const wasFixed = validateAndFixSession(session, sessionId);
  if (wasFixed) {
    console.log('🔄 會話已修復，重新處理請求');
  }

  let reply = '';
  const lowerMessage = message.toLowerCase();

  console.log(`🔄 處理步驟: ${session.step}`);
  
  // 價格查詢意圖
  if (/價格|價錢|多少錢|查詢價格|房價|報價/.test(lowerMessage)) {
    console.log('💰 檢測到價格查詢意圖');
    
    let roomType = 'standard';
    if (/標準/.test(lowerMessage)) roomType = 'standard';
    else if (/豪華/.test(lowerMessage)) roomType = 'deluxe';
    else if (/套房/.test(lowerMessage)) roomType = 'suite';
    
    const priceResult = pricingService.calculateRoomPrice(roomType, 1, 2);
    const roomNames = { standard: '標準雙人房', deluxe: '豪華雙人房', suite: '套房' };
    
    reply = `�� ${roomNames[roomType]}價格：\n` +
            `• 平日價格: ${priceResult.pricing.basePrice} TWD/晚\n` +
            `• 住宿1晚總價: ${priceResult.pricing.totalPrice} TWD\n` +
            `• 貨幣: ${priceResult.pricing.currency}\n\n` +
            `需要為您預訂嗎？`;
    
    console.log(`✅ 返回價格資訊: ${roomType}`);
    
  } else {
    switch (session.step) {
      case 'init':
        console.log(`🔤 轉為小寫: ${lowerMessage}`);
        
        if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'room';
          session.serviceType = 'booking';
          reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
          console.log('✅ 識別為訂房意圖，轉到房間選擇步驟');
          saveSessions();
        } else if (/取消|取消訂單|取消預訂|退訂|不要了/.test(lowerMessage)) {
          session.step = 'cancel_init';
          session.serviceType = 'cancellation';
          reply = '請問您要取消哪筆訂單？請提供訂單編號。';
          console.log('✅ 識別為取消意圖，轉到取消初始步驟');
          saveSessions();
        } else if (/會員|優惠|折扣|促銷/.test(lowerMessage)) {
          session.serviceType = 'membership';
          reply = '我們提供金卡、銀卡會員優惠，請問您想了解哪種會員權益？';
          console.log('✅ 識別為會員服務意圖');
          saveSessions();
        } else if (/附近|周邊|景點|好玩|旅遊|觀光|推薦|哪裡玩|有什麼好玩的/.test(lowerMessage)) {
          session.step = 'attractions_init';
          session.serviceType = 'attractions';
          reply = '🏞️ 想了解酒店附近的好玩景點嗎！請問您對什麼類型的景點感興趣？\n（例如：美食餐廳、購物中心、自然景觀、文化古蹟、夜市、便利商店）';
          console.log('✅ 識別為景點查詢意圖，轉到景點服務');
          saveSessions();
        } else {
          reply = '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
          console.log('❌ 未識別到明確意圖，保持在初始步驟');
        }
        break;

      case 'room':
        if (/標準|豪華|套房/.test(message)) {
          const matchedRoom = message.match(/標準|豪華|套房/)[0];
          session.data.roomType = matchedRoom;
          session.step = 'date';
          reply = `您選擇了「${matchedRoom}」，請提供入住日期（格式：YYYY-MM-DD）`;
          console.log(`✅ 選擇房型: ${matchedRoom}，轉到日期步驟`);
          saveSessions();
        } else {
          reply = '抱歉，我沒聽清，請重新告訴我您想訂哪種房型？（標準雙人房/豪華雙人房/套房）';
          console.log('❌ 未識別房型，保持在房間選擇步驟');
        }
        break;

      case 'date':
        const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          session.data.checkInDate = dateMatch[0];
          session.step = 'nights';
          reply = `入住日期為 ${session.data.checkInDate}。請問要住幾晚？`;
          console.log(`✅ 設置日期: ${session.data.checkInDate}，轉到天數步驟`);
          saveSessions();
        } else {
          reply = '日期格式錯誤，請輸入YYYY-MM-DD格式的入住日期。';
          console.log('❌ 日期格式錯誤，保持在日期步驟');
        }
        break;

      case 'nights':
        const nightMatch = message.match(/\d+/);
        if (nightMatch) {
          session.data.nights = parseInt(nightMatch[0]);
          session.step = 'guests';
          reply = '請問入住人數為多少？請輸入格式例如「2大1小」';
          console.log(`✅ 設置天數: ${session.data.nights}，轉到人數步驟`);
          saveSessions();
        } else {
          reply = '請輸入住期天數，如：2晚';
          console.log('❌ 天數格式錯誤，保持在天數步驟');
        }
        break;

      case 'guests':
        const guestMatch = message.match(/(\d+)大.*?(\d*)小/);
        if (guestMatch) {
          session.data.adults = parseInt(guestMatch[1]);
          session.data.children = guestMatch[2] ? parseInt(guestMatch[2]) : 0;
          session.step = 'confirm';
          reply = `您是 ${session.data.adults} 位大人和 ${session.data.children} 位小孩，請確認以上資訊是否正確，回覆「確認」或提出修改。`;
          console.log(`✅ 設置人數: ${session.data.adults}大${session.data.children}小，轉到確認步驟`);
          saveSessions();
        } else {
          reply = '入住人數格式錯誤，請輸入格式如「2大1小」。';
          console.log('❌ 人數格式錯誤，保持在人數步驟');
        }
        break;

      case 'confirm':
        if (/確認/.test(message)) {
          session.step = 'completed';
          
          const roomTypeMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
          const finalPrice = pricingService.calculateRoomPrice(
            roomTypeMap[session.data.roomType], 
            session.data.nights, 
            session.data.adults + session.data.children
          );
          
          reply = `🎉 預訂成功！\n` +
                  `• 房型: ${session.data.roomType}\n` +
                  `• 入住日期: ${session.data.checkInDate}\n` +
                  `• 住宿天數: ${session.data.nights} 晚\n` +
                  `• 入住人數: ${session.data.adults} 大 ${session.data.children} 小\n` +
                  `• 總價格: ${finalPrice.pricing.totalPrice} TWD\n\n` +
                  `感謝您的預訂，祝您旅途愉快！`;
          console.log('🎉 訂房完成，轉到完成步驟');
          saveSessions();
        } else {
          reply = '如需修改，請說明您的需求；確認請回覆「確認」。';
          console.log('ℹ️ 未確認，保持在確認步驟');
        }
        break;

      case 'completed':
        if (/重新開始|新訂單|再訂一間/.test(lowerMessage)) {
          session.step = 'init';
          session.data = {};
          reply = '🏨 歡迎再次使用 AI 訂房助理！請問需要什麼服務？';
          console.log('🔄 用戶要求重新開始，重置會話');
          saveSessions();
        } else {
          reply = '您的訂房已完成，如需新訂單，請輸入「重新開始」或「新訂單」。';
          console.log('ℹ️ 會話已完成，提示重新開始');
        }
        break;

      case 'cancel_init':
        const bookingIdMatch = message.match(/[A-Za-z0-9\-_]+/);
        if (bookingIdMatch) {
          const bookingId = bookingIdMatch[0];
          session.data.cancelBookingId = bookingId;
          
          try {
            const bookingResult = await bookingService.getBooking(bookingId);
            if (bookingResult.success) {
              session.step = 'cancel_confirm';
              const refundResult = pricingService.calculateRefund(bookingResult.totalPrice);
              
              reply = `📋 找到訂單 ${bookingId}：\n` +
                      `• 房型: ${bookingResult.roomType}\n` +
                      `• 入住日期: ${bookingResult.checkInDate}\n` +
                      `• 住宿天數: ${bookingResult.nights} 晚\n` +
                      `• 總金額: ${bookingResult.totalPrice} TWD\n` +
                      `• 預計退款: ${refundResult.refundAmount} TWD\n\n` +
                      `請問確認要取消此訂單嗎？回覆「確認取消」或「不取消」。`;
              console.log(`✅ 找到訂單: ${bookingId}，轉到取消確認步驟`);
            } else {
              reply = `❌ 找不到訂單 ${bookingId}，請確認訂單編號是否正確。`;
              console.log(`❌ 訂單不存在: ${bookingId}`);
            }
          } catch (error) {
            reply = `❌ 查詢訂單時發生錯誤：${error.message}`;
            console.log(`❌ 查詢訂單錯誤: ${error.message}`);
          }
          saveSessions();
        } else {
          reply = '請提供有效的訂單編號，例如：BKG-123456';
          console.log('❌ 未提供有效訂單編號，保持在取消初始步驟');
        }
        break;

      case 'cancel_confirm':
        if (/確認取消|是的取消|確定取消/.test(lowerMessage)) {
          try {
            const cancelResult = await bookingService.cancelBooking(session.data.cancelBookingId);
            const bookingResult = await bookingService.getBooking(session.data.cancelBookingId);
            const refundResult = pricingService.calculateRefund(bookingResult.totalPrice);
            
            session.step = 'cancel_completed';
            reply = `✅ 訂單取消成功！\n` +
                    `• 訂單編號: ${session.data.cancelBookingId}\n` +
                    `• 取消狀態: ${cancelResult.status}\n` +
                    `• 退款金額: ${refundResult.refundAmount} TWD\n` +
                    `• 退款將在 7-14 個工作天內處理完成\n\n` +
                    `感謝您使用我們的服務！`;
            console.log(`✅ 取消訂單成功: ${session.data.cancelBookingId}`);
          } catch (error) {
            reply = `❌ 取消訂單失敗：${error.message}`;
            console.log(`❌ 取消訂單錯誤: ${error.message}`);
          }
          saveSessions();
        } else if (/不取消|保留訂單|不要取消/.test(lowerMessage)) {
          session.step = 'init';
          session.data = {};
          reply = '已保留您的訂單，如需其他服務請告訴我。';
          console.log('✅ 用戶選擇不取消，重置會話');
          saveSessions();
        } else {
          reply = '請回覆「確認取消」來取消訂單，或「不取消」保留訂單。';
          console.log('ℹ️ 未確認取消，保持在取消確認步驟');
        }
        break;

      case 'cancel_completed':
        if (/重新開始|新服務|其他服務/.test(lowerMessage)) {
          session.step = 'init';
          session.data = {};
          reply = '🏨 歡迎使用 AI 訂房助理！請問需要什麼服務？';
          console.log('🔄 用戶要求重新開始，重置會話');
          saveSessions();
        } else {
          reply = '訂單取消已完成，如需其他服務請輸入「重新開始」。';
          console.log('ℹ️ 取消已完成，提示重新開始');
        }
        break;

      // ==================== 景點服務流程 ====================
      case 'attractions_init':
        const attractionTypes = {
          '美食': 'food', '餐廳': 'food', '吃的': 'food', '食物': 'food',
          '購物': 'shopping', '商場': 'shopping', '買東西': 'shopping', '百貨': 'shopping',
          '自然': 'nature', '公園': 'nature', '風景': 'nature', '散步': 'nature',
          '文化': 'culture', '古蹟': 'culture', '歷史': 'culture', '博物館': 'culture',
          '夜市': 'nightmarket', '小吃': 'nightmarket', '夜市小吃': 'nightmarket',
          '便利': 'convenience', '便利商店': 'convenience', '超市': 'convenience', '商店': 'convenience'
        };
        
        const matchedType = Object.keys(attractionTypes).find(key => 
          lowerMessage.includes(key)
        );
        
        if (matchedType) {
          const typeKey = attractionTypes[matchedType];
          const result = attractionsService.recommendByType(typeKey, 200);
          
          if (result.attractions.length > 0) {
            let replyText = `🏞️ 酒店${result.maxDistance}內的${matchedType}推薦：\n\n`;
            result.attractions.forEach((attr, index) => {
              replyText += `${index + 1}. **${attr.name}** (${attr.distance})\n`;
              replyText += `   ⭐ 評分: ${attr.rating}/5\n`;
              replyText += `   📍 ${attr.description}\n`;
              if (attr.openingHours) {
                replyText += `   🕒 ${attr.openingHours}\n`;
              }
              replyText += `   💰 ${attr.priceLevel || '價格 varies'}\n\n`;
            });
            replyText += `需要了解某個景點的詳細資訊嗎？或者想查詢其他類型的景點？`;
            
            session.step = 'attractions_details';
            session.data.lastAttractionType = typeKey;
            session.data.lastAttractions = result.attractions;
            reply = replyText;
          } else {
            reply = `抱歉，${result.maxDistance}內沒有找到${matchedType}類型的景點。要不要試試其他類型？`;
          }
        } else if (/所有|全部|附近有什麼/.test(lowerMessage)) {
          const result = attractionsService.getAllNearby(200);
          if (result.attractions.length > 0) {
            let replyText = `🏞️ 酒店${result.maxDistance}內的所有推薦景點：\n\n`;
            result.attractions.forEach((attr, index) => {
              replyText += `${index + 1}. **${attr.name}** (${attr.distance}) - ${attr.type}\n`;
              replyText += `   ⭐ ${attr.rating}/5 - ${attr.description}\n\n`;
            });
            replyText += `想了解哪個景點的詳細資訊嗎？`;
            
            session.step = 'attractions_details';
            session.data.lastAttractions = result.attractions;
            reply = replyText;
          } else {
            reply = '抱歉，附近暫時沒有推薦的景點。';
          }
        } else {
          reply = '請告訴我您對什麼類型的景點感興趣？\n（美食餐廳、購物中心、自然景觀、文化古蹟、夜市小吃、便利商店）';
        }
        saveSessions();
        break;

      case 'attractions_details':
        if (/詳細|資訊|介紹/.test(lowerMessage)) {
          const lastAttractions = session.data.lastAttractions || [];
          const attractionNames = lastAttractions.map(attr => attr.name);
          const mentionedAttraction = attractionNames.find(name => 
            lowerMessage.includes(name)
          );
          
          if (mentionedAttraction) {
            const details = attractionsService.getAttractionDetails(mentionedAttraction);
            if (details.success) {
              const attr = details.attraction;
              reply = `📋 **${attr.name}** 詳細資訊：\n\n` +
                      `📍 地址: ${attr.address || '未提供'}\n` +
                      `📞 電話: ${attr.contact || '未提供'}\n` +
                      `🕒 營業時間: ${attr.openingHours || '未提供'}\n` +
                      `⭐ 評分: ${attr.rating}/5\n` +
                      `💰 價格等級: ${attr.priceLevel || '未提供'}\n` +
                      `📝 描述: ${attr.description}\n` +
                      `🎯 特色: ${attr.features ? attr.features.join('、') : '未提供'}\n\n` +
                      `還需要其他協助嗎？`;
            } else {
              reply = `抱歉，找不到「${mentionedAttraction}」的詳細資訊。`;
            }
          } else {
            reply = `請告訴我您想了解哪個景點的詳細資訊？\n可選景點: ${attractionNames.join('、')}`;
          }
        } else if (/其他|換一個|不一樣/.test(lowerMessage)) {
          session.step = 'attractions_init';
          reply = '好的！請問您對什麼類型的景點感興趣呢？';
        } else if (/搜索|查找|找/.test(lowerMessage)) {
          session.step = 'attractions_search';
          reply = '請告訴我您想搜索什麼關鍵字？例如：牛肉麵、書店、公園等。';
        } else {
          reply = '需要其他協助嗎？可以詢問景點詳細資訊、搜索其他景點，或查詢其他類型景點。';
        }
        saveSessions();
        break;

      case 'attractions_search':
        if (message.trim().length > 0) {
          const result = attractionsService.searchAttractions(message, 200);
          if (result.attractions.length > 0) {
            let replyText = `🔍 搜索「${message}」的結果：\n\n`;
            result.attractions.forEach((attr, index) => {
              replyText += `${index + 1}. **${attr.name}** (${attr.distance})\n`;
              replyText += `   ⭐ ${attr.rating}/5 - ${attr.description}\n\n`;
            });
            replyText += `想了解哪個景點的詳細資訊嗎？`;
            
            session.step = 'attractions_details';
            session.data.lastAttractions = result.attractions;
            reply = replyText;
          } else {
            reply = `抱歉，沒有找到與「${message}」相關的景點。要不要試試其他關鍵字？`;
          }
        } else {
          reply = '請告訴我您想搜索什麼關鍵字？';
        }
        saveSessions();
        break;

      default:
        reply = '系統錯誤，請稍後再試或聯繫客服。';
        console.log('❌ 未知步驟，返回錯誤');
    }
  }

  console.log(`📤 發送回應: ${reply}`);
  console.log(`📊 最終會話狀態: step=${session.step}, data=${JSON.stringify(session.data)}`);
  console.log('=== 請求處理完成 ===\n');

  res.json({ 
    success: true, 
    response: reply, 
    sessionData: session.data,
    currentStep: session.step
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

app.listen(PORT, () => {
  console.log(`✅ 服務已啟動，監聽端口 ${PORT}`);
  console.log(`📊 當前會話數量: ${sessions.size}`);
  console.log(`🔧 健康檢查: http://localhost:${PORT}/health`);
  console.log(`💬 聊天接口: http://localhost:${PORT}/chat`);
  console.log(`💰 價格查詢: http://localhost:${PORT}/api/price`);
  console.log(`❌ 取消訂單: http://localhost:${PORT}/api/cancel-booking`);
  console.log(`🏞️ 景點查詢: http://localhost:${PORT}/api/attractions/nearby`);
  console.log(`🔍 景點搜索: http://localhost:${PORT}/api/attractions/search`);
  console.log(`📈 會話統計: http://localhost:${PORT}/api/sessions/stats`);
  console.log('\n🎯 測試命令:');
  console.log('價格查詢: curl -X POST http://localhost:8080/api/price -H "Content-Type: application/json" -d \'{"roomType":"standard"}\'');
  console.log('取消訂單: curl -X POST http://localhost:8080/api/cancel-booking -H "Content-Type: application/json" -d \'{"bookingId":"BKG-123"}\'');
  console.log('景點查詢: curl "http://localhost:8080/api/attractions/nearby?type=food"');
  console.log('景點搜索: curl "http://localhost:8080/api/attractions/search?keyword=牛肉麵"');
  console.log('聊天測試: curl -X POST http://localhost:8080/chat -H "Content-Type: application/json" -d \'{"message":"附近有什麼好吃的","sessionId":"test-attractions"}\'');
});

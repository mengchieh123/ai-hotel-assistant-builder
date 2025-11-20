const express = require('express');
const router = express.Router();

console.log('🚨 加載完全修復版本的聊天路由');

// ==================== 智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // 精確匹配：附近景點
    if (/附近.*景點|周邊.*推薦|有什麼.*好玩|旅遊.*地點|觀光.*推薦|推薦.*景點/.test(lowerMessage)) {
      return this.getNearbyAttractions();
    }
    
    // 精確匹配：兒童收費
    if (/小孩.*收費|兒童.*價錢|幾歲.*免費|小朋友.*要錢|孩子.*年齡|嬰兒.*收費|小孩.*多少錢/.test(lowerMessage)) {
      return this.getChildPricing();
    }
    
    // 精確匹配：年長者優惠  
    if (/老人.*優惠|長者.*折扣|敬老|65歲|銀髮族|年長者|退休.*優惠/.test(lowerMessage)) {
      return this.getSeniorDiscount();
    }
    
    // 精確匹配：多間多晚
    if (/(\d+).*間.*(\d+).*晚|多間.*多晚|團體.*優惠|長期.*住宿|公司.*訂房|企業.*優惠|員工.*住宿/.test(lowerMessage)) {
      return this.getBulkDiscount(message);
    }
    
    // 精確匹配：設施服務
    if (/會議室|健身房|游泳池|設施.*設備|商務中心|溫泉|SPA/.test(lowerMessage)) {
      return this.getFacilityInfo();
    }

    // 原有邏輯
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價格資訊：\n• 標準雙人房：2,200 TWD/晚\n• 豪華雙人房：2,800 TWD/晚\n• 套房：4,500 TWD/晚\n• 以上價格已含服務費及稅金\n• 會員可享額外折扣`;
    }
    
    if (/小孩|兒童|孩子|小朋友|加價|加床|嬰兒/.test(lowerMessage)) {
      return `👶 兒童政策：\n• 6歲以下兒童：免費（不佔床）\n• 6-12歲兒童：每人每晚加收 300 TWD\n• 加嬰兒床：免費提供\n• 加床服務：500 TWD/晚\n• 家庭房：可容納 2大2小`;
    }
    
    if (/老人|長者|長輩|優惠|折扣|敬老/.test(lowerMessage)) {
      return `👴 長者優惠：\n• 65歲以上長者：房價 9 折優惠\n• 需出示身份證明文件\n• 可與會員折扣合併使用`;
    }
    
    if (/早餐|餐點|用餐|吃飯/.test(lowerMessage)) {
      return `🍽️ 早餐資訊：\n• 供應時間：06:30-10:00\n• 成人：300 TWD/位\n• 兒童：150 TWD/位\n• 白金會員：免費享用`;
    }
    
    if (/停車|車位|泊車/.test(lowerMessage)) {
      return `🅿️ 停車資訊：\n• 免費停車位\n• 地下停車場\n• 先到先得\n• 電動車充電站`;
    }
    
    if (/取消|退訂|退款|退房/.test(lowerMessage)) {
      return `📝 取消政策：\n• 入住前3天：全額退款\n• 入住前1天：退款80%\n• 當天取消：退款50%\n• 不可抗力因素：特殊處理`;
    }
    
    if (/會員|會員卡|會員資格|積分/.test(lowerMessage)) {
      return `🎫 會員制度：\n• 銀卡會員：房價9折 + 免費早餐\n• 金卡會員：房價85折 + 延遲退房\n• 白金會員：房價8折 + 專屬管家\n• 消費累積積分，可兌換免費住宿`;
    }
    
    if (/設施|設備|游泳池|健身房|溫泉/.test(lowerMessage)) {
      return `🏊 酒店設施：\n• 室外游泳池：07:00-22:00\n• 健身房：24小時開放\n• SPA溫泉：需預約\n• 商務中心：09:00-18:00`;
    }
    
    if (/寵物|狗|貓|帶寵物/.test(lowerMessage)) {
      return `🐾 寵物政策：\n• 允許攜帶小型寵物\n• 清潔費：500 TWD/晚\n• 需自備寵物用品\n• 公共區域需使用寵物推車`;
    }
    
    if (/無障礙|輪椅|殘障|行動不便/.test(lowerMessage)) {
      return `♿ 無障礙設施：\n• 無障礙客房\n• 輪椅通道\n• 專用停車位\n• 緊急呼叫系統`;
    }
    
    if (/長住|長期|月租|住.*月|住.*週/.test(lowerMessage)) {
      return `🏠 長住優惠：\n• 7-13晚：房價9折\n• 14-29晚：房價85折\n• 30晚以上：房價7折\n• 免費每周清潔服務\n• 免費mini bar補充`;
    }
    
    if (/(\d+).*間|團體|多人|公司|企業/.test(lowerMessage)) {
      const roomMatch = message.match(/(\d+).*間/);
      const roomCount = roomMatch ? parseInt(roomMatch[1]) : 1;
      let discountInfo = '';
      if (roomCount >= 3 && roomCount <= 5) discountInfo = '• 3-5間：房價95折\n';
      if (roomCount >= 6 && roomCount <= 10) discountInfo = '• 6-10間：房價9折 + 免費接駁\n';
      if (roomCount > 10) discountInfo = '• 11間以上：房價85折 + 免費會議室\n';
      return `🎉 團體訂房優惠：\n\n📊 ${roomCount}間房間優惠：\n${discountInfo}\n🎁 團體額外服務：\n• 專屬接待\n• 彈性付款\n• 客製化服務`;
    }
    
    return null;
  }

  static getNearbyAttractions() {
    return `🏞️ 附近熱門景點推薦：\n\n🎯 步行5分鐘內：\n• 鼎泰豐信義店 (150m) - 米其林一星小籠包\n• 新光三越百貨 (100m) - 精品購物中心\n\n🎯 步行10分鐘內：\n• 大安森林公園 (500m) - 都市綠洲\n• 永康街商圈 (800m) - 美食天堂\n\n需要詳細資訊嗎？`;
  }
  
  static getChildPricing() {
    return `👶 兒童收費詳細政策：\n\n📊 年齡分層收費：\n• 0-2歲嬰兒：完全免費\n• 3-5歲幼兒：免費（提供嬰兒床）\n• 6-11歲兒童：每晚 300 TWD\n• 12歲以上：視同成人收費\n\n請告知小朋友的具體年齡和人數。`;
  }
  
  static getSeniorDiscount() {
    return `👴 年長者專屬優惠：\n\n🎫 資格條件：\n• 65歲以上長者\n• 需出示身份證明\n\n💰 優惠內容：\n• 房價直接9折優惠\n• 免費早餐2客\n• 延遲退房至14:00\n\n請告知長者年齡及住宿需求。`;
  }
  
  static getBulkDiscount(message) {
    const roomMatch = message.match(/(\d+).*間/);
    const nightMatch = message.match(/(\d+).*晚/);
    const roomCount = roomMatch ? parseInt(roomMatch[1]) : 1;
    const nights = nightMatch ? parseInt(nightMatch[1]) : 1;
    
    return `🎉 ${roomCount}間房 × ${nights}晚 專屬優惠方案！\n\n請提供具體需求，為您製作正式報價單！`;
  }
  
  static getFacilityInfo() {
    return `🏊 酒店設施服務：\n\n💼 商務設施：\n• 會議室：可容納10-100人\n• 商務中心：24小時免費使用\n\n🏋️ 休閒設施：\n• 健身房：24小時開放\n• 游泳池：07:00-22:00\n\n需要預約任何設施嗎？`;
  }
}

// ==================== 會話管理 ====================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'init',
      data: {},
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 價格計算服務 ====================
const pricingService = {
  calculateRoomPrice(roomType, nights = 1, guestCount = 2) {
    const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
    const basePrice = (rates[roomType] || rates.standard) * nights;
    const extraGuestFee = guestCount > 2 ? (guestCount - 2) * 500 * nights : 0;
    const totalPrice = basePrice + extraGuestFee;

    return { totalPrice, currency: 'TWD' };
  }
};

<<<<<<< HEAD
// ==================== 回應生成器 - 完全修復版 ====================
=======
// ==================== 回應生成器 - 完全重寫版 ====================
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    let reply = '';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

<<<<<<< HEAD
    console.log(`🔍 [FIXED] 步驟: ${session.step}, 訊息: "${message}"`);

    // 🚨 關鍵修復：首先檢查是否為房型
    if (/標準|豪華|套房/.test(lowerMessage)) {
      console.log(`✅ [FIXED] 檢測到房型選擇: ${message}`);
      
      const roomMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
      const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
      
      session.data.roomType = roomMap[matchedKey] || 'standard';
      session.step = 'date';
      reply = `🏨 您選擇的是 ${matchedKey} 房型。請告訴我入住日期（格式：YYYY-MM-DD）`;
      
      console.log(`✅ [FIXED] 成功設置房型: ${matchedKey}, 轉到日期步驟`);
      return { reply, step: session.step, sessionData: session.data };
    }

    // 如果不是房型，才繼續其他邏輯
    switch (session.step) {
      case 'init':
        console.log(`🔍 [FIXED] 在 init 階段處理: ${message}`);
        
        if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'room';
          reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
          break;
        }
        
        // 處理智能問答
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          break;
        }

        if (/附近|周邊|景點|好玩|旅遊|觀光/.test(lowerMessage)) {
          reply = '🏞️ 附近推薦景點：\n• 鼎泰豐 (150m)\n• 新光三越 (100m)\n• 大安森林公園 (200m)\n\n需要詳細資訊嗎？';
          break;
        }

        reply = '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
        break;

      case 'room':
        // 在房型選擇階段，如果不是有效房型就提示
=======
    console.log(`🔍 [DEBUG] 步驟: ${session.step}, 訊息: "${message}"`);

    // 🚨 關鍵修復：在所有階段之前先檢查是否為房型選擇
    const isRoomType = /標準|豪華|套房/.test(lowerMessage);
    if (isRoomType) {
      console.log(`✅ 檢測到房型選擇: ${message}`);
      const roomMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
      const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
      
      if (session.step === 'init' || session.step === 'room') {
        session.data.roomType = roomMap[matchedKey] || 'standard';
        session.step = 'date';
        reply = `🏨 您選擇的是 ${matchedKey} 房型。請告訴我入住日期（格式：YYYY-MM-DD）`;
        console.log(`✅ 成功設置房型: ${matchedKey}, 轉到日期步驟`);
        return { reply, step: session.step, sessionData: session.data };
      }
    }

    // 🚨 關鍵修復：在 init 階段，先檢查是否為訂房意圖
    if (session.step === 'init') {
      if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
        session.step = 'room';
        reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
        console.log(`✅ 檢測到訂房意圖，轉到房型選擇`);
        return { reply, step: session.step, sessionData: session.data };
      }
      
      // 只有當不是房型選擇時才處理問答
      if (!isRoomType) {
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          console.log(`✅ 返回問答結果`);
          return { reply, step: session.step, sessionData: session.data };
        }
      }

      if (/附近|周邊|景點|好玩|旅遊|觀光/.test(lowerMessage)) {
        reply = '🏞️ 附近推薦景點：\n• 鼎泰豐 (150m)\n• 新光三越 (100m)\n• 大安森林公園 (200m)\n\n需要詳細資訊嗎？';
        return { reply, step: session.step, sessionData: session.data };
      }

      reply = '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
      return { reply, step: session.step, sessionData: session.data };
    }

    // 其他階段的處理
    switch (session.step) {
      case 'room':
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
        const qaAnswerRoom = QAService.handleQuestion(message);
        if (qaAnswerRoom) {
          reply = qaAnswerRoom + '\n\n🏨 請選擇房型：標準雙人房、豪華雙人房或套房';
        } else {
          reply = '請選擇有效的房型：標準雙人房、豪華雙人房或套房。';
        }
        break;

      case 'date':
        if (dateRegex.test(message)) {
          session.data.checkInDate = message;
          session.step = 'nights';
          reply = '📅 入住日期已記錄。請問您要入住幾晚？';
        } else {
          const qaAnswerDate = QAService.handleQuestion(message);
          if (qaAnswerDate) {
            reply = qaAnswerDate + '\n\n📅 請輸入入住日期（格式：YYYY-MM-DD）';
          } else {
            reply = '請輸入正確格式的入住日期，例如 2024-12-25。';
          }
        }
        break;

      case 'nights':
        const nights = parseInt(message);
        if (nights > 0 && nights <= 30) {
          session.data.nights = nights;
          session.step = 'guests';
          reply = `📆 已設定住宿 ${nights} 晚！請問有幾位旅客？`;
        } else {
          const qaAnswerNights = QAService.handleQuestion(message);
          if (qaAnswerNights) {
            reply = qaAnswerNights + '\n\n📆 請輸入住宿天數（1-30天）';
          } else {
            reply = '請輸入有效的住宿天數（1-30天）';
          }
        }
        break;

      case 'guests':
        const guests = parseInt(message);
        if (guests > 0 && guests <= 6) {
          session.data.guestCount = guests;
          session.step = 'confirm';
          const priceResult = pricingService.calculateRoomPrice(
            session.data.roomType, 
            session.data.nights, 
            session.data.guestCount
          );
          session.data.totalPrice = priceResult.totalPrice;
          
<<<<<<< HEAD
          reply = `👥 旅客數: ${guests} 位\n\n` +
                  `📋 訂房摘要：\n` +
=======
          reply = `👥 旅客數: ${guests} 位\n\n📋 訂房摘要：\n` +
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
                  `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
                  `• 入住: ${session.data.checkInDate}\n` +
                  `• 住宿: ${session.data.nights} 晚\n` +
                  `• 旅客: ${session.data.guestCount} 位\n` +
                  `• 總價: ${session.data.totalPrice} TWD\n\n` +
                  `請回覆「確認」完成訂房，或「取消」重新開始。`;
        } else {
          const qaAnswerGuests = QAService.handleQuestion(message);
          if (qaAnswerGuests) {
            reply = qaAnswerGuests + '\n\n👥 請輸入旅客人數（1-6位）';
          } else {
            reply = '請輸入有效的旅客人數（1-6位）';
          }
        }
        break;

      case 'confirm':
        if (/確認|是的|確定|ok|yes|完成訂房/.test(lowerMessage)) {
          const bookingId = 'BKG-' + Date.now();
          session.data.bookingId = bookingId;
          session.step = 'completed';
<<<<<<< HEAD
          
          reply = `🎉 訂房成功！\n\n` +
                  `📄 訂單編號: ${bookingId}\n` +
=======
          reply = `🎉 訂房成功！\n\n📄 訂單編號: ${bookingId}\n` +
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
                  `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
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
<<<<<<< HEAD
          const qaAnswerConfirm = QAService.handleQuestion(message);
=======
          const qaAnswerConfirm = QAService.handleQuestion(message, session.data);
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
          if (qaAnswerConfirm) {
            reply = qaAnswerConfirm + '\n\n📋 您的訂房摘要：\n' +
              `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
              `• 入住: ${session.data.checkInDate}\n` +
              `• 住宿: ${session.data.nights} 晚\n` +
              `• 旅客: ${session.data.guestCount} 位\n` +
              `• 總價: ${session.data.totalPrice} TWD\n\n` +
              `請回覆「確認」完成訂房，或「取消」重新開始。`;
          } else {
            reply = '請回覆「確認」完成訂房，或「取消」重新開始。';
          }
        }
        break;

      default:
        session.step = 'init';
        reply = '會話已重置。請問需要什麼服務？';
        break;
    }

<<<<<<< HEAD
    console.log(`💬 [FIXED] 最終回應步驟: ${session.step}`);
=======
    console.log(`💬 [DEBUG] 最終回應步驟: ${session.step}`);
>>>>>>> b5601fe80ddd21d3bcadab68584c9c58bd484964
    return { reply, step: session.step, sessionData: session.data };
  }

  static getRoomTypeName(roomType) {
    const roomNames = {
      'standard': '標準雙人房',
      'deluxe': '豪華雙人房', 
      'suite': '套房'
    };
    return roomNames[roomType] || roomType;
  }
}

// ==================== 路由處理 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: '消息不能为空',
        suggestion: '请提供您的查询或需求'
      });
    }

    console.log('📩 收到消息:', message, 'sessionId:', sessionId);

    const session = getOrCreateSession(sessionId);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('📊 最終結果:', {
      sessionId,
      message, 
      step: session.step,
      replyLength: response.reply.length
    });

    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      step: response.step,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat service error:', error);
    res.status(500).json({
      error: '处理您的请求时出现错误',
      suggestion: '请稍后重试或联系客服'
    });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy', 
    version: '5.0',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

module.exports = router;

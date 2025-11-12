const express = require('express');
const router = express.Router();

// ==================== 新增：智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // 價格相關問題
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價格資訊：\n` +
             `• 標準雙人房：2,200 TWD/晚\n` +
             `• 豪華雙人房：2,800 TWD/晚\n` +
             `• 套房：4,500 TWD/晚\n` +
             `• 以上價格已含服務費及稅金\n` +
             `• 會員可享額外折扣`;
    }
    
    // 兒童相關問題
    if (/小孩|兒童|孩子|小朋友|加價|加床|嬰兒/.test(lowerMessage)) {
      return `👶 兒童政策：\n` +
             `• 6歲以下兒童：免費（不佔床）\n` +
             `• 6-12歲兒童：每人每晚加收 300 TWD\n` +
             `• 加嬰兒床：免費提供\n` +
             `• 加床服務：500 TWD/晚\n` +
             `• 家庭房：可容納 2大2小`;
    }
    
    // 老人優惠問題
    if (/老人|長者|長輩|優惠|折扣|敬老/.test(lowerMessage)) {
      return `👴 長者優惠：\n` +
             `• 65歲以上長者：房價 9 折優惠\n` +
             `• 需出示身份證明文件\n` +
             `• 可與會員折扣合併使用`;
    }
    
    // 早餐問題
    if (/早餐|餐點|用餐|吃飯/.test(lowerMessage)) {
      return `🍽️ 早餐資訊：\n` +
             `• 供應時間：06:30-10:00\n` +
             `• 成人：300 TWD/位\n` +
             `• 兒童：150 TWD/位\n` +
             `• 白金會員：免費享用`;
    }
    
    // 停車問題
    if (/停車|車位|泊車/.test(lowerMessage)) {
      return `🅿️ 停車資訊：\n` +
             `• 免費停車位\n` +
             `• 地下停車場\n` +
             `• 先到先得\n` +
             `• 電動車充電站`;
    }
    
    // 取消政策
    if (/取消|退訂|退款|退房/.test(lowerMessage)) {
      return `📝 取消政策：\n` +
             `• 入住前3天：全額退款\n` +
             `• 入住前1天：退款80%\n` +
             `• 當天取消：退款50%\n` +
             `• 不可抗力因素：特殊處理`;
    }
    
    // 會員問題
    if (/會員|會員卡|會員資格|積分/.test(lowerMessage)) {
      return `🎫 會員制度：\n` +
             `• 銀卡會員：房價9折 + 免費早餐\n` +
             `• 金卡會員：房價85折 + 延遲退房\n` +
             `• 白金會員：房價8折 + 專屬管家\n` +
             `• 消費累積積分，可兌換免費住宿`;
    }
    
    // 設施問題
    if (/設施|設備|游泳池|健身房|溫泉/.test(lowerMessage)) {
      return `🏊 酒店設施：\n` +
             `• 室外游泳池：07:00-22:00\n` +
             `• 健身房：24小時開放\n` +
             `• SPA溫泉：需預約\n` +
             `• 商務中心：09:00-18:00`;
    }
    
    // 寵物問題
    if (/寵物|狗|貓|帶寵物/.test(lowerMessage)) {
      return `🐾 寵物政策：\n` +
             `• 允許攜帶小型寵物\n` +
             `• 清潔費：500 TWD/晚\n` +
             `• 需自備寵物用品\n` +
             `• 公共區域需使用寵物推車`;
    }
    
    // 無障礙設施
    if (/無障礙|輪椅|殘障|行動不便/.test(lowerMessage)) {
      return `♿ 無障礙設施：\n` +
             `• 無障礙客房\n` +
             `• 輪椅通道\n` +
             `• 專用停車位\n` +
             `• 緊急呼叫系統`;
    }
    
    // 長住優惠
    if (/長住|長期|月租|住.*月|住.*週/.test(lowerMessage)) {
      return `🏠 長住優惠：\n` +
             `• 7-13晚：房價9折\n` +
             `• 14-29晚：房價85折\n` +
             `• 30晚以上：房價7折\n` +
             `• 免費每周清潔服務\n` +
             `• 免費mini bar補充`;
    }
    
    // 團體優惠
    if (/(\d+).*間|團體|多人|公司|企業/.test(lowerMessage)) {
      const roomMatch = message.match(/(\d+).*間/);
      const roomCount = roomMatch ? parseInt(roomMatch[1]) : 1;
      
      let discountInfo = '';
      if (roomCount >= 3 && roomCount <= 5) discountInfo = '• 3-5間：房價95折\n';
      if (roomCount >= 6 && roomCount <= 10) discountInfo = '• 6-10間：房價9折 + 免費接駁\n';
      if (roomCount > 10) discountInfo = '• 11間以上：房價85折 + 免費會議室\n';
      
      return `🎉 團體訂房優惠：\n\n` +
             `📊 ${roomCount}間房間優惠：\n` +
             discountInfo +
             `\n🎁 團體額外服務：\n` +
             `• 專屬接待\n` +
             `• 彈性付款\n` +
             `• 客製化服務`;
    }
    
    return null;
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
  calculateRoomPrice(roomType, nights = 1, guestCount = 2, memberLevel = 'none') {
    const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
    const basePrice = (rates[roomType] || rates.standard) * nights;
    const extraGuestFee = guestCount > 2 ? (guestCount - 2) * 500 * nights : 0;
    
    const discountRates = { none: 0, silver: 0.05, gold: 0.1, platinum: 0.15 };
    const discount = discountRates[memberLevel] || 0;
    const discountAmount = basePrice * discount;
    
    const subtotal = basePrice + extraGuestFee;
    const totalPrice = subtotal - discountAmount;

    return {
      basePrice,
      extraGuestFee,
      subtotal,
      discountRate: discount * 100,
      discountAmount,
      totalPrice,
      currency: 'TWD'
    };
  }
};

// ==================== 需求檢測服務 ====================
class RequirementDetector {
  static async detectAllRequirements(message) {
    return {
      symbolCount: {
        count: (message.match(/[.!?,;:!！？，；：]/g) || []).length,
        level: 'normal'
      },
      accessible: {
        required: /(无障碍|残障|轮椅|行动不便)/i.test(message)
      },
      family: {
        children: /(小孩|儿童|孩子|小朋友|婴儿)/i.test(message),
        extraBed: /(加床|婴儿床)/i.test(message)
      },
      service: {
        parking: /(停车|车位)/i.test(message),
        breakfast: /(早餐|用餐)/i.test(message)
      }
    };
  }
}

// ==================== 回應生成器 - 重構版 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    let reply = '';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    switch (session.step) {
      case 'init':
        // ========== 優先處理複雜多需求情境 ==========
        
        // 1. 家庭旅遊複雜需求
        if (/(\d+).*大人.*(\d+).*小孩|家庭|嬰兒|老人|長者|加床|公園|餐廳|停車/.test(lowerMessage)) {
          const adultMatch = message.match(/(\d+).*大人/);
          const childMatch = message.match(/(\d+).*小孩/);
          const adultCount = adultMatch ? parseInt(adultMatch[1]) : 2;
          const childCount = childMatch ? parseInt(childMatch[1]) : 0;
          
          reply = `🎉 歡迎家庭旅遊！已了解您的需求：\n\n` +
                  `👨‍👩‍👧‍👦 家庭成員：\n` +
                  `• ${adultCount}位大人${childCount > 0 ? ` + ${childCount}位小孩` : ''}\n\n` +
                  `💰 相關優惠說明：\n` +
                  `• 兒童政策：6歲以下免費，6-12歲每晚300 TWD\n` +
                  `• 長者優惠：65歲以上房價9折\n` +
                  `• 加床服務：500 TWD/晚\n` +
                  `• 家庭房推薦：可容納2大2小，更舒適\n\n` +
                  `🏞️ 周邊設施：\n` +
                  `• 公園：大安森林公園（200m）\n` +
                  `• 餐廳：鼎泰豐、林東芳牛肉麵\n` +
                  `• 停車：免費地下停車場\n\n` +
                  `📋 建議選擇「家庭房」或「相連客房」\n` +
                  `是否需要為您開始訂房流程？`;
          session.step = 'room';
        
        // 2. 團體訂房需求
        } else if (/(\d+).*間|團體|多人|公司|企業|團體優惠/.test(lowerMessage)) {
          const roomMatch = message.match(/(\d+).*間/);
          const roomCount = roomMatch ? parseInt(roomMatch[1]) : 1;
          
          reply = `🎉 團體訂房專屬優惠！\n\n` +
                  `🏨 ${roomCount}間房間優惠：\n` +
                  `• 3-5間：房價95折\n` +
                  `• 6-10間：房價9折 + 免費接駁\n` +
                  `• 11間以上：房價85折 + 免費會議室\n\n` +
                  `請提供入住日期開始訂房流程！`;
          session.step = 'date';
        
        // 3. 長住優惠需求
        } else if (/(\d+).*晚|長住|長期|月租|住.*月/.test(lowerMessage)) {
          const nightMatch = message.match(/(\d+).*晚/);
          const nights = nightMatch ? parseInt(nightMatch[1]) : 1;
          
          let longStayDiscount = '';
          if (nights >= 7) longStayDiscount = '• 住7晚以上：房價9折\n';
          if (nights >= 14) longStayDiscount = '• 住14晚以上：房價85折\n';
          if (nights >= 30) longStayDiscount = '• 住30晚以上：房價7折 + 免費洗衣服務\n';
          
          reply = `🏠 長住優惠資訊：\n\n` +
                  `📅 住宿${nights}晚優惠：\n` +
                  longStayDiscount +
                  `\n🎁 長住額外服務：\n` +
                  `• 每周房間清潔\n` +
                  `• 免費mini bar補充\n` +
                  `• 專屬長住客服\n\n` +
                  `請選擇房型開始預訂！`;
          session.step = 'room';
        
        // 4. 標準流程
        } else if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'room';
          reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
        
        } else if (/取消|取消訂單|取消預訂|退訂/.test(lowerMessage)) {
          session.step = 'cancel_init';
          reply = '請問您要取消哪筆訂單？請提供訂單編號。';
        
        } else if (/會員|優惠|折扣|促銷/.test(lowerMessage)) {
          const qaAnswer = QAService.handleQuestion(message);
          reply = qaAnswer || '我們提供金卡、銀卡會員優惠，請問您想了解哪種會員權益？';
        
        } else if (/附近|周邊|景點|好玩|旅遊|觀光/.test(lowerMessage)) {
          reply = '🏞️ 附近推薦景點：\n' +
                  '• 鼎泰豐 (150m) - 知名小籠包\n' +
                  '• 新光三越 (100m) - 購物中心\n' +
                  '• 大安森林公園 (200m) - 自然景觀\n\n' +
                  '需要詳細資訊嗎？';
        
        } else {
          const qaAnswer = QAService.handleQuestion(message);
          reply = qaAnswer || '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
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
          
          session.data.totalPrice = priceResult.totalPrice;
          session.data.priceDetail = priceResult;
          
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
          const bookingId = 'BKG-' + Date.now();
          session.data.bookingId = bookingId;
          session.step = 'completed';
          
          reply = `🎉 訂房成功！\n\n` +
                  `📄 訂單編號: ${bookingId}\n` +
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
          // 在確認階段也處理問答
          const qaAnswer = QAService.handleQuestion(message, session.data);
          if (qaAnswer) {
            reply = qaAnswer + '\n\n📋 您的訂房摘要：\n' +
              `• 房型: ${session.data.roomType === 'standard' ? '標準雙人房' : session.data.roomType === 'deluxe' ? '豪華雙人房' : '套房'}\n` +
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

    return {
      reply,
      step: session.step,
      sessionData: session.data
    };
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

    console.log('收到消息:', message);

    const session = getOrCreateSession(sessionId);
    const requirements = await RequirementDetector.detectAllRequirements(message);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('Chat Request:', {
      sessionId,
      message,
      step: session.step,
      requirements: requirements.family.children ? '有兒童需求' : '無特殊需求'
    });

    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      step: response.step,
      requirements: requirements.family.children ? {
        summary: {
          hasSpecialRequirements: true,
          mainPoints: ['兒童相關'],
          requirementCount: 1
        },
        details: requirements
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat service error:', error);
    res.status(500).json({
      error: '处理您的请求时出现错误',
      suggestion: '请稍后重试或联系客服'
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '4.0',
    timestamp: new Date().toISOString(),
    features: [
      'smart_qa_service',
      'booking_workflow', 
      'family_travel_detection',
      'group_booking_detection',
      'long_stay_detection',
      'requirement_analysis',
      'session_management'
    ],
    activeSessions: sessions.size
  });
});

// 清理過期會話
setInterval(() => {
  const now = new Date();
  const expirationTime = 30 * 60 * 1000; // 30分鐘
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    const sessionTime = new Date(session.lastActive);
    if (now - sessionTime > expirationTime) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🗑️ 清理了 ${cleanedCount} 個過期會話`);
  }
}, 60 * 60 * 1000); // 每小時清理一次

module.exports = router;

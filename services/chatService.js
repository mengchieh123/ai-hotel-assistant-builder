const express = require('express');
const router = express.Router();
const OpenCC = require('opencc');
const converter = new OpenCC('s2t.json'); // 簡體轉繁體

// ==================== 智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();

    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價果資訊：\n` +
        `• 標準雙人房：2,200 TWD/晚\n` +
        `• 豪華雙人房：2,800 TWD/晚\n` +
        `• 套房：4,500 TWD/晚\n` +
        `• 以上價格已含服務費及稅金\n` +
        `• 會員可享額外折扣`;
    }
    // 其他智能問答判斷可擴充
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
        required: /(無障礙|殘障|輪椅|行動不便)/i.test(message)
      },
      family: {
        children: /(小孩|兒童|孩子|小朋友|嬰兒)/i.test(message),
        extraBed: /(加床|嬰兒床)/i.test(message)
      },
      service: {
        parking: /(停車|車位)/i.test(message),
        breakfast: /(早餐|用餐)/i.test(message)
      }
    };
  }
}

// ==================== 意圖與槽位偵測 ====================
async function detectIntentAndEntities(message) {
  const traditionalMsg = await converter.convertPromise(message);

  let intent = 'general_inquiry';
  let entities = {};

  if (/標準雙人房|豪華雙人房|套房/.test(traditionalMsg)) {
    intent = 'select_room_type';
    const match = traditionalMsg.match(/標準雙人房|豪華雙人房|套房/);
    entities.roomType = match ? match[0] : null;
  } else if (/訂房|預訂|預定/.test(traditionalMsg)) {
    intent = 'book_room';
  } else if (/優惠|折扣|促銷/.test(traditionalMsg)) {
    intent = 'ask_promotion';
  } else if (/取消|退訂/.test(traditionalMsg)) {
    intent = 'cancel_booking';
  }

  return { intent, entities };
}

// ==================== 回應生成器 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let reply = '';

    switch (session.step) {
      case 'init':
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          break;
        }
        if (/標準雙人房|豪華雙人房|套房/.test(message)) {
          session.data.roomType = message.match(/標準雙人房|豪華雙人房|套房/)[0];
          session.step = 'date';
          reply = `您選擇的是 ${session.data.roomType}，請告訴我入住日期（格式：YYYY-MM-DD）`;
          break;
        }
        reply = '您好，歡迎使用 AI 訂房助理！請問需要什麼幫助？';
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
          reply = '請問有幾位旅客？';
        } else {
          reply = '請輸入有效的住宿天數（1-30天）';
        }
        break;

      case 'guests':
        const guests = parseInt(message);
        if (guests > 0 && guests <= 6) {
          session.data.guestCount = guests;
          session.step = 'confirm';
          
          const priceResult = pricingService.calculateRoomPrice(
            session.data.roomType === '豪華雙人房' ? 'deluxe' :
            session.data.roomType === '套房' ? 'suite' : 'standard',
            session.data.nights, session.data.guestCount
          );
          session.data.totalPrice = priceResult.totalPrice;
          reply =
            `旅客數：${guests}位\n` +
            `房型：${session.data.roomType}\n` +
            `入住：${session.data.checkInDate}\n` +
            `住宿：${session.data.nights}晚\n` +
            `總價：${priceResult.totalPrice} TWD\n` +
            `請回覆「確認」完成訂房，或「取消」重新開始。`;
        } else {
          reply = '請輸入有效的旅客人數（1-6位）';
        }
        break;

      case 'confirm':
        if (/確認|是的|確定|ok|yes/.test(lowerMessage)) {
          session.step = 'completed';
          reply = `🎉 訂房成功！感謝使用 AI 訂房助理。`;
        } else if (/取消|不要了|重新開始/.test(lowerMessage)) {
          session.step = 'init';
          session.data = {};
          reply = '訂房已取消，請問還需要什麼服務？';
        } else {
          reply = '請回覆「確認」完成訂房，或「取消」重新開始。';
        }
        break;

      case 'completed':
        reply = '您的訂單已完成，如需其他服務請告訴我！';
        break;

      default:
        session.step = 'init';
        reply = '會話重置，請問需要什麼服務？';
        break;
    }
    return { reply, step: session.step, sessionData: session.data };
  }
}

// ==================== 聊天路由 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: '[translate:消息不能为空]',
        suggestion: '[translate:请提供您的查询或需求]'
      });
    }

    const session = getOrCreateSession(sessionId);
    const requirements = await RequirementDetector.detectAllRequirements(message);
    const response = ResponseGenerator.generateResponse(message, session);

    sessions.set(sessionId, session);

    res.json({
      success: true,
      reply: response.reply,
      sessionId,
      step: response.step,
      requirements: requirements.family.children ? {
        summary: {
          hasSpecialRequirements: true,
          mainPoints: [translate '兒童相關'],
          requirementCount: 1
        },
        details: requirements
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('聊天服務錯誤:', error);
    res.status(500).json({
      error: '[translate:處理您的請求時出現錯誤]',
      suggestion: '[translate:請稍後重試或聯繫客服]'
    });
  }
});

// ==================== 健康檢查 ====================
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

// ==================== 過期會話清理 ====================
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
    console.log(`[translate:🗑️ 清理了] ${cleanedCount} [translate:個過期會話]`);
  }
}, 60 * 60 * 1000); // 每小時清理一次

module.exports = router;

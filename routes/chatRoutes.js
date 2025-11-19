const express = require('express');
const cors = require('cors');
const router = express.Router();

// 使用 express.Router 但包含完整伺服器功能
const app = express();

// ==================== CORS 配置 ====================
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.86:3000', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 中間件
app.use(express.json());
router.use(express.json());

console.log('🚀 加載獨立版飯店AI助理服務');

// ==================== 會員資料庫 ====================
const memberData = {
  'gold': {
    level: 'Gold',
    discount: 0.1,
    benefits: ['免費早餐', '延遲退房至14:00']
  },
  'platinum': {
    level: 'Platinum', 
    discount: 0.2,
    benefits: ['免費早餐', '延遲退房至16:00', '房型升等']
  }
};

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
}

// ==================== 會話管理 ====================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
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
  calculateRoomPrice(roomType, nights = 1, adults = 2, children = 0, childrenAges = []) {
    const rates = { standard: 2200, deluxe: 2800, suite: 4500 };
    const basePrice = (rates[roomType] || rates.standard) * nights;
    
    // 兒童收費計算
    let childFee = 0;
    childrenAges.forEach(age => {
      if (age >= 6 && age <= 11) {
        childFee += 300 * nights; // 6-11歲兒童費
      }
    });
    
    // 額外成人收費
    const extraAdultFee = adults > 2 ? (adults - 2) * 500 * nights : 0;
    
    const totalPrice = basePrice + childFee + extraAdultFee;

    return { 
      totalPrice, 
      currency: 'TWD',
      basePrice,
      childFee,
      extraAdultFee
    };
  }
};

// ==================== 回應生成器 - 增強版 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    let reply = '';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    console.log(`🔍 步驟: ${session.step}, 訊息: "${message}"`);

    // 🚀 增強：家庭成員和年齡識別
    const familyPattern = /(\d+)[大位]?.*?(\d+)[小孩]?/;
    const agePattern = /(\d+)[歲年]/g;
    
    if (familyPattern.test(message) && (session.step === 'start_booking' || session.step === 'welcome')) {
      const match = message.match(familyPattern);
      const adults = parseInt(match[1]) || 2;
      const children = parseInt(match[2]) || 0;
      
      // 提取年齡
      const ages = [];
      let ageMatch;
      while ((ageMatch = agePattern.exec(message)) !== null) {
        ages.push(parseInt(ageMatch[1]));
      }
      
      session.data.adults = adults;
      session.data.children = children;
      session.data.childrenAges = ages;
      
      console.log(`✅ 識別家庭成員: ${adults}大${children}小, 年齡: ${ages}`);
      
      // 根據年齡給出建議
      let ageAdvice = '';
      if (ages.length > 0) {
        const under6 = ages.filter(age => age < 6).length;
        const schoolAge = ages.filter(age => age >= 6 && age <= 12).length;
        
        if (under6 > 0) ageAdvice += `\n• ${under6}位學齡前兒童可免費入住`;
        if (schoolAge > 0) ageAdvice += `\n• ${schoolAge}位學齡兒童需加收費用`;
      }
      
      session.step = 'room';
      reply = `👨‍👩‍👧‍👦 已記錄：${adults}位大人，${children}位小孩${ages.length > 0 ? `，年齡：${ages.join('、')}歲` : ''}。${ageAdvice}\n\n請選擇房型：標準雙人房、豪華雙人房或套房？`;
      return { reply, step: session.step, sessionData: session.data };
    }

    // 房型選擇檢查
    const isRoomType = /標準|豪華|套房/.test(lowerMessage);
    if (isRoomType) {
      console.log(`✅ 檢測到房型選擇: ${message}`);
      const roomMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
      const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
      
      if (session.step === 'start_booking' || session.step === 'room') {
        session.data.roomType = roomMap[matchedKey] || 'standard';
        session.step = 'date';
        reply = `🏨 您選擇的是 ${matchedKey} 房型。請告訴我入住日期（格式：YYYY-MM-DD）`;
        console.log(`✅ 成功設置房型: ${matchedKey}, 轉到日期步驟`);
        return { reply, step: session.step, sessionData: session.data };
      }
    }

    switch (session.step) {
      case 'welcome':
        if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'start_booking';
          reply = '🏨 **歡迎使用訂房服務！**\n\n請告訴我：\n• 入住人數 (幾位大人、小孩)\n• 小孩年齡 (如有)\n• 偏好房型\n\n例如："2大1小" 或 "想要家庭房，2大2小，小孩3歲和6歲"';
          break;
        }
        
        // 處理智能問答
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          break;
        }

        reply = '🤖 **我是飯店智能助理**\n\n我可以為您提供：\n🏨 訂房服務\n💰 價格查詢\n🎯 景點推薦\n🍽️ 餐廳推薦\n💎 會員服務\n\n請告訴我您需要什麼協助？';
        break;

      case 'start_booking':
        if (familyPattern.test(message)) {
          // 上面已經處理過家庭成員識別
          break;
        }
        
        const qaAnswerBooking = QAService.handleQuestion(message);
        if (qaAnswerBooking) {
          reply = qaAnswerBooking + '\n\n🏨 請告訴我入住人數，例如："2大1小" 或 "3大2小"';
        } else {
          reply = '請告訴我入住人數，例如："2大1小" 或 "3大2小，小孩年齡"';
        }
        break;

      case 'room':
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
          session.step = 'confirm';
          
          // 計算價格
          const priceResult = pricingService.calculateRoomPrice(
            session.data.roomType, 
            session.data.nights, 
            session.data.adults || 2,
            session.data.children || 0,
            session.data.childrenAges || []
          );
          session.data.totalPrice = priceResult.totalPrice;
          
          reply = `📋 **訂房摘要**：\n` +
                 `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
                 `• 入住: ${session.data.checkInDate}\n` +
                 `• 住宿: ${session.data.nights} 晚\n` +
                 `• 旅客: ${session.data.adults || 2}位大人${session.data.children ? `, ${session.data.children}位小孩` : ''}\n` +
                 `${session.data.childrenAges && session.data.childrenAges.length > 0 ? `• 小孩年齡: ${session.data.childrenAges.join('、')}歲\n` : ''}` +
                 `• 總價: ${session.data.totalPrice} TWD\n\n` +
                 `請回覆「確認」完成訂房，或「修改」重新選擇。`;
        } else {
          reply = '請輸入有效的住宿天數（1-30天）';
        }
        break;

      case 'confirm':
        if (/確認|是的|確定|ok|yes|完成訂房/.test(lowerMessage)) {
          const bookingId = 'BKG-' + Date.now();
          session.data.bookingId = bookingId;
          session.step = 'completed';
          reply = `🎉 **訂房成功！**\n\n` +
                  `📄 訂單編號: ${bookingId}\n` +
                  `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
                  `• 入住: ${session.data.checkInDate}\n` +
                  `• 住宿: ${session.data.nights} 晚\n` +
                  `• 旅客: ${session.data.adults || 2}位大人${session.data.children ? `, ${session.data.children}位小孩` : ''}\n` +
                  `• 總價: ${session.data.totalPrice} TWD\n\n` +
                  `感謝您的預訂！需要其他服務嗎？`;
        } else if (/取消|不要了|重新開始|修改/.test(lowerMessage)) {
          session.step = 'welcome';
          session.data = {};
          reply = '訂房已取消。請問需要什麼其他服務？';
        } else {
          const qaAnswerConfirm = QAService.handleQuestion(message, session.data);
          if (qaAnswerConfirm) {
            reply = qaAnswerConfirm + '\n\n📋 請回覆「確認」完成訂房，或「修改」重新選擇。';
          } else {
            reply = '請回覆「確認」完成訂房，或「修改」重新選擇。';
          }
        }
        break;

      default:
        session.step = 'welcome';
        reply = '🤖 **我是飯店智能助理**\n\n我可以為您提供各種服務，請問需要什麼協助？';
        break;
    }

    console.log(`💬 最終回應步驟: ${session.step}`);
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

    console.log('💬 收到消息:', message, 'sessionId:', sessionId);

    const session = getOrCreateSession(sessionId);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('📊 回應結果:', {
      sessionId,
      step: session.step,
      adults: session.data.adults,
      children: session.data.children,
      ages: session.data.childrenAges
    });

    res.json({
      success: true,
      reply: response.reply,
      sessionId: sessionId,
      nextStep: response.step,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 聊天服務錯誤:', error);
    res.status(500).json({
      error: '處理您的請求時出現錯誤',
      suggestion: '請稍後重試或聯繫客服'
    });
  }
});

// ==================== 其他路由 ====================
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy', 
    version: '6.0',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

router.get('/sessions', (req, res) => {
  res.json({
    activeSessions: sessions.size,
    sessions: Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      step: session.step,
      lastActive: session.lastActive
    }))
  });
});

// 會員查詢
router.get('/member/:level', (req, res) => {
  const level = req.params.level.toLowerCase();
  const member = memberData[level];
  
  if (member) {
    res.json({
      success: true,
      level: member.level,
      discount: member.discount,
      benefits: member.benefits
    });
  } else {
    res.status(404).json({
      success: false,
      error: '會員等級不存在'
    });
  }
});

module.exports = router;

// ==================== 獨立伺服器模式 ====================
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  const HOST = '0.0.0.0';
  
  app.use('/api', router);
  
  app.listen(PORT, HOST, () => {
    console.log(`🚀 獨立版飯店AI助理服務運行在 http://${HOST}:${PORT}`);
    console.log(`📞 API端點: http://${HOST}:${PORT}/api/chat`);
  });
}

echo "✅ 獨立版 chatRoutes.js 已創建！"

module.exports = router;

const express = require('express');
const router = express.Router();

// ==================== 智能問答服務 - 優化完整版 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // 精確匹配：附近景點（最高優先級）
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

    // ========== 原有邏輯（保持向後兼容） ==========
    
    // 團體訂房（放在精確匹配後面）
    if (/(\d+).*間|團體|多人|公司|企業|員工/.test(lowerMessage)) {
      const roomMatch = message.match(/(\d+).*間/);
      const roomCount = roomMatch ? parseInt(roomMatch[1]) : 10;
      
      let discountInfo = '';
      if (roomCount >= 3 && roomCount <= 5) discountInfo = '• 3-5間：房價95折\n';
      if (roomCount >= 6 && roomCount <= 10) discountInfo = '• 6-10間：房價9折 + 免費接駁\n';
      if (roomCount > 10) discountInfo = '• 11間以上：房價85折 + 免費會議室\n';
      
      return `🎉 企業團體訂房專屬優惠！\n\n` +
             `📊 ${roomCount}間房間優惠方案：\n` +
             discountInfo +
             `\n🏢 企業額外服務：\n` +
             `• 免費會議室使用（需預約）\n` +
             `• 24小時健身房免費使用\n` +
             `• 專屬接待服務\n` +
             `• 彈性付款方式\n` +
             `• 客製化住宿方案\n\n` +
             `💼 長期住宿加碼優惠：\n` +
             `• 住7-13晚：房價9折\n` +
             `• 住14-29晚：房價85折\n` +
             `• 住30晚以上：房價7折\n\n` +
             `是否需要為您開始團體訂房流程？`;
    }
    
    // 長住優惠
    if (/長住|長期|月租|住.*月|住.*週/.test(lowerMessage)) {
      const nightMatch = message.match(/(\d+).*晚/);
      const nights = nightMatch ? parseInt(nightMatch[1]) : 1;
      
      let longStayDiscount = '';
      if (nights >= 7 && nights <= 13) longStayDiscount = '• 住7-13晚：房價9折\n';
      if (nights >= 14 && nights <= 29) longStayDiscount = '• 住14-29晚：房價85折\n';
      if (nights >= 30) longStayDiscount = '• 住30晚以上：房價7折 + 免費洗衣服務\n';
      
      return `🏠 長住優惠資訊：\n\n` +
             `📅 住宿${nights}晚優惠：\n` +
             longStayDiscount +
             `\n🎁 長住額外服務：\n` +
             `• 每周房間清潔\n` +
             `• 免費mini bar補充\n` +
             `• 專屬長住客服\n\n` +
             `請選擇房型開始預訂！`;
    }
    
    // 價格相關問題
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價格資訊：\n` +
             `• 標準雙人房：2,200 TWD/晚\n` +
             `• 豪華雙人房：2,800 TWD/晚\n` +
             `• 套房：4,500 TWD/晚\n` +
             `• 以上價格已含服務費及稅金\n` +
             `• 會員可享額外折扣`;
    }
    
    // 兒童相關問題（改為fallback，精確匹配已處理）
    if ((/小孩|兒童|孩子|小朋友|加價|加床|嬰兒/.test(lowerMessage)) && 
        !/小孩.*收費|兒童.*價錢/.test(lowerMessage)) {
      return `👶 兒童政策：\n` +
             `• 6歲以下兒童：免費（不佔床）\n` +
             `• 6-12歲兒童：每人每晚加收 300 TWD\n` +
             `• 加嬰兒床：免費提供\n` +
             `• 加床服務：500 TWD/晚\n` +
             `• 家庭房：可容納 2大2小`;
    }
    
    // 老人優惠問題（改為fallback，精確匹配已處理）
    if ((/老人|長者|長輩|敬老/.test(lowerMessage)) && 
        !/老人.*優惠|長者.*折扣/.test(lowerMessage)) {
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
    
    // 設施問題（改為fallback，精確匹配已處理）
    if ((/設施|設備|游泳池|健身房|溫泉/.test(lowerMessage)) && 
        !/會議室|商務中心/.test(lowerMessage)) {
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
    
    return null;
  }

  // ========== 新增精確回應方法 ==========
  
  static getNearbyAttractions() {
    return `🏞️ 附近熱門景點推薦：\n\n🎯 步行5分鐘內：\n• 鼎泰豐信義店 (150m) - 米其林一星小籠包\n   ⏰ 10:00-21:00 | 💰 人均 500 TWD\n• 新光三越百貨 (100m) - 精品購物中心\n   ⏰ 11:00-21:30 | 🆓 免費入場\n\n🎯 步行10分鐘內：\n• 大安森林公園 (500m) - 都市綠洲\n   ⏰ 24小時 | 🆓 免費 | 🌳 露天音樂台、生態池\n• 永康街商圈 (800m) - 美食天堂\n   ⏰ 10:00-22:00 | 🍜 牛肉麵、芒果冰\n\n🎯 車程15分鐘內：\n• 台北101 (2km) - 地標觀景台\n   ⏰ 11:00-21:00 | 💰 觀景台 600 TWD\n• 國父紀念館 (1.5km) - 歷史文化\n   ⏰ 09:00-18:00 | 🆓 免費參觀\n\n🚗 交通建議：\n• 捷運：信義安和站步行3分鐘\n• 公車：多線路直達各景點\n• 計程車：24小時服務\n\n需要我為您規劃特定景點的行程路線嗎？`;
  }
  
  static getChildPricing() {
    return `👶 兒童收費詳細政策：\n\n📊 年齡分層收費：\n• 0-2歲嬰兒：完全免費（不佔床）\n• 3-5歲幼兒：免費（提供嬰兒床）\n• 6-11歲兒童：每晚 300 TWD\n• 12歲以上：視同成人收費\n\n🛏️ 加床服務：\n• 嬰兒床：免費提供\n• 兒童加床：500 TWD/晚\n• 家庭房：最多2大2小（12歲以下）\n\n🎁 兒童福利：\n• 免費兒童備品（牙刷、拖鞋）\n• 兒童遊樂區使用\n• 嬰兒澡盆借用\n• 兒童餐椅提供\n\n💡 範例計算：\n» 2大1小（8歲）住2晚：\n   - 房費：2,200 × 2 = 4,400 TWD\n   - 兒童加價：300 × 2 = 600 TWD\n   - 總計：5,000 TWD\n\n請告知小朋友的具體年齡和人數，為您精確計算費用。`;
  }
  
  static getSeniorDiscount() {
    return `👴 年長者專屬優惠：\n\n🎫 資格條件：\n• 65歲以上長者（需出示身份證明）\n• 本人及同行配偶皆可適用\n\n💰 優惠內容：\n• 房價直接9折優惠\n• 免費早餐2客（價值600 TWD）\n• 延遲退房至14:00\n• 免費使用健身房與游泳池\n\n🔗 疊加優惠：\n• 可與會員折扣同時使用\n• 團體訂房額外折扣\n• 長住方案再加碼\n\n🏥 貼心服務：\n• 一樓無障礙客房\n• 緊急呼叫按鈕\n• 血壓計免費借用\n• 輪椅租借服務\n\n💡 範例計算：\n» 標準雙人房原價2,200 TWD：\n   - 長者優惠：2,200 × 0.9 = 1,980 TWD\n   - 節省：220 TWD/晚\n   - 加上免費早餐：再省600 TWD\n\n請告知長者年齡、人數及住宿需求，為您計算最優價格。`;
  }
  
  static getBulkDiscount(message) {
    // 解析房間數和天數
    const roomMatch = message.match(/(\d+).*間/);
    const nightMatch = message.match(/(\d+).*晚/);
    const roomCount = roomMatch ? parseInt(roomMatch[1]) : 1;
    const nights = nightMatch ? parseInt(nightMatch[1]) : 1;
    
    // 計算優惠
    let roomDiscount = '';
    let roomBenefit = '';
    if (roomCount >= 21) {
      roomDiscount = '房價8折';
      roomBenefit = '專屬活動規劃';
    } else if (roomCount >= 11) {
      roomDiscount = '房價85折'; 
      roomBenefit = '免費歡迎點心';
    } else if (roomCount >= 6) {
      roomDiscount = '房價9折';
      roomBenefit = '免費會議室2小時';
    } else if (roomCount >= 3) {
      roomDiscount = '房價95折';
      roomBenefit = '免費接駁';
    } else {
      roomDiscount = '無額外優惠';
      roomBenefit = '標準服務';
    }
    
    let nightDiscount = '';
    let nightBenefit = '';
    if (nights >= 30) {
      nightDiscount = '房價7折';
      nightBenefit = '專屬管家服務';
    } else if (nights >= 14) {
      nightDiscount = '房價85折';
      nightBenefit = '每周房間清潔';
    } else if (nights >= 7) {
      nightDiscount = '房價9折';
      nightBenefit = '免費洗衣服務';
    } else {
      nightDiscount = '無額外優惠';
      nightBenefit = '標準服務';
    }
    
    return `🎉 ${roomCount}間房 × ${nights}晚 專屬優惠方案：\n\n🏨 房間數量優惠（${roomCount}間）：\n• ${roomDiscount}${roomBenefit ? ' + ' + roomBenefit : ''}\n\n📅 住宿天數優惠（${nights}晚）：\n• ${nightDiscount}${nightBenefit ? ' + ' + nightBenefit : ''}\n\n💼 企業客戶加碼：\n• 發票統編開立\n• 月結付款服務\n• 專屬客戶經理\n• 客製化合約\n\n🔢 組合優惠計算：\n» 標準雙人房原價 2,200 TWD/晚\n» 優惠後價格：約 ${Math.round(2200 * 0.9 * 0.85)}-${Math.round(2200 * 0.8 * 0.7)} TWD/晚\n» 總節省金額：可達 ${Math.round(2200 * roomCount * nights * 0.5)} TWD\n\n請提供具體的入住日期和詳細需求，為您製作正式報價單！`;
  }
  
  static getFacilityInfo() {
    return `🏊 酒店設施服務詳細資訊：\n\n💼 商務設施：\n• 會議室：可容納10-100人\n  ⏰ 08:00-22:00 | 💰 2000 TWD/小時（住宿客享5折優惠）\n• 商務中心：電腦、印表機、傳真\n  ⏰ 24小時 | 🆓 免費使用\n• 免費WiFi：全館覆蓋，高速網路\n\n🏋️ 休閒設施：\n• 健身房：專業器材、有氧區\n  ⏰ 24小時 | 🆓 免費 | 👟 運動鞋租借\n• 游泳池：室外溫水按摩池\n  ⏰ 07:00-22:00 | 🆓 免費 | 🏊 泳具租借\n• SPA溫泉：精油按摩、三溫暖\n  ⏰ 14:00-22:00 | 💰 1500 TWD/人（預約制）\n\n🍽️ 餐飲設施：\n• 自助早餐：06:30-10:00\n• 中式餐廳：11:30-21:00\n• 西式餐廳：11:30-22:00\n• 酒吧：18:00-01:00\n\n🎯 其他服務：\n• 行李寄存：24小時\n• 洗衣服務：當日可取\n• 旅遊諮詢：行程規劃\n• 租車服務：合作優惠\n\n需要預約任何設施或了解詳細收費嗎？`;
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

// ==================== 回應生成器 - 完全修復版 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    let reply = '';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    console.log(`🔍 [DEBUG] 當前步驟: ${session.step}, 訊息: "${message}"`);

    // 在所有階段都先檢查是否為房型選擇（最高優先級）
    if (/標準|豪華|套房/.test(lowerMessage)) {
      const roomMap = { '標準': 'standard', '豪華': 'deluxe', '套房': 'suite' };
      const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
      
      if (session.step === 'init' || session.step === 'room') {
        session.data.roomType = roomMap[matchedKey] || 'standard';
        session.step = 'date';
        reply = `🏨 您選擇的是 ${matchedKey} 房型。請告訴我入住日期（格式：YYYY-MM-DD）`;
        console.log(`✅ 直接進入房型選擇: ${matchedKey}`);
        return { reply, step: session.step, sessionData: session.data };
      }
    }

    switch (session.step) {
      case 'init':
        // 處理智能問答
        const qaAnswer = QAService.handleQuestion(message);
        if (qaAnswer) {
          reply = qaAnswer;
          break;
        }

        // 處理其他初始意圖
        if (/附近|周邊|景點|好玩|旅遊|觀光/.test(lowerMessage)) {
          reply = '🏞️ 附近推薦景點：\n' +
                  '• 鼎泰豐 (150m) - 知名小籠包\n' +
                  '• 新光三越 (100m) - 購物中心\n' +
                  '• 大安森林公園 (200m) - 自然景觀\n\n' +
                  '需要詳細資訊嗎？';
          break;
        }

        if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'room';
          reply = '🏨 歡迎使用 AI 訂房助理！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
          break;
        }

        // 默認回應
        reply = '您好！請問需要什麼服務？例如：訂房、查詢價格、取消訂單、會員服務、附近景點查詢等等。';
        break;

      case 'room':
        // 房型選擇階段的問答處理
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
          // 在日期輸入階段也允許問答
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
          // 在天數輸入階段也允許問答
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
          session.data.priceDetail = priceResult;
          
          reply = `👥 旅客數: ${guests} 位\n\n` +
                  `📋 訂房摘要：\n` +
                  `• 房型: ${this.getRoomTypeName(session.data.roomType)}\n` +
                  `• 入住: ${session.data.checkInDate}\n` +
                  `• 住宿: ${session.data.nights} 晚\n` +
                  `• 旅客: ${session.data.guestCount} 位\n` +
                  `• 總價: ${session.data.totalPrice} TWD\n\n` +
                  `請回覆「確認」完成訂房，或「取消」重新開始。`;
        } else {
          // 在旅客人數階段也允許問答
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
          
          reply = `🎉 訂房成功！\n\n` +
                  `📄 訂單編號: ${bookingId}\n` +
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
          // 在確認階段處理問答
          const qaAnswerConfirm = QAService.handleQuestion(message, session.data);
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

      case 'completed':
        // 訂房完成後的問答
        const qaAnswerCompleted = QAService.handleQuestion(message);
        if (qaAnswerCompleted) {
          reply = qaAnswerCompleted + '\n\n您的訂房已完成，還有其他需要協助的嗎？';
        } else if (/訂房|再訂|還要訂/.test(lowerMessage)) {
          session.step = 'room';
          session.data = {};
          reply = '🏨 歡迎再次訂房！請問需要哪種房型？（標準雙人房/豪華雙人房/套房）';
        } else {
          reply = '您的訂房已完成！還有其他需要協助的嗎？';
        }
        break;

      default:
        session.step = 'init';
        reply = '會話已重置。請問需要什麼服務？';
        break;
    }

    console.log(`💬 [DEBUG] 回應步驟: ${session.step}, 回應: ${reply.substring(0, 100)}...`);
    return {
      reply,
      step: session.step,
      sessionData: session.data
    };
  }

  // 輔助方法：獲取房型中文名稱
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

    const requirements = await RequirementDetector.detectAllRequirements(message);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('📊 Chat Request:', {
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
    console.error('❌ Chat service error:', error);
    res.status(500).json({
      error: '处理您的请求时出现错误',
      suggestion: '请稍后重试或联系客服'
    });
  }
});

// 健康檢查端點
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '4.2',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    features: [
      'smart_qa_service',
      'booking_workflow', 
      'family_travel_detection',
      'group_booking_detection',
      'long_stay_detection',
      'requirement_analysis',
      'session_management'
    ]
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

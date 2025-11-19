const express = require('express');
const router = express.Router();

console.log('🏨 加載完整版飯店AI助理 - 包含所有問題邏輯');

// ==================== 會員服務 ====================
class MemberService {
  static members = {
    'gold123': { level: '金卡', discount: 0.15, name: '王小明', points: 1250 },
    'silver456': { level: '銀卡', discount: 0.1, name: '李小姐', points: 800 },
    'platinum789': { level: '白金卡', discount: 0.2, name: '張先生', points: 2500 },
    'test001': { level: '銀卡', discount: 0.1, name: '測試用戶', points: 500 }
  };

  static validateMember(account) {
    return this.members[account] || null;
  }

  static getMemberBenefits(level) {
    const benefits = {
      '銀卡': ['房價9折優惠', '免費早餐x2', '延遲退房至14:00', '會員積分累積'],
      '金卡': ['房價85折優惠', '免費早餐x2', '延遲退房至15:00', '迎賓水果', '快速入住通道'],
      '白金卡': ['房價8折優惠', '免費早餐x4', '延遲退房至16:00', '房型升等機會', '專屬管家服務']
    };
    return benefits[level] || [];
  }

  static getPointsInfo() {
    return `🎫 **會員積分制度**\n\n` +
           `💰 積分累積：\n` +
           `• 每消費 100 TWD 累積 1 積分\n` +
           `• 首次入住贈送 500 積分\n` +
           `• 推薦朋友入住各得 200 積分\n\n` +
           `🎁 積分兌換：\n` +
           `• 1,000 積分 = 免費早餐券\n` +
           `• 5,000 積分 = 免費住宿一晚\n` +
           `• 10,000 積分 = 套房升等券`;
  }
}

// ==================== 日期處理服務 ====================
class DateService {
  static parseDate(input) {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // 處理 "下星期五" 等相對日期
    const relativeDate = this.parseRelativeDate(input);
    if (relativeDate) return relativeDate;
    
    // 處理 "12/23" 格式
    if (/\d{1,2}\/\d{1,2}/.test(input)) {
      const [month, day] = input.split('/').map(num => parseInt(num));
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
    
    // 處理 "2024-12-23" 格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    
    return null;
  }

  static parseRelativeDate(input) {
    const lowerInput = input.toLowerCase();
    const today = new Date();
    
    if (/下週五|下星期五|下周五/.test(lowerInput)) {
      const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
      today.setDate(today.getDate() + daysUntilFriday);
      return today.toISOString().split('T')[0];
    }
    
    if (/下週|下星期/.test(lowerInput)) {
      today.setDate(today.getDate() + 7);
      return today.toISOString().split('T')[0];
    }
    
    return null;
  }

  static isDateAvailable(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(date);
    return checkInDate >= today;
  }

  static formatDateDisplay(date) {
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

// ==================== 價格計算服務 ====================
class PricingService {
  static roomRates = {
    standard: { base: 2200, maxGuests: 2, name: '標準雙人房', description: '溫馨舒適，基本配備齊全' },
    deluxe: { base: 2800, maxGuests: 2, name: '豪華雙人房', description: '空間寬敞，景觀優美' },
    family: { base: 3800, maxGuests: 4, name: '家庭房', description: '專為家庭設計，兩張大床' },
    suite: { base: 4500, maxGuests: 4, name: '套房', description: '客廳臥室分離，豪華享受' }
  };

  static calculateRoomPrice(roomType, nights = 1, adults = 2, children = 0, member = null, roomCount = 1) {
    const room = this.roomRates[roomType] || this.roomRates.standard;
    let basePrice = room.base * nights * roomCount;
    
    // 團體折扣
    let groupDiscount = 0;
    if (roomCount >= 3) {
      groupDiscount = basePrice * 0.1; // 3間以上9折
    } else if (roomCount >= 5) {
      groupDiscount = basePrice * 0.15; // 5間以上85折
    }
    
    // 長住優惠
    let longStayDiscount = 0;
    if (nights >= 7) {
      longStayDiscount = basePrice * 0.1; // 住7晚以上9折
    } else if (nights >= 14) {
      longStayDiscount = basePrice * 0.15; // 住14晚以上85折
    } else if (nights >= 30) {
      longStayDiscount = basePrice * 0.2; // 住30晚以上8折
    }
    
    // 額外成人收費
    let extraFee = 0;
    const totalGuests = adults + children;
    if (totalGuests > room.maxGuests) {
      extraFee = (totalGuests - room.maxGuests) * 500 * nights * roomCount;
    }
    
    // 兒童收費 (6-12歲)
    const childFee = children * 300 * nights * roomCount;
    
    // 計算總價
    let totalPrice = basePrice + extraFee + childFee - groupDiscount - longStayDiscount;
    
    // 會員折扣
    let discountAmount = 0;
    if (member) {
      discountAmount = totalPrice * member.discount;
      totalPrice -= discountAmount;
    }
    
    return {
      totalPrice: Math.round(totalPrice),
      basePrice,
      extraFee,
      childFee,
      groupDiscount,
      longStayDiscount,
      discountAmount,
      currency: 'TWD',
      roomName: room.name
    };
  }

  static getRoomComparison() {
    return `🏨 **房型比較**\n\n` +
           `🛏️ **標準雙人房** (2,200 TWD/晚)\n` +
           `• 18平方公尺 • 1張大雙人床\n` +
           `• 基本衛浴 • 免費WiFi\n` +
           `• 適合商務旅客、情侶\n\n` +
           `🌟 **豪華雙人房** (2,800 TWD/晚)\n` +
           `• 25平方公尺 • 1張特大雙人床\n` +
           `• 乾濕分離衛浴 • 景觀窗\n` +
           `• 適合蜜月、紀念日\n\n` +
           `🏠 **家庭房** (3,800 TWD/晚)\n` +
           `• 32平方公尺 • 2張大雙人床\n` +
           `• 獨立兒童區 • 遊戲空間\n` +
           `• 適合2大2小家庭\n\n` +
           `💎 **套房** (4,500 TWD/晚)\n` +
           `• 45平方公尺 • 客廳+臥室分離\n` +
           `• 按摩浴缸 • 迷你吧台\n` +
           `• 適合重要場合、奢華體驗`;
  }
}

// ==================== 智能問答服務 - 增強版 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // ==================== 房型與價格相關 ====================
    if (/標準雙人房.*價格|價格.*標準雙人房/.test(lowerMessage)) {
      return `💰 **標準雙人房價格**\n\n` +
             `• 平日價格：2,200 TWD/晚\n` +
             `• 假日價格：2,500 TWD/晚\n` +
             `• 連續住宿優惠：住3晚以上享95折\n` +
             `• 會員另有專屬折扣`;
    }
    
    if (/豪華套房.*標準房.*差別|套房.*標準.*不同|房型.*比較/.test(lowerMessage)) {
      return PricingService.getRoomComparison();
    }
    
    if (/多訂.*間.*房.*折扣|團體.*訂房.*優惠|一次.*預訂.*折扣/.test(lowerMessage)) {
      return `🎉 **團體訂房優惠**\n\n` +
             `👥 人數優惠：\n` +
             `• 3-4間房：房價95折 + 免費接駁\n` +
             `• 5-9間房：房價9折 + 免費會議室2小時\n` +
             `• 10間以上：房價85折 + 專屬接待\n\n` +
             `💼 企業優惠：\n` +
             `• 長期合作另有企業協議價\n` +
             `• 可開立統一發票\n` +
             `• 彈性付款方式`;
    }
    
    if (/非吸煙房|禁煙房|無煙房|怎麼指定/.test(lowerMessage)) {
      return `🚭 **非吸煙房預訂**\n\n` +
             `✅ 所有客房均為非吸煙房\n` +
             `✅ 入住時可再次確認房型偏好\n` +
             `✅ 全館禁煙，設有指定吸煙區\n` +
             `✅ 如有特殊需求請提前告知`;
    }
    
    // ==================== 日期與住宿相關 ====================
    if (/下星期五.*訂房|下週五.*入住/.test(lowerMessage)) {
      const nextFriday = DateService.parseRelativeDate('下星期五');
      return `📅 **下星期五入住**\n\n` +
             `建議入住日期：${DateService.formatDateDisplay(nextFriday)}\n` +
             `✅ 目前仍有空房可供預訂\n` +
             `💡 建議儘早預訂以確保 availability\n` +
             `請告訴我入住人數和房型需求！`;
    }
    
    if (/住.*晚.*長住優惠|長期住宿.*優惠|長住.*折扣/.test(lowerMessage)) {
      return `🏠 **長期住宿優惠**\n\n` +
             `📅 優惠方案：\n` +
             `• 7-13晚：房價9折優惠\n` +
             `• 14-29晚：房價85折優惠\n` +
             `• 30晚以上：房價8折優惠\n\n` +
             `🎁 額外服務：\n` +
             `• 免費每週客房清潔\n` +
             `• 免費mini bar補充\n` +
             `• 專屬管家服務\n\n` +
             `💼 商務長住另有企業方案`;
    }
    
    if (/延長住宿|續住|多住.*晚/.test(lowerMessage)) {
      return `🔄 **延長住宿**\n\n` +
             `✅ 可直接向櫃檯辦理續住\n` +
             `✅ 建議提前1天告知以便安排\n` +
             `✅ 續住享受相同優惠價格\n` +
             `✅ 如遇滿房將協助安排其他方案\n\n` +
             `💡 也可透過客服專線預先延長`;
    }
    
    if (/退房時間|晚退房|延遲退房/.test(lowerMessage)) {
      return `⏰ **退房相關資訊**\n\n` +
             `🕛 標準退房時間：中午12:00前\n\n` +
             `🕐 延遲退房服務：\n` +
             `• 延至13:00：免費（視房況）\n` +
             `• 延至14:00：300 TWD\n` +
             `• 延至15:00：500 TWD\n` +
             `• 延至16:00：800 TWD\n\n` +
             `💎 會員享有免費延遲退房權益`;
    }
    
    if (/修改訂單|更改日期|入住日期改變/.test(lowerMessage)) {
      return `📝 **訂單修改**\n\n` +
             `🔄 修改方式：\n` +
             `• 官網：登入會員中心修改\n` +
             `• APP：我的訂單中修改\n` +
             `• 電話：客服專線\n` +
             `• 郵件：客服信箱\n\n` +
             `📅 修改規則：\n` +
             `• 入住前3天：免費修改\n` +
             `• 入住前1天：可能產生差價\n` +
             `• 當天修改：視房況安排`;
    }
    
    // ==================== 會員與優惠相關 ====================
    if (/會員.*專屬優惠|會員.*有什麼好處/.test(lowerMessage)) {
      return `💎 **會員專屬優惠**\n\n` +
             `🎫 銀卡會員：\n` +
             `• 房價9折優惠\n` +
             `• 免費早餐x2\n` +
             `• 延遲退房至14:00\n\n` +
             `🎫 金卡會員：\n` +
             `• 房價85折優惠\n` +
             `• 免費早餐x2\n` +
             `• 延遲退房至15:00\n` +
             `• 迎賓水果\n\n` +
             `🎫 白金會員：\n` +
             `• 房價8折優惠\n` +
             `• 免費早餐x4\n` +
             `• 延遲退房至16:00\n` +
             `• 房型升等機會`;
    }
    
    if (/會員積分|積分累積|折抵房費/.test(lowerMessage)) {
      return MemberService.getPointsInfo();
    }
    
    if (/長期住宿.*會員|商務套餐.*會員/.test(lowerMessage)) {
      return `💼 **商務會員方案**\n\n` +
             `🏢 企業會員：\n` +
             `• 房價75折起優惠\n` +
             `• 免費會議室使用\n` +
             `• 月結付款服務\n` +
             `• 專屬客戶經理\n\n` +
             `📊 長住商務套餐：\n` +
             `• 30晚以上享特別協議價\n` +
             `• 免費洗衣服務\n` +
             `• 行政酒廊使用權\n` +
             `• 機場接送服務`;
    }
    
    if (/新會員.*加入.*優惠|什麼時候.*享有優惠/.test(lowerMessage)) {
      return `🎁 **新會員優惠**\n\n` +
             `✨ 立即享受：\n` +
             `• 首次入住即享會員折扣\n` +
             `• 贈送500歡迎積分\n` +
             `• 專屬新會員禮包\n\n` +
             `🚀 升級福利：\n` +
             `• 年度消費滿5萬升級金卡\n` +
             `• 年度消費滿10萬升級白金卡\n` +
             `• 推薦朋友各得200積分`;
    }
    
    // ==================== 訂單與付款相關 ====================
    if (/信用卡付款|分期服務|付款方式/.test(lowerMessage)) {
      return `💳 **付款方式**\n\n` +
             `✅ 接受信用卡：\n` +
             `• VISA / MasterCard / JCB\n` +
             `• American Express\n` +
             `• UnionPay 銀聯卡\n\n` +
             `📊 分期服務：\n` +
             `• 3期0利率（限特定銀行）\n` +
             `• 6期0利率（限特定方案）\n\n` +
             `🏦 其他方式：\n` +
             `• 現金付款\n` +
             `• 銀行轉帳\n` +
             `• 行動支付`;
    }
    
    if (/訂金|預付款|匯款|刷卡/.test(lowerMessage)) {
      return `💰 **訂金政策**\n\n` +
             `📌 訂金要求：\n` +
             `• 一般訂房：免付訂金\n` +
             `• 旺季/特殊日期：首晚房費\n` +
             `• 團體訂房：總額30%\n\n` +
             `💸 付款方式：\n` +
             `• 信用卡預授權\n` +
             `• 銀行匯款\n` +
             `• 線上支付\n\n` +
             `🔄 退款保證：\n` +
             `• 依取消政策全額退款`;
    }
    
    if (/取消訂房|變更訂房|手續費/.test(lowerMessage)) {
      return `📝 **取消與變更政策**\n\n` +
             `🆓 免費取消：\n` +
             `• 入住前3天：全額退款\n` +
             `• 入住前1天：退款80%\n\n` +
             `💸 部分費用：\n` +
             `• 當天取消：退款50%\n` +
             `• No Show：收取首晚房費\n\n` +
             `🔧 免費變更：\n` +
             `• 日期、房型、人數變更\n` +
             `• 視房況安排，免手續費`;
    }
    
    // ==================== 設施與服務相關 ====================
    if (/Wi-Fi|網路|信號/.test(lowerMessage)) {
      return `📶 **Wi-Fi 服務**\n\n` +
             `✅ 全館免費Wi-Fi覆蓋\n` +
             `🚀 網路速度：100Mbps光纖\n` +
             `📱 連線方式：\n` +
             `• 選擇 HOTEL_GUEST\n` +
             `• 輸入房號+姓氏\n` +
             `• 無限裝置連接\n\n` +
             `💻 商務中心：\n` +
             `• 24小時開放\n` +
             `• 免費電腦使用\n` +
             `• 列印服務`;
    }
    
    if (/嬰兒床|加床服務|提前申請/.test(lowerMessage)) {
      return `👶 **嬰兒與加床服務**\n\n` +
             `🛏️ 嬰兒床：\n` +
             `• 免費提供\n` +
             `• 需提前預約\n` +
             `• 適合0-2歲嬰兒\n\n` +
             `➕ 加床服務：\n` +
             `• 費用：500 TWD/晚\n` +
             `• 適合成人或較大兒童\n` +
             `• 視房型空間安排\n\n` +
             `📞 預約方式：\n` +
             `• 訂房時備註\n` +
             `• 入住前3天確認`;
    }
    
    if (/吹風機|保險箱|設備|設施/.test(lowerMessage)) {
      return `🏠 **客房設備**\n\n` +
             `🔌 基本配備：\n` +
             `• 國際電壓吹風機\n` +
             `• 電子保險箱\n` +
             `• 43吋液晶電視\n` +
             `• 迷你冰箱\n\n` +
             `🍵 衛浴設備：\n` +
             `• 乾濕分離淋浴間\n` +
             `• 高級沐浴備品\n` +
             `• 浴巾/毛巾\n` +
             `• 體重計\n\n` +
             `☕ 其他：\n` +
             `• 電熱水壺\n` +
             `• 茶包/咖啡\n` +
             `• 免費瓶裝水`;
    }
    
    if (/停車位|接送服務|交通/.test(lowerMessage)) {
      return `🅿️ **停車與交通**\n\n` +
             `🚗 停車服務：\n` +
             `• 免費地下停車場\n` +
             `• 先到先得\n` +
             `• 電動車充電站\n\n` +
             `🚐 接送服務：\n` +
             `• 機場接送：600 TWD/單程\n` +
             `• 高鐵站接送：免費\n` +
             `• 市區定點接送：免費\n\n` +
             `📞 預約方式：\n` +
             `• 入住前1天預約\n` +
             `• 櫃檯現場安排`;
    }
    
    // ==================== 價格查詢 ====================
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 **價格資訊**\n\n` +
             `🛏️ 標準雙人房：2,200 TWD/晚\n` +
             `🌟 豪華雙人房：2,800 TWD/晚\n` +
             `🏠 家庭房：3,800 TWD/晚\n` +
             `💎 套房：4,500 TWD/晚\n\n` +
             `🎫 會員另有專屬折扣\n` +
             `🏠 長住享有額外優惠\n` +
             `👥 團體訂房更多優惠`;
    }
    
    return null;
  }
}

// ==================== 會話管理 ====================
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {
        adults: 2,
        children: 0,
        childrenAges: [],
        roomCount: 1
      },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    });
  }
  const session = sessions.get(sessionId);
  session.lastActive = new Date().toISOString();
  return session;
}

// ==================== 回應生成器 - 完整版 ====================
class ResponseGenerator {
  static generateResponse(message, session) {
    const lowerMessage = message.toLowerCase();
    let reply = '';

    console.log(`🔍 步驟: ${session.step}, 訊息: "${message}"`);

    // 🚀 意圖識別：重置對話
    if (/重新開始|重置|重來|再來一次/.test(lowerMessage)) {
      session.step = 'welcome';
      session.data = { adults: 2, children: 0, childrenAges: [], roomCount: 1 };
      return {
        reply: '🔄 對話已重置！請問需要什麼服務？',
        step: 'welcome',
        sessionData: session.data
      };
    }

    // 🚀 意圖識別：幫助
    if (/幫助|幫忙|怎麼用|如何使用/.test(lowerMessage)) {
      return {
        reply: this.getHelpMessage(session.step),
        step: session.step,
        sessionData: session.data
      };
    }

    // 🚀 智能處理：會員驗證
    if ((/會員|帳號/.test(lowerMessage) && /[a-zA-Z0-9]/.test(message)) || 
        Object.keys(MemberService.members).includes(message.trim())) {
      const member = MemberService.validateMember(message.trim());
      if (member) {
        session.data.member = member;
        const benefits = MemberService.getMemberBenefits(member.level);
        return {
          reply: `✅ **會員驗證成功！**\n\n` +
                 `👋 ${member.name} 您好！${member.level}會員\n` +
                 `📊 當前積分：${member.points}點\n\n` +
                 `🎁 **專屬權益**：\n${benefits.map(b => `• ${b}`).join('\n')}\n\n` +
                 `請問需要什麼服務？`,
          step: session.step,
          sessionData: session.data
        };
      } else {
        return {
          reply: `❌ **會員帳號未找到**\n\n` +
                 `請確認帳號是否正確，或聯繫客服協助。\n` +
                 `💡 試用帳號：gold123, silver456, platinum789`,
          step: session.step,
          sessionData: session.data
        };
      }
    }

    // 🚀 智能處理：日期識別
    const parsedDate = DateService.parseDate(message);
    if (parsedDate) {
      if (DateService.isDateAvailable(parsedDate)) {
        session.data.checkInDate = parsedDate;
        if (session.step === 'welcome' || session.step === 'start_booking') {
          session.step = 'guests';
          return {
            reply: `📅 **${DateService.formatDateDisplay(parsedDate)} 有可用房間！**\n\n請問有幾位旅客？`,
            step: 'guests',
            sessionData: session.data
          };
        } else if (session.step === 'date') {
          session.step = 'nights';
          return {
            reply: `📅 **${DateService.formatDateDisplay(parsedDate)} 有可用房間！**\n\n請問要入住幾晚？`,
            step: 'nights',
            sessionData: session.data
          };
        }
      } else {
        return {
          reply: `❌ **${DateService.formatDateDisplay(parsedDate)} 已客滿或日期無效**\n\n請選擇其他日期。`,
          step: session.step,
          sessionData: session.data
        };
      }
    }

    // 🚀 智能處理：問答系統
    const qaAnswer = QAService.handleQuestion(message, session.data);
    if (qaAnswer) {
      return {
        reply: qaAnswer,
        step: session.step,
        sessionData: session.data
      };
    }

    // 🚀 智能處理：家庭成員識別
    const guestInfo = this.extractGuestInfo(message);
    if (guestInfo.found && (session.step === 'welcome' || session.step === 'start_booking' || session.step === 'guests')) {
      Object.assign(session.data, guestInfo);
      session.step = 'room';
      const roomRec = this.getRoomRecommendation(guestInfo.adults, guestInfo.children);
      return {
        reply: `👨‍👩‍👧‍👦 **已記錄：${guestInfo.adults}位大人${guestInfo.children > 0 ? `, ${guestInfo.children}位小朋友` : ''}**\n\n` +
               `🏨 **適合的房型推薦**\n\n${roomRec}\n\n請選擇您喜歡的房型：`,
        step: 'room',
        sessionData: session.data
      };
    }

    // 主要對話狀態機
    switch (session.step) {
      case 'welcome':
        if (/訂房|預訂|預定/.test(lowerMessage)) {
          session.step = 'start_booking';
          reply = '🏨 **歡迎使用訂房服務！**\n\n請告訴我您的需求，或直接詢問任何問題！';
        } else {
          reply = '🤖 **我是飯店智能助理**\n\n我可以為您提供：\n🏨 訂房服務 • 💰 價格查詢\n🎯 景點推薦 • 💎 會員服務\n🍽️ 餐廳推薦 • 🏊 設施預約\n\n請告訴我您需要什麼協助？';
        }
        break;

      case 'start_booking':
        reply = '請告訴我入住需求，例如："12/23 2大1小" 或直接詢問任何問題！';
        break;

      case 'guests':
        reply = '請告訴我入住人數，例如："3位大人" 或 "2大1小"';
        break;

      case 'room':
        if (/標準|豪華|套房|家庭/.test(lowerMessage)) {
          const roomMap = { 
            '標準': 'standard', 
            '豪華': 'deluxe', 
            '套房': 'suite',
            '家庭': 'family'
          };
          const matchedKey = Object.keys(roomMap).find(k => lowerMessage.includes(k));
          session.data.roomType = roomMap[matchedKey] || 'standard';
          session.step = 'date';
          reply = `🏨 **您選擇的是 ${matchedKey}房型**\n\n請告訴我入住日期 (如：12/23)`;
        } else {
          reply = '請選擇房型：標準雙人房、豪華雙人房、家庭房或套房';
        }
        break;

      case 'date':
        reply = '請告訴我入住日期，例如：12/23 或 下星期五';
        break;

      case 'nights':
        const nights = parseInt(message);
        if (nights > 0 && nights <= 30) {
          session.data.nights = nights;
          session.step = 'confirm';
          
          const priceResult = PricingService.calculateRoomPrice(
            session.data.roomType, 
            session.data.nights, 
            session.data.adults,
            session.data.children,
            session.data.member,
            session.data.roomCount
          );
          
          Object.assign(session.data, priceResult);
          reply = this.generateBookingSummary(session.data);
        } else {
          reply = '請輸入有效的住宿天數（1-30天）';
        }
        break;

      case 'confirm':
        if (/確認|是的|確定/.test(lowerMessage)) {
          const bookingId = 'BKG-' + Date.now().toString().slice(-8);
          session.data.bookingId = bookingId;
          session.step = 'completed';
          reply = `🎉 **訂房成功！**\n\n` +
                 `📄 訂單編號：${bookingId}\n` +
                 this.generateBookingSummary(session.data, false) +
                 `\n📍 **入住提醒**\n` +
                 `• 辦理入住：15:00後\n` +
                 `• 退房時間：12:00前\n` +
                 `• 需出示身份證明文件\n\n` +
                 `感謝您的預訂！`;
        } else if (/修改|重新/.test(lowerMessage)) {
          session.step = 'guests';
          session.data = { adults: 2, children: 0, childrenAges: [], roomCount: 1 };
          reply = '好的，讓我們重新開始。請問有幾位旅客？';
        } else {
          reply = this.generateBookingSummary(session.data) + '\n\n請回覆「確認」完成訂房';
        }
        break;

      case 'completed':
        session.step = 'welcome';
        session.data = { adults: 2, children: 0, childrenAges: [], roomCount: 1 };
        reply = '✅ **訂房已完成！**\n\n還需要為您提供其他服務嗎？';
        break;

      default:
        session.step = 'welcome';
        reply = '請問需要什麼服務？';
        break;
    }

    return { reply, step: session.step, sessionData: session.data };
  }

  // 家庭成員識別
  static extractGuestInfo(message) {
    const lowerMessage = message.toLowerCase();
    
    // 多種模式匹配
    const patterns = [
      /(\d+)[位個]?大?人.*?(\d+)[位個]?小?孩?/,
      /(\d+)大.*?(\d+)小/,
      /(\d+)[位個]?大?人/,
      /(\d+)大/
    ];
    
    for (const pattern of patterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        let adults = parseInt(match[1]) || 2;
        let children = match[2] ? parseInt(match[2]) || 0 : 0;
        
        return { found: true, adults, children, childrenAges: [] };
      }
    }
    
    return { found: false, adults: 2, children: 0, childrenAges: [] };
  }

  // 房型推薦
  static getRoomRecommendation(adults, children) {
    const totalGuests = adults + children;
    
    if (totalGuests <= 2) {
      return `🛏️ **標準雙人房**\n• 適合1-2人 • 2,200 TWD/晚\n\n` +
             `🌟 **豪華雙人房**\n• 更大空間 • 2,800 TWD/晚`;
    } 
    else if (totalGuests === 3) {
      return `🏠 **家庭房**\n• 專為3人設計 • 3,800 TWD/晚\n\n` +
             `🌟 **豪華雙人房**\n• 可加床 • 2,800 TWD/晚+500`;
    }
    else if (totalGuests >= 4) {
      return `🏠 **家庭房**\n• 適合家庭 • 3,800 TWD/晚\n\n` +
             `💎 **套房**\n• 最舒適選擇 • 4,500 TWD/晚`;
    }
  }

  // 生成訂單摘要
  static generateBookingSummary(data, showConfirmation = true) {
    const roomName = PricingService.roomRates[data.roomType]?.name || data.roomType;
    const dateDisplay = data.checkInDate ? DateService.formatDateDisplay(data.checkInDate) : '待確認';
    
    let summary = `📋 **訂單摘要**\n\n` +
                 `🏨 房型：${roomName}\n` +
                 `📅 入住：${dateDisplay}\n` +
                 `⏱️ 天數：${data.nights}晚\n` +
                 `👥 人數：${data.adults}位大人${data.children > 0 ? `, ${data.children}位小朋友` : ''}\n` +
                 `💰 總金額：NT$${data.totalPrice.toLocaleString()}`;
    
    if (showConfirmation) {
      summary += `\n\n請確認以上資訊是否正確？`;
    }
    
    return summary;
  }

  // 幫助訊息
  static getHelpMessage(step) {
    return `💡 **需要幫助嗎？**\n\n` +
           `• 說 "價格" 查詢房價\n` +
           `• 說 "會員" 了解優惠\n` +
           `• 說 "設施" 查看設備\n` +
           `• 說 "重新開始" 重置對話\n` +
           `• 或直接告訴我您的需求！`;
  }
}

// ==================== 路由處理 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '訊息內容不能為空'
      });
    }

    const session = getOrCreateSession(sessionId);
    const response = ResponseGenerator.generateResponse(message, session);

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
      success: false,
      error: '處理您的請求時出現錯誤',
      suggestion: '請稍後重試'
    });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Hotel AI Assistant',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

module.exports = router;


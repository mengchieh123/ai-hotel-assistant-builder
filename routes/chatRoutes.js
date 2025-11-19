const express = require('express');
const router = express.Router();

console.log('🚀 加載完整版飯店AI助理服務');

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
      '銀卡': ['房價9折', '免費早餐x2', '延遲退房至14:00'],
      '金卡': ['房價85折', '免費早餐x2', '延遲退房至15:00', '迎賓水果'],
      '白金卡': ['房價8折', '免費早餐x4', '延遲退房至16:00', '房型升等', '專屬管家']
    };
    return benefits[level] || [];
  }
}

// ==================== 日期處理服務 ====================
class DateService {
  static parseDate(input) {
    const today = new Date();
    const currentYear = today.getFullYear();
    
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
    
    // 處理 "12-23" 格式
    if (/\d{1,2}-\d{1,2}/.test(input)) {
      const [month, day] = input.split('-').map(num => parseInt(num));
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
    
    return null;
  }

  static isDateAvailable(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(date);
    
    // 簡單的日期可用性檢查（實際應該查詢資料庫）
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
    standard: { base: 2200, maxGuests: 2, name: '標準雙人房' },
    deluxe: { base: 2800, maxGuests: 2, name: '豪華雙人房' },
    family: { base: 3800, maxGuests: 4, name: '家庭房' },
    suite: { base: 4500, maxGuests: 4, name: '套房' }
  };

  static calculateRoomPrice(roomType, nights = 1, adults = 2, children = 0, member = null) {
    const room = this.roomRates[roomType] || this.roomRates.standard;
    let basePrice = room.base * nights;
    
    // 額外成人收費
    let extraFee = 0;
    const totalGuests = adults + children;
    if (totalGuests > room.maxGuests) {
      extraFee = (totalGuests - room.maxGuests) * 500 * nights;
    }
    
    // 兒童收費 (6-12歲)
    const childFee = children * 300 * nights;
    
    // 計算總價
    let totalPrice = basePrice + extraFee + childFee;
    
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
      discountAmount,
      currency: 'TWD',
      roomName: room.name
    };
  }

  static getRoomCapacity(roomType) {
    const room = this.roomRates[roomType] || this.roomRates.standard;
    return room.maxGuests;
  }
}

// ==================== 智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // 精確匹配：附近景點
    if (/附近.*景點|周邊.*推薦|有什麼.*好玩|旅遊.*地點|觀光.*推薦|推薦.*景點/.test(lowerMessage)) {
      return this.getNearbyAttractions();
    }
    
    // 精確匹配：兒童收費
    if (/小孩.*收費|兒童.*價錢|幾歲.*免費|小朋友.*要錢|孩子.*年齡|嬰兒.*收費/.test(lowerMessage)) {
      return this.getChildPricing();
    }
    
    // 精確匹配：年長者優惠  
    if (/老人.*優惠|長者.*折扣|敬老|65歲|銀髮族|年長者/.test(lowerMessage)) {
      return this.getSeniorDiscount();
    }
    
    // 精確匹配：設施服務
    if (/會議室|健身房|游泳池|設施.*設備|商務中心|溫泉|SPA/.test(lowerMessage)) {
      return this.getFacilityInfo();
    }

    // 價格查詢
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 **價格資訊**\n\n` +
             `🛏️ 標準雙人房：2,200 TWD/晚\n` +
             `🌟 豪華雙人房：2,800 TWD/晚\n` +
             `🏠 家庭房：3,800 TWD/晚\n` +
             `💎 套房：4,500 TWD/晚\n\n` +
             `*以上價格已含服務費及稅金\n*會員可享額外折扣`;
    }
    
    // 兒童政策
    if (/小孩|兒童|孩子|小朋友|加價|加床|嬰兒/.test(lowerMessage)) {
      return `👶 **兒童政策**\n\n` +
             `• 0-5歲幼兒：完全免費\n` +
             `• 6-12歲兒童：每晚 300 TWD\n` +
             `• 13歲以上：視同成人\n` +
             `• 加嬰兒床：免費提供\n` +
             `• 加床服務：500 TWD/晚`;
    }
    
    // 會員制度
    if (/會員|會員卡|會員資格|積分/.test(lowerMessage)) {
      return `🎫 **會員制度**\n\n` +
             `🔹 銀卡會員：房價9折 + 免費早餐\n` +
             `🔸 金卡會員：房價85折 + 延遲退房\n` +
             `💎 白金會員：房價8折 + 專屬管家\n\n` +
             `消費累積積分，可兌換免費住宿！`;
    }
    
    // 早餐資訊
    if (/早餐|餐點|用餐|吃飯/.test(lowerMessage)) {
      return `🍽️ **早餐資訊**\n\n` +
             `• 供應時間：06:30-10:00\n` +
             `• 成人：300 TWD/位\n` +
             `• 兒童：150 TWD/位\n` +
             `• 金卡以上會員：免費享用`;
    }
    
    // 停車資訊
    if (/停車|車位|泊車/.test(lowerMessage)) {
      return `🅿️ **停車資訊**\n\n` +
             `• 免費地下停車場\n` +
             `• 先到先得\n` +
             `• 電動車充電站\n` +
             `• 代客泊車服務`;
    }
    
    // 取消政策
    if (/取消|退訂|退款|退房/.test(lowerMessage)) {
      return `📝 **取消政策**\n\n` +
             `• 入住前3天：全額退款\n` +
             `• 入住前1天：退款80%\n` +
             `• 當天取消：退款50%\n` +
             `• 不可抗力因素：特殊處理`;
    }
    
    return null;
  }

  static getNearbyAttractions() {
    return `🏞️ **附近熱門景點**\n\n` +
           `🎯 步行5分鐘內：\n` +
           `• 鼎泰豐信義店 (150m) - 米其林一星小籠包\n` +
           `• 新光三越百貨 (100m) - 精品購物中心\n\n` +
           `🎯 步行10分鐘內：\n` +
           `• 大安森林公園 (500m) - 都市綠洲\n` +
           `• 永康街商圈 (800m) - 美食天堂\n\n` +
           `需要詳細資訊或交通建議嗎？`;
  }
  
  static getChildPricing() {
    return `👶 **兒童收費詳細政策**\n\n` +
           `📊 年齡分層收費：\n` +
           `• 0-5歲幼兒：完全免費\n` +
           `• 6-12歲兒童：每晚 300 TWD\n` +
           `• 13歲以上：視同成人收費\n\n` +
           `請告知小朋友的具體年齡和人數。`;
  }
  
  static getSeniorDiscount() {
    return `👴 **年長者專屬優惠**\n\n` +
           `🎫 資格條件：\n` +
           `• 65歲以上長者\n` +
           `• 需出示身份證明\n\n` +
           `💰 優惠內容：\n` +
           `• 房價直接9折優惠\n` +
           `• 免費早餐2客\n` +
           `• 延遲退房至14:00\n\n` +
           `請告知長者年齡及住宿需求。`;
  }
  
  static getFacilityInfo() {
    return `🏊 **酒店設施服務**\n\n` +
           `💼 商務設施：\n` +
           `• 會議室：可容納10-100人\n` +
           `• 商務中心：24小時免費使用\n\n` +
           `🏋️ 休閒設施：\n` +
           `• 健身房：24小時開放\n` +
           `• 游泳池：07:00-22:00\n` +
           `• SPA溫泉：需預約\n\n` +
           `需要預約任何設施嗎？`;
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
        childrenAges: []
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
    if (/重新開始|重置|重來|再來一次|從頭開始/.test(lowerMessage)) {
      session.step = 'welcome';
      session.data = { adults: 2, children: 0, childrenAges: [] };
      return {
        reply: '🔄 對話已重置！請問需要什麼服務？',
        step: 'welcome',
        sessionData: session.data
      };
    }

    // 🚀 意圖識別：幫助
    if (/幫助|幫忙|怎麼用|如何使用|功能|說明/.test(lowerMessage)) {
      return {
        reply: this.getHelpMessage(session.step),
        step: session.step,
        sessionData: session.data
      };
    }

    // 🚀 智能處理：會員驗證
    if ((/會員|帳號|account|member/.test(lowerMessage) && /[a-zA-Z0-9]/.test(message)) || 
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
                 `您也可以繼續以一般旅客身份訂房。\n\n` +
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
            reply: `📅 **${DateService.formatDateDisplay(parsedDate)} 有可用房間！**\n\n請問有幾位旅客？\n例如："2位大人" 或 "2大1小"`,
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

    // 🚀 智能處理：家庭成員識別
    const guestInfo = this.extractGuestInfo(message);
    if (guestInfo.found && (session.step === 'welcome' || session.step === 'start_booking' || session.step === 'guests')) {
      session.data.adults = guestInfo.adults;
      session.data.children = guestInfo.children;
      session.data.childrenAges = guestInfo.ages;
      
      console.log(`✅ 識別人數: ${guestInfo.adults}大人, ${guestInfo.children}小孩`);
      
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
        if (/訂房|預訂|預定|訂房間|我要訂|想訂/.test(lowerMessage)) {
          session.step = 'start_booking';
          reply = '🏨 **歡迎使用訂房服務！**\n\n請告訴我：\n• 入住日期 (如：12/23)\n• 入住人數 (如：2大1小)\n• 偏好房型\n\n或直接告訴我您的需求！';
        } else {
          const qaAnswer = QAService.handleQuestion(message);
          if (qaAnswer) {
            reply = qaAnswer;
          } else {
            reply = '🤖 **我是飯店智能助理**\n\n我可以為您提供：\n🏨 訂房服務 • 💰 價格查詢\n🎯 景點推薦 • 💎 會員服務\n🍽️ 餐廳推薦 • 🏊 設施預約\n\n請告訴我您需要什麼協助？';
          }
        }
        break;

      case 'start_booking':
        reply = '請告訴我入住日期和人數，例如："12/23 2大1小" 或直接說 "3位大人"';
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
          reply = `🏨 **您選擇的是 ${matchedKey}房型**\n\n請告訴我入住日期 (如：12/23 或 2024-12-25)`;
        } else {
          const roomRec = this.getRoomRecommendation(session.data.adults, session.data.children);
          reply = `🏨 **適合的房型推薦**\n\n${roomRec}\n\n請選擇房型：標準雙人房、豪華雙人房、家庭房或套房`;
        }
        break;

      case 'date':
        reply = '請告訴我入住日期，例如：12/23 或 2024-12-25';
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
            session.data.member
          );
          
          Object.assign(session.data, priceResult);
          reply = this.generateBookingSummary(session.data);
        } else {
          reply = '請輸入有效的住宿天數（1-30天）';
        }
        break;

      case 'confirm':
        if (/確認|是的|確定|ok|yes|完成訂房/.test(lowerMessage)) {
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
                 `感謝您的預訂，期待為您服務！`;
        } else if (/修改|重新|更改/.test(lowerMessage)) {
          session.step = 'guests';
          session.data = { adults: 2, children: 0, childrenAges: [] };
          reply = '好的，讓我們重新開始。請問有幾位旅客？';
        } else {
          reply = this.generateBookingSummary(session.data) + '\n\n請回覆「確認」完成訂房，或「修改」重新選擇。';
        }
        break;

      case 'completed':
        session.step = 'welcome';
        session.data = { adults: 2, children: 0, childrenAges: [] };
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
      /([零一二兩三四五六七八九十])位?大?人.*?([零一二兩三四五六七八九十])位?小?孩?/,
      /(\d+)[位個]?大?人/,
      /(\d+)大/,
      /([零一二兩三四五六七八九十])位?大?人/
    ];
    
    for (const pattern of patterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const chineseNumbers = { 
          '零':0, '一':1, '二':2, '兩':2, '三':3, '四':4, '五':5, 
          '六':6, '七':7, '八':8, '九':9, '十':10 
        };
        
        let adults = chineseNumbers[match[1]] || parseInt(match[1]) || 2;
        let children = match[2] ? (chineseNumbers[match[2]] || parseInt(match[2]) || 0) : 0;
        
        // 提取年齡
        const agePattern = /(\d+)[歲年]/g;
        const ages = [];
        let ageMatch;
        while ((ageMatch = agePattern.exec(message)) !== null) {
          ages.push(parseInt(ageMatch[1]));
        }
        
        return { found: true, adults, children, ages };
      }
    }
    
    // 純數字處理
    const onlyNumber = lowerMessage.match(/^\d+$/);
    if (onlyNumber) {
      const num = parseInt(onlyNumber[0]);
      if (num > 0 && num <= 10) {
        return { found: true, adults: num, children: 0, ages: [] };
      }
    }
    
    return { found: false, adults: 2, children: 0, ages: [] };
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
    else if (totalGuests === 4) {
      return `🏠 **家庭房**\n• 2大2小首選 • 3,800 TWD/晚\n\n` +
             `💎 **套房**\n• 最舒適選擇 • 4,500 TWD/晚`;
    }
    else {
      return `💎 **套房**\n• 適合${totalGuests}人 • 4,500 TWD/晚\n\n` +
             `🔹 **建議**：預訂多間房間享受團體優惠`;
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
                 `💰 基礎價格：NT$${data.basePrice?.toLocaleString()}\n`;
    
    if (data.extraFee > 0) {
      summary += `➕ 額外費用：NT$${data.extraFee.toLocaleString()}\n`;
    }
    if (data.childFee > 0) {
      summary += `👶 兒童加價：NT$${data.childFee.toLocaleString()}\n`;
    }
    if (data.discountAmount > 0) {
      summary += `🎫 會員折扣：-NT$${data.discountAmount.toLocaleString()}\n`;
    }
    
    summary += `💵 **總金額：NT$${data.totalPrice.toLocaleString()}**`;
    
    if (data.member) {
      summary += `\n\n💎 ${data.member.level}會員專屬優惠`;
    }
    
    if (showConfirmation) {
      summary += `\n\n請確認以上資訊是否正確？`;
    }
    
    return summary;
  }

  // 幫助訊息
  static getHelpMessage(step) {
    const helpMessages = {
      welcome: `📖 **使用說明**\n\n` +
               `🏨 **訂房流程**\n` +
               `1. 告訴我入住需求\n` +
               `2. 選擇房型\n` +
               `3. 確認訂房資訊\n\n` +
               `💡 **常用指令**\n` +
               `• "2大1小" - 設定人數\n` +
               `• "12/23" - 設定日期\n` +
               `• "標準房型" - 選擇房型\n` +
               `• "確認" - 完成訂房\n` +
               `• "重新開始" - 重置對話`,

      default: `💡 **需要幫助嗎？**\n\n` +
               `• 說 "重新開始" 重置對話\n` +
               `• 直接告訴我您的需求\n` +
               `• 或詢問價格、設施等資訊`
    };
    
    return helpMessages[step] || helpMessages.default;
  }
}

// ==================== 路由處理 ====================
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '訊息內容不能為空',
        suggestion: '請提供您的查詢或需求'
      });
    }

    console.log('💬 收到訊息:', { message, sessionId });

    const session = getOrCreateSession(sessionId);
    const response = ResponseGenerator.generateResponse(message, session);

    console.log('📊 回應結果:', {
      sessionId,
      step: session.step,
      adults: session.data.adults,
      children: session.data.children
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
      success: false,
      error: '處理您的請求時出現錯誤',
      suggestion: '請稍後重試或聯繫客服'
    });
  }
});

// 健康檢查
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Hotel AI Assistant',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    features: ['booking', 'pricing', 'member', 'qa']
  });
});

// 會話狀態查詢
router.get('/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (session) {
    res.json({
      success: true,
      session: {
        step: session.step,
        data: session.data,
        lastActive: session.lastActive
      }
    });
  } else {
    res.status(404).json({
      success: false,
      error: '會話不存在'
    });
  }
});

module.exports = router;


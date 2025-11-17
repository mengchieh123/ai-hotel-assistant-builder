const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());

// 會話存儲
const sessions = new Map();

// ==================== 訊息清理工具 ====================
function cleanInputMessage(message) {
  if (!message) return '';
  
  let cleaned = message
    .replace(/\[translate:\s*|\]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned || message;
}

// ==================== n8n 整合服務 ====================
class N8NIntegrationService {
  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL || 'https://your-n8n-instance.railway.app';
    this.apiKey = process.env.N8N_API_KEY;
    this.enabled = !!process.env.N8N_WEBHOOK_URL;
  }

  async sendBookingConfirmation(bookingData) {
    if (!this.enabled) return null;
    try {
      const payload = {
        action: 'booking_confirmation',
        sessionId: bookingData.sessionId,
        orderNumber: bookingData.orderNumber,
        roomType: bookingData.roomType,
        roomCount: bookingData.roomCount,
        adults: bookingData.adults,
        children: bookingData.children,
        childAge: bookingData.childAge,
        nights: bookingData.nights,
        basePrice: bookingData.basePrice,
        finalPrice: bookingData.finalPrice,
        discounts: bookingData.discounts || [],
        extraCharges: bookingData.extraCharges || [],
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      const response = await fetch(`${this.baseUrl}/webhook/hotel-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) throw new Error(`n8n 響應錯誤: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ n8n 訂房確認發送失敗:', error.message);
      return null;
    }
  }

  async logCustomerInquiry(sessionId, userMessage, botResponse, intent) {
    if (!this.enabled) return null;
    try {
      const payload = {
        action: 'customer_inquiry',
        sessionId,
        userMessage,
        botResponse: botResponse.reply,
        intent: intent || 'unknown',
        step: botResponse.nextStep,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      fetch(`${this.baseUrl}/webhook/customer-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload)
      }).catch(error => console.error('❌ n8n 客戶查詢記錄失敗:', error.message));
    } catch (error) {
      console.error('❌ n8n 客戶查詢記錄錯誤:', error.message);
    }
  }
}

// 初始化 n8n 服務
const n8nService = new N8NIntegrationService();

// 獲取或創建會話
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      conversationHistory: [],
      lastActivity: Date.now()
    });
  }
  return sessions.get(sessionId);
}

// ==================== 房間容量資料庫 ====================
const roomCapacityData = {
  '標準雙人房': {
    maxAdults: 2,
    maxChildren: 1,
    maxTotal: 2,
    bedType: '1張雙人床',
    size: '28平方公尺',
    description: '舒適雙人床，基本設施齊全',
    price: 2800,
    suitableFor: ['情侶', '單人', '商務旅客']
  },
  '豪華雙人房': {
    maxAdults: 2,
    maxChildren: 2,
    maxTotal: 3,
    bedType: '1張加大雙人床',
    size: '35平方公尺',
    description: '加大雙人床，景觀較佳，可加嬰兒床',
    price: 3800,
    suitableFor: ['情侶', '小家庭(2大1小)', '蜜月旅客']
  },
  '套房': {
    maxAdults: 3,
    maxChildren: 2,
    maxTotal: 4,
    bedType: '1張雙人床 + 沙發床',
    size: '48平方公尺',
    description: '獨立客廳，豪華衛浴，空間寬敞',
    price: 5800,
    suitableFor: ['家庭(2大2小)', '商務旅客', '需要額外空間的旅客']
  },
  '家庭房': {
    maxAdults: 2,
    maxChildren: 3,
    maxTotal: 4,
    bedType: '2張雙人床',
    size: '42平方公尺',
    description: '兩張雙人床，專為家庭設計',
    price: 4500,
    suitableFor: ['家庭(2大2小)', '帶小孩的家庭', '需要多床的團體']
  }
};

// ==================== 會員等級系統 ====================
const memberLevels = {
  'gold': {
    name: '黃金會員',
    discount: 0.2,
    benefits: ['房價8折優惠', '免費早餐', '延遲退房至14:00', '迎賓水果'],
    requirements: '年度消費滿5萬元'
  },
  'silver': {
    name: '白銀會員', 
    discount: 0.1,
    benefits: ['房價9折優惠', '延遲退房至13:00'],
    requirements: '年度消費滿2萬元'
  },
  'basic': {
    name: '基礎會員',
    discount: 0.05,
    benefits: ['房價95折優惠', '累積點數'],
    requirements: '免費加入'
  }
};

// ==================== 兒童政策資料 ====================
const childPolicies = [
  {
    age: "0-2",
    policy: "嬰兒免費同住",
    conditions: ["需與父母同房", "不提供額外備品", "可提供嬰兒床（需預訂）"],
    extraCharge: 0
  },
  {
    age: "3-5", 
    policy: "幼兒免費同住",
    conditions: ["需與父母同房", "提供兒童備品", "可提供加床（NT$500/晚）"],
    extraCharge: 0
  },
  {
    age: "6-11",
    policy: "兒童可選擇加床或免費同住", 
    conditions: ["加床費用 NT$800/晚", "免費同住不提供額外備品", "建議加床以確保舒適度"],
    extraCharge: 800
  },
  {
    age: "12-17",
    policy: "視同成人收費", 
    conditions: ["需加床或訂額外房間", "可享兒童優惠價", "需成人陪同"],
    extraCharge: 0
  }
];

// ==================== 增強版對話處理 ====================
function processMessage(message, session) {
  const cleanMessage = cleanInputMessage(message);
  const lowerMsg = cleanMessage.toLowerCase();
  
  // 記錄對話歷史
  session.conversationHistory.push({
    role: 'user',
    content: cleanMessage,
    timestamp: new Date().toISOString()
  });
  
  console.log('🔄 處理訊息:', { 
    original: message, 
    cleaned: cleanMessage, 
    step: session.step 
  });
  
  let response = null;
  let detectedIntent = 'unknown';

  // 重置會話指令
  if (lowerMsg.includes('重置') || lowerMsg.includes('重新開始') || lowerMsg.includes('restart')) {
    session.step = 'welcome';
    session.data = {};
    session.context = {};
    session.conversationHistory = [];
    response = {
      reply: '會話已重置！請問需要什麼協助？\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹',
      nextStep: 'welcome'
    };
    detectedIntent = 'reset';
  }
  
  // 幫助指令
  else if (lowerMsg.includes('幫助') || lowerMsg.includes('help') || lowerMsg.includes('指令')) {
    response = {
      reply: '🆘 **幫助指南**\n\n📋 **可用指令：**\n• 訂房/預訂 - 開始訂房流程\n• 優惠查詢 - 查看各項優惠政策\n• 附近景點 - 推薦周邊景點\n• 飯店設施 - 介紹飯店設施\n• 兒童政策 - 了解兒童收費標準\n• 重置 - 重新開始對話\n\n💡 **訂房流程：**\n選擇房型 → 輸入人數 → 選擇房間數 → 選擇天數 → 確認訂單',
      nextStep: session.step
    };
    detectedIntent = 'help';
  }

  // === 優先處理確認動作 ===
  else if (!response) {
    response = handleConfirmation(lowerMsg, session);
    if (response) detectedIntent = 'confirmation';
  }
  
  // === 處理會員優惠查詢 ===
  if (!response) {
    response = handleMemberBenefitsQuery(cleanMessage, session);
    if (response) detectedIntent = 'member_benefits';
  }
  
  // === 處理入住天數 ===
  if (!response) {
    response = handleNightsQuery(cleanMessage, session);
    if (response) detectedIntent = 'nights_query';
  }
  
  // === 處理房間建議 ===
  if (!response) {
    response = handleRoomSuggestion(cleanMessage, session);
    if (response) detectedIntent = 'room_suggestion';
  }
  
  // === 家庭人數查詢 ===
  if (!response) {
    response = handleFamilySizeQuery(cleanMessage, session);
    if (response) detectedIntent = 'family_size_query';
  }
  
  // === 數字處理 ===
  if (!response) {
    response = handleNumberInputEnhanced(cleanMessage, session, lowerMsg);
    if (response) detectedIntent = 'number_input';
  }
  
  // === 訂房相關 ===
  if (!response) {
    response = handleBookingIntent(lowerMsg, session);
    if (response) detectedIntent = 'booking';
  }

  // 記錄回應到對話歷史
  if (response) {
    session.conversationHistory.push({
      role: 'assistant',
      content: response.reply,
      timestamp: new Date().toISOString()
    });
    
    n8nService.logCustomerInquiry(session.sessionId, cleanMessage, response, detectedIntent)
      .catch(error => console.error('n8n 記錄失敗:', error));
  } else {
    response = generateDefaultResponse(session);
    detectedIntent = 'default';
  }

  return response;
}

// ==================== 處理會員優惠查詢 ====================
function handleMemberBenefitsQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 匹配會員等級和折扣
  const memberMatch = message.match(/(gold|gold等級|黃金|silver|silver等級|白銀|basic|基礎)(.*?)(\d+折|[\d.]+折|\d+%|[\d.]+%)/i) || 
                     message.match(/(\d+折|[\d.]+折|\d+%|[\d.]+%)(.*?)(會員|member)/i);
  
  if (lowerMsg.includes('會員') || lowerMsg.includes('member') || lowerMsg.includes('折扣') || memberMatch) {
    let reply = '⭐ **會員優惠資訊**\n\n';
    
    // 如果有具體的會員等級匹配
    if (memberMatch) {
      const levelMatch = memberMatch[1].toLowerCase();
      let memberLevel = null;
      
      if (levelMatch.includes('gold') || levelMatch.includes('黃金')) {
        memberLevel = memberLevels.gold;
      } else if (levelMatch.includes('silver') || levelMatch.includes('白銀')) {
        memberLevel = memberLevels.silver;
      } else {
        memberLevel = memberLevels.basic;
      }
      
      reply += `🎯 **${memberLevel.name}**\n`;
      reply += `💰 折扣: ${(memberLevel.discount * 100)}% off\n`;
      reply += `🎁 專屬福利:\n`;
      memberLevel.benefits.forEach(benefit => {
        reply += `   • ${benefit}\n`;
      });
      reply += `📋 升級條件: ${memberLevel.requirements}\n\n`;
      
      // 如果正在訂房流程中，應用折扣
      if (session.data.roomType && session.data.nights) {
        const originalPrice = roomCapacityData[session.data.roomType].price * session.data.nights;
        const discountedPrice = originalPrice * (1 - memberLevel.discount);
        reply += `💡 您選擇的 ${session.data.roomType} ${session.data.nights}晚\n`;
        reply += `   原價: NT$${originalPrice.toLocaleString()}\n`;
        reply += `   會員價: NT$${discountedPrice.toLocaleString()} (省 NT$${(originalPrice - discountedPrice).toLocaleString()})\n\n`;
        
        // 記錄會員折扣
        session.data.memberDiscount = memberLevel.discount;
        session.data.memberLevel = memberLevel.name;
      }
    } else {
      // 一般會員查詢
      Object.values(memberLevels).forEach(level => {
        reply += `🎯 **${level.name}**\n`;
        reply += `   💰 ${(level.discount * 100)}%折扣 | ${level.requirements}\n`;
      });
      
      reply += `\n💡 成為會員即可享受專屬優惠！`;
    }
    
    session.step = 'member_info';
    return {
      reply: reply,
      nextStep: 'member_info'
    };
  }
  
  return null;
}

// ==================== 處理入住天數查詢 ====================
function handleNightsQuery(message, session) {
  const lowerMsg = message.toLowerCase();
  
  // 匹配天數模式
  const nightsMatch = message.match(/(\d+)\s*(晚|天|night|nights)/i) || 
                     message.match(/(入住|住|stay)\s*(\d+)\s*(晚|天)/i);
  
  if (nightsMatch || lowerMsg.includes('晚') || lowerMsg.includes('天') || lowerMsg.includes('night')) {
    const nights = nightsMatch ? parseInt(nightsMatch[1] || nightsMatch[2]) : 
                   (session.data.nights || 1);
    
    console.log(`📅 處理入住天數: ${nights}晚, 當前步驟: ${session.step}`);
    
    // 根據當前步驟處理
    if (session.step === 'ask_nights' || session.step === 'confirm_booking' || session.data.roomType) {
      session.data.nights = nights;
      
      if (session.data.roomType) {
        const roomInfo = roomCapacityData[session.data.roomType];
        const basePrice = roomInfo.price * nights * (session.data.roomCount || 1);
        
        let reply = `📅 已設定入住 ${nights} 晚\n\n`;
        reply += `🏨 ${session.data.roomType}\n`;
        reply += `💰 基礎費用: NT$${basePrice.toLocaleString()}\n`;
        
        // 檢查長住優惠
        if (nights >= 7) {
          const discount = nights >= 30 ? 0.3 : nights >= 14 ? 0.2 : 0.15;
          const discountedPrice = basePrice * (1 - discount);
          reply += `🎫 長住優惠: ${discount * 100}% off\n`;
          reply += `💵 優惠後: NT$${discountedPrice.toLocaleString()}\n`;
          session.data.longStayDiscount = discount;
        }
        
        // 如果有會員折扣
        if (session.data.memberDiscount) {
          const memberPrice = basePrice * (1 - session.data.memberDiscount);
          reply += `⭐ 會員折扣: ${session.data.memberDiscount * 100}% off\n`;
          reply += `💵 會員價: NT$${memberPrice.toLocaleString()}\n`;
        }
        
        reply += `\n請確認是否開始訂房流程？`;
        
        session.step = 'confirm_booking';
        return {
          reply: reply,
          nextStep: 'confirm_booking'
        };
      } else {
        session.step = 'ask_nights';
        return {
          reply: `好的，入住 ${nights} 晚。請問您想要預訂哪種房型？`,
          nextStep: 'select_room'
        };
      }
    } else {
      // 不在訂房流程中
      session.data.nights = nights;
      session.step = 'ask_room_type';
      return {
        reply: `了解您想入住 ${nights} 晚。請問需要什麼房型呢？\n\n可選房型：\n• 標準雙人房\n• 豪華雙人房\n• 套房\n• 家庭房`,
        nextStep: 'select_room'
      };
    }
  }
  
  return null;
}

// ==================== 處理房間建議 ====================
function handleRoomSuggestion(message, session) {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('建議') || lowerMsg.includes('推薦') || lowerMsg.includes('suggest') || lowerMsg.includes('recommend')) {
    let reply = '🏨 **房型推薦**\n\n';
    
    // 根據對話歷史和當前數據推薦
    const hasChildren = session.data.children > 0;
    const totalGuests = (session.data.adults || 0) + (session.data.children || 0);
    
    if (hasChildren && totalGuests >= 3) {
      reply += `👨‍👩‍👧‍👦 **家庭房** (NT$4,500/晚)\n`;
      reply += `   ✅ 兩張雙人床，專為家庭設計\n`;
      reply += `   ✅ 最多容納 2大3小\n`;
      reply += `   ✅ 兒童友善設施\n\n`;
      
      reply += `🏠 **套房** (NT$5,800/晚)\n`;
      reply += `   ✅ 獨立客廳，空間寬敞\n`;
      reply += `   ✅ 沙發床可加床\n`;
      reply += `   ✅ 適合需要額外空間的家庭\n`;
      
      reply += `💡 建議：家庭房最適合親子同住，套房則提供更多空間`;
    } else if (totalGuests === 2) {
      reply += `💑 **豪華雙人房** (NT$3,800/晚)\n`;
      reply += `   ✅ 加大雙人床，景觀佳\n`;
      reply += `   ✅ 可加嬰兒床\n`;
      reply += `   ✅ 浪漫氛圍\n\n`;
      
      reply += `🏢 **標準雙人房** (NT$2,800/晚)\n`;
      reply += `   ✅ 經濟實惠\n`;
      reply += `   ✅ 基本設施齊全\n`;
    } else {
      // 一般推薦
      reply += `💑 **情侶/夫妻推薦:**\n`;
      reply += `   • 豪華雙人房 - 浪漫體驗\n`;
      reply += `   • 套房 - 奢華享受\n\n`;
      
      reply += `👨‍👩‍👧‍👦 **家庭推薦:**\n`;
      reply += `   • 家庭房 - 專為家庭設計\n`;
      reply += `   • 套房 - 空間寬敞\n\n`;
      
      reply += `💼 **商務推薦:**\n`;
      reply += `   • 標準雙人房 - 經濟實惠\n`;
      reply += `   • 套房 - 獨立工作空間\n`;
    }
    
    reply += `\n請告訴我您選擇的房型，或需要更多資訊？`;
    
    session.step = 'room_recommendation';
    return {
      reply: reply,
      nextStep: 'room_recommendation'
    };
  }
  
  return null;
}

// ==================== 家庭人數查詢處理 ====================
function handleFamilySizeQuery(message, session) {
  const familyPatterns = [
    /(\d+)\s*大\s*(\d+)\s*小/,
    /(\d+)\s*個?\s*大人\s*(\d+)\s*個?\s*小孩/,
    /(\d+)\s*個?\s*大人.*?(\d+)\s*個?\s*小孩/,
    /(\d+)\s*adults?\s*(\d+)\s*kids?/i
  ];
  
  let adults = 0;
  let children = 0;
  
  for (const pattern of familyPatterns) {
    const match = message.match(pattern);
    if (match) {
      adults = parseInt(match[1]);
      children = parseInt(match[2]);
      break;
    }
  }
  
  if (adults === 0 && children === 0) {
    if (message.includes('兩大兩小') || message.includes('2大2小') || message.includes('兩個大人兩個小孩')) {
      adults = 2;
      children = 2;
    }
  }
  
  if (adults > 0 && children > 0) {
    console.log(`👨‍👩‍👧‍👦 檢測到家庭查詢: ${adults}大${children}小`);
    
    session.data.adults = adults;
    session.data.children = children;
    session.data.hasChildren = true;
    session.context.familyQuery = true;
    
    const suitableRooms = findSuitableRooms(adults, children);
    
    if (suitableRooms.length > 0) {
      let reply = `👨‍👩‍👧‍👦 根據 ${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''}，推薦以下房型：\n\n`;
      
      suitableRooms.forEach(room => {
        const roomInfo = roomCapacityData[room.roomType];
        reply += `🏨 **${room.roomType}**\n`;
        reply += `   💰 NT$${roomInfo.price}/晚\n`;
        reply += `   🛏️ ${roomInfo.bedType}\n`;
        reply += `   📏 ${roomInfo.size}\n`;
        reply += `   ✅ ${room.suitability}\n\n`;
      });
      
      reply += `💡 為了提供準確報價，請問小孩的年齡是？`;
      
      session.step = 'ask_child_age_for_family';
      return {
        reply: reply,
        nextStep: 'ask_child_age_for_family'
      };
    } else {
      // 沒有合適的單一房型，建議多間房間
      return suggestMultipleRooms(adults, children, session);
    }
  }
  
  return null;
}

// ==================== 核心功能函數 ====================
function findSuitableRooms(adults, children) {
  const suitable = [];
  const totalGuests = adults + children;
  
  for (const [roomType, capacity] of Object.entries(roomCapacityData)) {
    const canAccommodateAdults = adults <= capacity.maxAdults;
    const canAccommodateChildren = children <= capacity.maxChildren;
    const canAccommodateTotal = totalGuests <= capacity.maxTotal;
    
    if (canAccommodateAdults && canAccommodateChildren && canAccommodateTotal) {
      let suitability = '';
      
      if (roomType === '家庭房') {
        suitability = '最適合家庭入住';
      } else if (roomType === '套房') {
        suitability = '適合家庭，空間寬敞';
      } else if (roomType === '豪華雙人房' && children <= 1) {
        suitability = '可接受，建議嬰兒或幼兒';
      } else {
        suitability = '基本符合';
      }
      
      suitable.push({
        roomType,
        suitability
      });
    }
  }
  
  return suitable;
}

function suggestMultipleRooms(adults, children, session) {
  const totalGuests = adults + children;
  let reply = `👨‍👩‍👧‍👦 針對 ${adults}位大人${children > 0 ? ` + ${children}位小孩` : ''} 的組合：\n\n`;
  
  reply += `目前沒有單一房型可以容納所有成員，建議方案：\n\n`;
  
  // 計算需要的房間組合
  const roomCombinations = calculateRoomCombinations(adults, children);
  
  roomCombinations.forEach((combo, index) => {
    reply += `**方案 ${index + 1}:** ${combo.description}\n`;
    reply += `   💰 估算費用: NT$${combo.estimatedPrice.toLocaleString()}\n`;
    reply += `   ✅ ${combo.advantages.join('、')}\n\n`;
  });
  
  reply += `請告訴我您偏好哪種方案，或需要其他協助？`;
  
  session.step = 'suggest_multiple_rooms';
  return {
    reply: reply,
    nextStep: 'suggest_multiple_rooms'
  };
}

function calculateRoomCombinations(adults, children) {
  const combinations = [];
  
  // 方案1: 家庭房 + 標準房
  if (adults <= 4 && children <= 3) {
    const familyRoomPrice = roomCapacityData['家庭房'].price;
    const standardRoomPrice = roomCapacityData['標準雙人房'].price;
    combinations.push({
      description: '1間家庭房 + 1間標準雙人房',
      rooms: ['家庭房', '標準雙人房'],
      estimatedPrice: familyRoomPrice + standardRoomPrice,
      advantages: ['家庭房適合帶小孩', '標準房給其他成人', '靈活分配']
    });
  }
  
  // 方案2: 兩間家庭房
  combinations.push({
    description: '2間家庭房',
    rooms: ['家庭房', '家庭房'],
    estimatedPrice: roomCapacityData['家庭房'].price * 2,
    advantages: ['每間都有兩張雙人床', '隱私性佳', '適合大家庭']
  });
  
  // 方案3: 套房 + 豪華房
  combinations.push({
    description: '1間套房 + 1間豪華雙人房',
    rooms: ['套房', '豪華雙人房'],
    estimatedPrice: roomCapacityData['套房'].price + roomCapacityData['豪華雙人房'].price,
    advantages: ['套房空間寬敞', '豪華房舒適', '品質較高']
  });
  
  return combinations;
}

function handleConfirmation(message, session) {
  const confirmKeywords = ['確認', '是的', '沒錯', '對', '好', 'ok', 'okay', 'yes', 'y', 'correct'];
  const cancelKeywords = ['取消', '不要', '不對', '錯誤', 'no', 'n', '重新輸入'];
  
  const isConfirmation = confirmKeywords.some(keyword => message.includes(keyword));
  const isCancellation = cancelKeywords.some(keyword => message.includes(keyword));
  
  if (!isConfirmation && !isCancellation) return null;
  
  switch(session.step) {
    case 'confirm_booking':
      if (isConfirmation) {
        return completeBooking(session);
      } else {
        session.step = 'select_room';
        return {
          reply: '好的，我們重新選擇房型。請問您想要哪種房型？',
          nextStep: 'select_room'
        };
      }
      
    default:
      return null;
  }
}

function handleNumberInputEnhanced(cleanMessage, session, lowerMsg) {
  const numberMatch = cleanMessage.match(/(\d+)/);
  if (!numberMatch) return null;
  
  const number = parseInt(numberMatch[1]);
  
  // 兒童年齡處理
  if (session.step === 'ask_child_age' || session.step === 'ask_child_age_for_family' || 
      (cleanMessage.includes('歲') && session.data.hasChildren)) {
    session.data.childAge = number;
    return generateChildPolicyResponse(number, session.data.children, session);
  }
  
  // 處理大人人數
  if ((session.step === 'ask_guests' || !session.data.adults) && 
      (cleanMessage.includes('大人') || cleanMessage.includes('位') || cleanMessage.includes('個'))) {
    session.data.adults = number;
    session.step = 'ask_room_count';
    
    let reply = `了解，${number}位大人`;
    if (session.data.children) {
      reply += `和${session.data.children}位小孩`;
    }
    reply += `。請問需要預訂幾間${session.data.roomType || '房間'}？`;
    
    return {
      reply: reply,
      nextStep: 'ask_room_count'
    };
  }
  
  // 處理房間數量
  if ((session.step === 'ask_room_count' || !session.data.roomCount) && 
      cleanMessage.includes('間')) {
    session.data.roomCount = number;
    session.step = 'ask_nights';
    return {
      reply: `好的，${number}間${session.data.roomType || '房間'}。請問打算入住幾晚？`,
      nextStep: 'ask_nights'
    };
  }
  
  return null;
}

function generateChildPolicyResponse(childAge, childCount, session) {
  const policy = getChildPolicy(childAge);
  
  let reply = `👶 **兒童政策**\n\n`;
  reply += `年齡: ${childAge} 歲\n`;
  reply += `政策: ${policy.policy}\n`;
  
  if (policy.extraCharge > 0) {
    reply += `加床費用: NT$${policy.extraCharge}/晚\n`;
  }
  
  reply += `\n💡 建議：${getChildRecommendation(childAge)}\n`;
  reply += `\n是否需要開始訂房流程？`;
  
  session.step = 'child_policy_info';
  return {
    reply: reply,
    nextStep: 'child_policy_info'
  };
}

function getChildPolicy(age) {
  for (const policy of childPolicies) {
    const ageRange = policy.age.split('-');
    const minAge = parseInt(ageRange[0]);
    const maxAge = parseInt(ageRange[1]);
    
    if (age >= minAge && age <= maxAge) {
      return policy;
    }
  }
  return childPolicies[childPolicies.length - 1];
}

function getChildRecommendation(age) {
  if (age < 6) return '可選擇家庭房，空間較寬敞';
  if (age < 12) return '建議加床或選擇套房';
  return '建議預訂額外房間';
}

function handleBookingIntent(lowerMsg, session) {
  if (lowerMsg.includes('訂房') || lowerMsg.includes('預訂') || lowerMsg.includes('我要訂') || 
      lowerMsg.includes('book') || lowerMsg.includes('reservation')) {
    if (!session.data.roomType) {
      session.step = 'select_room';
      return {
        reply: '🏨 **開始訂房流程**\n\n請問您想要預訂哪種房型？\n\n' +
               '• 標準雙人房 - NT$2,800/晚\n' +
               '• 豪華雙人房 - NT$3,800/晚\n' +
               '• 套房 - NT$5,800/晚\n' +
               '• 家庭房 - NT$4,500/晚',
        nextStep: 'select_room'
      };
    }
  }
  
  // 房型選擇
  const roomKeywords = {
    '標準': '標準雙人房',
    '豪華': '豪華雙人房', 
    '套房': '套房',
    '家庭': '家庭房'
  };
  
  for (const [keyword, roomType] of Object.entries(roomKeywords)) {
    if (lowerMsg.includes(keyword)) {
      session.data.roomType = roomType;
      session.step = 'ask_guests';
      
      const roomInfo = roomCapacityData[roomType];
      return {
        reply: `🏨 已選擇 ${roomType}\n💰 NT$${roomInfo.price}/晚\n📝 ${roomInfo.description}\n\n請問有幾位大人入住？`,
        nextStep: 'ask_guests'
      };
    }
  }
  
  return null;
}

function generateDefaultResponse(session) {
  const currentStep = session.step;
  
  const stepPrompts = {
    'welcome': '您好！我是飯店客服助手，可以幫您：\n• 訂房服務\n• 優惠查詢\n• 景點推薦\n• 設施介紹\n\n請問需要什麼協助呢？',
    'select_room': '請選擇房型：標準雙人房、豪華雙人房、套房、家庭房',
    'ask_guests': '請問有幾位大人入住？',
    'ask_child_age_for_family': '請問小孩的年齡是？',
    'member_info': '還需要了解其他會員資訊嗎？',
    'room_recommendation': '請告訴我您選擇的房型？',
    'suggest_multiple_rooms': '請告訴我您偏好哪種房間方案？',
    'confirm_booking': '請確認訂房資訊是否正確？'
  };
  
  return {
    reply: stepPrompts[currentStep] || '請問需要什麼協助呢？',
    nextStep: currentStep
  };
}

// ==================== 訂房完成相關函數 ====================
async function completeBooking(session) {
  const finalPrice = calculateFinalPrice(session.data);
  const orderNumber = generateOrderNumber();
  
  session.step = 'booking_completed';
  session.data.orderNumber = orderNumber;
  session.data.finalPrice = finalPrice.finalPrice;

  await n8nService.sendBookingConfirmation(session.data);

  return {
    reply: `🎉 **訂房完成！**\n\n📋 訂單編號: ${orderNumber}\n💰 總金額: NT$${finalPrice.finalPrice.toLocaleString()}\n🏨 房型: ${session.data.roomType}\n📅 天數: ${session.data.nights}晚\n👥 人數: ${session.data.adults}位大人${session.data.children ? ` + ${session.data.children}位小孩` : ''}\n\n感謝您的預訂！我們期待為您服務！`,
    nextStep: 'booking_completed'
  };
}

function calculateFinalPrice(bookingData) {
  if (!bookingData.roomType) return { finalPrice: 0 };
  
  const roomPrice = roomCapacityData[bookingData.roomType].price;
  let finalPrice = roomPrice * (bookingData.nights || 1) * (bookingData.roomCount || 1);
  
  // 應用折扣
  if (bookingData.memberDiscount) {
    finalPrice *= (1 - bookingData.memberDiscount);
  }
  if (bookingData.longStayDiscount) {
    finalPrice *= (1 - bookingData.longStayDiscount);
  }
  
  // 兒童加床費用
  if (bookingData.childAge >= 6 && bookingData.childAge < 12 && bookingData.children > 0) {
    const policy = getChildPolicy(bookingData.childAge);
    if (policy.extraCharge > 0) {
      finalPrice += policy.extraCharge * bookingData.nights * bookingData.children;
    }
  }
  
  return { finalPrice: Math.round(finalPrice) };
}

function generateOrderNumber() {
  return `HTL${Date.now().toString().slice(-6)}`;
}

// ==================== 會話清理 ====================
function cleanupOldSessions() {
  const now = Date.now();
  const MAX_AGE = 30 * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > MAX_AGE) {
      sessions.delete(sessionId);
      console.log(`🧹 清理過期會話: ${sessionId}`);
    }
  }
}
setInterval(cleanupOldSessions, 60 * 60 * 1000);

// ==================== API 路由 ====================
app.post('/api/chat', handleChat);
app.post('/chat', handleChat);

function handleChat(req, res) {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '訊息不能為空' });
  }
  
  try {
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    session.sessionId = sessionId;
    
    const response = processMessage(message, session);
    
    if (response && response.nextStep) {
      session.step = response.nextStep;
    }
    
    res.json({
      reply: response.reply,
      sessionId: sessionId,
      step: session.step,
      timestamp: new Date().toISOString(),
      n8nEnabled: n8nService.enabled
    });
    
  } catch (error) {
    console.error('❌ 處理訊息時發生錯誤:', error);
    res.status(500).json({
      reply: '抱歉，處理您的請求時發生錯誤。請稍後再試或聯繫客服。',
      sessionId: sessionId || 'unknown',
      error: true
    });
  }
}

// 健康檢查和其他路由
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    n8nIntegration: {
      enabled: n8nService.enabled,
      baseUrl: n8nService.baseUrl
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: '會話不存在' });
  }
  
  res.json({
    sessionId,
    step: session.step,
    data: session.data,
    lastActivity: new Date(session.lastActivity).toLocaleString('zh-TW')
  });
});

app.post('/api/session/:sessionId/reset', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }
  
  res.json({ 
    success: true,
    message: '會話已重置'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: '端點不存在',
    availableEndpoints: [
      'POST /api/chat',
      'POST /chat',
      'GET /api/session/:sessionId', 
      'POST /api/session/:sessionId/reset',
      'GET /health',
      'GET /api/health'
    ]
  });
});

// ==================== 啟動伺服器 ====================
app.listen(PORT, () => {
  console.log(`🚀 飯店客服機器人已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log(`🔗 n8n 整合: ${n8nService.enabled ? '已啟用' : '未啟用'}`);
  console.log(`💾 會話管理: 自動清理機制已啟用`);
  console.log(`🏨 房間容量: ${Object.keys(roomCapacityData).length} 種房型資料已載入`);
});

process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信號，開始關機...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 信號，開始關機...');
  process.exit(0);
});

module.exports = app;

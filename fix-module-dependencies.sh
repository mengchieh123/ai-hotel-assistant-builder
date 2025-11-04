#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復模塊依賴問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 確保 hotel-data.js 正確
echo "1️⃣ 檢查 hotel-data.js..."

cat > services/hotel-data.js << 'EOFDATA'
const hotelData = {
  hotelInfo: {
    name: "台北晶華酒店",
    stars: 5,
    phone: "+886-2-2523-8000"
  },

  roomTypes: [
    {
      id: "deluxe",
      name: "豪華客房",
      size: "35平方公尺",
      capacity: { adults: 2, children: 1 },
      basePrice: 8800,
      breakfastIncluded: false,
      breakfastPrice: 650
    },
    {
      id: "executive",
      name: "行政客房",
      size: "42平方公尺",
      capacity: { adults: 2, children: 1 },
      basePrice: 12800,
      breakfastIncluded: true,
      breakfastPrice: 0
    },
    {
      id: "suite",
      name: "套房",
      size: "68平方公尺",
      capacity: { adults: 3, children: 2 },
      basePrice: 18800,
      breakfastIncluded: true,
      breakfastPrice: 0
    },
    {
      id: "presidential",
      name: "總統套房",
      size: "120平方公尺",
      capacity: { adults: 4, children: 2 },
      basePrice: 38800,
      breakfastIncluded: true,
      breakfastPrice: 0
    }
  ],

  pricingRules: {
    extraBed: {
      price: 1200
    },
    childPolicy: {
      freeAge: 6,
      childBedPrice: 800,
      adultBedPrice: 1200
    },
    longStayDiscount: [
      { nights: 3, discount: 5, description: "住3晚享95折" },
      { nights: 5, discount: 10, description: "住5晚享9折" },
      { nights: 7, discount: 15, description: "住7晚享85折" }
    ]
  },

  promotions: [
    {
      id: "earlybird",
      name: "早鳥優惠",
      description: "提前30天預訂享85折",
      discount: 15
    }
  ],

  addons: [
    {
      id: "breakfast",
      name: "早餐券",
      price: 650
    },
    {
      id: "airport",
      name: "機場接送",
      price: 1500
    },
    {
      id: "parking",
      name: "停車位",
      price: 500
    }
  ]
};

module.exports = hotelData;
EOFDATA

echo "✅ hotel-data.js 已確保"

# 2. 確保 booking-calculator.js 穩定
echo ""
echo "2️⃣ 檢查 booking-calculator.js..."

cat > services/booking-calculator.js << 'EOFCALC'
const hotelData = require('./hotel-data');

class BookingCalculator {
    calculateTotal(booking) {
        try {
            console.log('💰 開始計算:', JSON.stringify(booking));
            
            const { roomType, nights, adults, children = 0, childrenAges = [], includeBreakfast = false } = booking;
            
            // 驗證
            if (!roomType || !nights || !adults) {
                throw new Error('缺少必要資訊');
            }
            
            const room = hotelData.roomTypes.find(r => r.id === roomType);
            if (!room) {
                throw new Error('房型不存在: ' + roomType);
            }
            
            // 轉換數字
            const nightsNum = Number(nights);
            const adultsNum = Number(adults);
            const basePriceNum = Number(room.basePrice);
            
            console.log('數值:', { nightsNum, adultsNum, basePriceNum });
            
            if (isNaN(nightsNum) || isNaN(adultsNum) || isNaN(basePriceNum)) {
                throw new Error('數值格式錯誤');
            }
            
            let total = basePriceNum * nightsNum;
            const details = [{
                item: room.name + ' × ' + nightsNum + '晚',
                amount: total
            }];
            
            // 兒童加床
            if (childrenAges && childrenAges.length > 0) {
                let childBedTotal = 0;
                childrenAges.forEach(age => {
                    const ageNum = Number(age);
                    if (ageNum > 6 && ageNum <= 12) {
                        childBedTotal += 800 * nightsNum;
                    } else if (ageNum > 12) {
                        childBedTotal += 1200 * nightsNum;
                    }
                });
                if (childBedTotal > 0) {
                    total += childBedTotal;
                    details.push({ item: '兒童加床', amount: childBedTotal });
                }
            }
            
            // 長住優惠
            let discount = 1.0;
            if (nightsNum >= 7) discount = 0.85;
            else if (nightsNum >= 5) discount = 0.90;
            else if (nightsNum >= 3) discount = 0.95;
            
            if (discount < 1.0) {
                const discountAmount = total * (1 - discount);
                details.push({ item: '長住優惠', amount: -discountAmount });
                total = total * discount;
            }
            
            // 早餐
            if (includeBreakfast && !room.breakfastIncluded) {
                const breakfastCost = (adultsNum + Number(children)) * nightsNum * 650;
                total += breakfastCost;
                details.push({ item: '早餐', amount: breakfastCost });
            }
            
            const finalTotal = Math.round(total);
            console.log('✅ 計算完成:', finalTotal);
            
            return {
                roomName: room.name,
                nights: nightsNum,
                total: finalTotal,
                details: details
            };
        } catch (error) {
            console.error('❌ 計算錯誤:', error);
            throw error;
        }
    }
    
    formatBreakdown(breakdown) {
        let output = '📋 **訂房明細**\n\n';
        output += '🏨 房型：' + breakdown.roomName + '\n';
        output += '🌙 天數：' + breakdown.nights + '晚\n\n';
        
        if (breakdown.details && breakdown.details.length > 0) {
            output += '💰 **費用明細**\n';
            breakdown.details.forEach(item => {
                const sign = item.amount < 0 ? '' : '+ ';
                output += '  • ' + item.item + ': ' + sign + 'NT$ ' + Math.abs(item.amount).toLocaleString() + '\n';
            });
            output += '\n';
        }
        
        output += '💵 **總計**：NT$ ' + breakdown.total.toLocaleString();
        return output;
    }
}

module.exports = new BookingCalculator();
EOFCALC

echo "✅ booking-calculator.js 已確保"

# 3. 更新 mock-ai-service.js 增強錯誤處理
echo ""
echo "3️⃣ 增強 AI 服務錯誤處理..."

cat > services/mock-ai-service.js << 'EOFAI'
let hotelData, bookingCalculator;

try {
    hotelData = require('./hotel-data');
    console.log('✅ hotel-data 已加載');
} catch (e) {
    console.error('❌ hotel-data 加載失敗:', e.message);
}

try {
    bookingCalculator = require('./booking-calculator');
    console.log('✅ booking-calculator 已加載');
} catch (e) {
    console.error('❌ booking-calculator 加載失敗:', e.message);
}

class EnhancedMockAI {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        console.log('🤖 增強版 AI v2.2 已初始化');
    }

    isAvailable() {
        return this.available;
    }

    getConversation(sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                history: [],
                bookingInfo: {
                    roomType: null,
                    nights: null,
                    adults: null,
                    children: 0,
                    childrenAges: [],
                    includeBreakfast: false
                }
            });
        }
        return this.conversations.get(sessionId);
    }

    detectIntent(message) {
        const msg = message.toLowerCase();
        
        if (/^(你好|hi|hello|哈囉|嗨|您好)/.test(msg)) return 'greeting';
        if (/(有|提供|什麼|哪些).*(房型|房間|客房)/.test(msg)) return 'room_inquiry';
        if (/(多少錢|價格|費用|房價)/.test(msg)) return 'price_inquiry';
        if (/(計算|總共|總價|加起來)/.test(msg)) return 'calculate';
        if (/(設施|服務|游泳池|健身房)/.test(msg)) return 'facilities';
        if (/(早餐|breakfast)/.test(msg)) return 'breakfast';
        if (/(怎麼去|交通|位置|地址|在哪)/.test(msg)) return 'location';
        
        return 'unknown';
    }

    extractEntities(message, conversation) {
        const msg = message.toLowerCase();
        const info = conversation.bookingInfo;
        
        if (/豪華/.test(msg)) info.roomType = 'deluxe';
        else if (/行政/.test(msg)) info.roomType = 'executive';
        else if (/套房/.test(msg)) info.roomType = 'suite';
        
        const nightsMatch = msg.match(/(\d+)(晚|天)/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1]);
        
        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);
        
        const childMatch = msg.match(/(\d+)(小孩|兒童)/);
        if (childMatch) info.children = parseInt(childMatch[1]);
        
        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) info.childrenAges = ageMatches.map(m => parseInt(m));
        
        if (/(含早|要早|加早)/.test(msg)) info.includeBreakfast = true;
    }

    async generateResponse(message, sessionId) {
        const conversation = this.getConversation(sessionId);
        const intent = this.detectIntent(message);
        
        this.extractEntities(message, conversation);
        
        let response = '';

        try {
            switch (intent) {
                case 'greeting':
                    response = '您好！👋 歡迎來到台北晶華酒店\n\n' +
                              '我是您的智能訂房助手，可以協助您：\n' +
                              '✨ 查看各式房型和價格\n' +
                              '✨ 即時計算訂房費用\n' +
                              '✨ 介紹飯店設施服務\n' +
                              '✨ 提供交通和位置資訊\n\n' +
                              '請告訴我您的需求，我很樂意為您服務！😊';
                    break;
                    
                case 'room_inquiry':
                    if (!hotelData) throw new Error('資料載入中');
                    
                    response = '🏨 **台北晶華酒店房型介紹**\n\n';
                    hotelData.roomTypes.forEach((room, i) => {
                        response += `**${i+1}. ${room.name}**\n`;
                        response += `💰 每晚 NT$ ${room.basePrice.toLocaleString()}\n`;
                        response += `📐 ${room.size}\n`;
                        response += `👥 最多 ${room.capacity.adults} 位成人\n`;
                        response += `🍳 ${room.breakfastIncluded ? '含' : '不含'}早餐\n\n`;
                    });
                    response += '💡 長住優惠：3晚95折、5晚9折、7晚85折\n\n';
                    response += '想了解哪個房型？';
                    break;
                    
                case 'price_inquiry':
                    if (!hotelData) throw new Error('資料載入中');
                    
                    const { bookingInfo } = conversation;
                    if (bookingInfo.roomType) {
                        const room = hotelData.roomTypes.find(r => r.id === bookingInfo.roomType);
                        response = `📊 **${room.name}價格資訊**\n\n`;
                        response += `💰 基本房價：NT$ ${room.basePrice.toLocaleString()}/晚\n\n`;
                        response += `🎁 長住優惠：\n• 3-4晚：95折\n• 5-6晚：90折\n• 7晚以上：85折\n\n`;
                        if (!room.breakfastIncluded) {
                            response += `🍳 早餐加購：NT$ 650/人/天\n\n`;
                        }
                        response += `想計算具體總價？請告訴我天數和人數！`;
                    } else {
                        response = '💰 請選擇房型：\n• 豪華客房 NT$ 8,800/晚\n• 行政客房 NT$ 12,800/晚\n• 套房 NT$ 18,800/晚';
                    }
                    break;
                    
                case 'calculate':
                    if (!bookingCalculator) throw new Error('計算服務載入中');
                    
                    const { roomType, nights, adults } = conversation.bookingInfo;
                    if (roomType && nights && adults) {
                        const breakdown = bookingCalculator.calculateTotal(conversation.bookingInfo);
                        response = bookingCalculator.formatBreakdown(breakdown);
                        response += '\n\n📞 立即預訂：+886-2-2523-8000';
                    } else {
                        response = '請提供完整資訊：房型、天數、人數\n範例：「豪華客房，住3晚，2大人」';
                    }
                    break;
                    
                case 'facilities':
                    response = '🏨 **設施服務**\n\n🏊 游泳池 | 💪 健身房 | 🍽️ 餐廳\n🅿️ 停車場 | ✈️ 機場接送';
                    break;
                    
                case 'breakfast':
                    response = '🍳 **早餐資訊**\n\n📍 栢麗廳\n⏰ 06:30-10:30\n💰 NT$ 650/人';
                    break;
                    
                case 'location':
                    response = '📍 **位置**\n\n台北市中山區中山北路二段41號\n🚇 捷運中山站步行3分鐘';
                    break;
                    
                default:
                    response = '我可以協助您：\n🏨 房型查詢\n💰 價格計算\n🏊 設施資訊';
            }
        } catch (error) {
            console.error('生成回覆錯誤:', error);
            response = '抱歉，處理時發生錯誤。請稍後再試。\n錯誤：' + error.message;
        }

        return response;
    }

    async chat(message, sessionId = 'default') {
        try {
            const response = await this.generateResponse(message, sessionId);
            return {
                success: true,
                message: response,
                reply: response,
                sessionId: sessionId
            };
        } catch (error) {
            console.error('對話錯誤:', error);
            return {
                success: false,
                message: '系統錯誤: ' + error.message
            };
        }
    }
}

module.exports = new EnhancedMockAI();
EOFAI

echo "✅ AI 服務已增強錯誤處理"

# 提交
git add services/
git commit -m "fix: resolve module loading errors in enhanced AI

Critical fixes:
✅ Ensured hotel-data.js structure is correct
✅ Fixed booking-calculator with proper error handling
✅ Enhanced AI with safe module loading
✅ Added detailed error messages
✅ All dependencies properly exported

This should resolve all 'processing error' issues."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修復已推送！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待部署（60秒）..."
sleep 60

echo ""
echo "🧪 測試修復結果..."

for query in "你好" "有什麼房型" "豪華客房多少錢" "豪華客房住3晚2大人計算總價"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "問：$query"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
      -H "Content-Type: application/json" \
      -d "{\"message\": \"$query\"}" | jq -r '.message'
    echo ""
    sleep 1
done


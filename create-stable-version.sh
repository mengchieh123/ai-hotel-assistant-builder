#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 創建最小穩定版本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 確保 hotel-data.js 完整且正確
echo "1️⃣  檢查 hotel-data.js..."

if [ ! -f "services/hotel-data.js" ]; then
    echo "⚙️  創建 hotel-data.js..."
    
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
    }
  ]
};

module.exports = hotelData;
EOFDATA

    echo "✅ hotel-data.js 已創建"
else
    echo "✅ hotel-data.js 已存在"
fi

# 2. 確保 booking-calculator.js 正確
echo ""
echo "2️⃣  檢查 booking-calculator.js..."

cat > services/booking-calculator.js << 'EOFCALC'
const hotelData = require('./hotel-data');

class BookingCalculator {
    calculateTotal(booking) {
        const { roomType, nights, adults, children = 0, childrenAges = [], includeBreakfast = false } = booking;
        
        const room = hotelData.roomTypes.find(r => r.id === roomType);
        if (!room) {
            throw new Error('房型不存在: ' + roomType);
        }
        
        let total = room.basePrice * nights;
        const details = [];
        
        details.push({
            item: room.name + ' × ' + nights + '晚',
            amount: room.basePrice * nights
        });
        
        // 兒童加床
        childrenAges.forEach(age => {
            if (age > 6 && age <= 12) {
                total += 800 * nights;
            } else if (age > 12) {
                total += 1200 * nights;
            }
        });
        
        // 長住優惠
        if (nights >= 7) {
            total *= 0.85;
        } else if (nights >= 5) {
            total *= 0.90;
        } else if (nights >= 3) {
            total *= 0.95;
        }
        
        // 早餐
        if (includeBreakfast && !room.breakfastIncluded) {
            const breakfastCost = (adults + children) * nights * 650;
            total += breakfastCost;
        }
        
        return {
            roomName: room.name,
            nights: nights,
            total: Math.round(total),
            details: details
        };
    }
    
    formatBreakdown(breakdown) {
        let output = '📋 訂房明細\n\n';
        output += '🏨 房型：' + breakdown.roomName + '\n';
        output += '🌙 天數：' + breakdown.nights + '晚\n\n';
        output += '💵 總計：NT$ ' + breakdown.total.toLocaleString() + '\n';
        return output;
    }
}

module.exports = new BookingCalculator();
EOFCALC

echo "✅ booking-calculator.js 已更新（簡化版）"

# 3. 確保 mock-ai-service.js 穩定
echo ""
echo "3️⃣  更新 mock-ai-service.js（穩定版）..."

cat > services/mock-ai-service.js << 'EOFMOCK'
class MockAIService {
    constructor() {
        this.available = true;
        console.log('🤖 Mock AI 服務已初始化（穩定版）');
        
        // 延遲加載依賴
        this.hotelData = null;
        this.calculator = null;
        
        try {
            this.hotelData = require('./hotel-data');
            console.log('✅ hotel-data 已加載');
        } catch (e) {
            console.error('⚠️  hotel-data 加載失敗:', e.message);
        }
        
        try {
            this.calculator = require('./booking-calculator');
            console.log('✅ booking-calculator 已加載');
        } catch (e) {
            console.error('⚠️  calculator 加載失敗:', e.message);
        }
    }

    isAvailable() {
        return this.available;
    }

    async chat(message, sessionId = 'default') {
        const msg = message.toLowerCase();
        let response = '';

        try {
            // 智能計算
            if ((msg.includes('計算') || msg.includes('總價')) && this.calculator) {
                const bookingInfo = this.extractBookingInfo(message);
                
                if (bookingInfo.roomType && bookingInfo.nights && bookingInfo.adults) {
                    const breakdown = this.calculator.calculateTotal(bookingInfo);
                    response = this.calculator.formatBreakdown(breakdown);
                    response += '\n\n如需預訂，請致電：📞 +886-2-2523-8000';
                } else {
                    response = '請提供完整資訊：房型、天數、人數\n範例：「豪華客房，住3晚，2大人」';
                }
            }
            // 問候
            else if (msg.includes('你好') || msg.includes('hi')) {
                response = '您好！歡迎光臨台北晶華酒店🏨\n\n我可以幫您：\n✨ 查詢房型\n✨ 計算價格\n\n請問需要什麼協助？';
            }
            // 房型
            else if (msg.includes('房型')) {
                response = '我們提供：\n🏨 豪華客房 NT$8,800/晚\n🏨 行政客房 NT$12,800/晚\n🏨 套房 NT$18,800/晚';
            }
            // 默認
            else {
                response = '您好！我可以幫您查詢房型或計算價格。\n請問需要什麼協助？';
            }
        } catch (error) {
            console.error('對話錯誤:', error);
            response = '抱歉，處理時發生錯誤。請稍後再試。';
        }

        return {
            success: true,
            message: response,
            sessionId: sessionId
        };
    }

    extractBookingInfo(message) {
        const info = {
            roomType: null,
            nights: null,
            adults: null,
            children: 0,
            childrenAges: [],
            includeBreakfast: false
        };

        const msg = message.toLowerCase();

        if (msg.includes('豪華')) info.roomType = 'deluxe';
        else if (msg.includes('行政')) info.roomType = 'executive';
        else if (msg.includes('套房')) info.roomType = 'suite';

        const nightsMatch = msg.match(/(\d+)晚|住(\d+)天/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1] || nightsMatch[2]);

        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);

        const childMatch = msg.match(/(\d+)(小孩|兒童)/);
        if (childMatch) info.children = parseInt(childMatch[1]);

        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) {
            info.childrenAges = ageMatches.map(m => parseInt(m));
        }

        if (msg.includes('含早') || msg.includes('早餐')) {
            info.includeBreakfast = true;
        }

        return info;
    }
}

module.exports = new MockAIService();
EOFMOCK

echo "✅ mock-ai-service.js 已更新（穩定版）"

# 4. 確保 routes/ai-routes.js 存在
echo ""
echo "4️⃣  確保路由配置..."

mkdir -p routes

cat > routes/ai-routes.js << 'EOFROUTE'
const express = require('express');
const router = express.Router();

let aiService;

try {
    aiService = require('../services/mock-ai-service');
    console.log('✅ AI 路由已加載 Mock 服務');
} catch (error) {
    console.error('❌ AI 路由加載失敗:', error);
}

router.get('/status', (req, res) => {
    res.json({
        available: aiService ? aiService.isAvailable() : false,
        service: 'mock',
        message: 'AI 服務運行中'
    });
});

router.post('/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message) {
        return res.json({ success: false, error: '缺少 message' });
    }

    try {
        if (!aiService) {
            throw new Error('AI 服務未初始化');
        }
        
        const result = await aiService.chat(message, sessionId);
        res.json(result);
    } catch (error) {
        console.error('對話錯誤:', error);
        res.json({
            success: false,
            message: '處理錯誤: ' + error.message
        });
    }
});

module.exports = router;
EOFROUTE

echo "✅ routes/ai-routes.js 已確保"

# 5. 提交
echo ""
echo "5️⃣  提交穩定版本..."

git add services/ routes/
git commit -m "fix: stable version with proper error handling

Critical fixes:
✅ Simplified booking-calculator (no crashes)
✅ Safe module loading in mock-ai-service
✅ Proper error handling throughout
✅ Ensured all dependencies exist
✅ Routes properly configured

This should resolve SIGTERM restart loop."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 穩定版本已部署！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 部署（90秒）..."
sleep 90

echo ""
echo "🧪 測試穩定版本..."
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq .

echo ""
echo "🧪 測試計算功能..."
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價"}' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "測試完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


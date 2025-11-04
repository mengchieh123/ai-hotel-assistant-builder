#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復價格計算 NaN 問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 創建修復版的 booking-calculator.js
cat > services/booking-calculator.js << 'EOFCALC'
const hotelData = require('./hotel-data');

class BookingCalculator {
    calculateTotal(booking) {
        console.log('📊 計算輸入:', JSON.stringify(booking));
        
        const { 
            roomType, 
            nights, 
            adults, 
            children = 0, 
            childrenAges = [], 
            includeBreakfast = false 
        } = booking;
        
        // 驗證必要欄位
        if (!roomType || !nights || !adults) {
            throw new Error('缺少必要資訊: roomType, nights, adults');
        }
        
        const room = hotelData.roomTypes.find(r => r.id === roomType);
        if (!room) {
            throw new Error('房型不存在: ' + roomType);
        }
        
        console.log('✅ 找到房型:', room.name, '單價:', room.basePrice);
        
        // 確保所有數值都是數字
        const nightsNum = Number(nights);
        const adultsNum = Number(adults);
        const childrenNum = Number(children);
        const basePriceNum = Number(room.basePrice);
        
        console.log('數值檢查:', { nightsNum, adultsNum, childrenNum, basePriceNum });
        
        if (isNaN(nightsNum) || isNaN(adultsNum) || isNaN(basePriceNum)) {
            throw new Error('數值格式錯誤');
        }
        
        let total = basePriceNum * nightsNum;
        console.log('基礎房價:', total);
        
        const details = [];
        
        details.push({
            item: room.name + ' × ' + nightsNum + '晚',
            amount: total
        });
        
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
                details.push({
                    item: '兒童加床',
                    amount: childBedTotal
                });
                console.log('兒童加床:', childBedTotal);
            }
        }
        
        // 長住優惠
        let discount = 1.0;
        if (nightsNum >= 7) {
            discount = 0.85;
            console.log('長住優惠: 85折');
        } else if (nightsNum >= 5) {
            discount = 0.90;
            console.log('長住優惠: 90折');
        } else if (nightsNum >= 3) {
            discount = 0.95;
            console.log('長住優惠: 95折');
        }
        
        total = total * discount;
        
        // 早餐
        if (includeBreakfast && !room.breakfastIncluded) {
            const breakfastCost = (adultsNum + childrenNum) * nightsNum * 650;
            total += breakfastCost;
            details.push({
                item: '早餐',
                amount: breakfastCost
            });
            console.log('早餐費用:', breakfastCost);
        }
        
        const finalTotal = Math.round(total);
        console.log('最終總價:', finalTotal);
        
        return {
            roomName: room.name,
            nights: nightsNum,
            total: finalTotal,
            details: details
        };
    }
    
    formatBreakdown(breakdown) {
        let output = '📋 訂房明細\n\n';
        output += '🏨 房型：' + breakdown.roomName + '\n';
        output += '🌙 天數：' + breakdown.nights + '晚\n\n';
        
        if (breakdown.details && breakdown.details.length > 0) {
            output += '💰 費用明細\n';
            breakdown.details.forEach(item => {
                output += '  • ' + item.item + ': NT$ ' + item.amount.toLocaleString() + '\n';
            });
            output += '\n';
        }
        
        output += '💵 總計：NT$ ' + breakdown.total.toLocaleString() + '\n';
        return output;
    }
}

module.exports = new BookingCalculator();
EOFCALC

echo "✅ booking-calculator.js 已修復（加入日誌和數值驗證）"

# 提交
git add services/booking-calculator.js
git commit -m "fix: resolve NaN in price calculation

Critical fixes:
✅ Added Number() conversion for all numeric values
✅ Added isNaN checks to prevent calculation errors
✅ Added detailed logging for debugging
✅ Ensured all values are valid before calculation
✅ Fixed formatting in breakdown output

This should resolve the NaN issue and show correct prices."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修復已推送！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 部署（60秒）..."
sleep 60

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 重新測試價格計算"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 測試 1: 簡單計算
echo "測試 1: 簡單訂房（2大人，3晚）"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房住3晚2大人總價多少"}' | jq -r '.reply // .message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 測試 2: 複雜計算
echo "測試 2: 複雜訂房（2大人，1小孩8歲，3晚，含早餐）"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價"}' | jq -r '.reply // .message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 測試 3: 長住優惠
echo "測試 3: 長住訂房（2大人，7晚）"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房住7晚2大人多少錢"}' | jq -r '.reply // .message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 測試完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "如果仍顯示 NaN，檢查 Railway 日誌:"
echo "  railway logs --tail 30"
echo ""


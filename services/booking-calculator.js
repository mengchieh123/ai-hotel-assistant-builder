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

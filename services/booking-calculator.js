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

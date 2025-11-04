const hotelData = require('./hotel-data');

class BookingCalculator {
    calculateTotal(booking) {
        const { roomType, nights, adults, children = 0, childrenAges = [] } = booking;
        
        const room = hotelData.roomTypes.find(r => r.id === roomType);
        if (!room) throw new Error('房型不存在');
        
        let total = room.basePrice * nights;
        
        // 兒童加床
        childrenAges.forEach(age => {
            if (age > 6 && age <= 12) total += 800 * nights;
            else if (age > 12) total += 1200 * nights;
        });
        
        // 長住優惠
        if (nights >= 3) total *= 0.95;
        
        // 早餐
        if (booking.includeBreakfast) {
            total += (adults + children) * nights * 650;
        }
        
        return {
            roomName: room.name,
            nights: nights,
            total: Math.round(total),
            details: []
        };
    }
    
    formatBreakdown(breakdown) {
        return `📋 訂房明細\n\n🏨 房型：${breakdown.roomName}\n🌙 天數：${breakdown.nights}晚\n\n💵 總計：NT$ ${breakdown.total.toLocaleString()}`;
    }
}

module.exports = new BookingCalculator();

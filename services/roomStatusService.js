// 房態管理服務
class RoomStatusService {
    constructor() {
        this.roomInventory = {
            '豪華雙人房': { total: 10, blocked: 2 },
            '標準雙人房': { total: 20, blocked: 1 }
        };
        
        this.bookings = new Map();
    }
    
    checkAvailability(roomType, checkIn, checkOut, roomsNeeded = 1) {
        const roomInfo = this.roomInventory[roomType];
        
        if (!roomInfo) {
            return {
                available: false,
                error: '無效的房型'
            };
        }
        
        const availableRooms = roomInfo.total - roomInfo.blocked;
        
        // 模擬日期衝突檢查
        const conflictingBookings = this.getConflictingBookings(roomType, checkIn, checkOut);
        const actuallyAvailable = Math.max(0, availableRooms - conflictingBookings);
        
        return {
            available: actuallyAvailable >= roomsNeeded,
            availableRooms: actuallyAvailable,
            requestedRooms: roomsNeeded,
            checkIn: checkIn,
            checkOut: checkOut,
            roomType: roomType
        };
    }
    
    getConflictingBookings(roomType, checkIn, checkOut) {
        // 簡化的衝突檢查邏輯
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        // 模擬一些預訂衝突
        const randomConflicts = Math.floor(Math.random() * 3);
        return randomConflicts;
    }
    
    blockRooms(roomType, count, bookingId) {
        const roomInfo = this.roomInventory[roomType];
        
        if (!roomInfo) {
            return { success: false, error: '無效的房型' };
        }
        
        const available = roomInfo.total - roomInfo.blocked;
        
        if (available < count) {
            return { success: false, error: '房間數量不足' };
        }
        
        roomInfo.blocked += count;
        this.bookings.set(bookingId, { roomType, count, blocked: true });
        
        return { success: true, blocked: count };
    }
    
    releaseRooms(bookingId) {
        const booking = this.bookings.get(bookingId);
        
        if (booking && booking.blocked) {
            const roomInfo = this.roomInventory[booking.roomType];
            roomInfo.blocked = Math.max(0, roomInfo.blocked - booking.count);
            this.bookings.delete(bookingId);
            
            return { success: true, released: booking.count };
        }
        
        return { success: false, error: '預訂不存在或未鎖定房間' };
    }
}

// 正確導出類別實例
module.exports = new RoomStatusService();

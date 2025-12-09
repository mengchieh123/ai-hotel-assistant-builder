// service_mock_api.js (V5.9 - 增強可用性 API)

import dayjs from 'dayjs';

// --- 模擬數據庫 (移動到 Class 外部保持 V5.8 的結構，但新增 dayjs 邏輯) ---

const MOCK_ROOM_PRICING = {
    '標準雙人房': { price: 2200, capacity: 2, weekendMultiplier: 1.2 },
    '豪華客房': { price: 3200, capacity: 2, weekendMultiplier: 1.3 },
    '行政套房': { price: 4800, capacity: 2, weekendMultiplier: 1.1 },
    '家庭四人房': { price: 4500, capacity: 4, weekendMultiplier: 1.2 }
};

const MOCK_ADDONS_SERVICE = {
    'ADD001': { name: '機場接送', price: 1200, isPerNight: false, type: 'per_group', description: '單程機場接送服務' },
    'ADD002': { name: '晚餐券', price: 800, isPerNight: true, type: 'per_person', description: '每晚提供晚餐券' }, 
    'ADD003': { name: '迎賓香檳', price: 600, isPerNight: false, type: 'per_group', description: '一次性高級迎賓香檳' }
};

const MOCK_MEMBER_CREDENTIALS = { 'VIP': '1234' }; 

let CURRENT_INVENTORY = {
    '標準雙人房': 5,
    '豪華客房': 2,
    '行政套房': 10,
    '家庭四人房': 3
};
let ACTIVE_LOCKS = {}; 

// --- 輔助函數 ---

function simulateDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- 核心 API 接口 (使用 Class 統一匯出) ---

class MockAPI {
    
    /**
     * 🏆 新增: 取得指定條件下的可用房型 (用於初期篩選)
     */
    static async getAvailableRooms(checkInDate, nights = 1, guests = 1) {
        await simulateDelay(100);
        
        const availableRooms = [];
        
        // 假設週末判斷僅需判斷第一晚
        const checkDate = dayjs(checkInDate);
        // day() === 0 (Sun) 或 6 (Sat)
        const isWeekend = checkDate.isValid() && (checkDate.day() === 0 || checkDate.day() === 6); 

        for (const [type, details] of Object.entries(MOCK_ROOM_PRICING)) {
            const inventory = CURRENT_INVENTORY[type] || 0;
            const priceMultiplier = isWeekend ? details.weekendMultiplier : 1;
            const finalPrice = details.price * priceMultiplier;
            
            if (inventory > 0 && details.capacity >= guests) {
                availableRooms.push({
                    roomType: type,
                    basePricePerNight: Math.round(finalPrice),
                    capacity: details.capacity,
                    availableCount: inventory,
                    weekendPremium: isWeekend
                });
            }
        }
        
        // 如果沒有有效的日期，返回所有房型，價格為基礎價 (用於初期引導)
        if (!checkDate.isValid() || !checkInDate) {
            return Object.keys(MOCK_ROOM_PRICING).map(type => ({
                roomType: type,
                basePricePerNight: MOCK_ROOM_PRICING[type].price,
                capacity: MOCK_ROOM_PRICING[type].capacity,
                availableCount: CURRENT_INVENTORY[type] || 0
            })).filter(room => room.availableCount > 0);
        }
        
        return availableRooms;
    }

    /**
     * 取得房價細節和加購服務列表
     */
    static async getPricingDetails(roomType) {
        await simulateDelay(50);
        return {
            roomDetails: MOCK_ROOM_PRICING[roomType],
            addons: MOCK_ADDONS_SERVICE
        };
    }

    /**
     * 取得加購服務列表 (用於 UI 顯示)
     */
    static async getAddonsList() {
        await simulateDelay(50);
        return Object.keys(MOCK_ADDONS_SERVICE).map(id => ({
            id: id,
            title: MOCK_ADDONS_SERVICE[id].name,
            description: MOCK_ADDONS_SERVICE[id].description
        }));
    }

    /**
     * 模擬會員登入驗證
     */
    static async verifyMember(account, password) {
        await simulateDelay(200);
        const storedPassword = MOCK_MEMBER_CREDENTIALS[account.toUpperCase()];
        const isSuccessful = (storedPassword === password);
        
        if (account.toUpperCase() === 'ERROR') { 
            throw new Error('Member API Service Down: Test Failure');
        }

        return {
            isSuccessful: isSuccessful,
            memberId: isSuccessful ? 12345 : null
        };
    }

    /**
     * 鎖定庫存
     */
    static async lockInventory(roomType, roomCount) {
        await simulateDelay(150);
        const currentCount = CURRENT_INVENTORY[roomType] || 0;

        if (currentCount >= roomCount) {
            const lockId = `LOCK-${Date.now()}-${roomType.substring(0, 2)}`;
            ACTIVE_LOCKS[lockId] = { roomType, roomCount, timestamp: Date.now() };
            CURRENT_INVENTORY[roomType] -= roomCount; 
            
            // 設置 15 秒超時自動解鎖
            setTimeout(() => {
                if (ACTIVE_LOCKS[lockId]) {
                    CURRENT_INVENTORY[ACTIVE_LOCKS[lockId].roomType] += ACTIVE_LOCKS[lockId].roomCount;
                    delete ACTIVE_LOCKS[lockId];
                }
            }, 15000);

            return { isLocked: true, lockId: lockId, remaining: CURRENT_INVENTORY[roomType] };
        } else {
            return { isLocked: false, message: '庫存不足', remaining: currentCount };
        }
    }

    /**
     * 解除庫存鎖定
     */
    static async unlockInventory(lockId) {
        if (ACTIVE_LOCKS[lockId]) {
            CURRENT_INVENTORY[ACTIVE_LOCKS[lockId].roomType] += ACTIVE_LOCKS[lockId].roomCount;
            delete ACTIVE_LOCKS[lockId];
            return { isUnlocked: true };
        }
        return { isUnlocked: false };
    }

    /**
     * 提交最終訂單
     */
    static async submitBooking(bookingData) {
        await simulateDelay(300);
        
        const lockId = bookingData.inventoryLockId;
        
        if (!lockId || !ACTIVE_LOCKS[lockId]) {
            return { success: false, message: '庫存鎖定已失效，請重新預訂以鎖定房型。' };
        }
        
        if (bookingData.contactName && bookingData.finalPrice > 0) {
            
            await this.unlockInventory(lockId);  
            
            const bookingId = `BOOK-${Date.now()}`;
            return { success: true, bookingId: bookingId };
        } else {
            
            await this.unlockInventory(lockId);  
            return { success: false, message: '預訂資料不完整。' };
        }
    }
    
    static simulateDelay = simulateDelay;
}

export { MockAPI };

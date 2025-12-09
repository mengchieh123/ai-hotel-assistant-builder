// service_mock_api.js (V5.8 - 完整的 ESM 命名匯出)

// 🏆 ESM 導入：將 require('dayjs') 替換為 import
import dayjs from 'dayjs';

// --- 模擬數據庫 ---

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
let ACTIVE_LOCKS = {}; // 追蹤所有活躍的庫存鎖

// --- 輔助函數 ---

function simulateDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- 核心 API 接口 (使用 Class 統一匯出) ---

class MockAPI {
    
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
     * 提交最終訂單 (V5.1 優化：強制檢查鎖定狀態)
     */
    static async submitBooking(bookingData) {
        await simulateDelay(300);
        
        const lockId = bookingData.inventoryLockId;
        
        // 1. 檢查庫存鎖定是否仍然存在
        if (!lockId || !ACTIVE_LOCKS[lockId]) {
            return { success: false, message: '庫存鎖定已失效，請重新預訂以鎖定房型。' };
        }
        
        // 2. 業務邏輯檢查
        if (bookingData.contactName && bookingData.finalPrice > 0) {
            
            // 3. 提交成功，立即手動解鎖（防止超時機制重複操作）
            await this.unlockInventory(lockId);  // 使用 this.unlockInventory
            
            const bookingId = `BOOK-${Date.now()}`;
            return { success: true, bookingId: bookingId };
        } else {
            
            // 4. 數據不完整，手動解鎖並返回失敗 (不讓庫存被鎖定在失敗的訂單上)
            await this.unlockInventory(lockId);  // 使用 this.unlockInventory
            return { success: false, message: '預訂資料不完整。' };
        }
    }
    
    // 雖然這個函數沒有被外部調用，但我們讓它保持靜態
    static simulateDelay = simulateDelay;
}


// 🏆 最終修正：使用命名匯出
export { MockAPI };

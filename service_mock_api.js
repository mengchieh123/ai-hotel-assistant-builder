// service_mock_api.js (V6.0 - 完整修復版)

import dayjs from 'dayjs';

// --- 模擬數據庫 ---

const MOCK_ROOM_PRICING = {
    '標準雙人房': { price: 2200, capacity: 2, weekendMultiplier: 1.2 },
    '豪華客房': { price: 3200, capacity: 2, weekendMultiplier: 1.3 },
    '行政套房': { price: 4800, capacity: 2, weekendMultiplier: 1.1 },
    '家庭四人房': { price: 4500, capacity: 4, weekendMultiplier: 1.2 }
};

const MOCK_ADDONS_SERVICE = {
    'ADD001': { name: '機場接送', price: 1200, isPerNight: false, type: 'one_time', description: '單程機場接送服務' },
    'ADD002': { name: '晚餐券', price: 800, isPerNight: true, type: 'per_person', description: '每晚提供晚餐券' }, 
    'ADD003': { name: '迎賓香檳', price: 600, isPerNight: false, type: 'one_time', description: '一次性高級迎賓香檳' }
};

// 🎯 修復：擴充會員數據庫
const MOCK_MEMBER_CREDENTIALS = { 
    'VIP': '1234',
    '0912345678': '1234',
    '0922999888': '1234',
    'test@example.com': '1234',
    'lee.d.w@test.com': '1234'
}; 

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

// --- 核心 API 接口 ---

class MockAPI {
    
    /**
     * 🏆 取得指定條件下的可用房型 (用於初期篩選)
     */
    static async getAvailableRooms(checkInDate, nights = 1, guests = 1) {
        await simulateDelay(100);
        
        const availableRooms = [];
        
        const checkDate = dayjs(checkInDate);
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
        
        if (!MOCK_ROOM_PRICING[roomType]) {
            throw new Error(`房型 ${roomType} 不存在`);
        }
        
        // ✅ 修正 1.1: 確保 addons 輸出包含 ID 資訊
        const addonsWithId = Object.entries(MOCK_ADDONS_SERVICE).reduce((acc, [id, details]) => {
            acc[id] = { ...details, id: id };
            return acc;
        }, {});
        
        return {
            roomDetails: MOCK_ROOM_PRICING[roomType],
            addons: addonsWithId 
        };
    }

    /**
     * 取得加購服務列表 (用於 UI 顯示) - 修正後應使用 getPricingDetails.addons
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
        
        // 🎯 修復：處理各種帳號格式
        let normalizedAccount = account;
        if (typeof account === 'string') {
            // 移除空白和特殊字符
            normalizedAccount = account.trim();
        }
        
        // 檢查帳號是否存在（支援手機號碼和email）
        const isAccountExists = Object.keys(MOCK_MEMBER_CREDENTIALS).some(key => 
            key.toLowerCase() === normalizedAccount.toLowerCase()
        );
        
        const storedPassword = MOCK_MEMBER_CREDENTIALS[normalizedAccount] || 
                              MOCK_MEMBER_CREDENTIALS[normalizedAccount.toLowerCase()];
        
        const isSuccessful = isAccountExists && (storedPassword === password);
        
        // 測試錯誤情況
        if (account.toUpperCase() === 'ERROR') { 
            throw new Error('Member API Service Down: Test Failure');
        }

        return {
            isSuccessful: isSuccessful,
            memberId: isSuccessful ? 12345 : null,
            message: isSuccessful ? '登入成功' : '帳號或密碼錯誤'
        };
    }

    /**
     * 會員註冊
     */
    static async registerMember(account) {
        await simulateDelay(300);
        
        // 🎯 修復：檢查帳號是否已存在
        const normalizedAccount = account.trim();
        const accountExists = Object.keys(MOCK_MEMBER_CREDENTIALS).some(key => 
            key.toLowerCase() === normalizedAccount.toLowerCase()
        );
        
        if (accountExists) {
            return {
                isSuccessful: false,
                message: '此帳號已存在，請使用其他帳號或直接登入。'
            };
        }
        
        // 模擬註冊成功
        // 在真實環境中，這裡應該將帳號密碼存入資料庫
        MOCK_MEMBER_CREDENTIALS[normalizedAccount] = 'default123'; // 預設密碼
        
        return {
            isSuccessful: true,
            message: '註冊成功！系統已為您設定預設密碼，請登入後修改。'
        };
    }

    /**
     * 鎖定庫存
     */
    static async lockInventory(roomType, roomCount) {
        await simulateDelay(150);
        
        if (!MOCK_ROOM_PRICING[roomType]) {
            return { 
                isLocked: false, 
                message: '無效的房型', 
                remaining: 0 
            };
        }
        
        const currentCount = CURRENT_INVENTORY[roomType] || 0;

        if (currentCount >= roomCount) {
            const lockId = `LOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            ACTIVE_LOCKS[lockId] = { 
                roomType, 
                roomCount, 
                timestamp: Date.now(),
                expiresAt: Date.now() + 300000 // 5分鐘後過期
            };
            CURRENT_INVENTORY[roomType] -= roomCount; 
            
            // 設定自動解鎖計時器
            setTimeout(() => {
                if (ACTIVE_LOCKS[lockId]) {
                    console.log(`[MOCK API] 鎖定 ${lockId} 已過期，自動釋放庫存`);
                    CURRENT_INVENTORY[ACTIVE_LOCKS[lockId].roomType] += ACTIVE_LOCKS[lockId].roomCount;
                    delete ACTIVE_LOCKS[lockId];
                }
            }, 300000);

            return { 
                isLocked: true, 
                lockId: lockId, 
                remaining: CURRENT_INVENTORY[roomType],
                message: '庫存鎖定成功'
            };
        } else {
            return { 
                isLocked: false, 
                message: '庫存不足', 
                remaining: currentCount 
            };
        }
    }

    /**
     * 解除庫存鎖定
     */
    static async unlockInventory(lockId) {
        await simulateDelay(50);
        
        if (!lockId) {
            return { isUnlocked: false, message: '無效的鎖定 ID' };
        }
        
        if (ACTIVE_LOCKS[lockId]) {
            CURRENT_INVENTORY[ACTIVE_LOCKS[lockId].roomType] += ACTIVE_LOCKS[lockId].roomCount;
            delete ACTIVE_LOCKS[lockId];
            return { isUnlocked: true, message: '庫存已釋放' };
        }
        return { isUnlocked: false, message: '鎖定不存在或已過期' };
    }

    /**
     * 檢查庫存鎖定狀態
     */
    static async checkLockStatus(lockId) {
        await simulateDelay(50);
        
        const lock = ACTIVE_LOCKS[lockId];
        if (!lock) {
            return { isValid: false, message: '鎖定不存在' };
        }
        
        const isExpired = Date.now() > lock.expiresAt;
        if (isExpired) {
            // 自動清理過期鎖定
            CURRENT_INVENTORY[lock.roomType] += lock.roomCount;
            delete ACTIVE_LOCKS[lockId];
            return { isValid: false, message: '鎖定已過期' };
        }
        
        return { 
            isValid: true, 
            roomType: lock.roomType,
            roomCount: lock.roomCount,
            expiresIn: Math.max(0, lock.expiresAt - Date.now())
        };
    }

    /**
     * 提交最終訂單
     */
    static async submitBooking(bookingData) {
        await simulateDelay(300);
        
        console.log('[MOCK API] 提交訂單資料:', {
            roomType: bookingData.roomType,
            finalPrice: bookingData.finalPrice,
            contactName: bookingData.contactName,
            hasLock: !!bookingData.inventoryLockId
        });
        
        const lockId = bookingData.inventoryLockId;
        
        if (lockId) {
            const lockStatus = await this.checkLockStatus(lockId);
            if (!lockStatus.isValid) {
                return { 
                    isSuccessful: false, 
                    message: '庫存鎖定已失效，請重新預訂以鎖定房型。' 
                };
            }
        } else {
            // 沒有鎖定 ID，直接檢查庫存
            const roomType = bookingData.roomType;
            const roomCount = parseInt(bookingData.roomCount) || 1;
            const currentCount = CURRENT_INVENTORY[roomType] || 0;
            
            if (currentCount < roomCount) {
                return { 
                    isSuccessful: false, 
                    message: '目前庫存不足，請選擇其他房型或稍後再試。' 
                };
            }
        }
        
        // 🎯 檢查必要資料
        const requiredFields = ['contactName', 'contactPhone', 'contactEmail', 'finalPrice'];
        const missingFields = requiredFields.filter(field => !bookingData[field]);
        
        if (missingFields.length > 0) {
            return { 
                isSuccessful: false, 
                message: `預訂資料不完整，缺少：${missingFields.join(', ')}` 
            };
        }
        
        if (bookingData.finalPrice <= 0) {
            return { 
                isSuccessful: false, 
                message: '價格計算錯誤，請重新計算價格。' 
            };
        }
        
        // 🎯 解除庫存鎖定（如果存在）
        if (lockId) {
            await this.unlockInventory(lockId);
        }
        
        // 🎯 生成訂單 ID
        const orderId = `BOOK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // 🎯 記錄訂單（在真實環境中這裡會寫入資料庫）
        const orderRecord = {
            orderId: orderId,
            timestamp: new Date().toISOString(),
            roomType: bookingData.roomType,
            roomCount: bookingData.roomCount,
            checkInDate: bookingData.checkInDate,
            nights: bookingData.nights,
            adultCount: bookingData.adultCount,
            childCount: bookingData.childCount || 0,
            contactName: bookingData.contactName,
            contactPhone: bookingData.contactPhone,
            contactEmail: bookingData.contactEmail,
            paymentMethod: bookingData.paymentMethod || '未選擇',
            finalPrice: bookingData.finalPrice,
            isLoggedIn: bookingData.isLoggedIn || false,
            addons: bookingData.addons || [],
            specialRequest: bookingData.specialRequest || null
        };
        
        console.log('[MOCK API] 訂單建立成功:', orderId);
        
        return { 
            isSuccessful: true, 
            orderId: orderId,
            message: '訂單提交成功！我們已收到您的預訂。',
            details: {
                bookingDate: new Date().toLocaleDateString('zh-TW'),
                estimatedCheckInTime: '15:00',
                estimatedCheckOutTime: '11:00'
            }
        };
    }
    
    /**
     * 🎯 新增：重置模擬資料庫（用於測試）
     */
    static resetMockData() {
        CURRENT_INVENTORY = {
            '標準雙人房': 5,
            '豪華客房': 2,
            '行政套房': 10,
            '家庭四人房': 3
        };
        ACTIVE_LOCKS = {};
        
        console.log('[MOCK API] 模擬資料庫已重置');
        return { success: true };
    }
    
    /**
     * 🎯 新增：取得當前庫存狀態（用於除錯）
     */
    static getInventoryStatus() {
        return {
            inventory: { ...CURRENT_INVENTORY },
            activeLocks: Object.keys(ACTIVE_LOCKS).length,
            lockDetails: Object.entries(ACTIVE_LOCKS).map(([id, lock]) => ({
                id,
                roomType: lock.roomType,
                roomCount: lock.roomCount,
                expiresIn: Math.max(0, lock.expiresAt - Date.now())
            }))
        };
    }
    
    /**
     * 🎯 新增：模擬日期檢查
     */
    static async checkDateAvailability(checkInDate, nights, roomType) {
        await simulateDelay(100);
        
        const checkDate = dayjs(checkInDate);
        if (!checkDate.isValid()) {
            return { available: false, message: '無效的日期格式' };
        }
        
        if (checkDate.isBefore(dayjs(), 'day')) {
            return { available: false, message: '入住日期不能是過去日期' };
        }
        
        const maxDaysInAdvance = 180; // 最多預訂180天內
        if (checkDate.isAfter(dayjs().add(maxDaysInAdvance, 'day'))) {
            return { available: false, message: '最多只能預訂180天內的日期' };
        }
        
        const inventory = CURRENT_INVENTORY[roomType] || 0;
        return { 
            available: inventory > 0, 
            message: inventory > 0 ? '日期可用' : '該日期已無空房',
            availableCount: inventory
        };
    }
    
    static simulateDelay = simulateDelay;
}

export { MockAPI };

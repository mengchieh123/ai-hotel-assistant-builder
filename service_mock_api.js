// service_mock_api.js

/**
 * 模擬外部服務 API 接口
 * 包含房價、加購服務、會員驗證及庫存鎖定功能
 */

const MOCK_ROOM_PRICING = {
    '標準雙人房': { price: 2200, capacity: 2 },
    '豪華客房': { price: 3200, capacity: 2 },
    '行政套房': { price: 4800, capacity: 2 },
    '家庭四人房': { price: 4500, capacity: 4 }
};

const MOCK_ADDONS_SERVICE = {
    'ADD001': { name: '機場接送', price: 1200 },
    'ADD002': { name: '晚餐券 (兩人份)', price: 800 },
    'ADD003': { name: '迎賓香檳', price: 600 }
};

const MOCK_MEMBER_CREDENTIALS = { 'VIP': '1234' }; 

// 模擬當前庫存狀態 (實際串接資料庫後，這裡會改為資料庫查詢)
let CURRENT_INVENTORY = {
    '標準雙人房': 5,
    '豪華客房': 2, // 模擬庫存緊張
    '行政套房': 10,
    '家庭四人房': 3
};

// 模擬庫存鎖定數據
let ACTIVE_LOCKS = {};

// --- 輔助函數 ---

/** 模擬網路延遲 */
function simulateDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- 核心 API 函數 ---

/** 模擬獲取價格明細 */
async function getPricingDetails(roomType) {
    await simulateDelay(50);
    
    // 實際會從 API 查詢浮動房價，這裡返回模擬數據
    return {
        roomDetails: MOCK_ROOM_PRICING[roomType],
        addons: MOCK_ADDONS_SERVICE
    };
}

/** 模擬會員登入驗證 */
async function verifyMember(account, password) {
    await simulateDelay(200);

    const storedPassword = MOCK_MEMBER_CREDENTIALS[account.toUpperCase()];
    const isSuccessful = (storedPassword === password);
    
    // 模擬 API 錯誤 (測試用)
    if (account.toUpperCase() === 'ERROR') { 
        throw new Error('Member API Service Down: Test Failure');
    }

    return {
        isSuccessful: isSuccessful,
        memberId: isSuccessful ? 12345 : null
    };
}


/** 模擬庫存鎖定 (實現階段 2) */
async function lockInventory(roomType, roomCount) {
    await simulateDelay(150);

    const currentCount = CURRENT_INVENTORY[roomType] || 0;

    if (currentCount >= roomCount) {
        // 鎖定成功
        const lockId = `LOCK-${Date.now()}-${roomType.substring(0, 2)}`;
        ACTIVE_LOCKS[lockId] = { roomType, roomCount, timestamp: Date.now() };
        CURRENT_INVENTORY[roomType] -= roomCount; 

        // 🚨 模擬超時自動釋放（15 秒）
        setTimeout(() => {
            if (ACTIVE_LOCKS[lockId]) {
                CURRENT_INVENTORY[roomType] += ACTIVE_LOCKS[lockId].roomCount;
                delete ACTIVE_LOCKS[lockId];
                console.log(`[Mock] Lock ${lockId} timed out and released.`);
            }
        }, 15000);

        return { isLocked: true, lockId: lockId, remaining: CURRENT_INVENTORY[roomType] };
    } else {
        // 鎖定失敗，庫存不足
        return { isLocked: false, message: '庫存不足', remaining: currentCount };
    }
}

/** 模擬解除鎖定/交易完成時釋放資源 */
async function unlockInventory(lockId) {
    if (ACTIVE_LOCKS[lockId]) {
        CURRENT_INVENTORY[ACTIVE_LOCKS[lockId].roomType] += ACTIVE_LOCKS[lockId].roomCount;
        delete ACTIVE_LOCKS[lockId];
        return { isUnlocked: true };
    }
    return { isUnlocked: false };
}


module.exports = {
    getPricingDetails,
    verifyMember,
    lockInventory,
    unlockInventory
};

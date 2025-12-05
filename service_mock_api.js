// service_mock_api.js (V1.18 - 最終版)

/**
 * 模擬外部服務 API 接口
 */

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

/** 模擬網路延遲 */
function simulateDelay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- 核心 API 函數 ---

async function getPricingDetails(roomType) {
    await simulateDelay(50);
    return {
        roomDetails: MOCK_ROOM_PRICING[roomType],
        addons: MOCK_ADDONS_SERVICE
    };
}

async function verifyMember(account, password) {
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

async function lockInventory(roomType, roomCount) {
    await simulateDelay(150);
    const currentCount = CURRENT_INVENTORY[roomType] || 0;

    if (currentCount >= roomCount) {
        const lockId = `LOCK-${Date.now()}-${roomType.substring(0, 2)}`;
        ACTIVE_LOCKS[lockId] = { roomType, roomCount, timestamp: Date.now() };
        CURRENT_INVENTORY[roomType] -= roomCount; 
        
        // 模擬超時自動釋放
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

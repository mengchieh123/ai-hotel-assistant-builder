const dayjs = require('dayjs');
// 假設您的 MockAPI.js 在同一目錄層級
const MockAPI = require('./MockAPI'); 

// --- 輔助函數：日誌記錄 ---
function log(level, message, details = {}) {
    const timestamp = dayjs().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, details);
}

// --- 1. 流程前置檢查 ---

/**
 * 檢查日期和晚數的有效性。
 */
function checkDateCompleteness(session) {
    const data = session.collectedData;
    const { checkInDate, nights } = data;

    if (checkInDate && nights && parseInt(nights) > 0) {
        // 假設日期格式和晚數都有效
        log('DEBUG', 'Date and nights are complete.');
        // 推進到下一步：詢問人數
        return { isHandled: true, nextStep: 'ask_guest_count' };
    }

    log('WARNING', 'Date or nights missing/invalid.', { checkInDate, nights });
    // 導回收集日期
    return { isHandled: true, nextStep: 'ask_nights_and_dates', prompt: '請確認您的入住日期和晚數。' };
}

/**
 * 檢查核心預訂數據（房型、日期、人數、間數）是否完整。
 */
function checkBookingEssentials(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;

    if (!roomType || !checkInDate || !nights || !roomCount || !adultCount) {
        log('ERROR', 'Missing essential booking data.', data);
        return { isHandled: true, prompt: '資料不完整，請從頭開始預訂。', nextStep: 'init' };
    }

    log('INFO', 'All booking essentials are present.');
    // 成功，推進到下一步：驗證人數容量
    return { isHandled: true, nextStep: 'validate_capacity' };
}

// --- 2. 業務邏輯：人數容量驗證 (新加入) ---

/**
 * 驗證房型是否能容納總人數。
 * 如果人數超限，則清除人數資訊並導回 ask_guest_count。
 */
async function validateRoomCapacity(session) {
    const data = session.collectedData;
    const { roomType, roomCount, adultCount, childCount } = data;
    
    // 總人數：確保轉為數字
    const totalGuests = parseInt(adultCount) + parseInt(childCount || 0); 
    const numRooms = parseInt(roomCount);

    if (isNaN(totalGuests) || totalGuests <= 0 || isNaN(numRooms) || numRooms <= 0) {
        log('WARNING', 'Guest count or room count invalid during capacity check.');
        return { isHandled: true, nextStep: 'ask_guest_count', prompt: '請提供有效的人數和房間數。' };
    }
    
    try {
        const pricingData = await MockAPI.getPricingDetails(roomType);
        // 假設 API 返回 roomDetails 包含 capacity
        const capacity = pricingData.roomDetails ? pricingData.roomDetails.capacity : 0; 

        if (capacity <= 0) {
            log('ERROR', `Room type ${roomType} capacity not found.`);
            return { isHandled: true, nextStep: 'show_room_types', prompt: '房型容量數據缺失，請重新選擇房型。' };
        }

        // 計算最大可容納人數
        const maxCapacity = capacity * numRooms;

        if (totalGuests > maxCapacity) {
            // 人數超過上限
            const message = `⚠️ **房型人數警告**：您預訂了 ${numRooms} 間【${roomType}】，每間最多容納 ${capacity} 人，總共最多容納 ${maxCapacity} 人，但您總共有 **${totalGuests} 人**。請減少人數或增加房間數。`;
            
            // **清除人數資訊，強制流程返回收集**
            delete data.adultCount;
            delete data.childCount; 
            
            return {
                isHandled: true,
                prompt: message,
                nextStep: 'ask_guest_count' // 導回收集人數
            };
        }
        
        log('INFO', 'Room capacity validated.', { totalGuests, maxCapacity });
        // 驗證成功，推進到下一步：鎖定庫存
        return { isHandled: true, nextStep: 'lock_inventory' };

    } catch (error) {
        log('ERROR', 'Capacity check API failed.', { error: error.message });
        return { 
            isHandled: true, 
            nextStep: 'lock_inventory', // API 失敗，允許繼續，但在最終提交前需謹慎
            prompt: '人數驗證服務暫時中斷，繼續嘗試鎖定庫存...' 
        };
    }
}

// --- 3. 業務邏輯：庫存鎖定 ---

/**
 * 呼叫 MockAPI 鎖定庫存。
 */
async function lockInventoryLogic(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 如果之前已經有鎖定 ID，先嘗試解鎖，避免重複鎖定
    if (data.inventoryLockId) {
        await MockAPI.unlockInventory(data.inventoryLockId);
        delete data.inventoryLockId;
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));

        if (lockResult.isLocked) {
            log('SUCCESS', 'Inventory locked.', { lockId: lockResult.lockId });
            data.inventoryLockId = lockResult.lockId;
            // 鎖定成功，推進到下一步：價格計算
            return { isHandled: true, nextStep: 'calculate_price_logic' };
        } else {
            // 庫存不足或鎖定失敗
            log('WARNING', 'Inventory lock failed.', lockResult);
            
            // **關鍵修正：庫存不足時清除間數，強制用戶重新選擇。**
            delete data.roomCount; 
            
            const message = `😭 **抱歉，您選擇的【${roomType}】庫存不足** (剩餘 ${lockResult.remaining} 間)。請重新選擇房型或間數。`;
            
            // 導回選擇房型或間數
            return {
                isHandled: true,
                prompt: message,
                nextStep: 'show_room_types' // 導回選擇房型，可順便修改間數
            };
        }
    } catch (error) {
        log('FATAL', 'Lock Inventory API Failed.', { error: error.message });
        return { isHandled: true, prompt: '庫存鎖定服務異常，請稍後再試。', nextStep: 'init' };
    }
}


// --- 4. 業務邏輯：價格計算 ---

/**
 * 根據 Session 數據計算總價格。
 */
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount, childCount, addons } = data;

    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        if (!roomDetails) {
            return { isHandled: true, prompt: '查詢房型價格失敗，請重新選擇。', nextStep: 'show_room_types' };
        }

        let totalPrice = 0;
        let priceDetails = [];
        let totalAddonCost = 0;
        const totalGuests = parseInt(adultCount) + parseInt(childCount || 0);

        // --- 1. 計算房間總價 ---
        let currentDay = dayjs(checkInDate);
        for (let i = 0; i < nights; i++) {
            const isWeekend = currentDay.day() === 5 || currentDay.day() === 6; // 週五和週六
            const multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
            const nightPrice = roomDetails.price * multiplier * parseInt(roomCount);
            totalPrice += nightPrice;
            
            priceDetails.push({ 
                date: currentDay.format('YYYY/MM/DD'), 
                price: nightPrice, 
                isWeekend 
            });
            currentDay = currentDay.add(1, 'day');
        }

        // --- 2. 計算加購服務總價 ---
        if (addons && addons.length > 0) {
            const allAddons = pricing.addons;
            for (const addonId of addons) {
                const addonItem = allAddons[addonId];
                if (addonItem) {
                    let cost = addonItem.price;
                    if (addonItem.isPerNight) cost *= nights; 
                    if (addonItem.type === 'per_person') cost *= totalGuests; 
                    
                    totalAddonCost += cost;
                }
            }
        }
        
        // --- 3. 應用服務費/稅費 (假設為 5% 總價) ---
        const serviceFee = (totalPrice + totalAddonCost) * 0.05;

        // --- 4. 最終價格 ---
        const finalPrice = totalPrice + totalAddonCost + serviceFee;
        
        // 更新 Session
        Object.assign(data, {
            totalPrice: Math.round(totalPrice),
            childCost: 0,
            serviceFee: Math.round(serviceFee),
            finalPrice: Math.round(finalPrice),
            priceDetails: priceDetails 
        });

        log('INFO', `Price calculated: NT$${data.finalPrice}`);
        return { 
            isHandled: true, 
            prompt: `房價已計算完畢：NT$${data.finalPrice}（含服務費和加購項目）。`,
            nextStep: 'ask_member_login' 
        };

    } catch (error) {
        log('ERROR', 'Price calculation failed:', error);
        return { 
            isHandled: true, 
            prompt: '價格計算服務暫時故障，請稍後再試。', 
            nextStep: 'init' 
        };
    }
}

// --- 5. 會員/登入邏輯 ---

/**
 * 處理會員登入邏輯。
 */
async function processMemberLogin(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    if (!memberAccount || !memberPassword) {
        // 應該在 RuleEngine 收集完整後才觸發此 Handler
        return { isHandled: false }; 
    }

    try {
        const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            log('SUCCESS', 'Member logged in.', { memberAccount });
            return {
                isHandled: true,
                prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                nextStep: 'ask_contact_info' // 登入成功，推進到聯絡資訊
            };
        } else {
            data.isLoggedIn = false;
            log('WARNING', 'Member login failed.');
            // 清除密碼，讓用戶重新嘗試或跳過
            delete data.memberPassword; 
            return {
                isHandled: true,
                prompt: '帳號或密碼錯誤，請重新輸入。若要跳過請輸入「跳過」。',
                nextStep: 'login_member_account' // 導回登入狀態
            };
        }
    } catch (error) {
        log('FATAL', 'Member API Service Failed.', { error: error.message });
        return {
            isHandled: true,
            prompt: '會員驗證服務異常，請直接進行預訂。',
            nextStep: 'ask_contact_info' // 服務異常則跳過登入
        };
    }
}

// --- 6. 最終提交 ---

/**
 * 處理最終訂單提交邏輯。
 */
async function handleBookingConfirmation(session) {
    const data = session.collectedData;
    // 再次檢查核心資料和庫存鎖定
    if (!data.contactName || !data.inventoryLockId || data.finalPrice <= 0) {
        log('ERROR', 'Missing critical data for submission.', data);
        // 如果有鎖定ID，先嘗試解鎖
        if (data.inventoryLockId) {
            await MockAPI.unlockInventory(data.inventoryLockId);
            delete data.inventoryLockId;
        }
        return { isHandled: true, prompt: '資料不完整或價格計算有誤，無法提交訂單。', nextStep: 'init' };
    }

    try {
        const result = await MockAPI.submitBooking(data);

        if (result.success) {
            log('SUCCESS', 'Booking submitted.', { bookingId: result.bookingId });
            // 清除 Session 數據，防止重用
            session.collectedData = {}; 
            return {
                isHandled: true,
                prompt: `🎉 **預訂成功！** 您的訂單編號是 **${result.bookingId}**。總價 NT$${data.finalPrice} 已確認。感謝您的預訂。`,
                nextStep: 'init' // 導回初始狀態
            };
        } else {
            log('WARNING', 'Booking submission failed.', result);
            return {
                isHandled: true,
                prompt: `提交訂單失敗：${result.message}。請重新開始預訂。`,
                nextStep: 'init' 
            };
        }
    } catch (error) {
        log('FATAL', 'Submit Booking API Failed.', { error: error.message });
        return {
            isHandled: true,
            prompt: '提交訂單服務異常，請聯絡客服。',
            nextStep: 'init'
        };
    }
}


module.exports = {
    checkDateCompleteness,
    checkBookingEssentials,
    validateRoomCapacity, // <-- 處理人數超限檢查
    lockInventoryLogic,
    calculatePriceLogic,
    processMemberLogin,
    handleBookingConfirmation
};

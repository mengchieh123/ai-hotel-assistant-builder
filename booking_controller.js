// booking_controller.js (V1.21 - 數據完整性強化版)

const MockAPI = require('./service_mock_api'); 
const sessionManager = require('./session_manager'); // 用於 session 相關操作

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05;

// --- 結構化日誌函數 ---
function log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level, message, details }));
}

// --- 價格計算核心邏輯 ---

/**
 * 內部輔助函數：計算詳細價格明細。
 * @param {object} data - session.collectedData
 */
async function getPriceDetails(data) {
    // 嚴格檢查核心預訂數據
    if (!data.nights || !data.roomType || !data.adultCount || !data.roomCount) { 
        log('WARNING', 'Price calculation skipped due to missing essential data.', { 
            nights: data.nights, roomType: data.roomType, adultCount: data.adultCount, roomCount: data.roomCount 
        });
        return { roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, serviceFee: 0, finalPrice: 0, error: true };
    }

    try {
        const pricingData = await MockAPI.getPricingDetails(data.roomType);
        const roomDetails = pricingData.roomDetails;
        const ADDONS_SERVICE = pricingData.addons; 

        if (!roomDetails) {
            log('ERROR', 'Room details not found in API response', { roomType: data.roomType });
            return { roomCost: 0, childCost: 0, finalPrice: 0, error: true, errorMessage: '無效房型或價格 API 錯誤' };
        }

        let roomCost = 0;
        const totalNights = data.nights || 1;
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        // 判斷是否為週末 (假設週末為週六和週日)
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6 || checkInDate.getDay() === 0) : false;
        
        let multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;

        const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

        let addonsCost = 0;
        if (data.addons && data.addons.length > 0) {
            data.addons.forEach(addon => {
                const item = ADDONS_SERVICE[addon.id];
                if (item) {
                    let cost = item.price;
                    if (item.type === 'per_person') {
                        cost *= (data.adultCount || 1);
                    }
                    if (item.isPerNight) {
                        cost *= totalNights;
                    }
                    addonsCost += cost;
                }
            });
        }

        let totalPriceBeforeFee = roomCost + childCost + addonsCost;

        // 會員折扣只作用於房費
        const memberDiscountValue = data.isLoggedIn ? roomCost * MEMBER_DISCOUNT_RATE : 0; 

        let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;

        const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;

        const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

        log('INFO', 'Price Calculation Completed', {
            roomCost, childCost, addonsCost, memberDiscountValue: memberDiscountValue.toFixed(2), finalPrice
        });

        return {
            roomCost: roomCost,
            childCost: childCost,
            addonsCost: addonsCost,
            memberDiscountValue: memberDiscountValue,
            serviceFee: serviceFee,
            finalPrice: finalPrice,
            error: false
        };

    } catch (error) {
        log('FATAL', 'Price Service API Failure', { error: error.message, stack: error.stack });
        return { roomCost: 0, childCost: 0, finalPrice: 0, error: true, errorMessage: error.message };
    }
}


// --- Handler 區塊 (必須為 Async 函數) ---

/**
 * 1. checkDateAndNights: 檢查日期和晚數是否有效
 */
async function checkDateAndNights(session) {
    const data = session.collectedData;
    
    if (!data.checkInDate || isNaN(new Date(data.checkInDate))) {
        data.CUSTOM_PROMPT = '請提供有效的【入住日期】。';
        return { isHandled: true, nextStep: 'ask_nights_and_dates' };
    }
    
    const nights = parseInt(data.nights);
    if (isNaN(nights) || nights <= 0 || nights > MAX_NIGHTS) {
        data.CUSTOM_PROMPT = `請提供有效的【住宿晚數】(1-${MAX_NIGHTS}晚)。`;
        return { isHandled: true, nextStep: 'ask_nights_and_dates' };
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}

/**
 * 2. checkBookingEssentials: 檢查房型、房間數、人數是否已收集
 */
async function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { isHandled: true, nextStep: 'show_room_types' }; // 🚨 強制導向房型選擇
    }
    if (!data.roomCount || parseInt(data.roomCount) <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { isHandled: true, nextStep: 'ask_room_count' }; 
    }
    if (!data.adultCount || parseInt(data.adultCount) <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { isHandled: true, nextStep: 'ask_guest_count' }; 
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}


/**
 * 3. lockInventory: 模擬庫存鎖定
 */
async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 🚨 避免重複執行，僅在沒有 lockId 時才嘗試鎖定
    if (data.inventoryLockId) {
        return { isHandled: true }; 
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));
        
        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', 'Inventory locked successfully', { lockId: lockResult.lockId, roomType, roomCount });
            return { isHandled: true, prompt: `✅ 庫存鎖定成功！【${roomType}】現有 ${lockResult.remaining} 間庫存。` };
        } else {
            log('WARNING', 'Inventory lock failed', { roomType, roomCount, reason: lockResult.message, remaining: lockResult.remaining });
            // 鎖定失敗，退回重新選擇房型
            return { 
                isHandled: true,
                prompt: `😭 抱歉，您選擇的【${roomType}】庫存不足 (剩餘 ${lockResult.remaining} 間)，請重新選擇房型或間數。`,
                nextStep: 'show_room_types' 
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        // API 連線失敗，引導用戶重新開始，或導向一個明確的錯誤狀態
        return { 
            isHandled: false, // 設為 false 讓 RuleEngine 處理
            errorMessage: '庫存服務暫時無法連線，請稍後再試。'
        };
    }
}

/**
 * 4. calculatePrice: 計算最終價格並儲存
 */
async function calculatePrice(session) {
    const data = session.collectedData;
    
    // 🚨 強化防禦：如果價格已計算，直接跳過
    if (data.finalPrice && data.priceDetails) {
         return { isHandled: true }; 
    }
    
    const details = await getPriceDetails(data);
    
    if (details.error || details.finalPrice <= 0) {
        log('ERROR', 'Final price is invalid or zero.', { details });
        return {
            isHandled: true,
            prompt: `抱歉，價格計算失敗：${details.errorMessage || '請確認您的預訂資訊。'}`,
            nextStep: 'show_room_types'
        };
    }
    
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;

    return { isHandled: true, prompt: `總價格已計算完成，金額為 **TWD {finalPrice} 元**。` }; 
}

/**
 * 5. generateAddonsCarousel: 模擬生成加購服務清單
 */
async function generateAddonsCarousel(session) {
    // 實務上應從 API 取得最新加購清單
    const richCard = {
        type: 'carousel',
        options: [
            { id: 'ADD001', title: '機場接送', description: 'TWD 1200 / 單程' },
            { id: 'ADD002', title: '晚餐券', description: 'TWD 800 / 每人每晚' },
            { id: 'ADD003', title: '迎賓香檳', description: 'TWD 600 / 一次性' }
        ]
    };
    return { isHandled: true, richCard: richCard };
}

/**
 * 6. executeAddonsSelection: 處理加購服務選擇，更新 collectedData.addons
 */
async function executeAddonsSelection(session) {
    const data = session.collectedData;
    // 假設 data.addonSelection 是一個陣列，包含已選的加購 ID
    
    if (data.addonSelection && data.addonSelection.length > 0) {
        data.addons = data.addonSelection.map(id => ({ id: id, count: 1 }));
        delete data.addonSelection;
        // 由於加購項目可能影響價格，需要重設價格
        delete data.finalPrice;
        delete data.priceDetails;
        return { isHandled: true, prompt: `已記錄 ${data.addons.length} 項加購服務。` };
    }
    data.addons = [];
    return { isHandled: true, prompt: '未選擇加購服務，繼續流程。' };
}

/**
 * 7. loginMemberAccount: 模擬會員登入
 */
async function loginMemberAccount(session) {
    const data = session.collectedData;
    const { account, password } = data;
    
    if (data.isLoggedIn) {
        return { isHandled: true };
    }
    
    if (!account || !password) {
        return { isHandled: false }; 
    }

    try {
        const loginResult = await MockAPI.verifyMember(account, password);
        
        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            data.memberId = loginResult.memberId;
            data.CUSTOM_PROMPT = `✅ 會員登入成功！已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 的會員折扣。`;
            // 由於折扣已變，必須重新計算價格，清除已計算的價格數據
            delete data.finalPrice;
            delete data.priceDetails;
            return { isHandled: true, nextStep: 'check_availability_and_price' }; // 跳回價格檢查點
        } else {
            data.CUSTOM_PROMPT = '❌ 登入失敗：帳號或密碼錯誤，請重新輸入。';
            delete data.account; delete data.password;
            return { isHandled: true, nextStep: 'ask_login' }; // 退回登入狀態
        }
    } catch (error) {
        log('FATAL', 'Member API failed', { error: error.message });
        return { isHandled: true, prompt: '會員服務暫時無法連線，將跳過登入步驟。', nextStep: 'ask_contact_info' };
    }
}


/**
 * 8. validateContactInfo: 驗證聯絡資訊
 */
async function validateContactInfo(session) {
    const data = session.collectedData;
    
    if (!data.name || data.name.length < 2) {
        data.CUSTOM_PROMPT = '請提供有效的【訂房人姓名】。';
        delete data.name; // 🚨 清除失敗數據
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
    if (!data.phone || data.phone.length < 8) {
        data.CUSTOM_PROMPT = '請提供有效的【電話號碼】。';
        delete data.phone; // 🚨 清除失敗數據
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
    if (!data.email || !data.email.includes('@')) {
        data.CUSTOM_PROMPT = '請提供有效的【電子郵件】。';
        delete data.email; // 🚨 清除失敗數據
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true };
}

/**
 * 9. generateOrderSummary: 生成訂單摘要 (最終確認前)
 */
async function generateOrderSummary(session) {
    const data = session.collectedData;
    
    // 使用價格詳情來顯示折扣和費用，使摘要更精確
    const details = data.priceDetails;
    const isMember = data.isLoggedIn ? '（已套用會員折扣）' : '';

    const summary = `
**訂單摘要 ${isMember}**
- 房型/間數: ${data.roomType} x ${data.roomCount} 間
- 入住/晚數: ${data.checkInDate} / ${data.nights} 晚
- 聯絡人: ${data.name} (${data.phone})
- 費用詳情:
    - 房費總計: TWD ${details.roomCost}
    - 兒童附加費: TWD ${details.childCost}
    - 加購服務費: TWD ${details.addonsCost}
    - 會員折扣: - TWD ${Math.round(details.memberDiscountValue)}
    - 服務費 (${SERVICE_FEE_RATE*100}%): + TWD ${Math.round(details.serviceFee)}
- **應付總額: TWD ${data.finalPrice} 元**
`;
    data.orderSummary = summary;
    
    const richCard = {
        type: 'text_card',
        title: '請確認您的訂房資訊',
        body: summary,
        buttons: [{ text: '確認並提交', intent: 'affirm' }, { text: '取消訂房', intent: 'cancel' }]
    };
    
    return { isHandled: true, prompt: `請仔細核對以下訂單摘要，確認無誤後請點選「確認並提交」。`, richCard: richCard };
}


/**
 * 10. submitBooking: 提交訂單到外部服務
 */
async function submitBooking(session) {
    const data = session.collectedData;
    
    if (!data.inventoryLockId) {
        return { isHandled: false, errorMessage: '提交失敗：庫存鎖定 ID 遺失。' };
    }

    try {
        await MockAPI.simulateDelay(500); 

        // 交易成功，釋放鎖定
        await MockAPI.unlockInventory(data.inventoryLockId); 
        
        data.orderId = `HTL${Date.now().toString().slice(-6)}`;
        data.paymentMessage = data.paymentMethod === 'credit_card' 
            ? '您的信用卡授權成功。' 
            : '請於入住前 72 小時內完成銀行轉帳。';

        return { isHandled: true };
    } catch (error) {
        log('FATAL', 'Booking Submission Failed', { error: error.message });
        // 🚨 提交失敗時，不釋放鎖定，讓後續定時任務處理超時釋放
        return { isHandled: false, errorMessage: `訂單提交服務失敗：${error.message}` };
    }
}


// --- 匯出所有 Handler ---
module.exports = {
    checkDateAndNights,
    checkBookingEssentials,
    lockInventory,
    calculatePrice,
    generateAddonsCarousel,
    executeAddonsSelection,
    loginMemberAccount,
    validateContactInfo,
    handleSpecialRequests: async (session) => { 
        if (session.collectedData.specialRequest) {
            session.collectedData.CUSTOM_PROMPT = `已記錄您的特殊需求: ${session.collectedData.specialRequest}`;
        }
        return { isHandled: true }; 
    },
    generateOrderSummary,
    submitBooking 
};

const MockAPI = require('./service_mock_api');
const sessionManager = require('./session_manager'); // 假設這是管理 session 的模組

// --- 輔助常量 ---
const MAX_NIGHTS = 30; // 最大住宿晚數限制
const CHILD_SURCHARGE = 500; // 兒童附加費 (每人每晚)
const SERVICE_FEE_RATE = 0.1; // 服務費率 (10%)
const MEMBER_DISCOUNT_RATE = 0.05; // 會員折扣率 (5%)

// --- 安全日誌函數 ---
/**
 * 記錄流程日誌，避免記錄循環引用或敏感資訊。
 */
function log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    try {
        // 避免循環引用，只記錄必要資訊
        const safeDetails = {};
        for (const key in details) {
            // 避免記錄整個 session 物件，只記錄原始型別或簡單字串化
            if (typeof details[key] !== 'object' || details[key] === null) {
                safeDetails[key] = details[key];
            } else if (key !== 'session') {
                safeDetails[key] = String(details[key]);
            }
        }
        console.log(JSON.stringify({ timestamp, level, message, details: safeDetails }));
    } catch (error) {
        console.log(`${timestamp} [${level}] ${message} - 日誌序列化失敗: ${error.message}`);
    }
}

// --- 價格計算核心邏輯 ---
/**
 * 根據預訂數據計算詳細的費用結構。
 * @param {object} data - 包含 nights, roomType, adultCount, roomCount, childCount, checkInDate, addons, isLoggedIn 等資訊。
 * @returns {object} 包含各項費用和最終價格的結構。
 */
async function getPriceDetails(data) {
    // 嚴格檢查核心預訂數據
    if (!data.nights || !data.roomType || !data.adultCount || !data.roomCount) { 
        log('WARNING', 'Price calculation skipped due to missing essential data.', { 
            nights: data.nights, roomType: data.roomType, adultCount: data.adultCount, roomCount: data.roomCount 
        });
        return { 
            roomCost: 0, 
            childCost: 0, 
            addonsCost: 0, 
            memberDiscountValue: 0, 
            serviceFee: 0, 
            finalPrice: 0, 
            error: true,
            errorMessage: '缺少必要的預訂資訊'
        };
    }

    try {
        // 模擬從外部 API 獲取價格和加購服務詳情
        const pricingData = await MockAPI.getPricingDetails(data.roomType);
        const roomDetails = pricingData.roomDetails;
        const ADDONS_SERVICE = pricingData.addons; 

        if (!roomDetails) {
            log('ERROR', 'Room details not found in API response', { roomType: data.roomType });
            return { 
                roomCost: 0, 
                childCost: 0, 
                finalPrice: 0, 
                error: true, 
                errorMessage: '無效房型或價格 API 錯誤' 
            };
        }

        let roomCost = 0;
        const totalNights = parseInt(data.nights) || 1;
        const totalRooms = parseInt(data.roomCount) || 1;
        const totalAdults = parseInt(data.adultCount) || 1;
        const totalChildren = parseInt(data.childCount) || 0;
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        
        // --- 1. 房費計算 (Room Cost) ---
        // 判斷是否為週末 (週六=6, 週日=0) 並應用週末乘數
        let isWeekend = false;
        if (checkInDate) {
            const day = checkInDate.getDay();
            isWeekend = (day === 6 || day === 0);
        }
        
        const multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        const basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * totalRooms * totalNights;

        // --- 2. 兒童附加費 (Child Cost) ---
        const childCost = totalChildren * CHILD_SURCHARGE * totalNights;

        // --- 3. 加購服務費 (Addons Cost) ---
        let addonsCost = 0;
        if (data.addons && Array.isArray(data.addons) && data.addons.length > 0) {
            data.addons.forEach(addon => {
                const item = ADDONS_SERVICE[addon.id];
                if (item) {
                    let cost = item.price;
                    if (item.type === 'per_person') {
                        // per_person 應乘以總人數
                        cost *= totalAdults; 
                    }
                    if (item.isPerNight) {
                        cost *= totalNights;
                    }
                    addonsCost += cost;
                }
            });
        }

        let totalPriceBeforeFee = roomCost + childCost + addonsCost;

        // --- 4. 會員折扣 (Member Discount) ---
        // 會員折扣只作用於房費
        const memberDiscountValue = data.isLoggedIn ? roomCost * MEMBER_DISCOUNT_RATE : 0; 

        let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;
        
        // --- 5. 服務費 (Service Fee) ---
        // 服務費作用於折扣後的總額 (Subtotal)
        const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;
        
        // --- 6. 最終價格 (Final Price) ---
        // 只有最終價格應用四捨五入
        const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

        log('INFO', 'Price Calculation Completed', {
            roomCost: roomCost.toFixed(2), 
            childCost: childCost.toFixed(2), 
            addonsCost: addonsCost.toFixed(2), 
            memberDiscountValue: memberDiscountValue.toFixed(2), 
            finalPrice
        });
        
        // 細項保留小數點， finalPrice 使用四捨五入
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
        log('FATAL', 'Price Service API Failure', { error: error.message });
        return { 
            roomCost: 0, 
            childCost: 0, 
            finalPrice: 0, 
            error: true, 
            errorMessage: '價格計算服務暫時無法使用' 
        };
    }
}

// --- Handler 區塊 ---

/**
 * 1. checkDateCompleteness: 檢查日期和晚數的完整性與格式。
 */
async function checkDateCompleteness(session) {
    const data = session.collectedData;
    
    if (!data.checkInDate || !data.nights) {
        return { 
            isHandled: true, 
            prompt: '請提供完整的入住日期和住宿晚數。',
            nextStep: 'handle_date_not_found' // 導向收集日期
        };
    }
    
    // 檢查日期格式
    const date = new Date(data.checkInDate);
    if (isNaN(date.getTime())) {
        return { 
            isHandled: true, 
            prompt: '請提供有效的日期格式 (例如: 2025-12-25)。',
            nextStep: 'handle_date_not_found'
        };
    }
    
    // 檢查晚數
    const nights = parseInt(data.nights);
    if (isNaN(nights) || nights <= 0 || nights > MAX_NIGHTS) {
        return { 
            isHandled: true, 
            prompt: `請提供有效的住宿晚數 (1-${MAX_NIGHTS}晚)。`,
            nextStep: 'handle_date_not_found'
        };
    }
    
    return { isHandled: true };
}


// **已移除原有的 checkDateAndNights 函數，因功能與 checkDateCompleteness 重疊且未在 Flow 中被使用**


/**
 * 2. checkBookingEssentials: 檢查房型、房間數、人數是否已收集。
 */
async function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { isHandled: true, nextStep: 'show_room_types' };
    }
    // 房間數和人數檢查需要確保是數字且大於 0
    if (!data.roomCount || parseInt(data.roomCount) <= 0 || isNaN(parseInt(data.roomCount))) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { isHandled: true, nextStep: 'ask_room_count' }; 
    }
    if (!data.adultCount || parseInt(data.adultCount) <= 0 || isNaN(parseInt(data.adultCount))) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { isHandled: true, nextStep: 'ask_guest_count' }; 
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}


/**
 * 3. lockInventory: 模擬庫存鎖定 (防止超賣)。
 */
async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 避免重複執行
    if (data.inventoryLockId) {
        log('INFO', 'Inventory lock already exists.', { lockId: data.inventoryLockId });
        return { isHandled: true }; 
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));
        
        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', 'Inventory locked successfully', { 
                lockId: lockResult.lockId, 
                roomType, 
                roomCount 
            });
            return { 
                isHandled: true, 
                prompt: `✅ 庫存鎖定成功！【${roomType}】現有 ${lockResult.remaining} 間庫存。` 
            };
        } else {
            log('WARNING', 'Inventory lock failed', { 
                roomType, 
                roomCount, 
                reason: lockResult.message, 
                remaining: lockResult.remaining 
            });
            // 庫存不足，導回房型選擇
            return { 
                isHandled: true,
                prompt: `😭 抱歉，您選擇的【${roomType}】庫存不足 (剩餘 ${lockResult.remaining} 間)，請重新選擇房型或間數。`,
                nextStep: 'show_room_types' 
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        return { 
            isHandled: true, 
            prompt: '庫存服務暫時無法連線，請稍後再試。',
            nextStep: 'show_room_types'
        };
    }
}


/**
 * 4. calculatePrice: 計算最終價格並儲存。
 */
async function calculatePrice(session) {
    const data = session.collectedData;
    
    // 如果價格已計算且沒有被清除 (isLoggedIn 或 addons 變更會清除)，則跳過
    if (data.finalPrice && data.priceDetails) {
        log('INFO', 'Price calculation skipped as data is cached.', { finalPrice: data.finalPrice });
        return { isHandled: true }; 
    }
    
    const details = await getPriceDetails(data);
    
    if (details.error || details.finalPrice <= 0) {
        log('ERROR', 'Final price is invalid or zero.', { details });
        
        // 價格計算失敗，釋放庫存鎖定，防止資源洩漏
        if (data.inventoryLockId) {
             await MockAPI.unlockInventory(data.inventoryLockId).catch(() => {});
             delete data.inventoryLockId;
        }

        return {
            isHandled: true,
            prompt: `抱歉，價格計算失敗：${details.errorMessage || '請確認您的預訂資訊。'}`,
            nextStep: 'show_room_types' // 導回房型選擇
        };
    }
    
    data.finalPrice = details.finalPrice;
    
    // 細項金額四捨五入到整數，便於顯示 (這裡僅用於顯示，實際計算使用浮點數)
    const displayDetails = {};
    for (const key in details) {
        if (typeof details[key] === 'number') {
            displayDetails[key] = Math.round(details[key]);
        } else {
            displayDetails[key] = details[key];
        }
    }
    data.priceDetails = displayDetails;


    log('INFO', 'Price Calculated and Stored.', { finalPrice: details.finalPrice });
    return { 
        isHandled: true, 
        prompt: `總價格已計算完成，金額為 **TWD ${details.finalPrice} 元**。` 
    }; 
}


/**
 * 5. generateAddonsCarousel: 模擬生成加購服務清單。
 */
async function generateAddonsCarousel(session) {
    // 模擬呼叫 API 獲取最新的加購服務清單
    const addonsList = await MockAPI.getAddonsList();

    const richCard = {
        type: 'carousel',
        options: addonsList.map(item => ({
            id: item.id,
            title: item.title,
            description: `${item.description} (NT$ ${item.price}/${item.isPerNight ? '晚' : '次'})` // 顯示價格資訊
        }))
    };
    return { isHandled: true, richCard: richCard };
}


/**
 * 6. executeAddonsSelection: 處理加購服務選擇。
 */
async function executeAddonsSelection(session) {
    const data = session.collectedData;
    
    // 假設 addonSelection 是從前端傳來的選擇 ID 陣列
    if (data.addonSelection && data.addonSelection.length > 0) {
        // 將選擇的 ID 陣列轉換為內部數據結構 (這裡假設數量都為 1)
        data.addons = data.addonSelection.map(id => ({ id: id, count: 1 }));
        delete data.addonSelection;
        
        // 由於加購項目影響價格，清除已計算的價格，強制重新計算
        delete data.finalPrice;
        delete data.priceDetails;
        
        log('INFO', 'Addons selected. Price cache cleared.', { addonCount: data.addons.length });
        
        return { 
            isHandled: true, 
            prompt: `已記錄 ${data.addons.length} 項加購服務，將重新計算總價。`,
            nextStep: 'calculate_price_logic' // 導回價格檢查
        };
    }
    
    data.addons = []; // 清空或設置為空陣列
    log('INFO', 'No addons selected.');
    return { 
        isHandled: true, 
        prompt: '未選擇加購服務，繼續流程。' 
    };
}


/**
 * 7. loginMemberAccount: 模擬會員登入 (影響價格)。
 */
async function loginMemberAccount(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;
    
    if (data.isLoggedIn) {
        log('INFO', 'User already logged in.');
        return { isHandled: true };
    }
    
    // 如果帳號或密碼不足，返回 isHandled: false 讓 RuleEngine 繼續收集實體
    if (!memberAccount || !memberPassword) {
        return { isHandled: false }; 
    }

    try {
        const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);
        
        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            data.memberId = loginResult.memberId;
            
            // 清除已計算的價格數據，需要重新計算
            delete data.finalPrice;
            delete data.priceDetails;
            
            log('INFO', 'Member login successful. Price cache cleared.', { memberId: loginResult.memberId });
            
            return { 
                isHandled: true, 
                prompt: `✅ 會員登入成功！已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 的會員折扣，正在重新計算價格...`,
                nextStep: 'calculate_price_logic' // 導向價格計算
            };
        } else {
            // **修正：導向回已定義的狀態 login_member_account 重新收集**
            delete data.memberAccount; 
            delete data.memberPassword;
            log('WARNING', 'Member login failed.', { account: memberAccount });
            return { 
                isHandled: true, 
                prompt: '❌ 登入失敗：帳號或密碼錯誤，請重新輸入。',
                nextStep: 'login_member_account' // 導回收集帳號的狀態
            };
        }
    } catch (error) {
        log('FATAL', 'Member API failed', { error: error.message });
        return { 
            isHandled: true, 
            prompt: '會員服務暫時無法連線，將跳過登入步驟。', 
            nextStep: 'ask_addons' // 跳過登入，繼續到下一步
        };
    }
}


/**
 * 8. validateContactInfo: 驗證聯絡資訊。
 */
async function validateContactInfo(session) {
    const data = session.collectedData;
    
    if (!data.contactName || data.contactName.length < 2) {
        data.CUSTOM_PROMPT = '請提供有效的【訂房人姓名】。';
        delete data.contactName;
        return { 
            isHandled: true, 
            nextStep: 'ask_contact_info' 
        };
    }
    
    // 考慮台灣手機號碼 (09開頭，10位數) 或市話 (8位數以上)
    if (!data.contactPhone || String(data.contactPhone).replace(/\D/g,'').length < 8) {
        data.CUSTOM_PROMPT = '請提供有效的【電話號碼】。';
        delete data.contactPhone;
        return { 
            isHandled: true, 
            nextStep: 'ask_contact_info' 
        };
    }
    
    // 簡單的 Email 格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.contactEmail || !emailRegex.test(data.contactEmail)) {
        data.CUSTOM_PROMPT = '請提供有效的【電子郵件】。';
        delete data.contactEmail;
        return { 
            isHandled: true, 
            nextStep: 'ask_contact_info' 
        };
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true };
}


/**
 * 9. handleSpecialRequests: 處理特殊需求 (記錄文本)。
 */
async function handleSpecialRequests(session) {
    const data = session.collectedData;
    
    if (data.specialRequest && data.specialRequest.trim().length > 0) {
        data.CUSTOM_PROMPT = `✅ 已記錄您的特殊需求: ${data.specialRequest}`;
        log('INFO', 'Special request recorded.', { request: data.specialRequest });
    } else {
        data.CUSTOM_PROMPT = '無特殊需求記錄。';
    }
    
    return { isHandled: true };
}


/**
 * 10. generateOrderSummary: 生成訂單摘要。
 */
async function generateOrderSummary(session) {
    const data = session.collectedData;
    
    // 確保價格已計算
    if (!data.priceDetails) {
        // 如果價格計算失敗，則回傳 calculatePrice 的結果
        const priceResult = await calculatePrice(session);
        if (priceResult.error) {
            return priceResult; 
        }
    }
    
    const details = data.priceDetails;
    const isMember = data.isLoggedIn ? '（已套用會員折扣）' : '';

    // 使用 toFixed(0) 確保顯示的細項也是整數 (因為 calculatePrice 已經將 displayDetails 四捨五入)
    const summary = `
- 房型/間數: ${data.roomType} x ${data.roomCount} 間
- 入住/晚數: ${data.checkInDate} / ${data.nights} 晚
- 聯絡人: ${data.contactName} (${data.contactPhone})
- 費用詳情:
    - 房費總計: TWD ${details.roomCost.toFixed(0)}
    - 兒童附加費: TWD ${details.childCost.toFixed(0)}
    - 加購服務費: TWD ${details.addonsCost.toFixed(0)}
    - 會員折扣 (${MEMBER_DISCOUNT_RATE * 100}%): - TWD ${details.memberDiscountValue.toFixed(0)}
    - 服務費 (${SERVICE_FEE_RATE * 100}%): + TWD ${details.serviceFee.toFixed(0)}
- **應付總額: TWD ${data.finalPrice} 元**
`;
    data.finalSummary = summary;
    
    const richCard = {
        type: 'text_card',
        title: `✅ 訂單摘要 ${isMember}`,
        body: summary,
        buttons: [
            { text: '確認並提交', intent: 'affirm' }, 
            { text: '修改預訂', intent: 'correction' } 
        ]
    };
    
    log('INFO', 'Order Summary Generated.', { finalPrice: data.finalPrice });
    return { 
        isHandled: true, 
        prompt: `請仔細核對以下訂單摘要，確認無誤後請點選【確認並提交】。`, 
        richCard: richCard 
    };
}

/**
 * 11. submitBooking: 提交訂單 (並釋放庫存鎖定)。
 */
async function submitBooking(session) {
    const data = session.collectedData;
    const lockId = data.inventoryLockId;
    
    if (!lockId) {
        log('ERROR', 'Submission failed: Inventory lock ID missing.');
        return { 
            isHandled: true, 
            prompt: '提交失敗：庫存鎖定狀態遺失，請重新開始預訂流程。',
            nextStep: 'init' // 導回 init 重置流程
        };
    }

    try {
        await MockAPI.simulateDelay(500);
        
        // 模擬訂單提交
        const bookingResult = await MockAPI.submitBooking({
            roomType: data.roomType,
            roomCount: data.roomCount,
            checkInDate: data.checkInDate,
            nights: data.nights,
            contactName: data.contactName,
            finalPrice: data.finalPrice
        });
        
        // 確保釋放庫存鎖定
        await MockAPI.unlockInventory(lockId).catch(e => {
            log('WARNING', 'Failed to unlock inventory after submission.', { lockId, error: e.message });
        });
        delete data.inventoryLockId; // 清除鎖定 ID

        if (bookingResult.success) {
            data.orderId = `HTL${Date.now().toString().slice(-6)}`;
            data.paymentMessage = data.paymentMethod === '信用卡' 
                ? '您的信用卡授權成功。' 
                : '請於入住前 72 小時內完成銀行轉帳/支付。';
                
            log('SUCCESS', 'Booking Submitted Successfully', { orderId: data.orderId });
            return { 
                isHandled: true,
                prompt: `🎉 訂房成功！您的訂單編號是 **${data.orderId}**。${data.paymentMessage}稍後我們會將完整的確認信寄至您的信箱。`
            };
        } else {
            log('ERROR', 'Booking Submission Failed', { message: bookingResult.message });
            return { 
                isHandled: true, 
                prompt: `訂單提交失敗：${bookingResult.message}。請嘗試重新預訂。`,
                nextStep: 'init'
            };
        }
    } catch (error) {
        log('FATAL', 'Booking Submission Service Failed', { error: error.message });
        // 服務連線失敗，在最終失敗時也嘗試釋放
        if (lockId) {
             await MockAPI.unlockInventory(lockId).catch(() => {});
             delete data.inventoryLockId;
        }
        return { 
            isHandled: true, 
            prompt: `訂單提交服務暫時無法連線：${error.message}。請聯繫客服。`,
            nextStep: 'end_of_flow'
        };
    }
}

// --- 匯出所有 Handler ---
module.exports = {
    checkDateCompleteness,      // 1. 檢查日期完整性
    // checkDateAndNights,       // (Removed)
    checkBookingEssentials,     // 2. 檢查預訂基本資訊
    lockInventory,              // 3. 鎖定庫存
    calculatePrice,             // 4. 計算價格
    generateAddonsCarousel,     // 5. 生成加購服務
    executeAddonsSelection,     // 6. 執行加購選擇
    loginMemberAccount,         // 7. 會員登入 (修正 nextStep)
    validateContactInfo,        // 8. 驗證聯絡資訊
    handleSpecialRequests,      // 9. 處理特殊需求
    generateOrderSummary,       // 10. 生成訂單摘要
    submitBooking               // 11. 提交訂單
};

// booking_controller.js (V1.22 - 完整修復版)

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
            if (typeof details[key] !== 'object' || details[key] === null) {
                safeDetails[key] = details[key];
            } else if (key !== 'session') { // 避免記錄整個 session 物件
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
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        
        // 判斷是否為週末 (週六=6, 週日=0) 並應用週末乘數
        let isWeekend = false;
        if (checkInDate) {
            const day = checkInDate.getDay();
            isWeekend = (day === 6 || day === 0);
        }
        
        let multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (parseInt(data.roomCount) || 1) * totalNights;

        // 兒童附加費
        const childCost = (parseInt(data.childCount) || 0) * CHILD_SURCHARGE * totalNights;

        // 加購服務費
        let addonsCost = 0;
        if (data.addons && Array.isArray(data.addons) && data.addons.length > 0) {
            data.addons.forEach(addon => {
                const item = ADDONS_SERVICE[addon.id];
                if (item) {
                    let cost = item.price;
                    if (item.type === 'per_person') {
                        cost *= (parseInt(data.adultCount) || 1);
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
            roomCost, 
            childCost, 
            addonsCost, 
            memberDiscountValue: memberDiscountValue.toFixed(2), 
            finalPrice
        });

        return {
            roomCost: Math.round(roomCost),
            childCost: Math.round(childCost),
            addonsCost: Math.round(addonsCost),
            memberDiscountValue: Math.round(memberDiscountValue),
            serviceFee: Math.round(serviceFee),
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

/**
 * 2. checkDateAndNights: 檢查日期和晚數是否有效 (冗餘檢查，確保數值正確)
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
 * 3. checkBookingEssentials: 檢查房型、房間數、人數是否已收集。
 */
async function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { isHandled: true, nextStep: 'show_room_types' };
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
 * 4. lockInventory: 模擬庫存鎖定 (防止超賣)。
 */
async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 避免重複執行
    if (data.inventoryLockId) {
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
            return { 
                isHandled: true,
                prompt: `😭 抱歉，您選擇的【${roomType}】庫存不足 (剩餘 ${lockResult.remaining} 間)，請重新選擇房型或間數。`,
                nextStep: 'show_room_types' 
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        return { 
            isHandled: false,
            errorMessage: '庫存服務暫時無法連線，請稍後再試。'
        };
    }
}

/**
 * 5. calculatePrice: 計算最終價格並儲存。
 */
async function calculatePrice(session) {
    const data = session.collectedData;
    
    // 如果價格已計算，直接跳過 (但會員登入/加購變更會清除此數據，強制重算)
    if (data.finalPrice && data.priceDetails) {
         return { isHandled: true }; 
    }
    
    const details = await getPriceDetails(data);
    
    if (details.error || details.finalPrice <= 0) {
        log('ERROR', 'Final price is invalid or zero.', { details });
        return {
            isHandled: true,
            prompt: `抱歉，價格計算失敗：${details.errorMessage || '請確認您的預訂資訊。'}`,
            nextStep: 'show_room_types' // 導回房型選擇
        };
    }
    
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;

    return { 
        isHandled: true, 
        prompt: `總價格已計算完成，金額為 **TWD ${details.finalPrice} 元**。` 
    }; 
}

/**
 * 6. generateAddonsCarousel: 模擬生成加購服務清單。
 */
async function generateAddonsCarousel(session) {
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
 * 7. executeAddonsSelection: 處理加購服務選擇。
 */
async function executeAddonsSelection(session) {
    const data = session.collectedData;
    
    // 假設 addonSelection 是從前端傳來的選擇 ID 陣列
    if (data.addonSelection && data.addonSelection.length > 0) {
        data.addons = data.addonSelection.map(id => ({ id: id, count: 1 }));
        delete data.addonSelection;
        
        // 由於加購項目影響價格，清除已計算的價格，強制重新計算
        delete data.finalPrice;
        delete data.priceDetails;
        
        return { 
            isHandled: true, 
            prompt: `已記錄 ${data.addons.length} 項加購服務，將重新計算總價。`,
            nextStep: 'check_availability_and_price' // 導回價格檢查
        };
    }
    
    data.addons = [];
    return { 
        isHandled: true, 
        prompt: '未選擇加購服務，繼續流程。' 
    };
}

/**
 * 8. loginMemberAccount: 模擬會員登入 (影響價格)。
 */
async function loginMemberAccount(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;
    
    if (data.isLoggedIn) {
        return { isHandled: true };
    }
    
    if (!memberAccount || !memberPassword) {
        return { isHandled: false }; // 讓 RuleEngine 透過 nextStep 繼續收集實體
    }

    try {
        const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);
        
        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            data.memberId = loginResult.memberId;
            
            // 清除已計算的價格數據，需要重新計算
            delete data.finalPrice;
            delete data.priceDetails;
            
            return { 
                isHandled: true, 
                prompt: `✅ 會員登入成功！已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 的會員折扣，正在重新計算價格...`,
                nextStep: 'check_availability_and_price' 
            };
        } else {
            // 登入失敗，清空數據並導回收集狀態
            delete data.memberAccount; 
            delete data.memberPassword;
            return { 
                isHandled: true, 
                prompt: '❌ 登入失敗：帳號或密碼錯誤，請重新輸入。',
                nextStep: 'handle_member_login'  // 導回當前狀態，重新收集
            };
        }
    } catch (error) {
        log('FATAL', 'Member API failed', { error: error.message });
        return { 
            isHandled: true, 
            prompt: '會員服務暫時無法連線，將跳過登入步驟。', 
            nextStep: 'ask_addons' 
        };
    }
}

/**
 * 9. validateContactInfo: 驗證聯絡資訊。
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
    
    if (!data.contactPhone || data.contactPhone.length < 8) {
        data.CUSTOM_PROMPT = '請提供有效的【電話號碼】。';
        delete data.contactPhone;
        return { 
            isHandled: true, 
            nextStep: 'ask_contact_info' 
        };
    }
    
    if (!data.contactEmail || !data.contactEmail.includes('@')) {
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
 * 10. handleSpecialRequests: 處理特殊需求 (記錄文本)。
 */
async function handleSpecialRequests(session) {
    const data = session.collectedData;
    
    if (data.specialRequest) {
        data.CUSTOM_PROMPT = `已記錄您的特殊需求: ${data.specialRequest}`;
    } else {
        data.CUSTOM_PROMPT = '無特殊需求記錄。';
    }
    
    return { isHandled: true };
}

/**
 * 11. generateOrderSummary: 生成訂單摘要。
 */
async function generateOrderSummary(session) {
    const data = session.collectedData;
    
    // 確保價格已計算
    if (!data.priceDetails) {
        const priceResult = await calculatePrice(session);
        if (!priceResult.isHandled) {
            return priceResult;
        }
    }
    
    const details = data.priceDetails;
    const isMember = data.isLoggedIn ? '（已套用會員折扣）' : '';

    const summary = `
**訂單摘要 ${isMember}**
- 房型/間數: ${data.roomType} x ${data.roomCount} 間
- 入住/晚數: ${data.checkInDate} / ${data.nights} 晚
- 聯絡人: ${data.contactName} (${data.contactPhone})
- 費用詳情:
    - 房費總計: TWD ${details.roomCost}
    - 兒童附加費: TWD ${details.childCost}
    - 加購服務費: TWD ${details.addonsCost}
    - 會員折扣: - TWD ${Math.round(details.memberDiscountValue)}
    - 服務費 (${SERVICE_FEE_RATE*100}%): + TWD ${Math.round(details.serviceFee)}
- **應付總額: TWD ${data.finalPrice} 元**
`;
    data.finalSummary = summary;
    
    const richCard = {
        type: 'text_card',
        title: '請確認您的訂房資訊',
        body: summary,
        buttons: [
            { text: '確認並提交', intent: 'affirm' }, 
            { text: '取消訂房', intent: 'cancel' }
        ]
    };
    
    return { 
        isHandled: true, 
        prompt: `請仔細核對以下訂單摘要，確認無誤後請點選「確認並提交」。`, 
        richCard: richCard 
    };
}

/**
 * 12. submitBooking: 提交訂單 (並釋放庫存鎖定)。
 */
async function submitBooking(session) {
    const data = session.collectedData;
    
    if (!data.inventoryLockId) {
        return { 
            isHandled: false, 
            errorMessage: '提交失敗：庫存鎖定 ID 遺失。' 
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
            contactPhone: data.contactPhone,
            contactEmail: data.contactEmail,
            finalPrice: data.finalPrice
        });
        
        if (bookingResult.success) {
            // 確保釋放庫存鎖定，防止資源洩漏
            await MockAPI.unlockInventory(data.inventoryLockId);
            
            data.orderId = `HTL${Date.now().toString().slice(-6)}`;
            data.paymentMessage = data.paymentMethod === 'credit_card' 
                ? '您的信用卡授權成功。' 
                : '請於入住前 72 小時內完成銀行轉帳。';
                
            return { isHandled: true };
        } else {
            return { 
                isHandled: false, 
                errorMessage: `訂單提交失敗：${bookingResult.message}` 
            };
        }
    } catch (error) {
        log('FATAL', 'Booking Submission Failed', { error: error.message });
        return { 
            isHandled: false, 
            errorMessage: `訂單提交服務失敗：${error.message}` 
        };
    }
}

// --- 匯出所有 Handler ---
module.exports = {
    checkDateCompleteness,    // 1. 檢查日期完整性
    checkDateAndNights,       // 2. 檢查日期和晚數
    checkBookingEssentials,   // 3. 檢查預訂基本資訊
    lockInventory,            // 4. 鎖定庫存
    calculatePrice,           // 5. 計算價格
    generateAddonsCarousel,   // 6. 生成加購服務
    executeAddonsSelection,   // 7. 執行加購選擇
    loginMemberAccount,       // 8. 會員登入 (影響價格)
    validateContactInfo,      // 9. 驗證聯絡資訊
    handleSpecialRequests,    // 10. 處理特殊需求
    generateOrderSummary,     // 11. 生成訂單摘要
    submitBooking             // 12. 提交訂單
};

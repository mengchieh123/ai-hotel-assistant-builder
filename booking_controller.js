// booking_controller.js (V5.9 - 修正 Handler 命名與會員登入邏輯)

// 🏆 ESM 導入
import dayjs from 'dayjs';
import { MockAPI } from './service_mock_api.js'; 
import { LLMManager } from './llm_manager.js'; 

// --- 輔助函數：日誌記錄 ---
function log(level, message, details = {}) {
    const timestamp = dayjs().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`); 
    if (level === 'ERROR' || level === 'FATAL' || level === 'DEBUG') {
        console.log('詳細資訊:', details);
    }
}

// --- 1. 流程前置檢查 (checkDateCompleteness) ---
function checkDateCompleteness(session) {
    const data = session.collectedData;
    const { checkInDate, nights } = data;

    if (checkInDate && nights && parseInt(nights) > 0) {
        log('DEBUG', 'Date and nights are complete.');
        return { isHandled: true, nextStep: 'ask_guest_count' };
    }

    log('WARNING', 'Date or nights missing/invalid.');
    return {
        isHandled: true,
        nextStep: 'ask_nights_and_dates',
        prompt: '請確認您的入住日期和晚數。'
    };
}

// --- 2. 流程前置檢查 (checkBookingEssentials) ---
function checkBookingEssentials(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;

    if (!roomType || !checkInDate || !nights || !roomCount || !adultCount) {
        log('ERROR', 'Missing essential booking data.');
        return {
            isHandled: true,
            prompt: '資料不完整，請從頭開始預訂。',
            nextStep: 'init'
        };
    }

    log('INFO', 'All booking essentials are present.');
    return { isHandled: true, nextStep: 'lock_inventory' };
}


// --- 3. 業務邏輯：庫存鎖定 (lockInventory) ---
async function lockInventoryLogic(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 如果存在舊的 Lock ID，先嘗試解鎖
    if (data.inventoryLockId) {
        await MockAPI.unlockInventory(data.inventoryLockId);
        delete data.inventoryLockId;
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));

        if (lockResult.isLocked) {
            log('SUCCESS', 'Inventory locked.', { lockId: lockResult.lockId });
            data.inventoryLockId = lockResult.lockId;
            return { isHandled: true, nextStep: 'calculate_price_logic' };
        } else {
            log('WARNING', 'Inventory lock failed.');
            delete data.roomCount;
            
            const message = `😭 **抱歉，您選擇的【${roomType}】庫存不足** (剩餘 ${lockResult.remaining} 間)。請重新選擇房型或間數。`;
            
            return {
                isHandled: true,
                prompt: message,
                nextStep: 'ask_room_type'
            };
        }
    } catch (error) {
        log('FATAL', 'Lock Inventory API Failed.', { error: error.message });
        return {
            isHandled: true,
            prompt: '庫存鎖定服務異常，請稍後再試。',
            nextStep: 'init'
        };
    }
}

// --- 4. 業務邏輯：價格計算 (calculatePrice) ---
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount, childCount, addons } = data;

    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        if (!roomDetails) {
            return {
                isHandled: true,
                prompt: '查詢房型價格失敗，請重新選擇。',
                nextStep: 'ask_room_type'
            };
        }

        let totalPrice = 0;
        let priceDetails = [];
        let totalAddonCost = 0;
        const totalGuests = parseInt(adultCount) + parseInt(childCount || 0);

        // --- 1. 計算房間總價 ---
        let currentDay = dayjs(checkInDate);
        for (let i = 0; i < nights; i++) {
            const isWeekend = currentDay.day() === 5 || currentDay.day() === 6;
            const multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
            const nightPrice = roomDetails.price * multiplier * parseInt(roomCount);
            totalPrice += nightPrice;
            
            priceDetails.push({
                date: currentDay.format('YYYY/MM/DD'),
                price: nightPrice,
                isWeekend: isWeekend
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
                    if (addonItem.isPerNight) {
                        cost *= nights;
                    }
                    if (addonItem.type === 'per_person') {
                        cost *= totalGuests;
                    }
                    
                    totalAddonCost += cost;
                }
            }
        }
        
        // --- 3. 應用服務費/稅費 (假設為 5% 總價) ---
        const serviceFee = (totalPrice + totalAddonCost) * 0.05;

        // --- 4. 最終價格 ---
        let finalPrice = totalPrice + totalAddonCost + serviceFee;
        
        // 5. 會員折扣 (假設登入成功)
        if (data.isLoggedIn) {
             finalPrice *= 0.95; // 95 折
        }

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

// --- 5. 會員/登入邏輯 (loginMemberAccount) ---
// ⚠️ 修正邏輯：這個 Handler 應僅處理實際的登入動作，並將流程導向 `calculate_price_logic` 進行價格重算。
async function processMemberLogin(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    // 1. 當處於 login_member_account (只收集 memberAccount) 狀態
    if (session.currentState === 'login_member_account' && memberAccount && !memberPassword) {
        // 實體已收集，交給 Rule Engine 推進到 ask_member_password
        // 這裡 return { isHandled: false }，讓 Rule Engine 走下一步
        return { isHandled: false }; 
    }

    // 2. 當處於 ask_member_password (同時收集 memberAccount 和 memberPassword) 狀態，執行登入
    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                log('SUCCESS', 'Member logged in.');
                // 登入成功後，返回重算價格
                return {
                    isHandled: true,
                    prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                    nextStep: 'calculate_price_logic' 
                };
            } else {
                data.isLoggedIn = false;
                log('WARNING', 'Member login failed.');
                delete data.memberPassword; // 清除密碼，要求重試
                return {
                    isHandled: true,
                    prompt: '帳號或密碼錯誤，請重新輸入。若要跳過請輸入「跳過」。',
                    nextStep: 'ask_member_password' // 保持在密碼狀態
                };
            }
        } catch (error) {
            log('FATAL', 'Member API Service Failed.', { error: error.message });
            return {
                isHandled: true,
                prompt: '會員驗證服務異常，請直接進行預訂。',
                nextStep: 'ask_addons' // 跳過會員步驟
            };
        }
    }
    
    // 3. 其他情況 (例如：在 ask_member_password 狀態，但密碼未收集到)
    // 讓 Rule Engine 繼續收集實體
    return { isHandled: false };
}


// --- 6. 通用查詢邏輯 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
    // 由於 Rule Engine 會自動將用戶輸入放在 session.lastMessage，我們優先使用它
    const userQuery = session.lastMessage;

    if (!userQuery) {
        log('ERROR', 'General inquiry called without user query.');
        return { isHandled: false };
    }

    try {
        const llmResult = await LLMManager.getGeneralAnswer(userQuery, data);

        data.llm_response = llmResult.response;
        data.llm_source = llmResult.source; 

        log('SUCCESS', 'LLM Inquiry handled.', { source: llmResult.source });

        return { isHandled: true, nextStep: 'general_inquiry_response' };
        
    } catch (error) {
        log('FATAL', 'All LLM services failed.', { error: error.message });
        // 觸發 JSON 中的 fallback_state
        return { isHandled: false }; 
    }
}


// --- 7. 最終提交 (submitBooking) ---
async function submitBooking(session) {
    const data = session.collectedData;
    // ... (為了簡潔，這裡省略，保留您原來的邏輯) ...
    // 檢查關鍵數據是否齊全
    if (!data.contactName || !data.inventoryLockId || data.finalPrice <= 0) {
        log('ERROR', 'Missing critical data for submission.', data);
        if (data.inventoryLockId) {
            // 提交失敗時釋放庫存
            await MockAPI.unlockInventory(data.inventoryLockId);
            delete data.inventoryLockId;
        }
        return {
            isHandled: true,
            prompt: '資料不完整或價格計算有誤，無法提交訂單。',
            nextStep: 'init'
        };
    }

    try {
        const result = await MockAPI.submitBooking(data);

        if (result.success) {
            log('SUCCESS', 'Booking submitted.', { bookingId: result.bookingId });
            data.orderId = result.bookingId;
            data.paymentMessage = data.paymentMethod === '現場支付' ? 
                                 '請在入住時支付。' : 
                                 '支付連結已發送至您的信箱。';
            
            return {
                isHandled: true,
                nextStep: 'booking_complete' // 讓流程推進到最終狀態
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


// --- 8. 庫存保護：解鎖 (unlockInventory) ---
async function unlockInventory(lockId) {
    if (!lockId) {
        log('WARNING', 'Attempted to unlock inventory without a valid ID.');
        return;
    }

    try {
        log('INFO', `Attempting to unlock inventory lock ID: ${lockId}`);
        await MockAPI.unlockInventory(lockId);
        log('SUCCESS', `Inventory lock ID ${lockId} released.`);
    } catch (error) {
        log('ERROR', `Failed to unlock inventory ${lockId}.`, { error: error.message });
    }
}


// -------------------------------------------------------------
// 🏆 ESM 匯出
// -------------------------------------------------------------
class BookingFlowController {
    static checkDateCompleteness = checkDateCompleteness;
    static checkBookingEssentials = checkBookingEssentials;
    
    // 修正：確保 Handler 名稱與 dialogue_flow.json 一致
    static lockInventory = lockInventoryLogic; 
    static calculatePrice = calculatePriceLogic; 
    static loginMemberAccount = processMemberLogin; 
    
    // 暫時忽略 addons 和 summary 的 Handler，讓流程順暢推進
    static generateAddonsCarousel = (session) => ({ isHandled: false });
    static executeAddonsSelection = (session) => ({ isHandled: true, nextStep: 'ask_contact_info' });
    static validateContactInfo = (session) => ({ isHandled: false });
    static handleSpecialRequests = (session) => ({ isHandled: false });
    static generateOrderSummary = (session) => {
        const { roomType, checkInDate, nights, roomCount, finalPrice } = session.collectedData;
        session.collectedData.finalSummary = `房型: ${roomCount}間${roomType}\n入住: ${checkInDate} / ${nights}晚\n聯絡人: ${session.collectedData.contactName || '未提供'}\n總價: NT$ ${finalPrice}`;
        return { isHandled: false };
    };

    static processGeneralInquiry = processGeneralInquiry; 
    static submitBooking = submitBooking; 
    static unlockInventory = unlockInventory;
}

// 🏆 命名匯出
export { BookingFlowController };

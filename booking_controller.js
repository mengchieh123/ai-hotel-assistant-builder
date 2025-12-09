// booking_controller.js (V5.8.1 - 修正 Handler 命名與 dialogue_flow.json 一致)

// 🏆 ESM 導入：將 require() 替換為 import
import dayjs from 'dayjs';
import { MockAPI } from './service_mock_api.js'; 
import { LLMManager } from './llm_manager.js'; 

// --- 輔助函數：日誌記錄 ---
function log(level, message, details = {}) {
    const timestamp = dayjs().toISOString();
    // 移除 details 避免 log 過度冗長，僅在 DEBUG/ERROR 使用
    console.log(`[${timestamp}] [${level}] ${message}`); 
    if (level === 'ERROR' || level === 'FATAL' || level === 'DEBUG') {
        console.log('詳細資訊:', details);
    }
}

// --- 1. 流程前置檢查 ---
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
                nextStep: 'ask_room_type' // 修正為 ask_room_type 讓用戶重新選擇房型
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
async function processMemberLogin(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    if (memberAccount && !memberPassword) {
        return { isHandled: false }; // 等待密碼輸入
    }

    if (!memberAccount || !memberPassword) {
        return { isHandled: false };
    }

    try {
        const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            log('SUCCESS', 'Member logged in.');
            // 登入成功後跳轉回計算價格，以應用折扣
            return {
                isHandled: true,
                prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                nextStep: 'calculate_price_logic' 
            };
        } else {
            data.isLoggedIn = false;
            log('WARNING', 'Member login failed.');
            delete data.memberPassword;
            return {
                isHandled: true,
                prompt: '帳號或密碼錯誤，請重新輸入。若要跳過請輸入「跳過」。',
                nextStep: 'login_member_account'
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

// --- 6. 通用查詢邏輯 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
    // ⚠️ 注意：此處應從 Rule Engine 取得用戶輸入，使用 collectedData.user_query 或 session.lastMessage
    const userQuery = data.user_query || session.lastMessage;

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

        return { isHandled: false }; 
    }
}

// --- 7. 最終提交 (submitBooking) ---
async function submitBooking(session) {
    const data = session.collectedData;
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
// 🏆 ESM 匯出：使用命名匯出 class
// -------------------------------------------------------------
class BookingFlowController {
    static checkDateCompleteness = checkDateCompleteness;
    static checkBookingEssentials = checkBookingEssentials;
    
    // 修正：Handler 名稱與 dialogue_flow.json 中的 "handler": "lockInventory" 一致
    static lockInventory = lockInventoryLogic; 
    
    // 修正：Handler 名稱與 dialogue_flow.json 中的 "handler": "calculatePrice" 一致
    static calculatePrice = calculatePriceLogic; 
    
    // 修正：Handler 名稱與 dialogue_flow.json 中的 "handler": "loginMemberAccount" 一致
    static loginMemberAccount = processMemberLogin; 
    
    static processGeneralInquiry = processGeneralInquiry; 
    static submitBooking = submitBooking; 
    static unlockInventory = unlockInventory;
    
    // 您應確保所有在 dialogue_flow.json 中被調用的 Handler 都在這裡
}

// 🏆 命名匯出
export { BookingFlowController };

// booking_controller.js (V5.11 - 整合日期救援與兒童數自動補齊)

// 🏆 ESM 導入
import dayjs from 'dayjs';
import { MockAPI } from './service_mock_api.js'; 
import { LLMManager } from './llm_manager.js'; 
// 🚨 新增：引入 chrono-node 進行日期解析救援
import * as chrono from 'chrono-node'; 
// 🚨 確保您已安裝 npm install chrono-node

// --- 輔助函數：日誌記錄 ---
function log(level, message, details = {}) {
    const timestamp = dayjs().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`); 
    if (level === 'ERROR' || level === 'FATAL' || level === 'DEBUG') {
        console.log('詳細資訊:', details);
    }
}

// -------------------------------------------------------------
// I. 流程前置檢查與實體補齊 (Handlers for Logic_Exec)
// -------------------------------------------------------------

// --- 1. 流程前置檢查 (checkDateCompleteness) ---
function checkDateCompleteness(session) {
    const data = session.collectedData;
    let { checkInDate, nights } = data; // 使用 let 允許變更
    const originalUserInput = session.lastMessage || ''; // 從 session 取得原始輸入

    // 🚨 核心邏輯：日期實體救援
    if (!checkInDate) {
        // 使用 chrono-node 嘗試解析原始輸入文本
        const results = chrono.parse(originalUserInput);
        
        if (results && results.length > 0) {
            const dateObj = results[0].start.date();
            
            // 格式化為系統標準 YYYY-MM-DD
            const parsedDateStr = dayjs(dateObj).format('YYYY-MM-DD'); 
            
            // 強制補齊實體
            data.checkInDate = parsedDateStr;
            checkInDate = parsedDateStr; 
            log('SUCCESS', `日期實體救援成功，設定為 ${parsedDateStr}`);
        }
    }
    
    // 最終檢查與推進
    if (checkInDate && nights && parseInt(nights) > 0) {
        // 檢查日期是否是未來日期
        const today = dayjs().startOf('day');
        if (dayjs(checkInDate).isBefore(today)) {
             log('ERROR', '解析的日期是過去的日期。');
             data.checkInDate = null; // 清除實體，要求用戶重新輸入
             return {
                isHandled: true,
                nextStep: 'ask_nights_and_dates',
                prompt: '入住日期必須是今日或未來日期，請重新輸入。'
             };
        }
        
        log('DEBUG', 'Date and nights are complete and valid.');
        // 流程推進到 set_default_child_count
        return { isHandled: true, nextStep: 'set_default_child_count' };
    }

    // 仍缺失或無效，返回要求用戶輸入
    log('WARNING', 'Date or nights missing/invalid after rescue attempt.');
    return {
        isHandled: true,
        nextStep: 'ask_nights_and_dates',
        prompt: '請確認您的入住日期和晚數。'
    };
}


// --- 2. 實體補齊：自動設定兒童數 (setDefaultChildCount) ---
function setDefaultChildCount(session) {
    const data = session.collectedData;
    
    // 檢查 adultCount 是否已收集 (這是前提)
    if (data.adultCount && data.childCount === null) {
        // 🚨 如果 adultCount 存在，但 childCount 為 null (未提供)
        data.childCount = 0; // 自動設定為 0 避免流程卡住
        log('INFO', 'childCount 實體自動補齊為 0。');
    }

    // 不論是否補齊，只要有 adultCount，就推進到下一步
    if (data.adultCount) {
        return { isHandled: true, nextStep: 'ask_room_type' };
    }
    
    // 如果 adultCount 也沒收集到，通常不應該發生，但保險起見導回
    log('WARNING', 'adultCount 缺失，導回 ask_guest_count。');
    return { isHandled: true, nextStep: 'ask_guest_count' };
}


// --- 3. 流程前置檢查 (checkBookingEssentials) ---
function checkBookingEssentials(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;

    // 🚨 修正：如果缺失關鍵資料，應導回最初的日期收集狀態，而不是 init
    if (!roomType || !checkInDate || !nights || !roomCount || !adultCount) {
        log('ERROR', 'Missing essential booking data. Returning to ask_nights_and_dates.');
        return {
            isHandled: true,
            prompt: '預訂核心資訊（日期、房型、人數）不完整，請重新確認日期。',
            nextStep: 'ask_nights_and_dates' // 導向日期收集狀態
        };
    }

    log('INFO', 'All booking essentials are present.');
    return { isHandled: true, nextStep: 'lock_inventory' };
}

// -------------------------------------------------------------
// II. 業務邏輯 (Handlers for API & Calculation)
// -------------------------------------------------------------

// --- 4. 業務邏輯：庫存鎖定 (lockInventory) ---
async function lockInventoryLogic(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    // ... (邏輯不變) ...
    
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

// --- 5. 業務邏輯：價格計算 (calculatePrice) ---
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount, childCount, addons } = data;

    // ... (價格計算邏輯不變) ...

    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        // ... (價格計算細節省略) ...
        
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
        
        // --- 3. 應用服務費/稅費 ---
        const serviceFee = (totalPrice + totalAddonCost) * 0.05;

        // --- 4. 最終價格 ---
        let finalPrice = totalPrice + totalAddonCost + serviceFee;
        
        // 5. 會員折扣
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


// --- 6. 會員/登入邏輯 (loginMemberAccount) ---
async function processMemberLogin(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    // ... (會員登入邏輯不變) ...
    
    // 1. 當處於 login_member_account (只收集 memberAccount) 狀態
    if (session.currentState === 'login_member_account' && memberAccount && !memberPassword) {
        return { isHandled: false }; 
    }

    // 2. 當處於 ask_member_password (同時收集 memberAccount 和 memberPassword) 狀態，執行登入
    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                log('SUCCESS', 'Member logged in.');
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
                    nextStep: 'ask_member_password' 
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
    
    return { isHandled: false };
}


// --- 7. 通用查詢邏輯 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
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
        // 🚨 這裡會觸發 JSON 中的 fallback_state (確保降級/失敗時流程不會卡死)
        return { isHandled: false }; 
    }
}


// --- 8. 最終提交 (submitBooking) ---
async function submitBooking(session) {
    const data = session.collectedData;

    // ... (提交邏輯不變) ...
    
    if (!data.contactName || !data.inventoryLockId || data.finalPrice <= 0) {
        log('ERROR', 'Missing critical data for submission.', data);
        if (data.inventoryLockId) {
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
                nextStep: 'booking_complete' 
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


// -------------------------------------------------------------
// III. 其他 Handler (邏輯與輔助)
// -------------------------------------------------------------

// --- 9. 聯絡資訊驗證與推進 (validateContactInfo) ---
function validateContactInfoLogic(session) {
    const data = session.collectedData;
    const { contactName, contactPhone, contactEmail } = data;

    if (contactPhone && contactEmail) {
        if (!contactName) {
            data.contactName = data.memberAccount || '未提供聯絡人姓名';
        }
        log('INFO', 'Contact phone and email are present, proceeding.');
        return { isHandled: true, nextStep: 'ask_special_requests' }; 
    } else {
        log('WARNING', 'Missing contact phone or email. Staying in state to collect.');
        return { isHandled: false }; 
    }
}

// --- 10. 加購牌卡生成 (generateAddonsCarousel) ---
async function generateAddonsCarouselLogic(session) {
    // ... (邏輯不變) ...
    const data = session.collectedData;
    
    try {
        const pricing = await MockAPI.getPricingDetails(data.roomType);
        const addonsList = Object.values(pricing.addons);
        
        const richCardButtons = addonsList.map(addon => ({
            text: `${addon.name} (NT$ ${addon.price})`,
            value: `加購 ${addon.id}`,
            intent: 'correction' 
        }));
        
        richCardButtons.push({
            text: '完成加購，進入下一步',
            value: '完成',
            intent: 'affirm'
        });
    
        data.customRichCard = {
            type: "button_list",
            buttons: richCardButtons
        };
        
        log('INFO', 'Addons carousel generated.');
        return { isHandled: true, nextStep: 'ask_addons' }; 
    } catch (error) {
        log('ERROR', 'Failed to generate addons carousel. Skipping to contact info.', error);
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
}

// --- 11. 執行加購操作 (executeAddonsSelection) ---
function executeAddonsSelectionLogic(session) {
    const data = session.collectedData;
    const { addonAction, addonId } = data;
    
    data.addons = data.addons || [];

    if (addonAction === '加購' && addonId) {
        if (!data.addons.includes(addonId)) {
            data.addons.push(addonId);
            log('INFO', `Addon ${addonId} added.`);
            
            return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `✅ 已加購 ${addonId}。當前總價將在下一步更新。`
            };
        } else {
             return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `您已加購 ${addonId}。`
            };
        }
    } 
    
    log('INFO', 'Addons selection completed or skipped. Proceeding to contact info.');
    return { isHandled: true, nextStep: 'ask_contact_info' };
}

// --- 12. 處理特殊需求 (handleSpecialRequests) ---
function handleSpecialRequestsLogic(session) {
    log('INFO', 'Special requests handled. Proceeding to payment.');
    return { isHandled: true, nextStep: 'ask_payment_method' };
}


// --- 13. 生成訂單摘要 (generateOrderSummary) ---
function generateOrderSummaryLogic(session) {
    const { roomType, checkInDate, nights, roomCount, finalPrice, contactName, contactPhone, contactEmail } = session.collectedData;
    
    const summary = [
        `**預訂項目:** ${roomCount}間 ${roomType}`,
        `**入住時間:** ${checkInDate} / ${nights}晚`,
        `**聯絡人:** ${contactName || '未提供' }`,
        `**電話/Email:** ${contactPhone || '未提供'} / ${contactEmail || '未提供'}`,
        `**加購服務:** ${session.collectedData.addons && session.collectedData.addons.length > 0 ? session.collectedData.addons.join(', ') : '無'}`
    ].join('\n');
    
    session.collectedData.finalSummary = summary;
    return { isHandled: true, nextStep: 'confirm_booking' }; 
}


// --- 14. 庫存保護：解鎖 (unlockInventory) ---
async function unlockInventory(lockId) {
    // ... (邏輯不變) ...
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
    static setDefaultChildCount = setDefaultChildCount; // 🚨 新增導出
    static checkBookingEssentials = checkBookingEssentials;
    
    static lockInventory = lockInventoryLogic; 
    static calculatePrice = calculatePriceLogic; 
    static loginMemberAccount = processMemberLogin; 
    
    static generateAddonsCarousel = generateAddonsCarouselLogic; 
    static executeAddonsSelection = executeAddonsSelectionLogic;
    static validateContactInfo = validateContactInfoLogic;
    static handleSpecialRequests = handleSpecialRequestsLogic;
    static generateOrderSummary = generateOrderSummaryLogic;

    static processGeneralInquiry = processGeneralInquiry; 
    static submitBooking = submitBooking; 
    static unlockInventory = unlockInventory;
}

// 🏆 命名匯出
export { BookingFlowController };

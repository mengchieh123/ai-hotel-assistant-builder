// booking_controller.js (V5.11 - 最終修正)

// 🏆 ESM 導入
import dayjs from 'dayjs';
import { MockAPI } from './service_mock_api.js'; 
import { LLMManager } from './llm_manager.js'; 
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
    let { checkInDate, nights } = data;
    const originalUserInput = session.lastMessage || '';

    // 🚨 日期實體救援邏輯 (不變) ...

    if (checkInDate && nights && parseInt(nights) > 0) {
        const today = dayjs().startOf('day');
        if (dayjs(checkInDate).isBefore(today)) {
            data.checkInDate = null;
            return {
                isHandled: true,
                // 🚨 修正導向狀態名稱
                nextStep: 'ask_dates_and_nights',
                prompt: '入住日期必須是今日或未來日期，請重新輸入。'
            };
        }
        return { isHandled: true, nextStep: 'set_default_child_count' };
    }

    return {
        isHandled: true,
        // 🚨 修正導向狀態名稱
        nextStep: 'ask_dates_and_nights', 
        prompt: '請確認您的入住日期和晚數。'
    };
}


// --- 2. 實體補齊：自動設定兒童數 (setDefaultChildCount) ---
function setDefaultChildCount(session) {
    const data = session.collectedData;
    if (data.adultCount && data.childCount === null) {
        data.childCount = 0;
        log('INFO', 'childCount 實體自動補齊為 0。');
    }
    if (data.adultCount) {
        return { isHandled: true, nextStep: 'ask_room_type' };
    }
    return { isHandled: true, nextStep: 'ask_guest_count' };
}


// --- 3. 流程前置檢查 (checkBookingEssentials) ---
function checkBookingEssentials(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;

    if (!roomType || !checkInDate || !nights || !roomCount || !adultCount) {
        log('ERROR', 'Missing essential booking data. Returning to ask_dates_and_nights.');
        return {
            isHandled: true,
            prompt: '預訂核心資訊（日期、房型、人數）不完整，請重新確認日期。',
            // 🚨 修正導向狀態名稱
            nextStep: 'ask_dates_and_nights' 
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
    // ... (邏輯不變) ...
    // ... (成功後導向 calculate_price_logic) ...
    return { isHandled: true, nextStep: 'calculate_price_logic' };
}

// --- 5. 業務邏輯：價格計算 (calculatePrice) ---
// 🚨 修正：此 Handler 現在會根據當前狀態判斷下一步導向
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount, childCount, addons } = data;
    // ... (價格計算細節省略，假設 data.finalPrice, data.totalPrice 等已正確更新) ...

    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        let totalPrice = 0;
        let priceDetails = [];
        let totalAddonCost = 0;
        const totalGuests = parseInt(adultCount) + parseInt(childCount || 0);

        // --- 1. 計算房間總價 (省略計算細節) ---
        let currentDay = dayjs(checkInDate);
        for (let i = 0; i < nights; i++) {
            const isWeekend = currentDay.day() === 5 || currentDay.day() === 6;
            const multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
            const nightPrice = roomDetails.price * multiplier * parseInt(roomCount);
            totalPrice += nightPrice;
            priceDetails.push({ date: currentDay.format('YYYY/MM/DD'), price: nightPrice, isWeekend: isWeekend });
            currentDay = currentDay.add(1, 'day');
        }

        // --- 2. 計算加購服務總價 (省略計算細節) ---
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
        
        // --- 3. 服務費/稅費 ---
        const serviceFee = (totalPrice + totalAddonCost) * 0.05;

        // --- 4. 最終價格 ---
        let finalPrice = totalPrice + totalAddonCost + serviceFee;
        
        // --- 5. 會員折扣 ---
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

        // 🚨 根據當前狀態決定下一步導向
        let targetStep;
        if (session.currentState === 'calculate_price_logic_after_login') {
            targetStep = 'ask_addons'; // 登入/註冊後 -> 加購
        } else if (session.currentState === 'calculate_price_logic_after_addons') {
            targetStep = 'ask_contact_info'; // 加購後 -> 聯絡資訊 (此邏輯由 calculatePriceAfterAddons Handler 處理)
        } else {
            targetStep = 'ask_member_login'; // 預設 (初次計算) -> 會員登入選擇
        }

        log('INFO', `Price calculated: NT$${data.finalPrice}. Next step: ${targetStep}`);
        return { isHandled: true, nextStep: targetStep };

    } catch (error) {
        log('ERROR', 'Price calculation failed:', error);
        return {
            isHandled: true,
            prompt: '價格計算服務暫時故障，請稍後再試。',
            nextStep: 'init'
        };
    }
}


// --- 6. 業務邏輯：加購後價格計算 (calculatePriceAfterAddons) ---
// 🚨 新增 Handler：與 calculatePriceLogic 邏輯相同，但強制導向聯絡資訊
async function calculatePriceAfterAddons(session) {
    // 執行 calculatePriceLogic 中的計算核心部分
    await calculatePriceLogic(session); 
    
    // 強制 nextStep 導向聯絡資訊 (這是 JSON 中定義的)
    return {
        isHandled: true,
        nextStep: 'ask_contact_info' 
    };
}


// --- 7. 會員登入邏輯 (loginMemberAccount) ---
async function processMemberLogin(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    // 1. 當處於 login_member_account (只收集 memberAccount) 狀態
    if (session.currentState === 'login_member_account' && memberAccount && !memberPassword) {
        return { isHandled: false }; // 讓流程推進到 ask_member_password 收集密碼
    }

    // 2. 當處於 ask_member_password (同時收集 memberAccount 和 memberPassword) 狀態，執行登入
    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                return {
                    isHandled: true,
                    prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                    // 導向 calculate_price_logic_after_login 讓價格重算
                    nextStep: 'calculate_price_logic_after_login' 
                };
            } else {
                data.isLoggedIn = false;
                delete data.memberPassword;
                return {
                    isHandled: true,
                    prompt: '帳號或密碼錯誤，請重新輸入。若要跳過請輸入「跳過」。',
                    nextStep: 'ask_member_password' 
                };
            }
        } catch (error) {
            return {
                isHandled: true,
                prompt: '會員驗證服務異常，請直接進行預訂。',
                nextStep: 'ask_addons' // 跳過會員步驟
            };
        }
    }
    return { isHandled: false };
}


// --- 8. 會員註冊邏輯 (registerMemberAccount) ---
// 🚨 新增 Handler
async function registerMemberAccountLogic(session) {
    const data = session.collectedData;
    const { memberAccount } = data;

    if (!memberAccount) {
        return { isHandled: false }; 
    }

    try {
        const registerResult = await MockAPI.registerMember(memberAccount);

        if (registerResult.isSuccessful) {
            data.isLoggedIn = true;
            return {
                isHandled: true,
                prompt: `🎉 ${memberAccount} 註冊成功並自動登入！您本次預訂享有 95 折優惠。`,
                // 導向 calculate_price_logic_after_login 讓價格重算
                nextStep: 'calculate_price_logic_after_login' 
            };
        } else {
            return {
                isHandled: true,
                prompt: `註冊失敗：${registerResult.message}。請嘗試使用其他帳號或輸入「跳過」進入下一步。`,
                nextStep: 'register_member_account'
            };
        }
    } catch (error) {
        return {
            isHandled: true,
            prompt: '會員服務異常，請直接進入下一步。',
            nextStep: 'ask_addons' // 跳過會員步驟
        };
    }
}


// -------------------------------------------------------------
// III. 其他 Handler (邏輯與輔助)
// -------------------------------------------------------------

// --- 9. 加購牌卡生成 (generateAddonsCarousel) ---
async function generateAddonsCarouselLogic(session) {
    const data = session.collectedData;
    
    try {
        const pricing = await MockAPI.getPricingDetails(data.roomType);
        const addonsList = Object.values(pricing.addons);
        
        const richCardButtons = addonsList.map(addon => ({
            text: `${addon.name} (NT$ ${addon.price}${addon.isPerNight ? '/晚' : ''})`,
            // 確保按鈕 value 帶有正確的 ID
            value: `加購 ${addon.id}`, 
            intent: 'correction' // 使用 correction 意圖來觸發 executeAddonsSelection 狀態
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
        // Handler 執行成功，讓 JSON 的 next_state 接手
        return { isHandled: true }; 
    } catch (error) {
        log('ERROR', 'Failed to generate addons carousel. Skipping to contact info.', error);
        // 失敗時直接跳過加購流程
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
}

// --- 10. 執行加購操作 (executeAddonsSelection) ---
function executeAddonsSelectionLogic(session) {
    const data = session.collectedData;
    const { addonAction, addonId } = data;
    
    data.addons = data.addons || [];

    if (addonAction === '加購' && addonId) {
        if (!data.addons.includes(addonId)) {
            data.addons.push(addonId);
            return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `✅ 已加購 ${addonId}。請選擇其他服務或回覆「完成」。`
            };
        } else {
             return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `您已加購 ${addonId}。請選擇其他服務或回覆「完成」。`
            };
        }
    } 
    
    // 當用戶選擇 '完成' 或 '跳過' 時，推進到 calculate_price_logic_after_addons
    return { isHandled: true, nextStep: 'calculate_price_logic_after_addons' };
}

// --- 11. 聯絡資訊驗證與推進 (validateContactInfo) ---
function validateContactInfoLogic(session) {
    const data = session.collectedData;
    const { contactName, contactPhone, contactEmail } = data;

    if (contactPhone && contactEmail) {
        if (!contactName) {
            data.contactName = data.memberAccount || '未提供聯絡人姓名';
        }
        return { isHandled: true, nextStep: 'ask_special_requests' }; 
    } else {
        return { isHandled: false }; 
    }
}

// --- (其他 Handler: handleSpecialRequests, generateOrderSummary, submitBooking, processGeneralInquiry, unlockInventory 邏輯不變) ---


// -------------------------------------------------------------
// 🏆 ESM 匯出 (Export Class)
// -------------------------------------------------------------
class BookingFlowController {
    static checkDateCompleteness = checkDateCompleteness;
    static setDefaultChildCount = setDefaultChildCount; 
    static checkBookingEssentials = checkBookingEssentials;
    
    static lockInventory = lockInventoryLogic; 
    static calculatePrice = calculatePriceLogic; 
    
    // 🚨 新增導出
    static calculatePriceAfterAddons = calculatePriceAfterAddons; 

    static loginMemberAccount = processMemberLogin; 
    // 🚨 新增導出
    static registerMemberAccount = registerMemberAccountLogic; 
    
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

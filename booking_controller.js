// booking_controller.js (V6.0 - 最終優化版)

// 🏆 ESM 導入
import dayjs from 'dayjs';
import { MockAPI } from './service_mock_api.js'; 
import { LLMManager } from './llm_manager.js'; 
import * as chrono from 'chrono-node'; 


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
    
    // 🚨 這裡應有日期實體救援邏輯，但為簡化省略

    if (checkInDate && nights && parseInt(nights) > 0) {
        const today = dayjs().startOf('day');
        if (dayjs(checkInDate).isBefore(today)) {
            data.checkInDate = null;
            return {
                isHandled: true,
                nextStep: 'ask_dates_and_nights',
                prompt: '入住日期必須是今日或未來日期，請重新輸入。'
            };
        }
        // 🚨 優化點：日期驗證成功，導向檢查人數
        return { isHandled: true, nextStep: 'set_default_child_count' };
    }

    return {
        isHandled: true,
        nextStep: 'ask_dates_and_nights', 
        prompt: '請確認您的入住日期和晚數。'
    };
}


// --- 2. 實體補齊：自動設定兒童數 (setDefaultChildCount) ---
function setDefaultChildCount(session) {
    const data = session.collectedData;
    // 🚨 優化點：如果只有大人數，將兒童數補齊為 0
    if (data.adultCount && data.childCount === null) {
        data.childCount = 0;
        log('INFO', 'childCount 實體自動補齊為 0。');
    }
    
    if (data.adultCount) {
        // 人數齊全，導向問房型 (在 ask_room_type 之前應先取得可用房型列表)
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
    const data = session.collectedData;
    const { roomType, roomCount } = data;

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));
        
        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', `Inventory locked: ${lockResult.lockId}`);
            return { isHandled: true, nextStep: 'calculate_price_logic' };
        } else {
            // 🚨 優化點：庫存鎖定失敗，返回房型選擇或日期調整
            return { 
                isHandled: true, 
                nextStep: 'ask_room_type', // 重新選擇房型/數量
                prompt: `抱歉，您選擇的 ${roomType} x ${roomCount} 間目前庫存不足，剩餘 ${lockResult.remaining} 間。請調整房型或數量。`
            };
        }
    } catch (error) {
        log('ERROR', 'Inventory lock API failed.', error);
        return { 
            isHandled: true, 
            nextStep: 'init', 
            prompt: '庫存服務暫時故障，請稍後再試。' 
        };
    }
}

// --- 5. 業務邏輯：價格計算 (calculatePrice) ---
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    const { roomType, checkInDate, nights, roomCount, adultCount, childCount, addons } = data;
    
    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        let totalPrice = 0;
        let priceDetails = [];
        let totalAddonCost = 0;
        const totalGuests = parseInt(adultCount) + parseInt(childCount || 0);

        // --- 1. 計算房間總價 (原價) ---
        let currentDay = dayjs(checkInDate);
        for (let i = 0; i < nights; i++) {
            const isWeekend = currentDay.day() === 5 || currentDay.day() === 6;
            const multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
            const nightPrice = roomDetails.price * multiplier * parseInt(roomCount);
            totalPrice += nightPrice;
            priceDetails.push({ date: currentDay.format('YYYY/MM/DD'), price: nightPrice, isWeekend: isWeekend });
            currentDay = currentDay.add(1, 'day');
        }

        // --- 2. 計算加購服務總價 (在 calculatePriceLogic_after_addons 狀態才計入) ---
        if (session.currentState.includes('after_addons') && addons && addons.length > 0) {
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
        
        // --- 3. 服務費/稅費 (基於原價+加購) ---
        const serviceFee = (totalPrice + totalAddonCost) * 0.05;

        // --- 4. 最終價格 (含服務費/稅費) ---
        let finalPrice = totalPrice + totalAddonCost + serviceFee;
        
        // --- 5. 會員折扣 (在 calculatePriceLogic_after_login 狀態才應用) ---
        if (data.isLoggedIn) {
            finalPrice *= 0.95; // 95 折
        }

        Object.assign(data, {
            roomBasePrice: Math.round(totalPrice), // 紀錄房間原價
            totalAddonCost: Math.round(totalAddonCost), // 紀錄加購總價
            serviceFee: Math.round(serviceFee),
            finalPrice: Math.round(finalPrice),
            priceDetails: priceDetails
        });

        // 🚨 根據當前狀態決定下一步導向
        let targetStep;
        if (session.currentState === 'calculate_price_logic_after_login') {
            targetStep = 'ask_addons'; // 登入/註冊後 -> 加購
        } else if (session.currentState === 'calculate_price_logic_after_addons') {
            targetStep = 'ask_contact_info'; // 加購完成後 -> 聯絡資訊
        } else {
            targetStep = 'ask_member_login'; // 預設 (初次計算) -> 會員登入選擇
        }

        log('INFO', `Price calculated: NT$${data.finalPrice}. Next step: ${targetStep}`);
        // 🚨 優化點：初次和登入後的計算，不改變提示，讓流程安靜過渡
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
// 專門用於加購服務完成後的價格計算和導向聯絡資訊
async function calculatePriceAfterAddons(session) {
    // 執行 calculatePriceLogic 中的計算核心部分
    // 這裡會觸發 calculatePriceLogic 內部對 after_addons 狀態的處理
    await calculatePriceLogic(session); 
    
    // 強制 nextStep 導向聯絡資訊 (這是 calculatePriceLogic 的預期行為)
    return {
        isHandled: true,
        nextStep: 'ask_contact_info' 
    };
}


// --- 7. 會員登入邏輯 (loginMemberAccount) ---
async function processMemberLogin(session) {
    const data = session.collectedData;
    let { memberAccount, memberPassword, rawNumber } = data; // 🚨 引入 rawNumber

    // 🚨 優化點：處理 rawNumber 被誤抓為密碼的情況 (步驟 2)
    if (session.currentState === 'ask_member_password' && !memberPassword && rawNumber) {
        memberPassword = String(rawNumber);
        data.memberPassword = memberPassword;
        delete data.rawNumber; 
    }

    if (session.currentState === 'login_member_account' && memberAccount && !memberPassword) {
        return { isHandled: false }; 
    }

    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                return {
                    isHandled: true,
                    prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
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
            log('ERROR', 'Member verification failed:', error);
            return {
                isHandled: true,
                prompt: '會員驗證服務異常，請直接進行預訂。',
                nextStep: 'ask_addons' 
            };
        }
    }
    return { isHandled: false };
}


// --- 8. 會員註冊邏輯 (registerMemberAccount) ---
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
        log('ERROR', 'Member registration failed:', error);
        return {
            isHandled: true,
            prompt: '會員服務異常，請直接進入下一步。',
            nextStep: 'ask_addons' 
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
        // 🚨 修正：使用 Object.entries 來同時取得 ID 和細節 (步驟 3)
        const addonsEntries = Object.entries(pricing.addons);
        
        const richCardButtons = addonsEntries.map(([id, addon]) => ({
            text: `${addon.name} (NT$ ${addon.price}${addon.isPerNight ? '/晚' : ''})`,
            value: `加購 ${id}`, // 確保這裡使用正確的 ID
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
        
        return { isHandled: true }; 
    } catch (error) {
        log('ERROR', 'Failed to generate addons carousel. Skipping to contact info.', error);
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
             // 清除實體，準備接收下一個加購指令
            delete data.addonAction;
            delete data.addonId; 
            return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `✅ 已加購 ${addonId}。請選擇其他服務或回覆「完成」。`
            };
        } else {
             // 清除實體，準備接收下一個加購指令
            delete data.addonAction;
            delete data.addonId; 
             return { 
                isHandled: true, 
                nextStep: 'ask_addons', 
                prompt: `您已加購 ${addonId}。請選擇其他服務或回覆「完成」。`
            };
        }
    } 
    
    // 預設 (當使用者說「完成」或 Intent 導向這裡)
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

// --- 12. 處理特殊需求 (handleSpecialRequests) ---
function handleSpecialRequestsLogic(session) {
    log('INFO', 'Special requests recorded. Proceeding to payment.');
    return { isHandled: true, nextStep: 'ask_payment_method' };
}

// --- 13. 生成訂單摘要 (generateOrderSummary) ---
async function generateOrderSummaryLogic(session) {
    const data = session.collectedData;
    const roomBasePriceAfterDiscount = data.isLoggedIn ? data.roomBasePrice * 0.95 : data.roomBasePrice;
    const totalRoomPrice = roomBasePriceAfterDiscount + data.totalAddonCost;
    
    data.finalSummary = `
🏨 預訂資訊
- 入住日期: ${data.checkInDate} (共 ${data.nights} 晚)
- 房型/間數: ${data.roomType} / ${data.roomCount} 間
- 入住人數: ${data.adultCount} 大 ${data.childCount || 0} 小
- 會員身份: **${data.isLoggedIn ? '已登入 (享 95 折)' : '未登入'}**
- 加購服務: ${data.addons && data.addons.length > 0 ? data.addons.join(', ') : '無'}
- 特殊需求: ${data.specialRequest || '無'}

👤 聯絡人
- 姓名: ${data.contactName}
- 電話/Email: ${data.contactPhone} / ${data.contactEmail}

💳 付款資訊
- 付款方式: **${data.paymentMethod || '未選擇'}**
---
💰 **價格明細**
- 房間原價 (折扣前): NT$ ${data.roomBasePrice}
- 折扣金額: NT$ ${data.roomBasePrice - roomBasePriceAfterDiscount}
- 房間總價 (折扣後): NT$ ${Math.round(roomBasePriceAfterDiscount)}
- 加購服務費用: NT$ ${data.totalAddonCost}
- 服務費/稅費 (5%): NT$ ${data.serviceFee}
---
**🎉 最終總價: NT$ ${data.finalPrice}**
    `.trim();

    // 🚨 優化點：增加修改按鈕 (步驟 4)
    data.customRichCard = {
        type: "button_list",
        buttons: [
            { text: "✏️ 修改房型", value: "我要修改房型", intent: "correction" },
            { text: "👤 修改聯絡資訊", value: "我要修改聯絡資訊", intent: "correction" }
        ]
    };

    return { isHandled: true };
}

// --- 14. 提交訂單 (submitBooking) ---
async function submitBooking(session) {
    const data = session.collectedData;
    
    try {
        const orderResult = await MockAPI.submitBooking(data); // MockAPI已在步驟1中修正

        if (orderResult.isSuccessful) {
            data.orderId = orderResult.orderId;
            data.paymentMessage = data.paymentMethod === '現場支付' 
                ? '請於入住時在櫃檯完成支付。' 
                : '付款連結已透過郵件寄給您。';
            // 訂單完成後，釋放庫存鎖
            await unlockInventory(session); 
            return { isHandled: true };
        } else {
            return { 
                isHandled: true, 
                nextStep: 'confirm_booking', 
                prompt: `訂單提交失敗：${orderResult.message}，請檢查資訊後再試。`
            };
        }
    } catch (error) {
        log('FATAL', 'Order submission API failed.', error);
        return { 
            isHandled: true, 
            nextStep: 'confirm_booking', 
            prompt: '系統錯誤，無法提交訂單。請稍後再試。' 
        };
    }
}

// --- 15. 庫存解鎖 (unlockInventory) ---
async function unlockInventory(session) {
    const data = session.collectedData;
    if (data.inventoryLockId) {
        await MockAPI.unlockInventory(data.inventoryLockId);
        log('INFO', `Inventory lock ${data.inventoryLockId} released.`);
        delete data.inventoryLockId;
    }
    return { isHandled: true }; 
}

// --- 16. 通用查詢處理 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
    const lastMessage = session.lastMessage;
    
    try {
        const llmResponse = await LLMManager.getLLMResponse(lastMessage);
        data.llm_response = llmResponse.text;
        data.llm_source = llmResponse.source || 'LLM';
        return { isHandled: true, nextStep: 'general_inquiry_response' };
    } catch (error) {
        log('ERROR', 'LLM General Inquiry Failed:', error);
        return { isHandled: true, nextStep: 'handle_llm_failure' };
    }
}


// -------------------------------------------------------------
// 🏆 ESM 匯出 (Export Class)
// -------------------------------------------------------------
class BookingFlowController {
    static checkDateCompleteness = checkDateCompleteness;
    static setDefaultChildCount = setDefaultChildCount; 
    static checkBookingEssentials = checkBookingEssentials;
    
    static lockInventory = lockInventoryLogic; 
    static calculatePrice = calculatePriceLogic; 
    
    static calculatePriceAfterAddons = calculatePriceAfterAddons; 

    static loginMemberAccount = processMemberLogin; 
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

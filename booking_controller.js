// booking_controller.js (V8.3 - 最終修正與價格摘要優化版)

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

// 🎯 關鍵修正：輔助函數：清除 RichCard，防止會員/加購介面混亂
function cleanRichCard(data) {
    if (data.customRichCard) {
        delete data.customRichCard;
        log('DEBUG', 'customRichCard cleared to prevent UI confusion.');
    }
}

// 🎯 新增輔助函數：保存當前狀態為暫停點
function saveCurrentState(session, nextState) {
    // 儲存狀態點：在流程進入需要互動的狀態前儲存，以備通用查詢後返回
    session.collectedData.pauseFromState = nextState;
    log('DEBUG', `Saved pause point: ${nextState}`);
}


// -------------------------------------------------------------
// I. 輔助/流程控制 Handler
// -------------------------------------------------------------

// --- 1. 庫存解鎖 (unlockInventory) ---
async function unlockInventory(session) {
    const data = session.collectedData || {};

    if (data.inventoryLockId) {
        try {
            await MockAPI.unlockInventory(data.inventoryLockId);
            log('INFO', `Inventory lock ${data.inventoryLockId} released.`);
        } catch (error) {
            log('ERROR', `Failed to release inventory lock ${data.inventoryLockId}.`, error);
        }
        delete data.inventoryLockId;
    } else {
        log('INFO', 'Attempted to unlock inventory, but inventoryLockId was not found in data.');
    }
    return { isHandled: true };
}

// --- 2. 處理全局取消 (handleCancellationLogic) ---
async function handleCancellationLogic(session) {
    await unlockInventory(session);
    session.collectedData = {};
    cleanRichCard(session.collectedData);

    log('INFO', 'Global cancellation executed. Data cleared.');
    return {
        isHandled: true,
        prompt: '您的預訂已取消。感謝您的使用，期待下次為您服務！',
        nextStep: 'init'
    };
}

// --- 3. 恢復流程 (resumeFlowFromPause) ---
function resumeFlowFromPause(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    // 預設回到 ask_member_login，確保價格已計算
    const resumeState = data.pauseFromState || 'ask_member_login'; 

    log('INFO', `Resuming flow from state: ${resumeState}`);
    // 清除暫停點，防止重複恢復
    delete data.pauseFromState; 

    return { 
        isHandled: true, 
        nextStep: resumeState 
    };
}


// -------------------------------------------------------------
// II. 流程前置檢查與實體補齊
// -------------------------------------------------------------

// --- 4. 流程前置檢查 (checkDateCompleteness) ---
function checkDateCompleteness(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    let { checkInDate, nights } = data;

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
        if (!data.adultCount) {
            data.adultCount = 1;
        }
        return { isHandled: true, nextStep: 'set_default_child_count' };
    }

    return {
        isHandled: true,
        nextStep: 'ask_dates_and_nights',
        prompt: '請確認您的入住日期和晚數。'
    };
}


// --- 5. 實體補齊：自動設定兒童數 (setDefaultChildCount) ---
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


// --- 6. 流程前置檢查 (checkBookingEssentials) ---
function checkBookingEssentials(session) {
    const data = session.collectedData;
    cleanRichCard(data);
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
// III. 業務邏輯 (API & Calculation)
// -------------------------------------------------------------

// --- 7. 業務邏輯：庫存鎖定 (lockInventory) ---
async function lockInventoryLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { roomType, roomCount } = data;

    try {
        // 在鎖定庫存前先進行解鎖 (避免重複鎖定)
        await unlockInventory(session); 
        
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));

        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', `Inventory locked: ${lockResult.lockId}`);
            return { isHandled: true, nextStep: 'calculate_price_logic' };
        } else {
            // 鎖定失敗後，重置房型和間數，讓使用者重新選擇
            delete data.roomType;
            delete data.roomCount;
            return {
                isHandled: true,
                nextStep: 'ask_room_type',
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

// --- 8. 業務邏輯：價格計算 (calculatePrice) ---
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;

    data.addons = data.addons || [];
    const addons = data.addons;

    try {
        const pricing = await MockAPI.getPricingDetails(roomType);
        const roomDetails = pricing.roomDetails;
        let totalPrice = 0; // 房間總價 (折扣前)
        let priceDetails = [];
        let totalAddonCost = 0;
        const totalGuests = parseInt(adultCount) + parseInt(data.childCount || 0);

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

        // --- 2. 計算加購服務總價 ---
        // 確保在需要時計算 Addon 費用 (流程已到 ask_addons 之後)
        if (data.addons.length > 0 && 
           (session.currentState === 'calculate_price_logic_after_addons' || 
            session.currentState === 'ask_contact_info' ||
            session.currentState === 'ask_payment_method')) {
            
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
        
        // --- 3. 套用會員折扣 (只針對房間總價 totalPrice) ---
        let discountAmount = 0;
        let roomPriceAfterDiscount = totalPrice;
        if (data.isLoggedIn) {
            roomPriceAfterDiscount = totalPrice * 0.95;
            discountAmount = totalPrice - roomPriceAfterDiscount;
        }

        // --- 4. 服務費/稅費 (基於房間折扣後價格 + 加購費用) ---
        const priceBeforeFee = roomPriceAfterDiscount + totalAddonCost;
        const serviceFee = priceBeforeFee * 0.05;

        // --- 5. 最終價格 (折扣後房價 + 加購費用 + 服務費) ---
        let finalPrice = priceBeforeFee + serviceFee;

        // 儲存所有價格細節，並四捨五入到整數
        Object.assign(data, {
            roomBasePrice: Math.round(totalPrice), // 房間原價 (折扣前)
            discountAmount: Math.round(discountAmount), // 折扣金額
            roomPriceAfterDiscount: Math.round(roomPriceAfterDiscount), // 房間總價 (折扣後)
            totalAddonCost: Math.round(totalAddonCost),
            serviceFee: Math.round(serviceFee),
            finalPrice: Math.round(finalPrice),
            priceDetails: priceDetails
        });

        // --- 6. 決定下一步 & 儲存暫停點 ---
        let targetStep;
        // 判斷是從加購後返回還是從一開始的鎖定庫存後
        if (session.currentState === 'calculate_price_logic_after_addons') {
            targetStep = 'ask_contact_info';
            saveCurrentState(session, targetStep); // 📌 儲存聯絡資訊狀態
        } else if (data.isLoggedIn) {
            // 已登入，跳過詢問會員，直接問加購服務
            targetStep = 'ask_addons';
            saveCurrentState(session, targetStep); // 📌 儲存加購服務狀態
        } else {
            // 未登入，詢問是否登入
            targetStep = 'ask_member_login';
            saveCurrentState(session, targetStep); // 📌 儲存會員登入狀態
        }

        log('INFO', `Price calculated: NT$${data.finalPrice}. Next step: ${targetStep}`);
        return { isHandled: true, nextStep: targetStep };

    } catch (error) {
        log('ERROR', 'Price calculation failed:', { error: error, stack: error.stack });
        return {
            isHandled: true,
            prompt: '價格計算服務暫時故障，請稍後再試。',
            nextStep: 'init'
        };
    }
}


// --- 9. 業務邏輯：加購後價格計算 (calculatePriceAfterAddons) ---
// 💡 此 Handler 將在 dialogue_flow.json 的 calculate_price_logic_after_addons 狀態中被呼叫。
async function calculatePriceAfterAddons(session) {
    // 再次調用核心價格邏輯，確保加購服務費用已計入
    return calculatePriceLogic(session);
}


// --- 10. 會員登入邏輯 (loginMemberAccount) ---
async function processMemberLogin(session) {
    const data = session.collectedData;
    let { memberAccount, memberPassword, rawNumber } = data;

    cleanRichCard(data);

    // 處理密碼是數字 (rawNumber) 的情況
    if (session.currentState === 'ask_member_password' && !memberPassword && rawNumber) {
        memberPassword = String(rawNumber);
        data.memberPassword = memberPassword;
        delete data.rawNumber;
    }

    // 如果在 login_member_account 狀態只提供了帳號但沒有密碼，則需要進一步詢問
    if (session.currentState === 'login_member_account' && memberAccount && !memberPassword) {
        // 這裡返回 isHandled: false，讓 Rule Engine 根據 dialogue_flow.json 導向 ask_member_password
        return { isHandled: false }; 
    }

    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                // 登入成功後跳到 calculate_price_logic 狀態進行價格更新 (會自動導向 ask_addons)
                return {
                    isHandled: true,
                    prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                    nextStep: 'calculate_price_logic'
                };
            } else {
                data.isLoggedIn = false;
                delete data.memberPassword;
                saveCurrentState(session, 'ask_member_password'); // 📌 儲存暫停點
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


// --- 11. 會員註冊邏輯 (registerMemberAccount) ---
async function registerMemberAccountLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { memberAccount } = data;

    if (!memberAccount) {
        // 讓 Rule Engine 根據 entity_check 導向 ask_member_account 繼續詢問
        return { isHandled: false };
    }

    try {
        const registerResult = await MockAPI.registerMember(memberAccount);

        if (registerResult.isSuccessful) {
            data.isLoggedIn = true;
            // 註冊成功後跳到 calculate_price_logic 狀態進行價格更新 (會自動導向 ask_addons)
            return {
                isHandled: true,
                prompt: `🎉 ${memberAccount} 註冊成功並自動登入！您本次預訂享有 95 折優惠。`,
                nextStep: 'calculate_price_logic'
            };
        } else {
            saveCurrentState(session, 'register_member_account'); // 📌 儲存暫停點
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
// IV. 其他 Handler (加購/聯絡人/摘要/提交)
// -------------------------------------------------------------

// --- 12. 加購牌卡生成 (generateAddonsCarousel) ---
async function generateAddonsCarouselLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    // 📌 確保當前流程是 ask_addons 時，儲存暫停點
    saveCurrentState(session, 'ask_addons'); 

    try {
        const pricing = await MockAPI.getPricingDetails(data.roomType);
        const addonsEntries = Object.entries(pricing.addons);

        let summaryPrompt = '請選擇您需要的加購服務，完成後請回覆「完成」。';
        if (data.addons && data.addons.length > 0) {
            const selectedNames = data.addons.map(id => pricing.addons[id]?.name || id);
            summaryPrompt = `您目前已選擇：**${selectedNames.join(', ')}**。請繼續選擇或回覆「完成」進入下一步。`;
        }

        const richCardButtons = addonsEntries.map(([id, addon]) => ({
            text: `${addon.name} (NT$ ${addon.price}${addon.isPerNight ? '/晚' : ''})`,
            value: `加購 ${id}`
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

        return { isHandled: true, prompt: summaryPrompt };
    } catch (error) {
        log('ERROR', 'Failed to generate addons carousel. Skipping to contact info.', error);
        // 如果 API 失敗，自動跳到下一步 (ask_contact_info)
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
}

// --- 13. 執行加購操作 (executeAddonsSelection) ---
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
            // 重新生成牌卡並留在 ask_addons
            return {
                isHandled: true,
                nextStep: 'ask_addons',
                prompt: `✅ 已加購 ${addonId}。請選擇其他服務或回覆「完成」。`
            };
        } else {
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
    // 轉移到 calculate_price_logic_after_addons 狀態，由其 Handler 再次計算價格並導向 ask_contact_info
    return { isHandled: true, nextStep: 'calculate_price_logic_after_addons' };
}

// --- 14. 聯絡資訊驗證與推進 (checkContactInfo) ---
function checkContactInfoLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { contactName, contactPhone, contactEmail } = data;

    // 📌 確保當前流程是 ask_contact_info 時，儲存暫停點
    saveCurrentState(session, 'ask_contact_info');

    if (contactName && contactPhone && contactEmail) {
        // 聯絡資訊完整，直接導向 ask_special_requests
        saveCurrentState(session, 'ask_special_requests'); // 📌 儲存特殊需求狀態
        return { isHandled: true, nextStep: 'ask_special_requests' };
    } else {
        // 聯絡資訊不完整，交給 Rule Engine 根據 entity_check 重新詢問
        return { isHandled: false };
    }
}

// --- 15. 處理特殊需求 (handleSpecialRequests) ---
function handleSpecialRequestsLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    log('INFO', 'Special requests recorded. Proceeding to payment.');

    // 📌 確保當前流程是 ask_special_requests 時，儲存暫停點
    saveCurrentState(session, 'ask_payment_method');
    return { isHandled: true, nextStep: 'ask_payment_method' };
}

// --- 16. 生成訂單摘要 (generateOrderSummary) ---
async function generateOrderSummaryLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    // 📌 確保當前流程是 confirm_booking 時，儲存暫停點
    saveCurrentState(session, 'confirm_booking'); 

    // 🎯 確保價格計算在最終摘要前執行
    // 這裡我們信任 priceLogic 已經在 ask_payment_method 狀態中被呼叫過
    const roomBasePrice = data.roomBasePrice || 0; 
    const discountAmount = data.discountAmount || 0; 
    const roomPriceAfterDiscount = data.roomPriceAfterDiscount || 0; 
    const totalAddonCost = data.totalAddonCost || 0; 
    const serviceFee = data.serviceFee || 0; 
    const finalPrice = data.finalPrice || 0; 
    
    // 聯絡人資訊，用於顯示
    const contactInfo = `
- 姓名: ${data.contactName || 'N/A'}
- 電話/Email: ${data.contactPhone || 'N/A'} / ${data.contactEmail || 'N/A'}
    `.trim();

    data.finalSummary = `
🏨 **預訂資訊**
- **入住日期**: ${data.checkInDate} (共 ${data.nights} 晚)
- **房型/間數**: ${data.roomType} / ${data.roomCount} 間
- **入住人數**: ${data.adultCount} 大 ${data.childCount || 0} 小
- **會員身份**: **${data.isLoggedIn ? '✅ 已登入 (享 95 折)' : '❌ 未登入'}**
- **加購服務**: ${data.addons && data.addons.length > 0 ? data.addons.join(', ') : '無'}
- **特殊需求**: ${data.specialRequest || '無'}

👤 **聯絡人**
${contactInfo}

💳 **付款資訊**
- **付款方式**: **${data.paymentMethod || '未選擇'}**
---
💰 **價格明細**
- 房間原價 (折扣前): NT$ ${roomBasePrice.toLocaleString('zh-TW')}
- 折扣金額: NT$ ${discountAmount.toLocaleString('zh-TW')}
- 房間總價 (折扣後): NT$ ${roomPriceAfterDiscount.toLocaleString('zh-TW')}
- 加購服務費用: NT$ ${totalAddonCost.toLocaleString('zh-TW')}
- 服務費/稅費 (5%): NT$ ${serviceFee.toLocaleString('zh-TW')}
---
**🎉 最終總價: NT$ ${finalPrice.toLocaleString('zh-TW')}**
    `.trim();

    // 增加確認/修改按鈕
    data.customRichCard = {
        type: "button_list",
        buttons: [
            { text: "✅ 確認並提交訂單", value: "確認送出", intent: "affirm" },
            { text: "✏️ 修改資訊", value: "修改資訊", intent: "correction" }
        ]
    };

    return { isHandled: true };
}

// --- 17. 提交訂單 (submitBooking) ---
async function submitBooking(session) {
    const data = session.collectedData;
    cleanRichCard(data);

    try {
        const orderResult = await MockAPI.submitBooking(data);

        if (orderResult.isSuccessful) {
            data.orderId = orderResult.orderId;
            data.paymentMessage = data.paymentMethod === '現場支付'
                ? '請於入住時在櫃檯完成支付。'
                : '付款連結已透過郵件寄給您。';
            await unlockInventory(session);
            // 讓流程在 booking_complete 結束
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

// --- 18. 通用查詢處理 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const lastMessage = session.lastMessage;

    try {
        // 確保在呼叫 LLM 之前，將當前狀態作為暫停點儲存
        saveCurrentState(session, session.currentStep); 

        const llmResponse = await LLMManager.getLLMResponse(lastMessage, data); 
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
    // I. 輔助/流程控制
    static unlockInventory = unlockInventory;
    static handleCancellation = handleCancellationLogic;
    static resumeFlowFromPause = resumeFlowFromPause; // 🏆 新增的流程恢復 Handler

    // II. 流程前置檢查與實體補齊
    static checkDateCompleteness = checkDateCompleteness;
    static setDefaultChildCount = setDefaultChildCount;
    static checkBookingEssentials = checkBookingEssentials;

    // III. 業務邏輯
    static lockInventory = lockInventoryLogic;
    static calculatePrice = calculatePriceLogic;
    static calculatePriceAfterAddons = calculatePriceAfterAddons;
    static loginMemberAccount = processMemberLogin;
    static registerMemberAccount = registerMemberAccountLogic;

    // IV. 其他 Handler
    static generateAddonsCarousel = generateAddonsCarouselLogic;
    static executeAddonsSelection = executeAddonsSelectionLogic;
    static validateContactInfo = checkContactInfoLogic;
    static handleSpecialRequests = handleSpecialRequestsLogic;
    static generateOrderSummary = generateOrderSummaryLogic;
    static submitBooking = submitBooking;
    static processGeneralInquiry = processGeneralInquiry;
}

// 🏆 命名匯出
export { BookingFlowController };

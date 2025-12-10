// booking_controller.js (V8.3 - 最終穩定版)

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
    // 確保 data 存在且是物件，然後才清除 customRichCard
    if (data && typeof data === 'object' && data.customRichCard) {
        delete data.customRichCard;
        log('DEBUG', 'customRichCard cleared to prevent UI confusion.');
    }
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


// -------------------------------------------------------------
// II. 流程前置檢查與實體補齊
// -------------------------------------------------------------

// --- 3. 流程前置檢查 (checkDateCompleteness) ---
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


// --- 4. 實體補齊：自動設定兒童數 (setDefaultChildCount) ---
function setDefaultChildCount(session) {
    const data = session.collectedData;

    // 只有當 adultCount 存在且 childCount 為 null 時，才補齊為 0
    if (data.adultCount && (data.childCount === undefined || data.childCount === null)) {
        data.childCount = 0;
        log('INFO', 'childCount 實體自動補齊為 0。');
    }

    if (data.adultCount) {
        return { isHandled: true, nextStep: 'ask_room_type' };
    }
    return { isHandled: true, nextStep: 'ask_guest_count' };
}


// --- 5. 流程前置檢查 (checkBookingEssentials) ---
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

// --- 6. 業務邏輯：庫存鎖定 (lockInventory) ---
async function lockInventoryLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { roomType, roomCount } = data;

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));

        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', `Inventory locked: ${lockResult.lockId}`);
            return { isHandled: true, nextStep: 'calculate_price_logic' };
        } else {
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

// --- 7. 業務邏輯：價格計算 (calculatePrice) ---
async function calculatePriceLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { roomType, checkInDate, nights, roomCount, adultCount } = data;
    // 🎯 修正: 統一使用 session.currentStep
    const currentStep = session.currentStep; 

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
        // 🎯 修正: 僅當狀態在 ask_addons 之後才計算 Addon 費用
        if (currentStep === 'calculate_price_logic_after_addons' || currentStep === 'ask_contact_info' || currentStep === 'ask_payment_method') {
            if (addons.length > 0) {
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

        // --- 6. 決定下一步 ---
        let targetStep;
        if (currentStep === 'calculate_price_logic_after_addons') { // <-- 修正: 使用 currentStep
            // 從加購流程結束導向
            targetStep = 'ask_contact_info';
        } else if (data.isLoggedIn && currentStep === 'calculate_price_logic') { 
             // 登入成功後第一次計算價格，導向詢問加購服務
             targetStep = 'ask_addons';
        } else {
            // 初次計算價格，或登入失敗/跳過，導向詢問登入
            targetStep = 'ask_member_login';
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


// --- 8. 業務邏輯：加購後價格計算 (calculatePriceAfterAddons) ---
async function calculatePriceAfterAddons(session) {
    // 💡 保持此名稱，但實際呼叫核心邏輯
    return calculatePriceLogic(session);
}


// --- 9. 會員登入邏輯 (loginMemberAccount) ---
async function processMemberLogin(session) {
    const data = session.collectedData;
    let { memberAccount, memberPassword, rawNumber } = data;

    // 🎯 修正：處理完畢後立即清除 Rich Card
    cleanRichCard(data);

    // 處理密碼是數字且被錯誤分類為 rawNumber 的情況
    if (session.currentStep === 'ask_member_password' && !memberPassword && rawNumber) {
        memberPassword = String(rawNumber);
        data.memberPassword = memberPassword;
        delete data.rawNumber;
    }

    // 檢查是否所有資訊都收集完畢（如果流程在 'login_member_account' 狀態）
    if (session.currentStep === 'login_member_account' && memberAccount && !memberPassword) {
        // 流程尚未收集到密碼，不處理
        return { isHandled: false }; 
    }

    if (memberAccount && memberPassword) {
        try {
            const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

            if (loginResult.isSuccessful) {
                data.isLoggedIn = true;
                // 登入成功後跳到 calculate_price_logic 狀態進行價格更新
                return {
                    isHandled: true,
                    prompt: `會員 ${memberAccount} 登入成功！您本次預訂享有 95 折優惠。`,
                    nextStep: 'calculate_price_logic'
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


// --- 10. 會員註冊邏輯 (registerMemberAccount) ---
async function registerMemberAccountLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { memberAccount } = data;

    if (!memberAccount) {
        return { isHandled: false };
    }

    try {
        const registerResult = await MockAPI.registerMember(memberAccount);

        if (registerResult.isSuccessful) {
            data.isLoggedIn = true;
            // 註冊成功後跳到 calculate_price_logic 狀態進行價格更新
            return {
                isHandled: true,
                prompt: `🎉 ${memberAccount} 註冊成功並自動登入！您本次預訂享有 95 折優惠。`,
                nextStep: 'calculate_price_logic'
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
// IV. 其他 Handler (加購/聯絡人/摘要/提交)
// -------------------------------------------------------------

// --- 11. 加購牌卡生成 (generateAddonsCarousel) ---
async function generateAddonsCarouselLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);

    try {
        const pricing = await MockAPI.getPricingDetails(data.roomType);
        const addonsEntries = Object.entries(pricing.addons);

        let summaryPrompt = '請選擇您需要的加購服務，完成後請回覆「完成」。';
        if (data.addons && data.addons.length > 0) {
            // 由於 Addons 可能只存 ID，我們需要從 pricing 結構中查找名稱
            const selectedNames = data.addons.map(id => pricing.addons[id]?.name || id);
            summaryPrompt = `您目前已選擇：**${selectedNames.join(', ')}**。請繼續選擇或回覆「完成」進入下一步。`;
        }

        const richCardButtons = addonsEntries.map(([id, addon]) => ({
            text: `${addon.name} (NT$ ${addon.price}${addon.isPerNight ? '/晚' : ''})`,
            value: `加購 ${id}`
            // 💡 移除 intent，讓其作為一般輸入被 executeAddonsSelectionLogic 捕獲
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
        return { isHandled: true, nextStep: 'ask_contact_info' };
    }
}

// --- 12. 執行加購操作 (executeAddonsSelection) ---
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
            // 🎯 重新生成牌卡並留在 ask_addons
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
    return { isHandled: true, nextStep: 'calculate_price_logic_after_addons' };
}

// --- 13. 聯絡資訊驗證與推進 (checkContactInfo) ---
function checkContactInfoLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    const { contactName, contactPhone, contactEmail } = data;

    if (contactName && contactPhone && contactEmail) {
        // 聯絡資訊完整，直接導向 ask_special_requests
        return { isHandled: true, nextStep: 'ask_special_requests' };
    } else {
        // 聯絡資訊不完整，交給 Rule Engine 根據 entity_check 重新詢問
        return { isHandled: false };
    }
}

// --- 14. 處理特殊需求 (handleSpecialRequests) ---
function handleSpecialRequestsLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);
    log('INFO', 'Special requests recorded. Proceeding to payment.');
    return { isHandled: true, nextStep: 'ask_payment_method' };
}

// --- 15. 生成訂單摘要 (generateOrderSummary) ---
async function generateOrderSummaryLogic(session) {
    const data = session.collectedData;
    cleanRichCard(data);

    // 🎯 保險檢查：確保價格數據存在
    if (!data.finalPrice) {
        // 如果價格計算結果遺失，則重新執行一次
        await calculatePriceLogic(session);
    }
    
    // 重新從 data 中讀取 (確保四捨五入後的價格)
    const summaryData = session.collectedData;
    const roomBasePrice = summaryData.roomBasePrice || 0;
    const discountAmount = summaryData.discountAmount || 0;
    const roomPriceAfterDiscount = summaryData.roomPriceAfterDiscount || 0;
    const totalAddonCost = summaryData.totalAddonCost || 0;
    const serviceFee = summaryData.serviceFee || 0;
    const finalPrice = summaryData.finalPrice || 0;

    data.finalSummary = `
🏨 預訂資訊
- 入住日期: ${summaryData.checkInDate} (共 ${summaryData.nights} 晚)
- 房型/間數: ${summaryData.roomType} / ${summaryData.roomCount} 間
- 入住人數: ${summaryData.adultCount} 大 ${summaryData.childCount || 0} 小
- 會員身份: **${summaryData.isLoggedIn ? '已登入 (享 95 折)' : '未登入'}**
- 加購服務: ${summaryData.addons && summaryData.addons.length > 0 ? summaryData.addons.join(', ') : '無'}
- 特殊需求: ${summaryData.specialRequest || '無'}

👤 聯絡人
- 姓名: ${summaryData.contactName}
- 電話/Email: ${summaryData.contactPhone} / ${summaryData.contactEmail}

💳 付款資訊
- 付款方式: **${summaryData.paymentMethod || '未選擇'}**
---
💰 **價格明細**
- 房間原價 (折扣前): NT$ ${roomBasePrice}
- 折扣金額: NT$ ${discountAmount}
- 房間總價 (折扣後): NT$ ${roomPriceAfterDiscount}
- 加購服務費用: NT$ ${totalAddonCost}
- 服務費/稅費 (5%): NT$ ${serviceFee}
---
**🎉 最終總價: NT$ ${finalPrice}**
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

// --- 16. 提交訂單 (submitBooking) ---
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

// --- 17. 通用查詢處理 (processGeneralInquiry) ---
async function processGeneralInquiry(session) {
    const data = session.collectedData;
    // 🎯 修正：確保清除 Rich Card
    cleanRichCard(data);
    const lastMessage = session.lastMessage;

    try {
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

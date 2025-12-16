import { sessionManager } from './session_manager.js';
// 註解：在實際應用中，您可能需要導入價格計算、庫存檢查等服務

const log = (message) => console.log(`[Handler] ${message}`);

// --- 輔助函數：用於統一 Handler 的返回值結構 ---
function _getDefaultResponse(data) {
    // 確保 nextState 存在，以防 Handler 沒有提供明確的跳轉
    const defaultNextState = data.currentConfig?.next_state || data.session?.currentStep;
    
    return { 
        responseText: data.currentConfig?.text || "流程處理中。", 
        richCard: data.currentConfig?.richCard || null,
        nextState: defaultNextState 
    };
}


// --- 核心 Handler 集合 ---

/**
 * 預留的空處理器，用於不需額外邏輯的靜態回應狀態。
 */
export function defaultHandler(data) {
    return _getDefaultResponse(data);
}

/**
 * 處理初次訂房意圖的邏輯。
 * 作用：檢查 CollectedData 是否已有足夠的初始實體 (日期/晚數)，決定下一步狀態。
 */
export function handleBooking(data) {
    const { checkInDate, nights } = data.session.collectedData;

    log(`執行 handleBooking：檢查日期/晚數 (Date: ${checkInDate}, Nights: ${nights})`);

    // 如果已經有日期和晚數，跳過提問階段
    if (checkInDate && nights) {
        return { 
            responseText: `好的，已記錄您預訂 ${nights} 晚，將從 ${checkInDate} 入住開始。請問您要幾間房、幾位大人、幾位小孩呢？`, 
            nextState: 'ask_room_type' // 直接跳到詢問房型
        };
    } else {
        // 否則，導向到明確收集日期/晚數的狀態
        return { 
            responseText: "請告訴我您的入住日期和晚數。", 
            nextState: 'ask_dates_and_nights' 
        };
    }
}


// --- 流程執行 Handler (Placeholder) ---

/**
 * 狀態: check_date_completeness
 * 檢查日期和晚數是否收集完整，如果完整則繼續，否則導向 fallback。
 */
export function checkDateCompleteness(data) {
    const { checkInDate, nights } = data.session.collectedData;
    
    if (checkInDate && nights) {
        return { nextState: 'set_default_child_count' };
    } else {
        // 導向 fallback_state: handle_date_not_found
        return { nextState: 'handle_date_not_found' }; 
    }
}

/**
 * 狀態: set_default_child_count
 * 設置預設的兒童和房間數量（如果用戶未提供）。
 */
export function setDefaultChildCount(data) {
    let { adultCount, childCount, roomCount } = data.session.collectedData;

    if (!adultCount) adultCount = 2; // 預設 2 位大人
    if (!childCount) childCount = 0; // 預設 0 位小孩
    if (!roomCount) roomCount = 1; // 預設 1 間房

    // 更新會話數據
    sessionManager.mergeEntities(data.session.id, { adultCount, childCount, roomCount });
    
    // 流程繼續：導向 ask_room_type
    return { nextState: 'ask_room_type' }; 
}

/**
 * 狀態: check_essentials_before_price
 * 最後檢查所有核心實體是否收集完畢。
 */
export function checkBookingEssentials(data) {
    const { checkInDate, nights, roomType, roomCount, adultCount } = data.session.collectedData;

    if (checkInDate && nights && roomType && roomCount && adultCount) {
        // 實體收集完整，可以進行庫存鎖定
        return { nextState: 'lock_inventory' };
    } else {
        // 缺少核心實體，導回 ask_dates_and_nights 重新開始收集
        return { 
            responseText: "系統偵測到您的訂房資訊不完整，我們將從頭開始收集必要的資訊。",
            nextState: 'ask_dates_and_nights' 
        };
    }
}


/**
 * 狀態: lock_inventory
 * 模擬鎖定庫存，獲取 inventoryLockId。
 */
export function lockInventory(data) {
    // ❌ 實際：調用外部 API 檢查庫存並鎖定
    const success = true; // 模擬成功
    
    if (success) {
        sessionManager.mergeEntities(data.session.id, { inventoryLockId: 'LOCK-' + Date.now() });
        return { nextState: 'calculate_price_logic' };
    } else {
        // 庫存鎖定失敗，導向 fallback_state: ask_room_type
        return { 
            responseText: "抱歉，您選擇的房型或日期目前庫存不足，請重新選擇。",
            nextState: 'ask_room_type' 
        };
    }
}

/**
 * 狀態: calculate_price_logic / calculate_price_logic_after_addons
 * 模擬價格計算，包含折扣和加購。
 */
export function calculatePrice(data) {
    // ❌ 實際：根據 collectedData 進行複雜的價格計算
    const finalPrice = 5000 + (data.session.collectedData.addons?.length || 0) * 100;
    
    sessionManager.mergeEntities(data.session.id, { 
        finalPrice: finalPrice,
        priceDetails: { room: 5000, addons: finalPrice - 5000 }
    });
    
    // 導向 ask_member_login 或 ask_contact_info (根據 JSON 流程)
    return { nextState: data.currentConfig.next_state };
}

/**
 * 狀態: ask_member_password
 * 模擬登入會員帳號。
 */
export function loginMemberAccount(data) {
    // ❌ 實際：調用登入 API
    const loginSuccess = (data.session.collectedData.memberPassword === '1234'); // 模擬密碼判斷
    
    if (loginSuccess) {
        sessionManager.mergeEntities(data.session.id, { isLoggedIn: true, discountAmount: 500 });
        return { 
            responseText: "登入成功！您已獲得 NT$ 500 的會員折扣。",
            nextState: 'calculate_price_logic' // 重新計算價格
        };
    } else {
        // 登入失敗，導向 fallback_state: ask_member_password
        return { 
            responseText: "會員帳號或密碼錯誤，請重新輸入。",
            nextState: 'ask_member_password' 
        };
    }
}

/**
 * 狀態: register_member_account
 * 模擬會員註冊。
 */
export function registerMemberAccount(data) {
    // ❌ 實際：調用註冊 API
    sessionManager.mergeEntities(data.session.id, { isLoggedIn: true, memberAccount: 'new_user@test.com' });
    return { 
        responseText: "註冊成功！我們已將帳號資訊發送至您的 Email。", 
        nextState: 'calculate_price_logic' 
    };
}

/**
 * 狀態: ask_addons
 * 模擬生成加購服務的 Rich Card。
 */
export function generateAddonsCarousel(data) {
    // ❌ 實際：從資料庫獲取加購項目並動態組裝 richCard
    const richCard = {
        "type": "carousel",
        "items": [
            { "title": "機場接送", "price": 800, "id": "A001" },
            { "title": "豪華早餐", "price": 300, "id": "A002" }
        ]
    };
    
    sessionManager.mergeEntities(data.session.id, { customRichCard: richCard });
    
    // 返回包含動態 richCard 的回應
    return { 
        responseText: data.currentConfig.prompt.replace('{addons}', data.session.collectedData.addons.map(a => a.title).join(', ') || '無'),
        richCard: richCard
    };
}

/**
 * 狀態: execute_addons_selection
 * 處理加購服務的選擇。
 */
export function executeAddonsSelection(data) {
    const { addonAction, addonId } = data.session.collectedData;
    let addons = data.session.collectedData.addons || [];
    
    if (addonAction === 'add' && addonId) {
        addons.push({ id: addonId, title: `加購項目 ${addonId}` });
        sessionManager.mergeEntities(data.session.id, { addons: addons, addonAction: null, addonId: null });
        return { nextState: 'ask_addons' }; // 重新回到加購頁面，讓用戶繼續選
    }
    
    // 如果是 'skip' 或 'affirm' (完成)，則跳到價格重算
    return { nextState: 'calculate_price_logic_after_addons' }; 
}

/**
 * 狀態: ask_contact_info
 * 驗證聯絡資訊是否完整。
 */
export function validateContactInfo(data) {
    const { contactName, contactPhone, contactEmail } = data.session.collectedData;
    
    if (contactName && contactPhone && contactEmail) {
        return { nextState: 'ask_special_requests' };
    } else {
        // 由於 ask_contact_info 是一個實體收集狀態，我們只需確保 Prompt 完整
        return _getDefaultResponse(data); 
    }
}

/**
 * 狀態: ask_special_requests
 * 處理特殊需求。
 */
export function handleSpecialRequests(data) {
    // 這裡只需要記錄 specialRequest 實體，流程直接繼續
    return { nextState: 'ask_payment_method' };
}

/**
 * 狀態: ask_payment_method
 * 處理付款方式選擇。
 */
export function processPaymentMethod(data) {
    // 這裡只需要記錄 paymentMethod 實體，流程直接繼續
    return { nextState: 'confirm_booking' };
}

/**
 * 狀態: confirm_booking
 * 生成最終訂單摘要。
 */
export function generateOrderSummary(data) {
    // ❌ 實際：根據 collectedData 組裝詳細的訂單摘要字串
    const sessionData = data.session.collectedData;
    
    const finalSummary = `
- 房型/間數: ${sessionData.roomType} x ${sessionData.roomCount} 間
- 入住日期/晚數: ${sessionData.checkInDate} / ${sessionData.nights} 晚
- 入住人數: ${sessionData.adultCount} 大 ${sessionData.childCount} 小
- 聯絡人: ${sessionData.contactName}
- 加購服務: ${sessionData.addons.map(a => a.title).join(', ') || '無'}
- 付款方式: ${sessionData.paymentMethod}
`;

    sessionManager.mergeEntities(data.session.id, { finalSummary: finalSummary });

    // 填充 Prompt 中的變數
    const responseText = data.currentConfig.prompt
        .replace('{finalSummary}', finalSummary)
        .replace('{finalPrice}', sessionData.finalPrice.toLocaleString());

    return { 
        responseText: responseText, 
        richCard: data.currentConfig.richCard 
    };
}

/**
 * 狀態: booking_complete
 * 模擬送出訂單。
 */
export function submitBooking(data) {
    // ❌ 實際：調用最終訂單 API
    const orderId = 'TM' + Math.floor(Math.random() * 100000);
    const paymentMessage = data.session.collectedData.paymentMethod === '信用卡' 
        ? "您的信用卡將被預授權，預訂成功！" 
        : "訂單已確認，請在入住時支付餘款。";

    sessionManager.mergeEntities(data.session.id, { orderId: orderId, paymentMessage: paymentMessage });
    
    // 填充 Prompt 中的變數
    const responseText = data.currentConfig.prompt
        .replace('{orderId}', orderId)
        .replace('{finalPrice}', data.session.collectedData.finalPrice.toLocaleString())
        .replace('{paymentMessage}', paymentMessage);

    return { 
        responseText: responseText,
        nextState: 'end_conversation' 
    };
}


// --- 輔助和流程控制 Handler ---

/**
 * 狀態: handle_general_inquiry
 * 處理通用查詢（通常與 LLM 或知識庫整合）。
 */
export function processGeneralInquiry(data) {
    // ❌ 實際：調用 Gemini 或其他知識庫 API
    const llm_response = "旅萌大酒店提供免費自助早餐和免費停車服務。";
    const llm_source = "Knowledge Base";
    
    sessionManager.mergeEntities(data.session.id, { llm_response, llm_source });
    
    // 暫停流程，記錄從哪個狀態中斷
    sessionManager.mergeEntities(data.session.id, { pauseFromState: data.session.currentStep });
    
    return { nextState: 'general_inquiry_response' };
}

/**
 * 狀態: resume_booking_flow
 * 恢復到暫停前的狀態。
 */
export function resumeFlowFromPause(data) {
    const pauseFromState = data.session.collectedData.pauseFromState || 'ask_member_login';
    
    // 清空暫停標記
    sessionManager.mergeEntities(data.session.id, { pauseFromState: null });
    
    return { 
        responseText: `已從通用查詢流程返回。恢復到狀態：${pauseFromState}`,
        nextState: pauseFromState 
    };
}

// 確保所有 Handler 都已導出
export { 
    checkDateCompleteness, 
    setDefaultChildCount, 
    checkBookingEssentials,
    lockInventory,
    calculatePrice,
    loginMemberAccount,
    registerMemberAccount,
    generateAddonsCarousel,
    executeAddonsSelection,
    validateContactInfo,
    handleSpecialRequests,
    processPaymentMethod,
    generateOrderSummary,
    submitBooking,
    processGeneralInquiry,
    resumeFlowFromPause
};
// booking_controller.js
/**
 * 核心訂房流程 Handler 實現 (V1.14 - 會員/加購/驗證優化版)
 * 假設流程圖已採用包含 login_member_account, ask_member_password, ask_addons 的優化結構。
 */

const sessionManager = require('./session_manager');

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05; // 5% 折扣

// --- 模擬服務層數據 ---
const ROOM_PRICING = {
    '標準雙人房': { price: 2200, weekendMultiplier: 1.2, capacity: 2 },
    '豪華客房': { price: 3200, weekendMultiplier: 1.2, capacity: 4 },
    '行政套房': { price: 4800, weekendMultiplier: 1.2, capacity: 4 },
    '家庭四人房': { price: 4500, weekendMultiplier: 1.1, capacity: 5 }
};

const ADDONS_SERVICE = {
    'meal_breakfast': { 
        name: '每日自助早餐', 
        price: 450, 
        isPerNight: true, 
        type: 'per_person', 
        description: '享受豐盛的自助式早餐，供應時間 07:00-10:00。',
        image: 'https://i.imgur.com/L79p44K.png' // 替換為實際圖片 URL
    },
    'ticket_waterpark': { 
        name: '水上樂園門票', 
        price: 800, 
        isPerNight: false, 
        type: 'per_person', 
        description: '包含單日票，僅限入住期間使用。兒童票價另計。',
        image: 'https://i.imgur.com/K5fJq2J.png'
    },
    'transfer': { 
        name: '機場接送服務', 
        price: 2000, 
        isPerNight: false, 
        type: 'flat_fee', 
        description: '4人座專車，適用單程接駁服務 (TPE/TSA/KHH)。',
        image: 'https://i.imgur.com/D4sX4n9.png'
    }
};

// --- 輔助函數 (Helper Functions) ---

/**
 * 計算詳細價格明細。 (此函數邏輯已在優化中確認可用，確保使用了 isLoggedIn 判斷折扣)
 */
function getPriceDetails(data) {
    if (!data.nights || !data.roomType || !ROOM_PRICING[data.roomType]) {
        return { roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, serviceFee: 0, finalPrice: 0 };
    }

    let roomCost = 0;
    const totalNights = data.nights || 1;
    const roomDetails = ROOM_PRICING[data.roomType];

    // 1. 房間基礎費用 (包含週末加成)
    if (roomDetails) {
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6 || checkInDate.getDay() === 0) : false; // 修正：週末為週六和週日
        let multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
        
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;
    }

    // 2. 兒童附加費
    const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

    // 3. 加購服務費用
    let addonsCost = 0;
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach(addon => {
            const item = ADDONS_SERVICE[addon.id];
            if (item) {
                let cost = item.price;
                if (item.type === 'per_person') {
                    // 假設 per_person 是按成人數計算
                    cost *= (data.adultCount || 1); 
                }
                if (item.isPerNight) {
                    cost *= totalNights;
                }
                addonsCost += cost;
            }
        });
    }
    
    // 4. 初始總價 (房費 + 兒童費 + 加購費)
    let totalPriceBeforeFee = roomCost + childCost + addonsCost;

    // 5. 會員折扣 - 僅在 isLoggedIn 為 true 時應用
    const memberDiscountValue = data.isLoggedIn ? totalPriceBeforeFee * MEMBER_DISCOUNT_RATE : 0;
    
    let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;

    // 6. 服務費
    const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;
    
    // 7. 最終總價
    const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

    return {
        roomCost: roomCost,
        childCost: childCost,
        addonsCost: addonsCost,
        memberDiscountValue: memberDiscountValue,
        serviceFee: serviceFee,
        finalPrice: finalPrice
    };
}

/**
 * 產生加購服務的 RichCard 輪播圖。
 */
function generateAddonsCarousel(data) {
    const details = getPriceDetails(data);
    
    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        const priceLabel = `TWD ${item.price.toLocaleString()} / ${item.type === 'per_person' ? '人' : '趟'}${item.isPerNight ? ' / 晚' : ''}`;
        const isAdded = data.addons.some(a => a.id === key);

        return {
            title: item.name + (isAdded ? ' ✅' : ''), 
            description: item.description,
            image: item.image,
            footer: priceLabel,
            buttons: isAdded ? 
                [ { text: '取消加購', value: `remove:${key}` } ] :
                [ { text: '新增至訂單', value: `add:${key}` } ]
        };
    });
    
    // 價格提示：強調已包含的項目
    const prompt = `💳 目前訂單總價：NT$ **${details.finalPrice.toLocaleString()}** (含房費、加購及服務費)。\n請選擇需要的加購服務或點擊「完成」。`;

    return {
        richCard: {
            type: 'carousel',
            cards: cards
        },
        prompt: prompt
    };
}


// --- Handler 實現區 ---

/**
 * 檢查日期與晚數 (checkDateAndNights) - (假設與舊版邏輯相同，用於 ask_nights_and_dates 狀態)
 */
function checkDateAndNights(session) {
    const data = session.collectedData;
    
    if (!data.checkInDate) {
        data.CUSTOM_PROMPT = '請提供有效的【入住日期】。';
        return { isHandled: false };
    }
    
    if (!data.nights || data.nights <= 0 || data.nights > MAX_NIGHTS) {
        data.CUSTOM_PROMPT = `請提供有效的【住宿晚數】(1-${MAX_NIGHTS}晚)。`;
        return { isHandled: false };
    }
    
    // 檢查通過
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}

/**
 * 檢查訂房核心資訊 (checkBookingEssentials) - (用於 check_essentials_before_price 狀態)
 */
function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType || !ROOM_PRICING[data.roomType]) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { nextStep: 'show_room_types', isHandled: true };
    }
    if (!data.roomCount || data.roomCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { nextStep: 'ask_guest_count', isHandled: true };
    }
    if (!data.adultCount || data.adultCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { nextStep: 'ask_guest_count', isHandled: true };
    }
    // 檢查通過
    delete data.CUSTOM_PROMPT;
    return { isHandled: false }; // 讓流程繼續到 check_availability_and_price
}

/**
 * 計算價格 (calculatePrice) - (用於 check_availability_and_price 狀態)
 */
function calculatePrice(session) {
    const data = session.collectedData;
    
    // 如果價格已經計算過且沒有變更，則跳過
    if (session.executedHandlers.calculatePrice) {
        return { isHandled: false }; 
    }

    const details = getPriceDetails(data);
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;

    session.executedHandlers.calculatePrice = true;
    
    // 由於 prompt 中使用了 {finalPrice} 變數，這裡不返回 prompt，讓 RuleEngine 使用流程定義的 prompt
    return { isHandled: false }; 
}


/**
 * 🏆 模擬會員登入驗證 Handler。
 * 狀態: login_member_account, ask_member_password
 */
async function loginMemberAccount(session) {
    const data = session.collectedData; 
    const account = data.memberAccount;
    const password = data.memberPassword; 

    // 1. 檢查帳號 (用於 login_member_account 狀態)
    if (!account || account.length < 3) {
        return { 
            prompt: data.CUSTOM_PROMPT || '請輸入有效的【會員帳號】(至少3位)。若無需登入，請輸入「跳過」。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }
    
    // 2. 檢查密碼 (用於 ask_member_password 狀態)
    if (!password || password.length < 4) {
        // 如果已經在問密碼的狀態，但密碼無效，給予錯誤提示
        if (session.currentStep === 'ask_member_password') {
            data.CUSTOM_PROMPT = '請輸入有效的【會員密碼】(至少4位)。';
        }
        
        // 清理本次輸入的實體，讓流程能問密碼
        delete data.memberPassword; 
        return { isHandled: false }; // 讓 RuleEngine 根據流程配置推進到問密碼狀態
    }

    // 3. 模擬登入驗證
    const isLoginSuccessful = (account.toUpperCase() === 'VIP' && password === '1234');
    
    delete data.memberPassword; // 清理密碼實體
    
    if (isLoginSuccessful) {
        data.isLoggedIn = true;
        
        // 🚨 登入成功後，強制清除價格計算追蹤，讓 calculatePrice 重新執行
        sessionManager.clearHandlerExecution(session.id, 'calculatePrice');
        
        // 立即計算更新後的價格並取得詳情
        const details = getPriceDetails(data); 
        data.finalPrice = details.finalPrice; // 更新 session 總價

        const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 專屬折扣！\n當前總價為 NT$ **${details.finalPrice.toLocaleString()}**。現在進入加購步驟。`;

        // 推進到加購選單
        const carouselResult = generateAddonsCarousel(data);

        return { 
            prompt: prompt,
            richCard: carouselResult.richCard,
            nextStep: 'ask_addons', 
            isHandled: true 
        };
        
    } else {
        // 登入失敗：要求重新輸入帳號，流程回退到 login_member_account
        data.isLoggedIn = false;
        data.memberAccount = null;
        
        return { 
            prompt: '❌ 登入失敗。帳號或密碼錯誤。請重新輸入完整的【會員帳號】。若無需登入，請輸入「跳過」。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }
}


/**
 * 🏆 處理加購服務的選擇和動作。
 * 狀態: ask_addons
 */
function executeAddonsSelection(session) {
    const data = session.collectedData; 
    
    if (!data.addons) data.addons = [];
    
    // 處理 RichCard/按鈕點擊傳回的 action 和 id (假設這些實體已在 RuleEngine 內處理)
    const action = data.addonAction; 
    const addonId = data.addonId;    

    let isModified = false;
    let message = '';

    if (action && addonId) {
        // ... (省略 Add/Remove 邏輯，與前一版相同)
        if (action.toLowerCase() === 'add') {
            const exists = data.addons.some(a => a.id === addonId);
            if (!exists) {
                data.addons.push({ id: addonId, count: 1 });
                message = `✅ 已成功加入加購服務：${ADDONS_SERVICE[addonId].name}。`;
                isModified = true;
            }
        } else if (action.toLowerCase() === 'remove') {
            const initialLength = data.addons.length;
            data.addons = data.addons.filter(a => a.id !== addonId);
            if (initialLength !== data.addons.length) {
                 message = `🗑️ 已移除加購服務：${ADDONS_SERVICE[addonId].name}。`;
                 isModified = true;
            }
        }
        
        delete data.addonAction;
        delete data.addonId;
    }
    
    if (isModified) {
        // 🚨 只要加購項目有變動，強制重新計算價格
        sessionManager.clearHandlerExecution(session.id, 'calculatePrice');
        
        const result = generateAddonsCarousel(data);
        return { 
            prompt: message + result.prompt, 
            richCard: result.richCard,
            nextStep: 'ask_addons', 
            isHandled: true 
        };
    }

    // 如果沒有動作，則顯示選單
    const result = generateAddonsCarousel(data);
    return {
        isHandled: true,
        richCard: result.richCard,
        prompt: result.prompt,
        nextStep: 'ask_addons'
    };
}

/**
 * 🏆 驗證聯絡資訊的有效性。
 * 狀態: ask_contact_info
 */
function validateContactInfo(session) {
    const data = session.collectedData; 

    // 姓名檢查
    if (!data.contactName || data.contactName.length < 2 || !/^[\u4e00-\u9fa5a-zA-Z\s]{2,}$/.test(data.contactName)) {
        data.CUSTOM_PROMPT = '請輸入有效的【聯絡人姓名】 (至少2個字)。'; 
        return { nextStep: 'ask_contact_info', isHandled: true };
    }

    // 電話檢查
    if (!data.contactPhone || !/^\d{8,12}$/.test(data.contactPhone.replace(/[\s-]/g, ''))) {
        data.CUSTOM_PROMPT = '請輸入有效的【聯絡電話】 (8-12位數字)。';
        return { nextStep: 'ask_contact_info', isHandled: true };
    }
    data.contactPhone = data.contactPhone.replace(/[\s-]/g, ''); // 清理電話格式

    // 郵件檢查
    if (!data.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
        data.CUSTOM_PROMPT = '請輸入有效的【電子郵件地址】。';
        return { nextStep: 'ask_contact_info', isHandled: true };
    }

    // 所有檢查通過，清除自訂 Prompt 並推進
    delete data.CUSTOM_PROMPT;
    return { isHandled: false };
}


// --- 匯出所有 Handler ---
module.exports = {
    checkDateAndNights, 
    checkBookingEssentials,
    calculatePrice,
    loginMemberAccount, 
    executeAddonsSelection, 
    validateContactInfo, 
    // ... 假設其他未列出的 Handler 仍然存在
    handleSpecialRequests: (session) => ({ isHandled: false }), // 模擬簡單通過
    generateOrderSummary: (session) => ({ isHandled: false }), // 模擬簡單通過
    submitBooking: (session) => { 
        session.collectedData.orderId = Math.random().toString(36).substring(2, 10).toUpperCase();
        session.collectedData.paymentMessage = `您的訂單已保留，請於 48 小時內完成 ${session.collectedData.paymentMethod} 付款。`;
        return { isHandled: false };
    }
};

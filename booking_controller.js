// booking_controller.js
/**
 * 核心訂房流程 Handler 實現 (V1.14 - 會員/加購/驗證優化版)
 */

const sessionManager = require('./session_manager');

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05; // 5% 折扣

// --- 模擬服務層數據 ---
const ROOM_PRICING = {
    // ... (與前一版相同)
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
 * 計算詳細價格明細。 (邏輯不變，僅確保使用了 isLoggedIn 判斷折扣)
 * @param {object} data - collectedData
 * @returns {object} 價格詳情
 */
function getPriceDetails(data) {
    if (!data.nights || !data.roomType || !ROOM_PRICING[data.roomType]) {
        return { roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, serviceFee: 0, finalPrice: 0 };
    }

    let roomCost = 0;
    const totalNights = data.nights || 1;
    const roomDetails = ROOM_PRICING[data.roomType];

    // 1. 房間基礎費用
    // ... (與前一版相同)
    if (roomDetails) {
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6) : false;
        let multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
        
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;
    }

    // 2. 兒童附加費
    const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

    // 3. 初始總價 (房費 + 兒童費 + 加購費)
    let totalPriceBeforeFee = roomCost + childCost;
    
    // 4. 加購服務費用
    let addonsCost = 0;
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach(addon => {
            const item = ADDONS_SERVICE[addon.id];
            if (item) {
                let cost = item.price;
                if (item.type === 'per_person') {
                    // 以總人數 (大人+小孩) 或只算大人? 這裡假設只算大人
                    cost *= (data.adultCount || 1); 
                }
                if (item.isPerNight) {
                    cost *= totalNights;
                }
                addonsCost += cost;
            }
        });
    }
    totalPriceBeforeFee += addonsCost;

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
 * @param {object} data - collectedData
 * @returns {object} RichCard 物件和 Prompt
 */
function generateAddonsCarousel(data) {
    const details = getPriceDetails(data);
    
    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        // 顯示基本價格或費率
        const priceLabel = `${item.price.toLocaleString()} / ${item.type === 'per_person' ? '人' : '趟'}`;
        const isAdded = data.addons.some(a => a.id === key);

        return {
            title: item.name + (isAdded ? ' ✅' : ''), // 已選的加註標記
            description: item.description,
            image: item.image,
            footer: `TWD ${priceLabel}`,
            buttons: isAdded ? 
                [ { text: '取消加購', value: `remove:${key}` } ] :
                [ { text: '新增至訂單', value: `add:${key}` } ]
        };
    });
    
    // 總價中包含已選擇的加購費
    const prompt = `💳 目前訂單總價：NT$ ${details.finalPrice.toLocaleString()} (含房費、加購及服務費)。請選擇需要的加購服務或點擊「完成」。`;

    return {
        richCard: {
            type: 'carousel',
            cards: cards
        },
        prompt: prompt
    };
}


// --- Handler 實現區 ---

// ... (checkDateAndNights, checkBookingEssentials, calculatePrice 保持不變)
// 確保 calculatePrice 負責計算價格並將結果存入 data.priceDetails

/**
 * 🏆 新增/修改：模擬會員登入驗證 Handler。
 * 狀態: login_member_account
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
async function loginMemberAccount(session) {
    const data = session.collectedData; 
    const account = data.memberAccount;
    const password = data.memberPassword; // 從實體收集的密碼/用戶輸入

    // 1. 檢查帳號
    if (!account || account.length < 3) {
        return { 
            prompt: '請輸入有效的會員帳號 (至少3位)。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }
    
    // 2. 檢查密碼/第二次輸入
    if (!password || password.length < 4) {
        // 如果還沒有密碼，推進到下一步，讓流程配置去問密碼
        // 清理本次輸入的實體，避免下次誤判
        delete data.memberPassword; 
        
        // 為了讓流程能問密碼，需要確保流程圖中有一個 next_state
        return { isHandled: false }; // 讓 RuleEngine 繼續推進或詢問密體
    }

    // 3. 模擬登入驗證
    // 假設帳號必須是 "VIP" 且密碼必須是 "1234" 才成功
    const isLoginSuccessful = (account.toUpperCase() === 'VIP' && password === '1234');
    
    // 清理本次輸入的實體
    delete data.memberPassword;
    
    if (isLoginSuccessful) {
        // 登入成功
        data.isLoggedIn = true;
        
        // 🚨 登入成功後，需要強制重新計算價格 (通過清除 Handler 追蹤)
        sessionManager.clearHandlerExecution(session.id, 'check_availability_and_price');
        sessionManager.clearHandlerExecution(session.id, 'check_essentials_before_price');
        
        // 立即計算更新後的價格 (這將在 calculatePrice Handler 再次執行時完成，這裡僅供 prompt 參考)
        const details = getPriceDetails(data); 
        
        const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 專屬折扣！\n當前總價為 NT$ ${details.finalPrice.toLocaleString()}。現在進入加購步驟。`;

        // 推進到加購選單
        const carouselResult = generateAddonsCarousel(data);

        return { 
            prompt: prompt,
            richCard: carouselResult.richCard,
            nextStep: 'ask_addons', 
            isHandled: true 
        };
        
    } else {
        // 登入失敗
        data.isLoggedIn = false;
        
        return { 
            prompt: '❌ 登入失敗。帳號或密碼錯誤。請重新輸入完整的【會員帳號】。若無需登入，請輸入「跳過」。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }
}


/**
 * 🏆 修改：處理加購服務的選擇和動作。
 * 狀態: ask_addons
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function executeAddonsSelection(session) {
    const data = session.collectedData; 
    
    if (!data.addons) data.addons = [];
    
    // 處理 RichCard/按鈕點擊傳回的 action 和 id
    const action = data.addonAction; // 動作：add 或 remove
    const addonId = data.addonId;    // 服務ID：meal_breakfast, transfer 等

    let isModified = false;
    let message = '';

    if (action && addonId) {
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
        
        // 清理本次輸入的 action 和 id
        delete data.addonAction;
        delete data.addonId;
    }
    
    if (isModified) {
        // 🚨 只要加購項目有變動，就強制重新計算價格
        sessionManager.clearHandlerExecution(session.id, 'check_availability_and_price');
        sessionManager.clearHandlerExecution(session.id, 'check_essentials_before_price');
        
        // 重新計算價格並回饋
        const result = generateAddonsCarousel(data);
        return { 
            prompt: message + result.prompt, // 顯示操作結果 + 輪播圖提示
            richCard: result.richCard,
            nextStep: 'ask_addons', 
            isHandled: true 
        };
    }

    // 處理文字指令 (例如用戶輸入「完成」、「跳過」)
    const userMessage = session.userMessage || '';
    if (session.intents.includes('affirm') || userMessage.includes('完成') || userMessage.includes('跳過') || userMessage.includes('不用了')) {
        const { finalPrice, addonsCost } = getPriceDetails(data); 
        let prompt = `您已選擇完成加購。加購總費用為 NT$ ${addonsCost.toLocaleString()}。現在進入下一步。`;
        data.finalPrice = finalPrice;
        
        // 推進到下一狀態
        return { prompt: prompt, nextStep: 'ask_contact_info', isHandled: true };
    }
    
    // 如果沒有動作，或用戶輸入閒聊，則保持狀態並顯示選單
    const result = generateAddonsCarousel(data);
    return {
        isHandled: true,
        richCard: result.richCard,
        prompt: result.prompt,
        nextStep: 'ask_addons'
    };
}

/**
 * 🏆 修改：驗證聯絡資訊的有效性。
 * 狀態: ask_contact_info
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function validateContactInfo(session) {
    const data = session.collectedData; 

    // 姓名檢查：至少2個字，不包含數字或特殊符號
    if (!data.contactName || data.contactName.length < 2 || !/^[\u4e00-\u9fa5a-zA-Z\s]{2,}$/.test(data.contactName)) {
        // 提示用戶缺失的資訊
        data.CUSTOM_PROMPT = '請輸入有效的【聯絡人姓名】 (至少2個字，不可包含數字)。'; 
        return { nextStep: 'ask_contact_info', isHandled: true };
    }

    // 電話檢查：8-12位數字，接受常見格式 (例如 09xx-xxx-xxx)
    if (!data.contactPhone || !/^\d{8,12}$/.test(data.contactPhone.replace(/[\s-]/g, ''))) {
        data.CUSTOM_PROMPT = '請輸入有效的【聯絡電話】 (8-12位數字)。';
        return { nextStep: 'ask_contact_info', isHandled: true };
    }
    // 清理電話格式
    data.contactPhone = data.contactPhone.replace(/[\s-]/g, '');

    // 郵件檢查：標準郵件格式
    if (!data.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
        data.CUSTOM_PROMPT = '請輸入有效的【電子郵件地址】。';
        return { nextStep: 'ask_contact_info', isHandled: true };
    }

    // 所有檢查通過，推進到下一狀態
    return { nextStep: 'ask_special_requests', isHandled: true };
}


// ... (handleSpecialRequests, generateOrderSummary, submitBooking 保持不變)

// --- 匯出所有 Handler ---
module.exports = {
    // ... (所有舊 Handler)
    checkDateAndNights, 
    checkBookingEssentials,
    calculatePrice,
    loginMemberAccount, // 🏆 新/改
    executeAddonsSelection, // 🏆 新/改
    validateContactInfo, // 🏆 新/改
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking
};

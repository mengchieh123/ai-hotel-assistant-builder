// booking_controller.js
/**
 * 核心訂房流程 Handler 實現 (V1.13 - 專業整合版，與通用 RuleEngine 兼容)
 */

// 假設這裡導入了 SessionManager (請確保其路徑和方法可用)
const sessionManager = require('./session_manager'); // 🚨 請確保此模組存在且路徑正確！

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const MAX_ADULTS_PER_ROOM = 4;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05;

// --- 模擬服務層數據 ---
const ROOM_PRICING = {
    '標準雙人房': { price: 2200, weekendMultiplier: 1.2, capacity: 2 },
    '豪華客房': { price: 3200, weekendMultiplier: 1.2, capacity: 4 },
    '行政套房': { price: 4800, weekendMultiplier: 1.2, capacity: 4 },
    '家庭四人房': { price: 4500, weekendMultiplier: 1.1, capacity: 5 }
};

const ADDONS_SERVICE = {
    'meal_breakfast': { name: '每日自助早餐', price: 450, isPerNight: true, type: 'per_person', image: 'https://i.imgur.com/L79p44K.png' },
    'ticket_waterpark': { name: '水上樂園門票', price: 800, isPerNight: false, type: 'per_person', image: 'https://i.imgur.com/K5fJq2J.png' },
    'transfer': { name: '機場接送-4人座', price: 2000, isPerNight: false, type: 'flat_fee', image: 'https://i.imgur.com/D4sX4n9.png' }
};

// --- 輔助函數 (Helper Functions) ---

/**
 * 計算詳細價格明細。
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
    if (roomDetails) {
        // 模擬週末價格 (週六)
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6) : false;
        let multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
        
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;
    }

    // 2. 兒童附加費
    const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

    // 3. 初始總價 (房費 + 兒童費)
    let totalPriceBeforeFee = roomCost + childCost;
    
    // 4. 加購服務費用
    let addonsCost = 0;
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach(addon => {
            const item = ADDONS_SERVICE[addon.id];
            if (item) {
                let cost = item.price;
                if (item.type === 'per_person') {
                    // 以成人數計費
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

    // 5. 會員折扣
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
 * 產生加購服務的 RichCard
 * @param {object} data - collectedData
 * @returns {object} RichCard 物件
 */
function generateAddonsCarousel(data) {
    const { finalPrice } = getPriceDetails(data);

    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        const basePrice = item.price;

        return {
            title: item.name,
            description: item.name.includes('早餐')
                ? `飯店精選自助式早餐。供應時間 07:00-10:00。`
                : item.name.includes('樂園')
                ? `包含單日票，僅限入住期間使用。`
                : `4人座專車，適用單程接駁服務。`,
            image: item.image,
            footer: `TWD ${basePrice.toLocaleString()} / ${item.type === 'per_person' ? '人' : '趟'}`,
            buttons: [
                {
                    text: '新增至訂單',
                    value: `add:${key}`
                }
            ]
        };
    });

    return {
        richCard: {
            type: 'carousel',
            cards: cards
        },
        prompt: `目前訂單總價：NT$ ${finalPrice.toLocaleString()} (含房費及服務費)。請選擇需要的加購服務：`
    };
}


// --- Handler 實現區 ---

/**
 * 檢查日期和入住天數的有效性。 (取代您舊版中 checkDateAndNights 的缺失邏輯)
 * 狀態: ask_nights_and_dates
 * @param {object} session - 當前對話 Session 物件
 * @returns {object} Handler 處理結果
 */
async function checkDateAndNights(session) {
    // 🏆 關鍵修正：從 session 中提取 collectedData
    const data = session.collectedData;

    // 1. 檢查核心實體是否存在
    if (!data.checkInDate || !data.nights) {
        // 如果缺少核心實體，則不需要處理 (交給 RuleEngine 的實體不足提示)
        return { isHandled: false }; 
    }

    // 2. 檢查 nights 是否為有效數字 (防止 NaN 或負數)
    const nights = parseInt(data.nights);
    if (isNaN(nights) || nights <= 0) {
        sessionManager.clearBookingEssentials(session.id); // 清空基本數據
        return {
            isHandled: true,
            nextStep: 'ask_nights_and_dates',
            prompt: `入住天數必須為有效的數字且至少為 1 晚。您輸入了 "${data.nights}"，請重新輸入。`,
        };
    }
    
    // 3. 檢查日期是否為過去
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const checkIn = new Date(data.checkInDate);
    
    if (checkIn < today) {
        sessionManager.clearBookingEssentials(session.id);
        return {
            isHandled: true,
            nextStep: 'ask_nights_and_dates',
            prompt: '抱歉，無法預訂過去的日期。請提供有效的入住日期。',
        };
    }

    // 4. 檢查最大天數限制
    if (nights > MAX_NIGHTS) {
        return {
            isHandled: true,
            nextStep: 'ask_nights_and_dates',
            prompt: `單次預訂最多僅能 ${MAX_NIGHTS} 晚。請縮短您的入住天數。`,
        };
    }
    
    // 檢查通過，更新數據並推進
    data.nights = nights;
    // 修正：您的舊版是 nextStep: 'ask_guest_count'，但 RuleEngine 會自動推進
    // 這裡只確保數據有效，並讓 RuleEngine 自動推進到下一個缺實體的狀態。
    return { isHandled: true }; 
}

/**
 * 🏆 強制檢查關鍵實體和邏輯一致性。
 * 狀態: check_essentials_before_price
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function checkBookingEssentials(session) {
    const data = session.collectedData; // 🏆 關鍵修正
    
    // 1. 檢查核心實體 (日期/晚數/房型/人數/間數)
    const required = ['checkInDate', 'nights', 'adultCount', 'roomCount', 'roomType'];
    const missing = required.filter(key => data[key] === undefined || data[key] === null || data[key] === '');

    if (missing.length > 0) {
        let fallbackState = 'ask_nights_and_dates';
        let prompt = `抱歉，您的預訂資訊缺少核心要素：${missing.join(', ')}。`;

        if (missing.includes('roomType')) {
            fallbackState = 'show_room_types';
            prompt += '請先選擇或確認房型。';
        } else if (missing.includes('adultCount')) {
             fallbackState = 'ask_guest_count';
             prompt += '請提供準確的入住人數 (大人/兒童)。';
        }
        
        return {
            isHandled: true,
            nextStep: fallbackState,
            prompt: prompt,
        };
    }

    // 2. 檢查邏輯一致性：最大入住人數
    const roomDetails = ROOM_PRICING[data.roomType];
    const maxCapacity = roomDetails ? roomDetails.capacity * data.roomCount : 99;

    if ((data.adultCount + (data.childCount || 0)) > maxCapacity) {
        return {
            isHandled: true,
            nextStep: 'ask_guest_count',
            prompt: `您選擇的 ${data.roomType} (${data.roomCount} 間) 最多可容納 ${maxCapacity} 人。請減少總入住人數。`,
        };
    }

    // 所有必要資訊齊全，自動推進到價格檢查
    return { isHandled: true, nextStep: 'check_availability_and_price' };
}

/**
 * 計算價格和空房檢查 (模擬)。
 * 狀態: check_availability_and_price
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function calculatePrice(session) {
    const data = session.collectedData; // 🏆 關鍵修正

    // 🚨 模擬空房檢查 (例如 2026/01/01 無房)
    if (data.checkInDate === '2026/01/01') {
        sessionManager.clearBookingEssentials(session.id);
        return {
            isHandled: true,
            nextStep: 'ask_nights_and_dates',
            prompt: `抱歉，您選擇的 ${data.checkInDate} 日期已無空房。請重新選擇入住日期。`,
        };
    }
    
    const details = getPriceDetails(data);
    
    // 將價格細節存回 session
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;
    
    // 檢查目前流程是否在詢問付款方式 (代表價格已確認過)
    if (session.currentStep === 'ask_payment_method') {
        let prompt = `好的，所有費用已確認，最終總價為 **NT$ ${details.finalPrice.toLocaleString()}**。請選擇您的付款方式：`;
        return { prompt: prompt, isHandled: true };
    }
    
    // 價格計算成功，推進到下一狀態 (讓 RuleEngine 自動推進)
    return { isHandled: true };
}

/**
 * 模擬會員登入/應用折扣 Handler。
 * 狀態: login_member_account
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function loginMemberAccount(session) {
    const data = session.collectedData; // 🏆 關鍵修正
    const account = data.memberAccount || '';
    
    // 檢查是否有有效的帳號實體
    if (!account || account.length < 3) {
        return { 
            prompt: '請輸入有效的會員帳號 (至少3位)。請重新輸入，或輸入「跳過」進入下一步。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }

    // 模擬登入成功
    data.memberAccount = account.toUpperCase();
    data.isLoggedIn = true;
    
    // 🚨 登入成功後，需要強制重新計算價格
    // 這裡我們不主動推進，讓 RuleEngine 偵測到實體滿足後自動推進到 'ask_addons'
    // 或在 ask_addons 之前加入 check_discount_price 狀態，讓其執行 calculatePrice
    
    const details = getPriceDetails(data);
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;
    
    const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 專屬折扣！\n當前總價為 NT$ ${details.finalPrice.toLocaleString()}。現在進入加購步驟。`;

    const carouselResult = generateAddonsCarousel(data);

    return { 
        prompt: prompt,
        richCard: carouselResult.richCard,
        nextStep: 'ask_addons', 
        isHandled: true 
    };
}

/**
 * 處理加購服務的選擇和動作。
 * 狀態: ask_addons
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function executeAddonsSelection(session) {
    const data = session.collectedData; // 🏆 關鍵修正
    
    // 確保 addons 陣列存在
    if (!data.addons) data.addons = [];
    
    // 處理 RichCard/按鈕點擊傳回的 action 和 id
    const action = session.collectedData.addonAction; 
    const addonId = session.collectedData.addonId;

    if (action && addonId) {
        if (action.toLowerCase() === 'add') {
            const exists = data.addons.some(a => a.id === addonId);
            if (!exists) {
                data.addons.push({ id: addonId, count: 1 });
            }
            // 清理本次輸入的 action 和 id，避免下次重複執行
            delete data.addonAction;
            delete data.addonId;

            // 重新計算價格並回饋
            const result = generateAddonsCarousel(data);
            return { 
                prompt: '✅ 已成功加入加購服務。請繼續選擇或點擊「完成」。', 
                richCard: result.richCard,
                nextStep: 'ask_addons', 
                isHandled: true 
            };
        }
    }
    
    // 處理文字指令 (例如用戶輸入「完成」、「跳過」)
    const userMessage = session.userMessage || '';
    if (session.intents.includes('affirm') || userMessage.includes('完成') || userMessage.includes('跳過')) {
        const { finalPrice, addonsCost } = getPriceDetails(data); 
        let prompt = `您已選擇完成加購，加購總費用為 NT$ ${addonsCost.toLocaleString()}。`;
        data.finalPrice = finalPrice;
        
        // 🚨 推進到下一狀態
        return { prompt: prompt, nextStep: 'ask_contact_info', isHandled: true };
    }
    
    // 如果沒有動作，重新顯示選單
    const result = generateAddonsCarousel(data);
    return {
        isHandled: true,
        richCard: result.richCard,
        prompt: result.prompt,
        nextStep: 'ask_addons'
    };
}

/**
 * 驗證聯絡資訊的有效性。
 * 狀態: ask_contact_info
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function validateContactInfo(session) {
    const data = session.collectedData; // 🏆 關鍵修正

    if (!data.contactName || data.contactName.length < 2) {
        return { prompt: '請輸入有效的聯絡人姓名 (至少2個字)。', nextStep: 'ask_contact_info', isHandled: true };
    }

    if (!data.contactPhone || !/^\d{8,12}$/.test(data.contactPhone)) {
        return { prompt: '請輸入有效的聯絡電話 (8-12位數字)。', nextStep: 'ask_contact_info', isHandled: true };
    }

    if (!data.contactEmail || !/@/.test(data.contactEmail)) {
        return { prompt: '請輸入有效的電子郵件地址。', nextStep: 'ask_contact_info', isHandled: true };
    }

    return { nextStep: 'ask_special_requests', isHandled: true };
}

/**
 * 處理特殊要求 (僅儲存並推進)。
 * 狀態: ask_special_requests
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function handleSpecialRequests(session) {
    const data = session.collectedData; // 🏆 關鍵修正
    // 確保 specialRequest 有值 (即使是空字串)
    data.specialRequest = data.specialRequest || ''; 
    
    return { nextStep: 'ask_payment_method', isHandled: true };
}

/**
 * 生成最終訂單摘要。
 * 狀態: confirm_booking
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果
 */
function generateOrderSummary(session) {
    const data = session.collectedData; // 🏆 關鍵修正
    const details = data.priceDetails;
    
    // 如果 priceDetails 不存在，強制重新計算一次
    if (!details || !details.finalPrice) {
        calculatePrice(session); // 此處會更新 data.priceDetails
        if (!data.priceDetails) {
             return { prompt: "抱歉，訂單摘要生成失敗，缺少價格資訊。", nextStep: 'check_essentials_before_price', isHandled: true };
        }
    }
    
    const finalDetails = data.priceDetails; // 使用更新後的 details

    const summary = `
**--- 📝 最終訂單摘要 ---**
**房間資訊：**
 * 房型/間數：${data.roomType} (${data.roomCount} 間)
 * 日期/晚數：${data.checkInDate}, ${data.nights} 晚
 * 入住人數：${data.adultCount} 大, ${data.childCount || 0} 小

**費用明細：**
 * 房間總費用：NT$ ${finalDetails.roomCost.toLocaleString()}
 * 兒童附加費：NT$ ${finalDetails.childCost.toLocaleString()}
 * 加購服務費：NT$ ${finalDetails.addonsCost.toLocaleString()}
 * 🥂 會員折扣：- NT$ ${finalDetails.memberDiscountValue.toLocaleString()}
 * 服務費 (${SERVICE_FEE_RATE * 100}%)：NT$ ${finalDetails.serviceFee.toLocaleString()}
**總價 (TWD)：NT$ ${finalDetails.finalPrice.toLocaleString()}**

**聯絡與要求：**
 * 聯絡人：${data.contactName} (${data.contactPhone})
 * 付款方式：${data.paymentMethod}
 * 特殊要求：${data.specialRequest || '無'}
**--- 🛎️ 請確認所有資訊無誤後，輸入「確認」完成預訂 ---**
    `;

    data.finalSummary = summary;
    
    return { 
        prompt: summary, 
        isHandled: true 
    };
}

/**
 * 模擬訂單提交 (此 Handler 通常由 RuleEngine 特殊調用，但仍需匯出)。
 * 狀態: booking_complete
 * @param {object} session - 當前 Session 物件
 * @returns {object} Handler 處理結果 (包含成功/失敗訊息)
 */
function submitBooking(session) {
    const data = session.collectedData;
    const orderId = `#${Math.floor(Math.random() * 90000) + 10000}`; 
    const finalPrice = data.priceDetails ? data.priceDetails.finalPrice.toLocaleString() : 'N/A';
    
    const finalPrompt = `
**🎉 訂單提交成功！**
訂單編號：${orderId}
總價：NT$ ${finalPrice}

您的預訂已確認，詳細資訊已發送到您的電子郵件 **${data.contactEmail}**。
期待您的光臨！
    `;

    // 模擬成功邏輯
    return { 
        success: true,
        id: orderId,
        paymentMessage: `我們已收到您的預訂。您的訂單將使用 ${data.paymentMethod} 方式支付。`,
        prompt: finalPrompt, // 雖然 RuleEngine 會處理，但這裡返回 finalPrompt
        isHandled: true
    };
    
    // 模擬失敗邏輯 (如果需要)
    /*
    return {
        success: false,
        errorMessage: '支付系統暫時無法連線，請稍後再試。',
    };
    */
}


// --- 匯出所有 Handler ---
module.exports = {
    checkDateAndNights, 
    checkBookingEssentials,
    calculatePrice,
    loginMemberAccount,
    executeAddonsSelection,
    validateContactInfo,
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking
};

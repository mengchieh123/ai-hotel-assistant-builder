/**
 * booking_controller.js
 * 核心訂房流程 Handler 實現
 * 配合 dialogue_flow.json (Optimized Structure V4) 使用
 */

// --- 模擬服務層數據 (實際應用應調用後端 API) ---

const ROOM_PRICING = {
    '標準雙人房': { price: 2200, weekendMultiplier: 1.2 },
    '豪華客房': { price: 3200, weekendMultiplier: 1.2 },
    '行政套房': { price: 4800, weekendMultiplier: 1.2 },
    '家庭四人房': { price: 4500, weekendMultiplier: 1.1 }
};

const ADDONS_SERVICE = {
    'meal_breakfast': { name: '每日自助早餐', price: 450, isPerNight: true, type: 'per_person', image: 'https://example.com/images/breakfast.jpg' },
    'ticket_waterpark': { name: '水上樂園門票', price: 800, isPerNight: false, type: 'per_person', image: 'https://example.com/images/waterpark.jpg' },
    'transfer': { name: '機場接送-4人座', price: 2000, isPerNight: false, type: 'flat_fee', image: 'https://example.com/images/transfer.jpg' }
};

const SERVICE_FEE_RATE = 0.1; // 服務費 10%
const CHILD_SURCHARGE = 500; // 兒童不佔床附加費/晚

// --- 輔助函數 (Helper Functions) ---

function getPriceDetails(data) {
    let basePrice = 0;
    let roomCost = 0;
    let totalNights = data.nights || 1;
    let roomDetails = ROOM_PRICING[data.roomType];

    if (roomDetails) {
        // 假設只有週六是週末價 (簡化計算)
        let isWeekend = (new Date(data.checkInDate).getDay() === 6);
        let multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
        basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;
    }

    const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

    // 🏆 會員折扣模擬 (95折，回應客戶上次發現的 5% 折扣)
    const MEMBER_DISCOUNT_RATE = 0.05;
    const memberDiscountValue = data.memberAccount ? (roomCost + childCost) * MEMBER_DISCOUNT_RATE : 0;

    let totalPriceBeforeFee = roomCost + childCost - memberDiscountValue;
    
    // 加購費用
    let addonsCost = 0;
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach(addon => {
            const item = ADDONS_SERVICE[addon.id];
            if (item) {
                let cost = item.price;
                if (item.type === 'per_person') {
                    // 假設按大人人數計算
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

    const serviceFee = totalPriceBeforeFee * SERVICE_FEE_RATE;
    const finalPrice = Math.round(totalPriceBeforeFee + serviceFee);

    return {
        roomCost: roomCost,
        childCost: childCost,
        addonsCost: addonsCost,
        memberDiscountValue: memberDiscountValue,
        serviceFee: serviceFee,
        finalPrice: finalPrice
    };
}


// --- Handler 實現區 ---

/**
 * 1. 處理價格計算和庫存檢查，並處理會員登入的條件式跳轉。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function calculatePrice(session) {
    const data = session.bookingData;
    const { roomCost, childCost, addonsCost, memberDiscountValue, serviceFee, finalPrice } = getPriceDetails(data);
    
    // 檢查庫存 (Oversimplified: 假設庫存總是足夠)
    const isAvailable = true; 

    // 更新 Session 數據
    session.bookingData.totalPrice = Math.round(roomCost + childCost); // 顯示給用戶的初始價
    session.bookingData.finalPrice = finalPrice; // 最終價格 (含折扣/加購/服務費)
    session.bookingData.priceDetails = { roomCost, childCost, addonsCost, memberDiscountValue, serviceFee, finalPrice };

    if (!isAvailable) {
        // 實際應用中需返回 OOS 訊息
        return { prompt: `抱歉，${data.roomType} 在該日期庫存不足。請修改房間數或日期。`, nextStep: 'ask_room_count', isHandled: true };
    }

    // 🏆 關鍵優化：如果已登入，直接跳到 ask_addons
    if (session.bookingData.isLoggedIn) {
        let prompt = `🎉 您已登入【${data.memberAccount}】。已為您套用 5% 會員折扣。現在為您準備加購服務。`;
        // 這是 ask_payment_method 狀態執行的情況
        if (session.currentState === 'ask_payment_method') {
             prompt = `好的，所有費用已確認，最終總價為 **NT$ ${finalPrice}**。請選擇您的付款方式：`;
        }
        
        return { 
            prompt: prompt, 
            nextStep: 'ask_addons', 
            isHandled: true 
        };
    }
    
    // 保持在原狀態，等待用戶點擊登入按鈕
    return { isHandled: true }; 
}

/**
 * 2. 處理會員登入邏輯。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function loginMemberAccount(session) {
    const data = session.bookingData;
    const account = data.memberAccount;

    // 模擬驗證 (實際應用中應調用 API)
    if (account && account.length >= 5) {
        // 🏆 關鍵優化：設置 isLoggedIn 標記，並強制跳轉
        session.bookingData.memberAccount = account.toUpperCase(); // 設置成功帳號
        session.bookingData.isLoggedIn = true; // 標記為已登入
        
        // 重新計算價格以應用折扣
        const { finalPrice } = getPriceDetails(session.bookingData);

        const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 5% 專屬折扣！\n當前總價為 NT$ ${finalPrice}。現在進入加購步驟。`;

        return { 
            prompt: prompt,
            nextStep: 'ask_addons', // 成功後直接跳轉
            isHandled: true 
        };
    } else {
        const prompt = '抱歉，查無此會員帳號。請檢查後重新輸入，或輸入「跳過」進入下一步。';
        return { prompt: prompt, nextStep: 'login_member_account', isHandled: true };
    }
}

/**
 * 3. 處理加購項目選擇，動態生成 Rich Card Carousel。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function executeAddonsSelection(session) {
    const data = session.bookingData;
    const { finalPrice } = getPriceDetails(data); // 重新計算價格以更新顯示

    // 處理用戶點擊加購動作 (addonAction)
    if (data.addonAction && data.addonId) {
        if (data.addonAction === 'add') {
            if (!data.addons) data.addons = [];
            data.addons.push({ id: data.addonId, count: 1 }); // 簡化處理，每次點擊加 1
            delete data.addonAction;
            delete data.addonId;
            // 處理完畢後，流程需停留在本狀態並重新渲染卡片
            return { prompt: '✅ 已成功加入加購服務。請繼續選擇或點擊「完成」。', nextStep: 'ask_addons', isHandled: true };
        }
    }
    
    // 檢查是否有「完成」指令，若有則跳轉
    if (session.entities.addonAction && session.entities.addonAction.toLowerCase() === '完成') {
        const addonsCost = data.priceDetails.addonsCost;
        let prompt = `您已選擇完成加購。加購總費用為 NT$ ${addonsCost}。`;
        return { prompt: prompt, nextStep: 'ask_contact_info', isHandled: true };
    }

    // 🏆 關鍵優化：動態生成 Rich Card Carousel
    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        const basePrice = item.price;
        let priceDescription = `${basePrice} /${item.type === 'per_person' ? '每人' : '每趟'}`;

        return {
            title: item.name,
            description: item.name === '每日自助早餐' 
                ? `飯店精選自助式早餐。價格：TWD ${basePrice} /人 (共 ${data.adultCount} 位大人)`
                : item.name === '水上樂園門票'
                ? `包含麗寶樂園水上/探索樂園單日票。價格：TWD ${basePrice} /人`
                : `接送服務。價格：TWD ${basePrice} /趟。`,
            image: item.image,
            footer: `TWD ${basePrice}`,
            buttons: [
                {
                    text: '新增至訂單',
                    value: `add:${key}` // 使用 value 傳遞指令和 ID
                }
            ]
        };
    });

    return {
        isHandled: true,
        richCard: {
            type: 'carousel',
            cards: cards
        },
        prompt: `目前訂單總價：NT$ ${finalPrice} (含加購)。請選擇需要的服務：`,
        nextStep: 'ask_addons' // 停留在本狀態
    };
}


/**
 * 4. 聯絡資訊格式驗證。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function validateContactInfo(session) {
    const data = session.bookingData;

    if (!data.contactName || data.contactName.length < 2) {
        return { prompt: '請輸入有效的聯絡人姓名 (至少2個字)。', nextStep: 'ask_contact_info', isHandled: true };
    }

    // 簡單的電話號碼驗證
    if (!data.contactPhone || !/^\d{10}$/.test(data.contactPhone)) {
        return { prompt: '請輸入有效的 10 位手機號碼。', nextStep: 'ask_contact_info', isHandled: true };
    }

    // 簡單的Email驗證
    if (!data.contactEmail || !/@/.test(data.contactEmail)) {
        return { prompt: '請輸入有效的電子郵件地址。', nextStep: 'ask_contact_info', isHandled: true };
    }

    // 驗證成功，跳轉到下一步
    return { nextStep: 'ask_special_requests', isHandled: true };
}

/**
 * 5. 處理特殊要求並跳轉。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function handleSpecialRequests(session) {
    const data = session.bookingData;
    
    // 假設特殊要求已儲存到 data.specialRequest 實體中
    const request = data.specialRequest || '無';
    
    session.bookingData.specialRequest = request; 

    // 成功處理後，跳轉到 ask_payment_method
    return { nextStep: 'ask_payment_method', isHandled: true };
}

/**
 * 6. 生成最終訂單摘要。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function generateOrderSummary(session) {
    const data = session.bookingData;
    const details = data.priceDetails;

    const summary = `
**--- 📝 最終訂單摘要 ---**
**房間資訊：**
  * 房型/間數：${data.roomType} (${data.roomCount} 間)
  * 日期/晚數：${data.checkInDate}, ${data.nights} 晚
  * 入住人數：${data.adultCount} 大, ${data.childCount} 小

**費用明細：**
  * 房間總費用：NT$ ${details.roomCost.toLocaleString()}
  * 兒童附加費：NT$ ${details.childCost.toLocaleString()}
  * 加購服務費：NT$ ${details.addonsCost.toLocaleString()}
  * 🥂 會員折扣：- NT$ ${details.memberDiscountValue.toLocaleString()}
  * 服務費 (10%)：NT$ ${details.serviceFee.toLocaleString()}
**總價 (TWD)：NT$ ${details.finalPrice.toLocaleString()}**

**聯絡與要求：**
  * 聯絡人：${data.contactName} (${data.contactPhone})
  * 付款方式：${data.paymentMethod}
  * 特殊要求：${data.specialRequest || '無'}
**--- 🛎️ 感謝您的預訂！ ---**
    `;

    session.bookingData.finalSummary = summary;
    
    return { 
        prompt: summary, // 將摘要顯示在 confirm_booking 狀態
        isHandled: true 
    };
}

/**
 * 7. 提交訂單到後端 (最終步驟)。
 * @param {object} session - 對話狀態數據
 * @returns {object} - 流程控制對象
 */
function submitBooking(session) {
    const data = session.bookingData;
    // 模擬後端 API 呼叫，提交 data
    const orderId = `#${Math.floor(Math.random() * 90000) + 10000}`; 

    const finalPrompt = `
**🎉 訂單提交成功！**
訂單編號：${orderId}
總價：NT$ ${data.priceDetails.finalPrice.toLocaleString()}

您的預訂已確認，詳細資訊已發送到您的電子郵件 **${data.contactEmail}**。
期待您的光臨！
    `;

    return { 
        prompt: finalPrompt, 
        isHandled: true 
    };
}


// --- 匯出所有 Handler ---
module.exports = {
    calculatePrice,
    loginMemberAccount,
    executeAddonsSelection,
    validateContactInfo,
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking
};

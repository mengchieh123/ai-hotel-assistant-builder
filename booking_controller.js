/**
 * booking_controller.js
 * 核心訂房流程 Handler 實現 (V1.11 - 最終穩定版，加入 checkBookingEssentials)
 */

// --- 模擬服務層數據 ---

const ROOM_PRICING = {
    '標準雙人房': { price: 2200, weekendMultiplier: 1.2 },
    '豪華客房': { price: 3200, weekendMultiplier: 1.2 },
    '行政套房': { price: 4800, weekendMultiplier: 1.2 },
    '家庭四人房': { price: 4500, weekendMultiplier: 1.1 }
};

const ADDONS_SERVICE = {
    'meal_breakfast': { name: '每日自助早餐', price: 450, isPerNight: true, type: 'per_person', image: 'https://i.imgur.com/L79p44K.png' },
    'ticket_waterpark': { name: '水上樂園門票', price: 800, isPerNight: false, type: 'per_person', image: 'https://i.imgur.com/K5fJq2J.png' },
    'transfer': { name: '機場接送-4人座', price: 2000, isPerNight: false, type: 'flat_fee', image: 'https://i.imgur.com/D4sX4n9.png' }
};

const SERVICE_FEE_RATE = 0.1; 
const CHILD_SURCHARGE = 500; 

// --- 輔助函數 (Helper Functions) ---

function getPriceDetails(data) {
    if (!data.nights || !data.roomType || !ROOM_PRICING[data.roomType]) {
        console.warn("getPriceDetails 缺少必要的實體 (nights 或 roomType)。");
        return { 
            roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, 
            serviceFee: 0, finalPrice: 0 
        };
    }

    let roomCost = 0;
    let totalNights = data.nights || 1;
    let roomDetails = ROOM_PRICING[data.roomType];

    let basePrice = 0;
    if (roomDetails) {
        let isWeekend = data.checkInDate ? (new Date(data.checkInDate).getDay() === 6) : false;
        let multiplier = isWeekend ? roomDetails.weekendMultiplier : 1;
        basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;
    }

    const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

    const MEMBER_DISCOUNT_RATE = 0.05;
    const memberDiscountValue = data.isLoggedIn ? (roomCost + childCost) * MEMBER_DISCOUNT_RATE : 0;

    let totalPriceBeforeFee = roomCost + childCost - memberDiscountValue;
    
    // 加購費用
    let addonsCost = 0;
    if (data.addons && data.addons.length > 0) {
        data.addons.forEach(addon => {
            const item = ADDONS_SERVICE[addon.id];
            if (item) {
                let cost = item.price;
                if (item.type === 'per_person') {
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

function generateAddonsCarousel(data) {
    const { finalPrice } = getPriceDetails(data); 

    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        const basePrice = item.price;

        return {
            title: item.name,
            description: item.name === '每日自助早餐' 
                ? `飯店精選自助式早餐。供應時間 07:00-10:00。`
                : item.name === '水上樂園門票'
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

function checkDateAndNights(session) {
    const data = session.bookingData;
    
    if (data.nights && data.checkInDate) {
        return {
            prompt: `已確認入住日期 ${data.checkInDate}，住宿 ${data.nights} 晚。現在請提供入住人數。`,
            nextStep: 'ask_guest_count', 
            isHandled: true
        };
    }
    return { isHandled: false };
}

/**
 * 🏆 V1.11 新增：強制檢查關鍵實體，解決 nights 丟失問題。
 */
function checkBookingEssentials(session) {
    const data = session.bookingData;
    
    // 檢查日期和晚數
    if (!data.nights || !data.checkInDate) {
        console.error("checkBookingEssentials: 日期或晚數丟失，導回 ask_nights_and_dates");
        return {
            prompt: "抱歉，訂房日期或晚數資訊丟失，請重新提供入住日期和住宿晚數。",
            nextStep: 'ask_nights_and_dates', 
            isHandled: true
        };
    }
    
    // 檢查房型和間數
    if (!data.roomType || !data.roomCount) {
        console.error("checkBookingEssentials: 房型或間數丟失，導回 show_room_types");
        return {
            prompt: "房型或間數資訊不完整，請重新選擇房型。",
            nextStep: 'show_room_types', 
            isHandled: true
        };
    }
    
    // 所有必要資訊齊全，自動推進
    return { 
        isHandled: true, 
        nextStep: 'check_availability_and_price' 
    };
}

function calculatePrice(session) {
    const data = session.bookingData;

    // 這裡我們不再需要嚴格的防呆，因為 checkBookingEssentials 已經處理了實體缺失
    // 但為了安全，還是保留 log 提醒
    if (!data.nights || !data.checkInDate || !data.roomType) {
        console.warn("calculatePrice: 仍缺少關鍵實體，請檢查流程邏輯。");
        // 雖然理論上不該發生，但如果發生，還是導回檢查點
        return { 
            prompt: "訂單信息不完整，請重新提供。 (Debug: 導回檢查點)", 
            nextStep: 'check_essentials_before_price', 
            isHandled: true 
        };
    }
    
    const { roomCost, childCost, addonsCost, memberDiscountValue, serviceFee, finalPrice } = getPriceDetails(data);
    const isAvailable = true; 

    session.bookingData.totalPrice = Math.round(roomCost + childCost);
    session.bookingData.finalPrice = finalPrice; 
    session.bookingData.priceDetails = { roomCost, childCost, addonsCost, memberDiscountValue, serviceFee, finalPrice };

    if (!isAvailable) {
        return { prompt: `抱歉，${data.roomType} 在該日期庫存不足。請修改房間數或日期。`, nextStep: 'ask_room_count', isHandled: true };
    }

    if (session.currentState === 'ask_payment_method') {
         let prompt = `好的，所有費用已確認，最終總價為 **NT$ ${finalPrice.toLocaleString()}**。請選擇您的付款方式：`;
         return { prompt: prompt, isHandled: true };
    }

    if (session.bookingData.isLoggedIn) {
        const carouselResult = generateAddonsCarousel(data);
        
        return { 
            prompt: `🎉 您已登入【${data.memberAccount}】。已為您套用 5% 會員折扣。當前總價 NT$ ${finalPrice.toLocaleString()}。現在為您準備加購服務。`, 
            richCard: carouselResult.richCard,
            nextStep: 'ask_addons', 
            isHandled: true 
        };
    }
    
    return { isHandled: true }; 
}

function loginMemberAccount(session) {
    const data = session.bookingData;
    const account = session.entities.memberAccount || data.memberAccount;

    if (!account || account.length < 5) {
        return { 
            prompt: '抱歉，請輸入有效的會員帳號 (至少5位)。請重新輸入，或輸入「跳過」進入下一步。', 
            nextStep: 'login_member_account', 
            isHandled: true 
        };
    }

    session.bookingData.memberAccount = account.toUpperCase();
    session.bookingData.isLoggedIn = true; 
    
    const { finalPrice } = getPriceDetails(session.bookingData);
    const carouselResult = generateAddonsCarousel(data);

    const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 5% 專屬折扣！\n當前總價為 NT$ ${finalPrice.toLocaleString()}。現在進入加購步驟。`;

    return { 
        prompt: prompt,
        richCard: carouselResult.richCard,
        nextStep: 'ask_addons', 
        isHandled: true 
    };
}

function executeAddonsSelection(session) {
    const data = session.bookingData;
    
    const action = session.entities.addonAction;
    const addonId = session.entities.addonId;

    if (action && addonId) {
        if (action.toLowerCase() === 'add') {
            if (!data.addons) data.addons = [];
            
            const exists = data.addons.some(a => a.id === addonId);
            if (!exists) {
                data.addons.push({ id: addonId, count: 1 });
            }

            delete session.entities.addonAction;
            delete session.entities.addonId;
            
            const result = generateAddonsCarousel(data);
            return { 
                prompt: '✅ 已成功加入加購服務。請繼續選擇或點擊「完成」。', 
                richCard: result.richCard,
                nextStep: 'ask_addons', 
                isHandled: true 
            };
        }
    }
    
    const userMessage = session.userMessage || '';
    if (userMessage.includes('完成') || userMessage.includes('跳過') || userMessage.includes('下一步')) {
        const { finalPrice, addonsCost } = getPriceDetails(data); 
        let prompt = `您已選擇完成加購，加購總費用為 NT$ ${addonsCost.toLocaleString()}。`;
        session.bookingData.finalPrice = finalPrice;
        return { prompt: prompt, nextStep: 'ask_contact_info', isHandled: true };
    }
    
    const result = generateAddonsCarousel(data);

    return {
        isHandled: true,
        richCard: result.richCard,
        prompt: result.prompt,
        nextStep: 'ask_addons'
    };
}

function validateContactInfo(session) {
    const data = session.bookingData;

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

function handleSpecialRequests(session) {
    const request = session.bookingData.specialRequest || '無';
    session.bookingData.specialRequest = request; 

    return { nextStep: 'ask_payment_method', isHandled: true };
}

function generateOrderSummary(session) {
    const data = session.bookingData;
    const details = data.priceDetails;

    if (!details || !details.finalPrice) {
        calculatePrice(session);
        const updatedDetails = session.bookingData.priceDetails;
        if (!updatedDetails) {
            return { prompt: "抱歉，訂單摘要生成失敗，缺少價格資訊。", nextStep: 'check_essentials_before_price', isHandled: true };
        }
    }
    
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
        prompt: summary, 
        isHandled: true 
    };
}

function submitBooking(session) {
    const data = session.bookingData;
    const orderId = `#${Math.floor(Math.random() * 90000) + 10000}`; 
    const finalPrice = data.priceDetails ? data.priceDetails.finalPrice.toLocaleString() : 'N/A';
    const finalPrompt = `
**🎉 訂單提交成功！**
訂單編號：${orderId}
總價：NT$ ${finalPrice}

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
    checkDateAndNights, 
    checkBookingEssentials, // 🏆 新增匯出
    calculatePrice,
    loginMemberAccount,
    executeAddonsSelection,
    validateContactInfo,
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking
};

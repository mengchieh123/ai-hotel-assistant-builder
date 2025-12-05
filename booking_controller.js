// booking_controller.js
/**
 * 核心訂房流程 Handler 實現 (V1.17 - 500錯誤修復 & 會員/加購 UX 優化)
 */

const MockAPI = require('./service_mock_api'); 
const sessionManager = require('./session_manager');

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05; // 5% 折扣

// --- 結構化日誌函數 (階段 3：安全與日誌) ---
function log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ timestamp, level, message, details }));
}

// --- 輔助函數 (Helper Functions) ---

/**
 * 計算詳細價格明細。
 */
async function getPriceDetails(data) {
    if (!data.nights || !data.roomType) {
        return { roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, serviceFee: 0, finalPrice: 0, error: true };
    }

    try {
        const pricingData = await MockAPI.getPricingDetails(data.roomType);
        const roomDetails = pricingData.roomDetails;
        const ADDONS_SERVICE = pricingData.addons; 

        if (!roomDetails) {
            log('ERROR', 'Room details not found in API response', { roomType: data.roomType });
            return { roomCost: 0, childCost: 0, finalPrice: 0, error: true };
        }

        let roomCost = 0;
        const totalNights = data.nights || 1;
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6 || checkInDate.getDay() === 0) : false;
        
        let multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;

        const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

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

        let totalPriceBeforeFee = roomCost + childCost + addonsCost;

        const memberDiscountValue = data.isLoggedIn ? roomCost * MEMBER_DISCOUNT_RATE : 0; 

        let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;

        const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;

        const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

        log('INFO', 'Price Calculation Completed', {
            roomCost, childCost, addonsCost, memberDiscountValue: memberDiscountValue.toFixed(2), finalPrice
        });

        return {
            roomCost: roomCost,
            childCost: childCost,
            addonsCost: addonsCost,
            memberDiscountValue: memberDiscountValue,
            serviceFee: serviceFee,
            finalPrice: finalPrice,
            error: false
        };

    } catch (error) {
        log('FATAL', 'Price Service API Failure', { error: error.message, stack: error.stack });
        return { roomCost: 0, childCost: 0, finalPrice: 0, error: true };
    }
}

/**
 * 產生加購服務的 RichCard 輪播圖。
 * 🏆 優化：修改提示語，使推薦更主動。
 */
async function generateAddonsCarousel(data) {
    if (!data.addons) data.addons = [];

    const [details, pricingData] = await Promise.all([
        getPriceDetails(data),
        MockAPI.getPricingDetails(data.roomType)
    ]);
    const ADDONS_SERVICE = pricingData.addons;

    const cards = Object.keys(ADDONS_SERVICE).map(key => {
        const item = ADDONS_SERVICE[key];
        const priceLabel = `TWD ${item.price.toLocaleString()} / ${item.type === 'per_person' ? '人' : '趟'}${item.isPerNight ? ' / 晚' : ''}`;
        const isAdded = data.addons.some(a => a.id === key);

        return {
            title: item.name + (isAdded ? ' ✅' : ''),
            description: item.description,
            image: item.image || 'https://i.imgur.com/placeholder.png', 
            footer: priceLabel,
            buttons: isAdded ?
                [{ text: '取消加購', value: `remove:${key}` }] :
                [{ text: '新增至訂單', value: `add:${key}` }]
        };
    });

    // 🏆 優化加購推薦提示語
    const prompt = `🎁 **加購服務推薦**：您的訂單目前總價為 NT$ **${details.finalPrice.toLocaleString()}** (含房費、折扣及服務費)。我們為您推薦以下服務，立即升級您的住宿體驗！`;

    return {
        richCard: {
            type: 'carousel',
            cards: cards
        },
        prompt: prompt
    };
}


// --- Handler 實現區 ---

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
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}

function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { nextStep: 'show_room_types', isHandled: true };
    }
    if (!data.roomCount || data.roomCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { nextStep: 'ask_room_count', isHandled: true }; 
    }
    if (!data.adultCount || data.adultCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { nextStep: 'ask_guest_count', isHandled: true }; 
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: false }; 
}

async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    if (data.inventoryLockId) {
        return { isHandled: false };
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, roomCount);
        
        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', 'Inventory locked successfully', { lockId: lockResult.lockId, roomType, roomCount });
            return { isHandled: true, prompt: `✅ 庫存鎖定成功！【${roomType}】現有 ${lockResult.remaining} 間庫存。正在計算總價...` };
        } else {
            log('WARNING', 'Inventory lock failed', { roomType, roomCount, reason: lockResult.message, remaining: lockResult.remaining });
            return { 
                isHandled: true,
                prompt: `😭 抱歉，您選擇的【${roomType}】庫存不足 (剩餘 ${lockResult.remaining} 間)，請重新選擇房型或間數。`,
                nextStep: 'show_room_types' 
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        return { 
            isHandled: true, 
            prompt: '系統暫時無法處理庫存鎖定，請稍後再試。', 
            nextStep: 'paused_waiting_for_resume' 
        };
    }
}

async function calculatePrice(session) {
    const data = session.collectedData;

    if (session.executedHandlers.calculatePrice) {
        return { isHandled: false };
    }
    
    const details = await getPriceDetails(data);
    
    if (details.error || details.finalPrice <= 0) {
        log('ERROR', 'Final price is invalid or zero.', { details });
        return {
            isHandled: true,
            prompt: '抱歉，價格計算失敗。請確認您已提供正確的日期、晚數和房型。',
            nextStep: 'show_room_types'
        };
    }
    
    data.finalPrice = details.finalPrice;
    data.priceDetails = details;

    session.executedHandlers.calculatePrice = true;
    
    return { isHandled: false }; 
}

/**
 * 🏆 優化版：模擬會員登入驗證 Handler。
 */
async function loginMemberAccount(session) {
    const data = session.collectedData;
    const account = data.memberAccount;
    const password = data.memberPassword;
    
    // 1. 檢查帳號
    if (!account || account.length < 3) {
        return {
            prompt: data.CUSTOM_PROMPT || '請輸入有效的【會員帳號】(至少3位)。若無需登入，請輸入「跳過」。',
            nextStep: 'login_member_account',
            isHandled: true
        };
    }
    
    // 2. 檢查密碼 (如果流程到了 ask_member_password 且密碼仍缺失)
    if (session.currentStep === 'ask_member_password' && (!password || password.length < 4)) {
        delete data.memberPassword;
        return { isHandled: false };
    }

    // 3. 模擬登入驗證 (完全依賴 Mock API)
    if (account && password) {
        try {
            const authResult = await MockAPI.verifyMember(account, password);

            delete data.memberPassword; 
            
            if (authResult.isSuccessful) {
                data.isLoggedIn = true;
                data.memberId = authResult.memberId;
                log('INFO', 'Member login successful', { memberId: data.memberId });
                
                // 🚨 登入成功後，強制清除價格計算追蹤，讓 calculatePrice 重新執行，套用折扣
                sessionManager.clearHandlerExecution(session.id, 'calculatePrice');
                
                const details = await getPriceDetails(data); 
                data.finalPrice = details.finalPrice;
                
                const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 專屬折扣！\n當前總價為 NT$ **${details.finalPrice.toLocaleString()}**。現在進入加購步驟。`;
                const carouselResult = await generateAddonsCarousel(data); 
                
                return {
                    prompt: prompt,
                    richCard: carouselResult.richCard,
                    nextStep: 'ask_addons',
                    isHandled: true
                };
            } else {
                log('WARNING', 'Member login failed', { account });
                data.isLoggedIn = false;
                data.memberAccount = null;
                
                // 🏆 優化：登入失敗提示更清晰
                return {
                    prompt: '❌ 登入失敗。帳號或密碼錯誤。請重新輸入完整的【會員帳號】。若無需登入，請輸入「跳過」。',
                    nextStep: 'login_member_account',
                    isHandled: true
                };
            }
        } catch (error) {
            log('FATAL', 'Member API failed', { error: error.message });
            return {
                prompt: '會員服務暫時無法連線，流程將跳過登入。',
                nextStep: 'ask_addons',
                isHandled: true
            };
        }
    }

    return { isHandled: false };
}

/**
 * 🏆 處理加購服務的選擇和動作。
 */
async function executeAddonsSelection(session) {
    const data = session.collectedData;
    
    if (!data.addons) data.addons = [];
    
    const action = data.addonAction;
    const addonId = data.addonId;

    let isModified = false;
    let message = '';
    const pricingData = await MockAPI.getPricingDetails(data.roomType);
    const ADDONS_SERVICE = pricingData.addons;

    if (action && addonId && ADDONS_SERVICE[addonId]) {
        // ... (原有的加購/移除邏輯)
        if (action.toLowerCase() === 'add') {
             const exists = data.addons.some(a => a.id === addonId);
             if (!exists) {
                 data.addons.push({ id: addonId, count: 1 });
                 message = `✅ 已成功加入加購服務：${ADDONS_SERVICE[addonId].name}。`;
                 isModified = true;
             } else {
                  message = `ℹ️ ${ADDONS_SERVICE[addonId].name} 已在訂單中。`;
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
        sessionManager.clearHandlerExecution(session.id, 'calculatePrice');
        
        const details = await getPriceDetails(data);
        data.finalPrice = details.finalPrice;
        
        const result = await generateAddonsCarousel(data);
        return {
            prompt: message + result.prompt,
            richCard: result.richCard,
            nextStep: 'ask_addons',
            isHandled: true
        };
    }

    const result = await generateAddonsCarousel(data);
    return {
        isHandled: true,
        richCard: result.richCard,
        prompt: result.prompt,
        nextStep: 'ask_addons'
    };
}

function validateContactInfo(session) {
    const data = session.collectedData;

    if (!data.contactName || data.contactName.length < 2 || !/^[\u4e00-\u9fa5a-zA-Z\s]{2,}$/.test(data.contactName)) {
         data.CUSTOM_PROMPT = '請輸入有效的【聯絡人姓名】 (至少2個字)。';
         return { nextStep: 'ask_contact_info', isHandled: true };
    }

    if (!data.contactPhone || !/^\d{8,12}$/.test(data.contactPhone.replace(/[\s-]/g, ''))) {
         data.CUSTOM_PROMPT = '請輸入有效的【聯絡電話】 (8-12位數字)。';
         return { nextStep: 'ask_contact_info', isHandled: true };
    }
    data.contactPhone = data.contactPhone.replace(/[\s-]/g, '');

    if (!data.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
         data.CUSTOM_PROMPT = '請輸入有效的【電子郵件地址】。';
         return { nextStep: 'ask_contact_info', isHandled: true };
    }
    
    // 階段 3 PII 日誌處理
    log('INFO', 'Contact Info Validated', { name: data.contactName, email: 'PII_REDACTED', phone: 'PII_REDACTED' }); 

    delete data.CUSTOM_PROMPT;
    return { isHandled: false };
}

function handleSpecialRequests(session) { 
    // 預留位置
    return { isHandled: false }; 
}
function generateOrderSummary(session) {
    // 預留位置
    return { isHandled: false };
}


async function submitBooking(session) {
    const data = session.collectedData;
    const lockId = data.inventoryLockId;
    
    const orderId = `HMB-${Date.now()}`;
    let paymentMessage = '';
    
    try {
        if (data.paymentMethod === '現場支付') {
            paymentMessage = '請您在入住時完成支付。';
        } else {
            paymentMessage = '我們已發送付款連結至您的信箱，請於 30 分鐘內完成支付。';
        }

        // 3. 解鎖庫存 (假設訂單提交成功，解除暫時鎖定)
        if (lockId) {
            await MockAPI.unlockInventory(lockId);
            log('INFO', 'Inventory unlocked after successful booking.', { orderId, lockId });
        }
        
        return { 
            isHandled: true, 
            orderId: orderId, 
            paymentMessage: paymentMessage,
            nextStep: 'booking_complete'
        };

    } catch (error) {
        log('FATAL', 'Order Submission Failed', { error: error.message, lockId });
        
        return {
            isHandled: true,
            prompt: `⚠️ 訂單提交失敗：發生系統錯誤 (${error.message})，請聯繫客服人員，訂單號碼: ${orderId} (可能未創建成功)。`,
            nextStep: 'end_conversation'
        };
    }
}


// --- 匯出所有 Handler (無外部檔案引用，解決 500 錯誤) ---
module.exports = {
    checkDateAndNights,
    checkBookingEssentials,
    lockInventory,
    calculatePrice,
    loginMemberAccount,
    executeAddonsSelection,
    validateContactInfo,
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking,
};

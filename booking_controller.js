// booking_controller.js
/**
 * 核心訂房流程 Handler 實現 (V1.15 - 整合 Mock API, 庫存鎖定, 結構化日誌)
 * 準備部署至 Staging 環境。
 */

const MockAPI = require('./service_mock_api'); // 引入 Mock API 服務層
const sessionManager = require('./session_manager'); // 假設您有一個 session_manager

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05; // 5% 折扣

// --- 結構化日誌函數 (階段 3：安全與日誌) ---
function log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    // 輸出 JSON 格式的結構化日誌
    console.log(JSON.stringify({ timestamp, level, message, details }));
}

// --- 輔助函數 (Helper Functions) ---

/**
 * 計算詳細價格明細。
 * 🚨 已修改：價格數據從 MockAPI 獲取。
 */
async function getPriceDetails(data) {
    if (!data.nights || !data.roomType) {
        return { roomCost: 0, childCost: 0, addonsCost: 0, memberDiscountValue: 0, serviceFee: 0, finalPrice: 0, error: true };
    }

    try {
        // 階段 1：呼叫 Mock API 獲取價格和加購服務清單
        const pricingData = await MockAPI.getPricingDetails(data.roomType);
        const roomDetails = pricingData.roomDetails;
        const ADDONS_SERVICE = pricingData.addons; // 從 API 獲取最新的加購服務列表

        if (!roomDetails) {
            log('ERROR', 'Room details not found in API response', { roomType: data.roomType });
            return { roomCost: 0, childCost: 0, finalPrice: 0, error: true };
        }

        let roomCost = 0;
        const totalNights = data.nights || 1;
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;
        let isWeekend = checkInDate ? (checkInDate.getDay() === 6 || checkInDate.getDay() === 0) : false;
        
        // 1. 房間基礎費用 (使用 API 獲取的價格)
        let multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        let basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * (data.roomCount || 1) * totalNights;

        // 2. 兒童附加費
        const childCost = (data.childCount || 0) * CHILD_SURCHARGE * totalNights;

        // 3. 加購服務費用 (使用 API 獲取的服務列表)
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

        // 4. 會員折扣
        const memberDiscountValue = data.isLoggedIn ? roomCost * MEMBER_DISCOUNT_RATE : 0; // 僅對房費折扣

        let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;

        // 5. 服務費
        const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;

        // 6. 最終總價
        const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

        // 階段 3：記錄計算結果
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
            error: false // 成功
        };

    } catch (error) {
        log('FATAL', 'Price Service API Failure', { error: error.message, stack: error.stack });
        return { roomCost: 0, childCost: 0, finalPrice: 0, error: true };
    }
}

/**
 * 產生加購服務的 RichCard 輪播圖。
 * 🚨 已修改：從 MockAPI 獲取數據。
 */
async function generateAddonsCarousel(data) {
    if (!data.addons) data.addons = [];

    // 重新計算價格並獲取最新的 Addons 列表
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
            image: item.image || 'https://i.imgur.com/placeholder.png', // Fallback Image
            footer: priceLabel,
            buttons: isAdded ?
                [{ text: '取消加購', value: `remove:${key}` }] :
                [{ text: '新增至訂單', value: `add:${key}` }]
        };
    });

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
 * 檢查日期與晚數 (checkDateAndNights) - (用於 ask_nights_and_dates 狀態)
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
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: true }; 
}

/**
 * 檢查訂房核心資訊 (checkBookingEssentials) - (用於 check_essentials_before_price 狀態)
 */
function checkBookingEssentials(session) {
    const data = session.collectedData;
    
    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { nextStep: 'show_room_types', isHandled: true };
    }
    if (!data.roomCount || data.roomCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { nextStep: 'ask_room_count', isHandled: true }; // 導向問房間數
    }
    if (!data.adultCount || data.adultCount <= 0) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { nextStep: 'ask_guest_count', isHandled: true }; // 導向問人數
    }
    
    delete data.CUSTOM_PROMPT;
    return { isHandled: false }; // 讓流程繼續到 lock_inventory
}

/**
 * 🏆 新增：處理庫存鎖定 (lockInventory) - (階段 2 實作)
 */
async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;
    
    // 如果已經有鎖定 ID，代表已鎖定，直接跳過
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
                nextStep: 'show_room_types' // 導回房型選擇
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        return { 
            isHandled: true, 
            prompt: '系統暫時無法處理庫存鎖定，請稍後再試。', 
            nextStep: 'paused_waiting_for_resume' // 暫停流程
        };
    }
}


/**
 * 計算價格 (calculatePrice) - (用於 check_availability_and_price 狀態)
 * 🚨 已修改：整合非同步 API 呼叫。
 */
async function calculatePrice(session) {
    const data = session.collectedData;

    if (session.executedHandlers.calculatePrice) {
        return { isHandled: false };
    }
    
    const details = await getPriceDetails(data);
    
    if (details.error || details.finalPrice <= 0) {
        // 價格計算失敗或 API 錯誤
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
 * 🏆 模擬會員登入驗證 Handler。
 * 🚨 已修改：整合非同步 Mock API 呼叫。
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

    // 3. 模擬登入驗證
    if (account && password) {
        try {
            const authResult = await MockAPI.verifyMember(account, password);

            delete data.memberPassword; // 清理密碼實體
            
            if (authResult.isSuccessful) {
                data.isLoggedIn = true;
                data.memberId = authResult.memberId;
                log('INFO', 'Member login successful', { memberId: data.memberId });
                
                // 🚨 登入成功後，強制清除價格計算追蹤，讓 calculatePrice 重新執行
                sessionManager.clearHandlerExecution(session.id, 'calculatePrice');
                
                const details = await getPriceDetails(data); // 重新計算應用折扣後的價格
                data.finalPrice = details.finalPrice;
                
                const prompt = `🎉 恭喜！會員【${account.toUpperCase()}】登入成功，已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 專屬折扣！\n當前總價為 NT$ **${details.finalPrice.toLocaleString()}**。現在進入加購步驟。`;
                const carouselResult = await generateAddonsCarousel(data); // 重新生成 RichCard
                
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
                
                return {
                    prompt: '❌ 登入失敗。帳號或密碼錯誤。請重新輸入完整的【會員帳號】。若無需登入，請輸入「跳過」。',
                    nextStep: 'login_member_account',
                    isHandled: true
                };
            }
        } catch (error) {
            log('FATAL', 'Member API failed', { error: error.message });
            return {
                prompt: '會員服務暫時無法使用，流程將跳過登入。',
                nextStep: 'ask_addons',
                isHandled: true
            };
        }
    }

    // 預設讓流程繼續到下一個狀態（問密碼）
    return { isHandled: false };
}


/**
 * 🏆 處理加購服務的選擇和動作。
 * 🚨 已修改：整合非同步 API 呼叫。
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
        // ... (省略加購/移除邏輯，與您提供的版本相同)
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

/**
 * 🏆 驗證聯絡資訊的有效性。
 * 🚨 備註：此處應加入 PII 加密日誌（階段 3）
 */
function validateContactInfo(session) {
    const data = session.collectedData;

    // ... (驗證邏輯與您提供的版本相同，此處省略)
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
    
    log('INFO', 'Contact Info Validated', { name: data.contactName, email: 'PII_REDACTED', phone: 'PII_REDACTED' }); // 階段 3 PII 日誌處理

    delete data.CUSTOM_PROMPT;
    return { isHandled: false };
}


/**
 * 🏆 覆蓋：提交訂單 (需處理庫存解鎖)
 * 🚨 已修改：整合非同步 API 呼叫，並加入庫存解鎖。
 */
async function submitBooking(session) {
    const data = session.collectedData;
    const lockId = data.inventoryLockId;
    
    // 1. 模擬訂單創建 (實際串接資料庫)
    const orderId = `HMB-${Date.now()}`;
    let paymentMessage = '';
    
    try {
        // 模擬呼叫後端 API 寫入訂單，並檢查寫入結果
        // const submitResult = await BackendAPI.submitOrder(data); 

        // 2. 處理付款訊息
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
        
        // 返回成功訊息
        return { 
            isHandled: true, 
            orderId: orderId, 
            paymentMessage: paymentMessage,
            nextStep: 'booking_complete'
        };

    } catch (error) {
        // 訂單提交失敗，需要通知用戶並可能需要重新鎖定庫存或回滾操作
        log('FATAL', 'Order Submission Failed', { error: error.message, lockId });
        
        // 🚨 這裡我們不會解鎖，因為訂單可能部分寫入，需要人工檢查！

        return {
            isHandled: true,
            prompt: `⚠️ 訂單提交失敗：發生系統錯誤 (${error.message})，請聯繫客服人員，訂單號碼: ${orderId} (可能未創建成功)。`,
            nextStep: 'end_conversation'
        };
    }
}


// --- 匯出所有 Handler ---
module.exports = {
    checkDateAndNights,
    checkBookingEssentials,
    lockInventory, // 新增
    calculatePrice,
    loginMemberAccount,
    executeAddonsSelection,
    validateContactInfo,
    // 模擬其他 Handler
    handleSpecialRequests: (session) => ({ isHandled: false }),
    generateOrderSummary: (session) => ({ isHandled: false }),
    submitBooking, // 覆蓋
};

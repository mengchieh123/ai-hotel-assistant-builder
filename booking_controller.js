// booking_controller.js - 負責業務計算與訂單模擬 (優化版 - 已修正 V1.9 錯誤)

// 導入依賴
const config = require('./config');
const { FlowConfigLoader } = require('./flow_loader'); 
const AddonsService = require('./AddonsService'); // 假設存在

// 導入 Day.js 及其插件
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

// 從配置中解構常數
const {
    ROOM_RATES = {},
    WEEKEND_MULTIPLIER = 1.2,
    CHILD_FEE_PER_NIGHT = 500,
    PET_FEE_PER_PET_PER_NIGHT = 300,
    SERVICE_FEE_RATE = 0.1,
    VIRTUAL_PAYMENT_BASE_URL = 'https://secure.payment.gateway.com/pay',
    DEFAULT_ROOM_INVENTORY = 5,
    VIRTUAL_INVENTORY = {},
    VIRTUAL_MEMBERS = {}
} = config;

// 模擬優惠代碼列表 (已從 config 複製過來)
const VIRTUAL_PROMO_CODES = {
    'SUMMER20': 0.80, // 20% off
    'WEEKDAY10': 0.90, // 10% off
    'SAVE500': { type: 'fixed', value: 500 } // 固定折扣 500
};

// 實例化 FlowConfigLoader (假設 flow_loader.js 存在並能載入 dialogue_flow.json)
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

class BookingFlowController {
    // 貨幣格式化 (已修正為靜態方法)
    static formatCurrency(amount) {
        return `NT$ ${Math.round(amount).toLocaleString('en-US')}`;
    }

    static getFlow() {
        return flowLoader.getFlow();
    }
    
    static initializeBookingData(session) {
        if (!session.bookingData) {
            session.bookingData = {};
        }
        // 核心數據初始化
        session.bookingData.addons = session.bookingData.addons || [];
        session.bookingData.nightlyDetails = session.bookingData.nightlyDetails || [];
        // 確保所有數字相關屬性有預設值，避免 NaN
        session.bookingData.petCount = session.bookingData.petCount || 0;
    }

    // 將原有的純驗證邏輯改為內部輔助函數
    static _performValidation(data) {
        const { contactName, contactPhone, contactEmail } = data;

        if (!contactName || contactName.length < 2) {
            return { success: false, errorMessage: "請輸入有效的聯絡人姓名 (至少2個字)。" };
        }
        if (!contactPhone || !/^\d{10}$/.test(contactPhone)) {
             return { success: false, errorMessage: "請輸入有效的 10 位手機號碼，僅限數字。" };
        }
        if (!contactEmail || !/\S+@\S+\.\S+/.test(contactEmail)) {
            return { success: false, errorMessage: "請輸入有效的電子郵件地址。" };
        }

        return { success: true };
    }


    /**
     * 聯絡資訊驗證 (重構為 Handler 簽名)
     * 這是 Flow 狀態機調用的主要驗證入口
     */
    static validateContactInfo(session, flow, nextStep, extractedEntities) {
        BookingFlowController.initializeBookingData(session);

        const { contactName, contactPhone, contactEmail } = extractedEntities;

        // 更新 session.bookingData
        session.bookingData.contactName = contactName;
        session.bookingData.contactPhone = contactPhone;
        session.bookingData.contactEmail = contactEmail;
        
        // 執行內部的純驗證邏輯
        const validationResult = BookingFlowController._performValidation({ contactName, contactPhone, contactEmail });

        if (validationResult.success) {
            return {
                nextStep: nextStep, // 成功則跳轉到 next_state (ask_special_requests)
                isHandled: true
            };
        } else {
            return {
                nextStep: 'ask_contact_info', // 驗證失敗則停留在當前狀態
                isHandled: true,
                prompt: validationResult.errorMessage // 提示錯誤訊息
            };
        }
    }

    /**
     * ⭐️ 新增：處理會員登入邏輯 (用於 login_member_account 狀態)
     */
    static loginMemberAccount(session, flow, nextStep, extractedEntities) {
        const memberAccount = extractedEntities.memberAccount || session.bookingData.memberAccount;
        const memberInfo = VIRTUAL_MEMBERS[memberAccount];
        
        // ⭐️ 修正：不再使用硬編碼的 nextStep，直接使用傳入的 nextStep 參數
        const successfulNextStep = nextStep; 

        if (memberInfo) {
            session.bookingData.memberAccount = memberAccount;
            // 重新計算價格以應用新會員折扣
            BookingFlowController.calculatePrice(session.bookingData, successfulNextStep); 
            
            const memberDiscountText = session.bookingData.memberDiscountValue > 0
                ? `已成功登入 Gold 會員，並為您套用 ${BookingFlowController.formatCurrency(session.bookingData.memberDiscountValue)} 折扣！`
                : '已成功登入 Gold 會員，但因您已使用更優惠的促銷代碼，會員折扣未生效。';

            return {
                nextStep: successfulNextStep,
                isHandled: true,
                prompt: `${memberDiscountText}\n\n請確認您的最終價格：${BookingFlowController.formatCurrency(session.bookingData.finalPrice)}`
            };
        } else {
            return {
                nextStep: 'login_member_account', // 保持在當前狀態要求重新輸入
                isHandled: true,
                prompt: "抱歉，查無此會員帳號。請檢查後重新輸入，或輸入『跳過』以繼續訂房流程。"
            };
        }
    }

    /**
     * 【動態價格計算和庫存檢查】 
     * @param {object} data - 預訂數據 (session.bookingData)
     * @param {string} nextState - 成功後的預設下一步狀態
     */
    static calculatePrice(data, nextState) {
        // 修正 1：確保 addons 在解構時，如果 data.addons 不存在，預設為空陣列 []，解決 reduce 錯誤
        const {
            roomType,
            checkInDate,
            nights = 1,
            adultCount = 1,
            childCount = 0,
            roomCount = 1,
            memberAccount,
            promoCode,
            petCount = 0,
            addons = [] // ⭐️ 修正點：設置預設值為空陣列
        } = data;
        
        // 核心參數的數值轉換
        const parsedNights = parseInt(nights);
        const parsedRoomCount = parseInt(roomCount);
        const parsedChildCount = parseInt(childCount);
        const parsedPetCount = parseInt(petCount);
        
        // 1. 基本安全與數據檢查
        if (!roomType || !ROOM_RATES[roomType] || parsedNights <= 0 || parsedRoomCount <= 0) {
            return { success: false, nextStep: 'ask_new_room_or_date', errorMessage: `價格計算所需的數據不完整或無效。` };
        }

        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;
        data.nightlyDetails = [];
        data.discountApplied = false;
        data.memberDiscountValue = 0;
        data.promoDiscountValue = 0;

        // 2. 逐晚檢查庫存與動態計算房價 (邏輯不變)
        for (let i = 0; i < parsedNights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day();
            
            const availableRooms = VIRTUAL_INVENTORY[dateKey]?.[roomType] || DEFAULT_ROOM_INVENTORY;

            if (parsedRoomCount > availableRooms) {
                return {
                    success: false,
                    errorMessage: `抱歉，${roomType} 在 ${currentDate.format('YYYY/MM/DD')} 僅剩 ${availableRooms} 間。`,
                    oos: true,
                    nextStep: 'ask_new_room_or_date'
                };
            }
            
            let baseRate = ROOM_RATES[roomType];
            let priceMultiplier = (dayOfWeek === 5 || dayOfWeek === 6) ? WEEKEND_MULTIPLIER : 1;
            const isWeekend = priceMultiplier > 1;
            
            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * parsedRoomCount;
            
            // 儲存每日價格明細
            data.nightlyDetails.push({
                date: dateKey,
                rate: nightlyRoomPrice * parsedRoomCount,
                ratePerRoom: nightlyRoomPrice,
                isWeekend: isWeekend
            });

            currentDate = currentDate.add(1, 'day');
        }

        // 3. 計算附加費用 (使用解構出來的 addons 變數)
        const totalChildFee = parsedChildCount * CHILD_FEE_PER_NIGHT * parsedNights;
        data.childCost = Math.round(totalChildFee);
        const totalPetFee = parsedPetCount * PET_FEE_PER_PET_PER_NIGHT * parsedNights;
        data.petFee = Math.round(totalPetFee);
        // ⭐️ 修正點：直接使用 addons 局部變數 (保證是陣列)
        let totalAddonsPrice = addons.reduce((sum, addon) => sum + addon.price, 0); 
        data.totalAddonsCost = Math.round(totalAddonsPrice);

        let subtotal = totalRoomPrice + data.childCost + data.petFee + data.totalAddonsCost;
        const serviceFee = subtotal * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee);
        let totalBeforeDiscount = subtotal + data.serviceFee;
        let discountedPrice = totalBeforeDiscount;
        
        // --- 4. 應用折扣 (邏輯不變) ---
        let memberInfo = VIRTUAL_MEMBERS[memberAccount];
        data.memberLevel = memberInfo ? memberInfo.level : '無';
        let memberDiscountRate = memberInfo ? (memberInfo.discount || 0.9) : 1;
        
        if (promoCode && VIRTUAL_PROMO_CODES[promoCode.toUpperCase()]) {
            const promo = VIRTUAL_PROMO_CODES[promoCode.toUpperCase()];
            let discountValue = 0;
            if (typeof promo === 'number') { 
                discountValue = totalBeforeDiscount * (1 - promo);
            } else if (promo.type === 'fixed') { 
                discountValue = promo.value;
            }
            data.promoDiscountValue = Math.round(discountValue); 
            data.appliedPromoCode = promoCode.toUpperCase();
            data.discountApplied = true;
            discountedPrice -= data.promoDiscountValue;
        }

        if (memberInfo && !data.discountApplied && memberDiscountRate < 1) {
            const discountValue = totalBeforeDiscount * (1 - memberDiscountRate);
            data.memberDiscountValue = Math.round(discountValue);
            data.discountApplied = true;
            discountedPrice -= data.memberDiscountValue;
        }

        // 5. 最終價格
        const finalPrice = Math.round(discountedPrice < 0 ? 0 : discountedPrice);
        data.finalPrice = finalPrice;
        data.totalDiscount = data.promoDiscountValue + data.memberDiscountValue;
        data.totalBeforeDiscount = Math.round(totalBeforeDiscount);

        return { 
            success: true, 
            totalPrice: finalPrice,
            nextStep: nextState
        };
    }

    /**
     * 執行通用加購選單邏輯 (Handler 結構正確)
     */
    static executeAddonsSelection(session, flow, nextStep, extractedEntities) {
        // 確保 bookingData 存在
        BookingFlowController.initializeBookingData(session);
        const data = session.bookingData;
        const currentPrompt = flow.states.ask_addons.prompt;
        
        // 每次進入/操作都重新計算價格，確保 totalAddonsCost 是最新的
        BookingFlowController.calculatePrice(data, nextStep); 

        // 1. 處理 '完成加購' 按鈕的回饋 (addonAction === 'finish')
        if (extractedEntities.addonAction === 'finish') {
            const totalAddons = data.addons.length;
            const totalAddonsCost = BookingFlowController.formatCurrency(data.totalAddonsCost);
            const finishPrompt = totalAddons > 0 
                ? `已確認 ${totalAddons} 個加購項目，總加購費用為 ${totalAddonsCost}。接下來請填寫聯絡資料。` 
                : '您選擇跳過加購步驟。接下來請填寫聯絡資料。';

            // 流程前進到下一步 (ask_contact_info)
            return { 
                nextStep: 'ask_contact_info', // 導向聯絡資訊狀態
                richCard: null, 
                isHandled: true, 
                endFlow: false,
                prompt: finishPrompt
            };
        }

        // 2. 處理 '加購' 按鈕的回饋 (addonAction === 'add')
        if (extractedEntities.addonId && extractedEntities.addonAction === 'add') {
            const addon = AddonsService.getAddonById(extractedEntities.addonId);
            if (addon) {
                let calculatedPrice = 0;
                // 價格計算邏輯
                if (addon.type === 'package' && addon.priceFixed) {
                    calculatedPrice = addon.priceFixed;
                } else if (addon.type === 'meal' || addon.type === 'ticket' || addon.id === 'transfer') {
                    const nights = (data.nights || 1);
                    if (addon.id === 'transfer') {
                        calculatedPrice = addon.priceFixed || 1000; 
                    } else {
                        calculatedPrice = ((data.adultCount || 0) * (addon.priceAdult || 0) + (data.childCount || 0) * (addon.priceChild || 0)) * (addon.type === 'meal' ? nights : 1);
                    }
                }
                
                data.addons.push({
                    id: addon.id,
                    name: addon.name,
                    quantity: 1, 
                    price: Math.round(calculatedPrice)
                });
                
                // 重新計算總價，更新 data.totalAddonsCost (重要)
                BookingFlowController.calculatePrice(data, nextStep); 

                session.prompt = `✅ 已為您加入 ${addon.name} (費用 ${BookingFlowController.formatCurrency(Math.round(calculatedPrice))})。總加購費用目前為 ${BookingFlowController.formatCurrency(data.totalAddonsCost)}。`;
            }
            // 在加購操作後，返回 isHandled: true 以保持在當前狀態
            return { 
                nextStep: 'ask_addons', 
                isHandled: true, 
                endFlow: false,
            };
        }
        
        // 3. 動態生成 Rich Card (輪播卡片) - 邏輯不變
        const availableAddons = AddonsService.getAvailableAddons(data.adultCount, data.childCount);
        // 為了程式碼完整性，假設這裡有生成卡片的邏輯
        const addonCards = availableAddons.map(addon => ({ id: addon.id, title: addon.name, description: `NT$ ${addon.priceFixed || '依人數/晚計算'}` }));
        const finishCard = { id: 'finish', title: '完成加購', description: '進入下一步聯絡資訊填寫', action: { type: 'postback', text: '完成加購', payload: { addonAction: 'finish' } } };
        const finalRichCard = { type: 'carousel', items: [...addonCards, finishCard] };

        // 返回結果 (這是 Handler 的最終返回結構)
        return { 
            nextStep: 'ask_addons', 
            richCard: finalRichCard, 
            isHandled: true, 
            endFlow: false,
            prompt: session.prompt || currentPrompt 
        };
    }
    
    /**
     * ⭐️ 新增：處理特殊需求 (用於 ask_special_requests 狀態)
     */
    static handleSpecialRequests(session, flow, nextStep, extractedEntities) {
        BookingFlowController.initializeBookingData(session);
        // 使用從 NLU 提取的 specialRequest 實體
        const specialRequest = extractedEntities.specialRequest || session.bookingData.specialRequest || "無特殊要求";

        // 儲存特殊需求
        session.bookingData.specialRequest = specialRequest;
        session.bookingData.notes = specialRequest; // 存入備註欄

        const promptText = specialRequest.toLowerCase().includes("無特殊要求") || specialRequest.length < 2
            ? "好的，沒有特殊要求。現在將進入付款方式選擇步驟。"
            : `已紀錄您的特殊要求：**${specialRequest}**。現在將進入付款方式選擇步驟。`;

        return {
            nextStep: nextStep, // 導向 next_state (ask_payment_method)
            isHandled: true,
            prompt: promptText
        };
    }

    // ... (generateOrderSummary 和 submitBooking 邏輯不變) ...
    static generateOrderSummary(data, orderId, paymentMessage) { /* ... */ }
    static submitBooking(data) { /* ... */ }
}

module.exports = BookingFlowController;

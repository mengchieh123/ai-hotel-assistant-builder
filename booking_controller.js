// booking_controller.js - 負責業務計算與訂單模擬 (最終修正版)

// 導入依賴
const config = require('./config');
const { FlowConfigLoader } = require('./flow_loader');
const AddonsService = require('./AddonsService'); // ⭐️ 導入加購服務

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
    DEFAULT_ROOM_INVENTORY = 5,
    VIRTUAL_INVENTORY = {},
    VIRTUAL_MEMBERS = {}
} = config;

// 常數定義
const SERVICE_FEE_RATE = 0.1; 
const PET_FEE_PER_PET_PER_NIGHT = 300; 
const VIRTUAL_PAYMENT_BASE_URL = 'https://secure.payment.gateway.com/pay'; 

// 模擬優惠代碼列表
const VIRTUAL_PROMO_CODES = {
    'SUMMER20': 0.80,
    'WEEKDAY10': 0.90,
    'SAVE500': { type: 'fixed', value: 500 }
};

// 實例化 FlowConfigLoader (假設 flow_loader.js 存在並能載入 dialogue_flow.json)
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

class BookingFlowController {
    static getFlow() {
        return flowLoader.getFlow();
    }
    
    /**
     * 建議在流程初始化時呼叫此函數，確保數據結構完整
     */
    static initializeBookingData(session) {
         session.bookingData = {
            // ... (其他核心數據) ...
            addons: [], // ⭐️ 初始化 addons 陣列
            // ...
         };
    }

    /**
     * 【動態價格計算和庫存檢查】
     */
    static calculatePrice(data) {
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
            transferFee = 0,
            addons = [] // ⭐️ 從 data (即 session.bookingData) 讀取 addons
        } = data;

        if (Object.keys(ROOM_RATES).length === 0 || !roomType || !ROOM_RATES[roomType]) {
            return { success: false, errorMessage: `警告：無法找到房型 [${roomType}] 的價格或配置錯誤。`, oos: true };
        }
        if (!checkInDate || nights <= 0 || roomCount <= 0 || adultCount <= 0) {
            return { success: false, errorMessage: "價格計算所需的數據不完整或無效。" };
        }

        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;

        // --- 2. 逐晚檢查庫存與動態計算房價 (不變) ---
        for (let i = 0; i < nights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day();

            const availableRooms = VIRTUAL_INVENTORY[dateKey]
                ? VIRTUAL_INVENTORY[dateKey][roomType] || DEFAULT_ROOM_INVENTORY
                : DEFAULT_ROOM_INVENTORY;

            if (roomCount > availableRooms) {
                return {
                    success: false,
                    errorMessage: `抱歉，${roomType} 在 ${currentDate.format('YYYY/MM/DD')} 僅剩 ${availableRooms} 間。`,
                    oos: true
                };
            }

            let baseRate = ROOM_RATES[roomType];
            let priceMultiplier = (dayOfWeek === 5 || dayOfWeek === 6) ? WEEKEND_MULTIPLIER : 1;
            
            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * roomCount;
            currentDate = currentDate.add(1, 'day');
        }

        // --- 3. 計算附加費用 ---

        // a) 兒童加價
        const totalChildFee = (childCount || 0) * CHILD_FEE_PER_NIGHT * nights;
        data.childCost = Math.round(totalChildFee).toFixed(0);

        // b) 寵物加價
        const totalPetFee = (petCount || 0) * PET_FEE_PER_PET_PER_NIGHT * nights;
        data.petFee = Math.round(totalPetFee).toFixed(0);
        
        // c) ⭐️ 通用加購費用計算
        let totalAddonsPrice = 0;
        for (const addon of addons) {
            totalAddonsPrice += addon.price; 
        }
        data.totalAddonsCost = Math.round(totalAddonsPrice).toFixed(0); 

        // 房費小計 (房費 + 兒童加價 + 寵物加價 + 總加購費用)
        let subtotalBeforeService = totalRoomPrice + totalChildFee + totalPetFee + totalAddonsPrice;
        data.totalPrice = Math.round(subtotalBeforeService).toFixed(0); 

        // d) 服務費計算
        const serviceFee = subtotalBeforeService * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee).toFixed(0);

        // e) 接送機費
        data.transferFee = Math.round(transferFee).toFixed(0);

        // 總價 (含服務費、接送機費)
        let total = subtotalBeforeService + serviceFee + transferFee;
        let discountedPrice = total;
        let discountApplied = false;
        
        // --- 4. 應用折扣 (不變) ---
        
        // a) 應用優惠代碼折扣
        if (promoCode && VIRTUAL_PROMO_CODES[promoCode.toUpperCase()]) {
            // ... (邏輯不變) ...
            const promo = VIRTUAL_PROMO_CODES[promoCode.toUpperCase()];

            if (typeof promo === 'number') {
                discountedPrice *= promo;
                data.promoDiscountRate = ((1 - promo) * 100).toFixed(0);
            } else if (promo.type === 'fixed') {
                discountedPrice -= promo.value;
                data.promoDiscountValue = promo.value;
            }
            discountApplied = true;
            data.appliedPromoCode = promoCode.toUpperCase();
        } else {
            data.appliedPromoCode = '';
        }

        // b) 應用會員折扣 (如果沒有應用優惠代碼)
        let isMemberDiscount = !!VIRTUAL_MEMBERS[memberAccount];

        if (isMemberDiscount && !discountApplied) {
            const memberInfo = VIRTUAL_MEMBERS[memberAccount];
            const memberDiscountRate = memberInfo.discount || 0.9;
            
            discountedPrice *= memberDiscountRate;

            data.discountRate = ((1 - memberDiscountRate) * 100).toFixed(0);
            data.memberLevel = memberInfo.level;
        } else {
            data.discountRate = '0';
            data.memberLevel = isMemberDiscount ? VIRTUAL_MEMBERS[memberAccount].level : '無';
        }

        // 5. 最終價格
        const finalPrice = Math.round(discountedPrice < 0 ? 0 : discountedPrice);
        data.newTotalPrice = finalPrice.toFixed(0); 
        data.finalPrice = finalPrice.toFixed(0);

        return { success: true, totalPrice: finalPrice };
    }

    /**
     * ⭐️ 新增：執行通用加購選單邏輯
     */
    static executeAddonsSelection(session, flow, nextStep, extractedEntities) {
        if (!session.bookingData.addons) { session.bookingData.addons = []; }
        
        const data = session.bookingData;
        const currentPrompt = flow.states.ask_addons.prompt;

        // 1. 處理用戶點擊 '完成加購' 按鈕的回饋
        if (extractedEntities.addonAction === 'finish') {
            const totalAddons = data.addons.length;
            const finishPrompt = totalAddons > 0 
                ? `已確認 ${totalAddons} 個加購項目，總加購費用為 NT$ ${data.totalAddonsCost || 0}。` 
                : '您選擇跳過加購步驟。';

            return { 
                nextStep: nextStep, 
                richCard: null, 
                isHandled: true, 
                endFlow: false,
                prompt: finishPrompt
            };
        }

        // 2. 處理用戶點擊 '加購' 按鈕的回饋
        if (extractedEntities.addonId && extractedEntities.addonAction === 'add') {
            const addon = AddonsService.getAddonById(extractedEntities.addonId);
            if (addon) {
                let calculatedPrice = 0;
                
                if (addon.type === 'package' && addon.priceFixed) {
                    calculatedPrice = addon.priceFixed;
                } else if (addon.type === 'meal' || addon.type === 'ticket') {
                    // 按人頭/天數計算。假設票券或餐飲是依據住幾晚
                    const guests = (data.adultCount || 1) + (data.childCount || 0);
                    const nights = (data.nights || 1);
                    calculatedPrice = (data.adultCount * addon.priceAdult + data.childCount * addon.priceChild) * (addon.type === 'meal' ? nights : 1);
                }

                // 加入訂單數據
                data.addons.push({
                    id: addon.id,
                    name: addon.name,
                    quantity: 1, 
                    price: calculatedPrice
                });
                
                // 重新計算總加購費用
                BookingFlowController.calculatePrice(data); 

                const addedCount = data.addons.filter(a => a.id === addon.id).length;
                session.prompt = `✅ 已為您加入 ${addon.name} (共 ${addedCount} 個，本次費用 NT$ ${calculatedPrice})。總加購費用目前為 NT$ ${data.totalAddonsCost}。`;
            }
        }
        
        // 3. 動態生成 Rich Card
        const availableAddons = AddonsService.getAvailableAddons(data.adultCount, data.childCount);
        
        const addonCards = availableAddons.map(addon => {
            let priceText;
            let buttonText;
            
            if (addon.type === 'package' && addon.priceFixed) {
                priceText = `固定價格：TWD ${addon.priceFixed}`;
                buttonText = `加購 (${addon.priceFixed} 元)`;
            } else {
                priceText = `成人 ${addon.priceAdult} 元 / 兒童 ${addon.priceChild} 元`;
                buttonText = `加購 (${addon.name})`; 
            }

            return {
                type: 'card',
                title: addon.name,
                description: addon.description,
                imageUrl: addon.imageUrl,
                sections: [
                    { title: '費用細節', text: priceText }
                ],
                buttons: [
                    { 
                        text: buttonText, 
                        intent: 'addon_selection', 
                        data: JSON.stringify({ addonId: addon.id, addonAction: 'add' }) 
                    }
                ]
            };
        });

        // 建立結束加購的按鈕
        const finishCard = {
            type: 'card',
            title: '完成加購',
            description: `目前已選擇 ${data.addons.length} 個加購項目。如果沒有其他需要，請點擊按鈕進入下一步。`,
            buttons: [
                {
                    text: '完成加購，進入下一步',
                    intent: 'affirm', 
                    data: JSON.stringify({ addonAction: 'finish' }) 
                }
            ]
        };

        const finalRichCard = {
            type: 'carousel', 
            items: [...addonCards, finishCard]
        };
        
        return { 
            nextStep: 'ask_addons', 
            richCard: finalRichCard, 
            isHandled: true, 
            endFlow: false,
            prompt: session.prompt || currentPrompt 
        };
    }

    /**
     * 【模擬訂單提交，包含金流連結生成】
     */
    static submitBooking(data) {
        // ... (邏輯不變) ...
        const orderId = 'AIBK' + Date.now().toString().slice(-6);
        let paymentMessage;
        
        if (data.paymentMethod === '線上付款') {
            const finalPrice = data.finalPrice;
            const virtualPaymentURL = `${VIRTUAL_PAYMENT_BASE_URL}?orderId=${orderId}&amount=${finalPrice}`;

            paymentMessage = `您的訂單編號是 **${orderId}**，最終金額 NT$ ${finalPrice}。\n\n**[點擊此處完成線上付款](${virtualPaymentURL})**\n\n請注意：連結將在 30 分鐘內有效。`;

        } else { // 現場結帳
            paymentMessage = `您的訂單編號是 **${orderId}**，我們已為您保留房間。請在入住時告知訂單編號 **${orderId}** 並完成現場結帳。`;
        }

        return { id: orderId, paymentMessage: paymentMessage };
    }
}

module.exports = BookingFlowController;

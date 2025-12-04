// booking_controller.js - 負責業務計算與訂單模擬 (最終修正版)

// 導入依賴
const config = require('./config');
const { FlowConfigLoader } = require('./flow_loader');

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
const MEAL_PRICE_PER_PERSON_PER_NIGHT = 350; // 早餐單價 (配合 flow.json 修正)
const SERVICE_FEE_RATE = 0.1; // 10% 服務費
const PET_FEE_PER_PET_PER_NIGHT = 300; // 寵物加價單價 (新增)
const VIRTUAL_PAYMENT_BASE_URL = 'https://secure.payment.gateway.com/pay'; // 虛擬金流服務基礎URL

// 模擬優惠代碼列表
const VIRTUAL_PROMO_CODES = {
    'SUMMER20': 0.80, // 8折
    'WEEKDAY10': 0.90, // 9折
    'SAVE500': { type: 'fixed', value: 500 } // 固定減免 500
};

// 實例化 FlowConfigLoader
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

class BookingFlowController {
    static getFlow() {
        return flowLoader.getFlow();
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
            needsMeal = '是', // 假設沒有問到就是預設「是」
            transferFee = 0,
        } = data;

        // 關鍵檢查點：房價數據是否存在
        if (Object.keys(ROOM_RATES).length === 0 || !roomType || !ROOM_RATES[roomType]) {
            return { success: false, errorMessage: `警告：無法找到房型 [${roomType}] 的價格或配置錯誤。`, oos: true };
        }
        
        // 數據完整性檢查
        if (!checkInDate || nights <= 0 || roomCount <= 0 || adultCount <= 0) {
            return { success: false, errorMessage: "價格計算所需的數據不完整或無效。" };
        }

        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;

        // --- 2. 逐晚檢查庫存與動態計算房價 ---
        for (let i = 0; i < nights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day();

            // 庫存檢查
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

            // 動態價格計算 (含週末加價)
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
        
        // c) 餐飲費計算
        const guests = adultCount + childCount;
        let mealPrice = 0;
        if (needsMeal === '是' || needsMeal === true) { // 檢查是否需要早餐
            mealPrice = MEAL_PRICE_PER_PERSON_PER_NIGHT * guests * nights;
        }
        data.mealPrice = Math.round(mealPrice).toFixed(0);

        // 房費小計 (房費 + 兒童加價 + 寵物加價 + 餐飲費)
        let subtotalBeforeService = totalRoomPrice + totalChildFee + totalPetFee + mealPrice;
        data.totalPrice = Math.round(subtotalBeforeService).toFixed(0); // 儲存折扣前的小計

        // d) 服務費計算
        const serviceFee = subtotalBeforeService * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee).toFixed(0);

        // e) 接送機費
        // 注意：此處 transferFee 應由 rule_engine 在 collect_transfer_details 狀態中根據 transferType 計算並寫入 data
        data.transferFee = Math.round(transferFee).toFixed(0);

        // 總價 (含服務費、接送機費)
        let total = subtotalBeforeService + serviceFee + transferFee;
        let discountedPrice = total;
        let discountApplied = false;
        
        // --- 4. 應用折扣 ---
        
        // a) 應用優惠代碼折扣
        if (promoCode && VIRTUAL_PROMO_CODES[promoCode.toUpperCase()]) {
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

        // 5. 最終價格 (Final Price)
        const finalPrice = Math.round(discountedPrice < 0 ? 0 : discountedPrice);
        data.newTotalPrice = finalPrice.toFixed(0); // 儲存折扣後的金額
        data.finalPrice = finalPrice.toFixed(0);

        return { success: true, totalPrice: finalPrice };
    }

    /**
     * 【模擬訂單提交，包含金流連結生成】
     */
    static submitBooking(data) {
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

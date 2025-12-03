// booking_controller.js

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

// 從配置中解構常數 (假設這些已在 config.js 中定義)
const {
    ROOM_RATES,
    WEEKEND_MULTIPLIER,
    CHILD_FEE_PER_NIGHT,
    DEFAULT_ROOM_INVENTORY,
    VIRTUAL_INVENTORY,
    VIRTUAL_MEMBERS
} = config;

// 常數定義
const MEAL_PRICE_PER_PERSON_PER_NIGHT = 150; // 早餐單價
const SERVICE_FEE_RATE = 0.1; // 10% 服務費
const PET_FEE_PER_PET_PER_NIGHT = 300; // 🐶 寵物加價單價 (新增)

// 模擬優惠代碼列表 (新增)
const VIRTUAL_PROMO_CODES = {
    'SUMMER20': 0.80, // 8折
    'WEEKDAY10': 0.90, // 9折
    'SAVE500': { type: 'fixed', value: 500 } // 固定減免 500
};

// 實例化 FlowConfigLoader，以便獲取流程配置
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

class BookingFlowController {
    static getFlow() {
        return flowLoader.getFlow();
    }

    /**
     * 【動態價格計算和庫存檢查】
     * 負責計算總價、兒童加價、週末加價、服務費、折扣，並檢查庫存。
     * @param {object} data - 包含會話數據
     * @returns {object} { success: boolean, errorMessage?: string, totalPrice?: number, oos?: boolean }
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
            promoCode, // 🎁 新增：優惠代碼
            petCount = 0, // 🐶 新增：寵物數量
            needsMeal = true,
            transferFee = 0
        } = data;

        // --- 1. 數據完整性檢查 ---
        if (!roomType || !ROOM_RATES[roomType] || !checkInDate || nights <= 0 || roomCount <= 0 || adultCount <= 0) {
            return { success: false, errorMessage: "價格計算所需的數據不完整或無效 (請檢查房型、日期、晚數、房間數、大人數)。" };
        }

        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;

        // --- 2. 逐晚檢查庫存與動態計算房價 (保持不變) ---
        for (let i = 0; i < nights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day(); // 0 (Sun) - 6 (Sat)

            // a) 庫存檢查
            const availableRooms = VIRTUAL_INVENTORY[dateKey]
                ? VIRTUAL_INVENTORY[dateKey][roomType] || DEFAULT_ROOM_INVENTORY
                : DEFAULT_ROOM_INVENTORY;

            if (roomCount > availableRooms) {
                // 庫存不足，回傳錯誤訊息和 OOS 標記
                return {
                    success: false,
                    errorMessage: `抱歉，您選擇的 **${roomType}** 在 **${currentDate.format('YYYY/MM/DD')}** 僅剩 **${availableRooms} 間**。`,
                    oos: true // Out Of Stock 標記
                };
            }

            // b) 動態價格計算
            let baseRate = ROOM_RATES[roomType];
            let priceMultiplier = (dayOfWeek === 5 || dayOfWeek === 6) ? WEEKEND_MULTIPLIER : 1;
            
            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * roomCount;

            // 移至下一晚
            currentDate = currentDate.add(1, 'day');
        }

        // --- 3. 計算附加費用 ---

        // a) 兒童加價
        const totalChildFee = (childCount || 0) * CHILD_FEE_PER_NIGHT * nights;
        data.childCost = Math.round(totalChildFee).toFixed(0);

        // b) 寵物加價 (新增)
        const totalPetFee = (petCount || 0) * PET_FEE_PER_PET_PER_NIGHT * nights;
        data.petFee = Math.round(totalPetFee).toFixed(0);
        
        // c) 餐飲費計算
        const guests = adultCount + childCount;
        let mealPrice = 0;
        if (needsMeal) {
            // 注意：這裡假設兒童也需付早餐費，若有更複雜政策需在 config 內設定。
            mealPrice = MEAL_PRICE_PER_PERSON_PER_NIGHT * guests * nights;
        }
        data.mealPrice = Math.round(mealPrice).toFixed(0);

        // 房費小計 (房費 + 兒童加價 + 寵物加價 + 餐飲費)
        let subtotalBeforeService = totalRoomPrice + totalChildFee + totalPetFee + mealPrice;
        data.totalPrice = Math.round(subtotalBeforeService).toFixed(0); // 這裡儲存小計

        // d) 服務費計算 (基於房費小計)
        const serviceFee = subtotalBeforeService * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee).toFixed(0);

        // e) 接送機費
        data.transferFee = Math.round(transferFee).toFixed(0);

        // 總價 (含服務費、接送機費)
        let total = subtotalBeforeService + serviceFee + transferFee;

        // --- 4. 應用折扣 ---
        let discountedPrice = total;
        let discountApplied = false;
        
        // a) 應用優惠代碼折扣 (新增邏輯)
        if (promoCode && VIRTUAL_PROMO_CODES[promoCode.toUpperCase()]) {
            const promo = VIRTUAL_PROMO_CODES[promoCode.toUpperCase()];

            if (typeof promo === 'number') { // 百分比折扣 (例如 0.80)
                discountedPrice *= promo;
                data.promoDiscountRate = ((1 - promo) * 100).toFixed(0);
                data.promoDiscountType = '百分比折扣';
            } else if (promo.type === 'fixed') { // 固定金額減免
                discountedPrice -= promo.value;
                data.promoDiscountValue = promo.value;
                data.promoDiscountType = '固定減免';
            }
            discountApplied = true;
            data.appliedPromoCode = promoCode.toUpperCase();
        } else {
            data.appliedPromoCode = '';
        }

        // b) 應用會員折扣 (只有在未應用優惠代碼時才考慮會員折扣，避免雙重折扣)
        let isMemberDiscount = !!VIRTUAL_MEMBERS[memberAccount];

        if (isMemberDiscount && !discountApplied) {
            const memberInfo = VIRTUAL_MEMBERS[memberAccount];
            const memberDiscountRate = memberInfo.discount || 0.9;
            
            // 折扣應用在總價上
            discountedPrice *= memberDiscountRate;

            data.discountRate = ((1 - memberDiscountRate) * 100).toFixed(0);
            data.memberLevel = memberInfo.level;
            data.newTotalPrice = Math.round(discountedPrice).toFixed(0);
        } else {
            // 如果應用了優惠代碼，會員折扣就不再適用 (或沒有會員/優惠碼)
            data.discountRate = '0';
            data.memberLevel = isMemberDiscount ? VIRTUAL_MEMBERS[memberAccount].level : '無';
            data.newTotalPrice = Math.round(discountedPrice).toFixed(0);
        }

        // 5. 最終價格 (Final Price)
        const finalPrice = Math.round(discountedPrice < 0 ? 0 : discountedPrice); // 確保最終價格不為負數
        data.finalPrice = finalPrice.toFixed(0);

        return { success: true, totalPrice: finalPrice };
    }

    /**
     * 【模擬訂單提交】
     * 模擬將訂單數據送出到後端系統。
     */
    static submitBooking(data) {
        // 實際應用中，這裡會呼叫 API
        const orderId = 'AIBK' + Date.now().toString().slice(-6);
        // 可以將新的折扣和費用包含在確認訊息中
        const paymentMessage = `我們已成功收到您的訂房請求，訂單編號 **${orderId}** 資訊已發送至您的聯絡信箱/電話，並包含付款連結。`;
        return { id: orderId, paymentMessage: paymentMessage };
    }
}

module.exports = BookingFlowController;

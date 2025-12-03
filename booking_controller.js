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
            needsMeal = true, // 假設流程會提供
            transferFee = 0 // 應在 rule_engine 中計算並寫入 data
        } = data;
        
        // --- 1. 數據完整性檢查 ---
        if (!roomType || !ROOM_RATES[roomType] || !checkInDate || nights <= 0 || roomCount <= 0 || adultCount <= 0) {
            return { success: false, errorMessage: "價格計算所需的數據不完整或無效 (請檢查房型、日期、晚數、房間數、大人數)。" };
        }
        
        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;
        
        // --- 2. 逐晚檢查庫存與動態計算房價 ---
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
            let priceMultiplier = 1;
            
            // 判斷是否為週末 (週五=5, 週六=6)
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                priceMultiplier = WEEKEND_MULTIPLIER;
            }

            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * roomCount;

            // 移至下一晚
            currentDate = currentDate.add(1, 'day');
        }
        
        // --- 3. 計算附加費用 ---
        
        // a) 兒童加價
        const totalChildFee = (childCount || 0) * CHILD_FEE_PER_NIGHT * nights;
        data.childCost = Math.round(totalChildFee).toFixed(0);

        // b) 餐飲費計算
        const guests = adultCount + childCount;
        let mealPrice = 0;
        if (needsMeal) {
            mealPrice = MEAL_PRICE_PER_PERSON_PER_NIGHT * guests * nights;
        }
        data.mealPrice = Math.round(mealPrice).toFixed(0);

        // 房費小計 (房費 + 兒童加價 + 餐飲費)
        let subtotalBeforeService = totalRoomPrice + totalChildFee + mealPrice;
        data.totalPrice = Math.round(subtotalBeforeService).toFixed(0); // 這裡儲存小計

        // c) 服務費計算 (基於房費小計)
        const serviceFee = subtotalBeforeService * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee).toFixed(0);
        
        // d) 接送機費 (已經由 RuleEngine 設置，這裡只需要確保格式正確)
        data.transferFee = Math.round(transferFee).toFixed(0);

        // 總價 (含服務費、接送機費)
        let total = subtotalBeforeService + serviceFee + transferFee;
        
        // --- 4. 應用會員折扣 ---
        let discountedPrice = total;
        let isMemberDiscount = !!VIRTUAL_MEMBERS[memberAccount];
        
        if (isMemberDiscount) {
            const memberInfo = VIRTUAL_MEMBERS[memberAccount];
            const discountRate = memberInfo.discount || 0.9; 
            
            // 折扣應用在總價上
            discountedPrice *= discountRate;
            
            data.discountRate = ((1 - discountRate) * 100).toFixed(0);
            data.memberLevel = memberInfo.level;
            data.newTotalPrice = Math.round(discountedPrice).toFixed(0); 
        } else {
            data.discountRate = '0';
            data.memberLevel = '無';
            data.newTotalPrice = Math.round(total).toFixed(0); // 沒有折扣時，新總價等於原總價
        }
        
        // 5. 最終價格 (Final Price)
        const finalPrice = Math.round(discountedPrice);
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
        const paymentMessage = `我們已成功收到您的訂房請求，訂單編號 **${orderId}** 資訊已發送至您的聯絡信箱/電話，並包含付款連結。`;
        return { id: orderId, paymentMessage: paymentMessage };
    }
}

module.exports = BookingFlowController;

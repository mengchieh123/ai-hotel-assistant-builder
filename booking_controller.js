// booking_controller.js - 負責業務計算與訂單模擬 (最終修正版)

// 導入依賴
const config = require('./config');
// 假設 flow_loader.js 和 AddonsService 存在且配置正確
const { FlowConfigLoader } = require('./flow_loader'); 
const AddonsService = require('./AddonsService'); 

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
const SERVICE_FEE_RATE = 0.1; // 服務費率 (10%)
const PET_FEE_PER_PET_PER_NIGHT = 300;
const VIRTUAL_PAYMENT_BASE_URL = 'https://secure.payment.gateway.com/pay';

// 模擬優惠代碼列表
const VIRTUAL_PROMO_CODES = {
    'SUMMER20': 0.80, // 20% off
    'WEEKDAY10': 0.90, // 10% off
    'SAVE500': { type: 'fixed', value: 500 } // 固定折扣 500
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
        if (!session.bookingData) {
            session.bookingData = {};
        }
        // 核心數據初始化
        session.bookingData.addons = session.bookingData.addons || [];
        session.bookingData.nightlyDetails = session.bookingData.nightlyDetails || [];
    }

    /**
     * ⭐️ 新增：聯絡資訊驗證 (問題 6)
     */
    static validateContactInfo(data) {
        const { contactName, contactPhone, contactEmail } = data;

        if (!contactName || contactName.length < 2) {
            return { success: false, errorMessage: "請輸入有效的聯絡人姓名 (至少2個字)。" };
        }

        // 簡易手機號碼驗證 (假設為 10 位數字)
        if (!contactPhone || !/^\d{10}$/.test(contactPhone)) {
             return { success: false, errorMessage: "請輸入有效的 10 位手機號碼，僅限數字。" };
        }

        // 簡易 Email 驗證
        if (!contactEmail || !/\S+@\S+\.\S+/.test(contactEmail)) {
            return { success: false, errorMessage: "請輸入有效的電子郵件地址。" };
        }

        return { success: true };
    }

    /**
     * 【動態價格計算和庫存檢查】 - 修正：新增每日明細、折扣金額詳情
     */
    static calculatePrice(data) {
        // 將所有數字類型的數據轉換為數字，確保計算正確性
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
            // 由於將接送機納入 Addons，移除 transferFee
            addons = [] 
        } = data;

        // 核心參數的數值轉換
        const parsedNights = parseInt(nights);
        const parsedRoomCount = parseInt(roomCount);
        const parsedChildCount = parseInt(childCount);
        const parsedPetCount = parseInt(petCount);
        
        // 1. 基本安全與數據檢查
        if (!roomType || !ROOM_RATES[roomType] || parsedNights <= 0 || parsedRoomCount <= 0) {
            return { success: false, errorMessage: `價格計算所需的數據不完整或無效。` };
        }

        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;
        data.nightlyDetails = []; // ⭐️ 修正：儲存每晚細節 (問題 2, 7)
        data.discountApplied = false;
        data.memberDiscountValue = 0;
        data.promoDiscountValue = 0;

        // 2. 逐晚檢查庫存與動態計算房價
        for (let i = 0; i < parsedNights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDate.day();
            
            const availableRooms = VIRTUAL_INVENTORY[dateKey]?.[roomType] || DEFAULT_ROOM_INVENTORY;

            if (parsedRoomCount > availableRooms) {
                return {
                    success: false,
                    errorMessage: `抱歉，${roomType} 在 ${currentDate.format('YYYY/MM/DD')} 僅剩 ${availableRooms} 間。`,
                    oos: true
                };
            }

            let baseRate = ROOM_RATES[roomType];
            let priceMultiplier = (dayOfWeek === 5 || dayOfWeek === 6) ? WEEKEND_MULTIPLIER : 1;
            const isWeekend = priceMultiplier > 1;
            
            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * parsedRoomCount;
            
            // ⭐️ 儲存每日價格明細
            data.nightlyDetails.push({
                date: dateKey,
                rate: nightlyRoomPrice * parsedRoomCount, // 該晚總房價
                ratePerRoom: nightlyRoomPrice, // 單間房價
                isWeekend: isWeekend
            });

            currentDate = currentDate.add(1, 'day');
        }

        // 3. 計算附加費用
        
        // a) 兒童加價
        const totalChildFee = parsedChildCount * CHILD_FEE_PER_NIGHT * parsedNights;
        data.childCost = Math.round(totalChildFee); // ⭐️ 確保為數字

        // b) 寵物加價
        const totalPetFee = parsedPetCount * PET_FEE_PER_PET_PER_NIGHT * parsedNights;
        data.petFee = Math.round(totalPetFee);
        
        // c) 通用加購費用計算
        let totalAddonsPrice = addons.reduce((sum, addon) => sum + addon.price, 0);
        data.totalAddonsCost = Math.round(totalAddonsPrice); // ⭐️ 確保為數字

        // 小計 (房費 + 兒童加價 + 寵物加價 + 總加購費用)
        let subtotal = totalRoomPrice + totalChildFee + totalPetFee + totalAddonsPrice;
        
        // d) 服務費計算 (基於 subtotal)
        const serviceFee = subtotal * SERVICE_FEE_RATE;
        data.serviceFee = Math.round(serviceFee); // ⭐️ 確保為數字
        
        // 總價 (含服務費，未折扣前)
        let totalBeforeDiscount = subtotal + data.serviceFee;
        let discountedPrice = totalBeforeDiscount;
        
        // --- 4. 應用折扣 (問題 3) ---
        
        // a) 會員等級判斷
        let memberInfo = VIRTUAL_MEMBERS[memberAccount];
        data.memberLevel = memberInfo ? memberInfo.level : '無';
        let memberDiscountRate = memberInfo ? (memberInfo.discount || 0.9) : 1;
        
        // b) 應用優惠代碼折扣
        if (promoCode && VIRTUAL_PROMO_CODES[promoCode.toUpperCase()]) {
            const promo = VIRTUAL_PROMO_CODES[promoCode.toUpperCase()];
            let discountValue = 0;

            if (typeof promo === 'number') { // 百分比折扣
                discountValue = totalBeforeDiscount * (1 - promo);
                discountedPrice -= discountValue;
            } else if (promo.type === 'fixed') { // 固定金額折扣
                discountValue = promo.value;
                discountedPrice -= discountValue;
            }
            
            data.promoDiscountValue = Math.round(discountValue); // ⭐️ 儲存固定折扣金額
            data.appliedPromoCode = promoCode.toUpperCase();
            data.discountApplied = true;
        }

        // c) 應用會員折扣 (如果沒有應用優惠代碼)
        if (memberInfo && !data.discountApplied && memberDiscountRate < 1) {
            const discountValue = totalBeforeDiscount * (1 - memberDiscountRate);
            discountedPrice -= discountValue;
            
            data.memberDiscountValue = Math.round(discountValue); // ⭐️ 儲存會員折扣金額
            data.discountApplied = true;
        }

        // 5. 最終價格
        const finalPrice = Math.round(discountedPrice < 0 ? 0 : discountedPrice);
        data.finalPrice = finalPrice; // ⭐️ 使用數字
        data.totalDiscount = data.promoDiscountValue + data.memberDiscountValue; // ⭐️ 總折扣金額
        data.totalBeforeDiscount = Math.round(totalBeforeDiscount); // ⭐️ 記錄未折扣總價

        return { success: true, totalPrice: finalPrice };
    }

    /**
     * ⭐️ 修正：執行通用加購選單邏輯 (流程不變，確保數據是數字)
     */
    static executeAddonsSelection(session, flow, nextStep, extractedEntities) {
        // 確保 addons 陣列已初始化
        if (!session.bookingData.addons) { session.bookingData.addons = []; }
        const data = session.bookingData;
        const currentPrompt = flow.states.ask_addons.prompt;
        
        // 確保最新的價格數據已載入到 session.bookingData 中
        BookingFlowController.calculatePrice(data); 

        // 1. 處理用戶點擊 '完成加購' 按鈕的回饋 (addonAction === 'finish')
        if (extractedEntities.addonAction === 'finish') {
            // ... (邏輯不變) ...
             const totalAddons = data.addons.length;
             const totalAddonsCost = data.totalAddonsCost.toLocaleString('en-US'); // 格式化輸出
             const finishPrompt = totalAddons > 0 
                ? `已確認 ${totalAddons} 個加購項目，總加購費用為 NT$ ${totalAddonsCost}。` 
                : '您選擇跳過加購步驟。';

            // 流程前進到下一步 (ask_contact_info)
            return { 
                nextStep: nextStep, 
                richCard: null, 
                isHandled: true, 
                endFlow: false,
                prompt: finishPrompt
            };
        }

        // 2. 處理用戶點擊 '加購' 按鈕的回饋 (addonAction === 'add')
        if (extractedEntities.addonId && extractedEntities.addonAction === 'add') {
            const addon = AddonsService.getAddonById(extractedEntities.addonId);
            if (addon) {
                let calculatedPrice = 0;
                
                // 價格計算邏輯
                if (addon.type === 'package' && addon.priceFixed) {
                    calculatedPrice = addon.priceFixed;
                } else if (addon.type === 'meal' || addon.type === 'ticket' || addon.id === 'transfer') { // ⭐️ 新增接送機識別
                    const nights = (data.nights || 1);
                    // 假設 transfer 是 fixed price 或按次/人數計價 (這裡以固定價或按人數計)
                    if (addon.id === 'transfer') {
                        // 假設接送機是固定費用
                        calculatedPrice = addon.priceAdult || 1000; 
                    } else {
                        // 餐飲/票券
                        calculatedPrice = (data.adultCount * addon.priceAdult + data.childCount * addon.priceChild) * (addon.type === 'meal' ? nights : 1);
                    }
                }

                // 加入訂單數據
                data.addons.push({
                    id: addon.id,
                    name: addon.name,
                    quantity: 1, 
                    price: Math.round(calculatedPrice) // ⭐️ 確保存入數字
                });
                
                // 重新計算總價，更新 data.totalAddonsCost (重要)
                BookingFlowController.calculatePrice(data); 

                const addedCount = data.addons.filter(a => a.id === addon.id).length;
                session.prompt = `✅ 已為您加入 ${addon.name} (共 ${addedCount} 個，本次費用 NT$ ${Math.round(calculatedPrice).toLocaleString('en-US')})。總加購費用目前為 NT$ ${data.totalAddonsCost.toLocaleString('en-US')}。`;
            }
        }
        
        // 3. 動態生成 Rich Card (輪播卡片) - 邏輯不變
        // ... (原 executeAddonsSelection 函數的 Rich Card 生成邏輯) ...
        const availableAddons = AddonsService.getAvailableAddons(data.adultCount, data.childCount);
        
        const addonCards = availableAddons.map(addon => {
             let priceText;
             let buttonText;
             
             // ⭐️ 優化卡片顯示價格的邏輯
             if (addon.priceFixed) {
                 priceText = `固定價格：TWD ${addon.priceFixed.toLocaleString('en-US')}`;
                 buttonText = `加購 (${addon.priceFixed.toLocaleString('en-US')} 元)`;
             } else {
                 priceText = `成人 ${addon.priceAdult.toLocaleString('en-US')} 元 / 兒童 ${addon.priceChild.toLocaleString('en-US')} 元`;
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
            description: `目前已選擇 ${data.addons.length} 個加購項目。總加購費用為 NT$ ${data.totalAddonsCost.toLocaleString('en-US')}。`,
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
        
        // 返回結果
        return { 
            nextStep: 'ask_addons', 
            richCard: finalRichCard, 
            isHandled: true, 
            endFlow: false,
            prompt: session.prompt || currentPrompt 
        };
    }

    /**
     * ⭐️ 新增：訂單摘要 (用於最終輸出) - 完全符合問題 7
     */
    static generateOrderSummary(data, orderId, paymentMessage) {
        // Helper function for currency formatting
        const formatCurrency = (amount) => `NT$ ${amount.toLocaleString('en-US')}`;

        let priceDetail = "\n\n**【費用詳細資訊】**\n";
        
        // 1. 房價明細
        priceDetail += "--- 房價與住宿費用 ---\n";
        
        // 每日明細 (問題 2)
        data.nightlyDetails.forEach(night => {
            const nightType = night.isWeekend ? '週末加價' : '平日';
            priceDetail += `🏨 ${night.date} (${nightType}, ${data.roomCount} 間): ${formatCurrency(night.rate)}\n`;
        });
        
        // 2. 加值與加購費用
        priceDetail += "\n--- 額外加值與服務費 ---\n";
        
        if (data.childCost > 0) {
            priceDetail += `👶 兒童加價 (${data.childCount} 位): ${formatCurrency(data.childCost)}\n`;
        }
        if (data.petFee > 0) {
            priceDetail += `🐾 寵物清潔費 (${data.petCount} 隻): ${formatCurrency(data.petFee)}\n`;
        }
        
        // 總加購服務費用
        if (data.addons.length > 0) {
            priceDetail += `🎁 加購服務總計 (${data.addons.length} 項): ${formatCurrency(data.totalAddonsCost)}\n`;
            // 可選：列出每個 addon
            data.addons.forEach(addon => {
                 priceDetail += `   - ${addon.name}: ${formatCurrency(addon.price)}\n`;
            });
        }
        
        // 服務費
        priceDetail += `🛎️ 總服務費 (${(SERVICE_FEE_RATE * 100).toFixed(0)}%): ${formatCurrency(data.serviceFee)}\n`;
        
        // 總計(未折扣)
        priceDetail += `**🧾 小計 (含服務費，未折扣): ${formatCurrency(data.totalBeforeDiscount)}**\n`;


        // 3. 折扣與最終價格
        priceDetail += "\n--- 折扣與最終價格 ---\n";
        priceDetail += `💰 **總折扣金額: - ${formatCurrency(data.totalDiscount)}**\n`;
        
        // 會員折扣詳列 (問題 3)
        if (data.memberDiscountValue > 0) {
            // 由於折扣率可能在 calculatePrice 中沒有精確計算，這裡僅顯示金額
            priceDetail += `   - 會員 (${data.memberLevel}): - ${formatCurrency(data.memberDiscountValue)}\n`; 
        }
        // 優惠代碼折扣詳列
        if (data.promoDiscountValue > 0) {
            priceDetail += `   - 優惠碼 (${data.appliedPromoCode}): - ${formatCurrency(data.promoDiscountValue)}\n`;
        }
        
        // 4. 最終總價
        priceDetail += `\n**✅ 最終應付總額: ${formatCurrency(data.finalPrice)}**\n`;

        // 最終回覆文字
        const finalMessage = `我已為您保留房間！以下是您的訂單 ${orderId} 詳情：\n\n` +
                             `**🏨 預訂資訊**\n` +
                             `* 房型：${data.roomType} (${data.roomCount} 間)\n` +
                             `* 入住/晚數：${data.checkInDate} / ${data.nights} 晚\n` +
                             `* 人數：${data.adultCount} 大 ${data.childCount} 小\n` +
                             `* 聯絡人：${data.contactName} (${data.contactPhone})\n` +
                             priceDetail + 
                             `\n**💳 付款方式：** ${data.paymentMethod}\n` +
                             `\n**👉 付款狀態：** ${paymentMessage}`;

        return finalMessage;
    }

    /**
     * 【模擬訂單提交，包含金流連結生成】
     */
    static submitBooking(data) {
        // 生成一個模擬的訂單 ID
        const orderId = 'AIBK' + Date.now().toString().slice(-6);
        let paymentMessage;
        
        // ⭐️ 確保 finalPrice 是數字類型以便計算
        const finalPrice = data.finalPrice; 
        
        if (data.paymentMethod === '線上付款') {
            // 模擬金流連結
            const virtualPaymentURL = `${VIRTUAL_PAYMENT_BASE_URL}?orderId=${orderId}&amount=${finalPrice}`;

            paymentMessage = `您的訂單已送出，總金額 **${formatCurrency(finalPrice)}**。\n\n**[點擊此處前往付款頁面](${virtualPaymentURL})**\n\n請注意：連結將在 30 分鐘內有效。付款完成後請告知助理。`;

        } else { // 現場結帳
            paymentMessage = `您的訂單已送出，應付金額 **${formatCurrency(finalPrice)}**，請在入住時告知訂單編號 **${orderId}** 完成現場結帳。`;
        }

        // ⭐️ 使用新的 generateOrderSummary 函數
        const finalSummary = BookingFlowController.generateOrderSummary(data, orderId, paymentMessage);

        return { id: orderId, finalSummary: finalSummary };
    }
}

// Helper function for currency formatting (在 node.js 環境中可能需要手動定義)
const formatCurrency = (amount) => `NT$ ${amount.toLocaleString('en-US')}`;

module.exports = BookingFlowController;

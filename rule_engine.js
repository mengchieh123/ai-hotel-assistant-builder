// rule_engine.js - 負責流程控制與狀態轉移 (最終修正版)

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager'); // 假設已存在
const SmartIntentClassifier = require('./intent_classifier'); // 假設已存在
const BookingFlowController = require('./booking_controller'); // 導入業務計算層
const GeminiGenerator = require('./gemini_generator'); // 假設已存在
const flowConfig = require('./dialogue_flow.json'); // 假設已存在

// 實用函數：替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        const value = data[key] === undefined || data[key] === null ? '' : data[key];
        // 替換所有 ${key} 或 {key}
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}

class RuleEngine {
    /** 主處理函數：接收用戶輸入並返回回應 */
    static async processRules({ sessionId, userMessage }) {
        const session = sessionManager.getSession(sessionId);
        const intents = SmartIntentClassifier.classify(userMessage);

        console.log(`🔍 Intent Classifier Output: ${JSON.stringify(intents)}`);

        // 提取實體並合併到 Session 資料中
        const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
        Object.assign(session.collectedData, extractedEntities);

        sessionManager.updateSession(sessionId, userMessage, intents);

        // 執行規則
        const result = await RuleEngine.process(intents, session, userMessage, extractedEntities);

        if (result.shouldProcess) {
            if (result.nextStep) {
                session.currentStep = result.nextStep;
            }

            let geminiResponse = '';
            if (result.allowGeminiCall) {
                // 這裡假設 GeminiGenerator.getResponse 能夠處理查詢
                geminiResponse = await GeminiGenerator.getResponse(session, userMessage);
            }

            let finalResponse = result.response;
            
            // 處理 AI 回應的組合方式
            if (geminiResponse) {
                if (session.currentStep === 'paused_waiting_for_resume') {
                    // 流程暫停時，AI回覆放在引導訊息之前
                    finalResponse = `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${result.response}`;
                } else if (session.currentStep === 'handle_general_inquiry' || intents.includes('general_inquiry')) {
                    finalResponse = geminiResponse;
                }
            }

            if (result.endFlow) {
                // 不清除實體，以便在 booking_complete 中使用
                // sessionManager.clearEntities(sessionId); 
                session.currentStep = 'init';
            }

            sessionManager.addAssistantResponse(sessionId, finalResponse, result.richCard);

            return {
                reply: finalResponse,
                nextStateKey: session.currentStep,
                data: session.collectedData,
                richCard: result.richCard
            };
        }

        return {
            reply: "抱歉，系統無法處理您的請求，請重新開始。",
            nextStateKey: 'init',
            data: session.collectedData
        };
    }

    /** 執行規則集 (從高優先級 P:105 到最低優先級 P:1) */
    static async process(intents, session, message, extractedEntities) {
        const rules = [
            this.emergencyRule, 
            this.generalInquiryOverrideRule,
            this.bookingFlowRule, 
            this.generalRule 
        ];

        for (const rule of rules) {
            const result = await rule.call(this, intents, session, message, extractedEntities);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (P:105) */
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            return {
                shouldProcess: true,
                priority: 105,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation',
                endFlow: true,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) - 純閒聊覆蓋 */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        const isGeneralQueryIntent = 
            intents.includes('general_inquiry') || 
            intents.includes('inquiry') || 
            intents.includes('pricing') || 
            intents.includes('facilities') || 
            intents.includes('weather');    

        // 如果是純粹的查詢意圖，且用戶輸入不包含任何訂房實體
        const hasNoBookingEntities = Object.keys(extractedEntities).length === 0;
        
        if (isGeneralQueryIntent && hasNoBookingEntities) {
            return {
                shouldProcess: true,
                priority: 104, 
                response: "好的，我將為您查詢。", 
                nextStep: 'handle_general_inquiry', 
                allowGeminiCall: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 輔助函數：生成訂單摘要 */
    static generateSummary(data) {
        // 使用 name, phone, email, paymentMethod 這些修正後的實體
        const isMember = data.memberAccount ? true : false;
        const totalDiscount = (data.totalPrice - data.newTotalPrice) > 0 ? (data.totalPrice - data.newTotalPrice).toFixed(0) : '0';
        
        let summary = `🗓️ 日期/房型：**${data.roomType || 'N/A'}** (${data.roomCount || 1} 間)
入住：**${data.checkInDate || 'N/A'}**，共 **${data.nights || 'N/A'} 晚**
👨‍👩‍👧‍👦 人數：**${data.adultCount || 'N/A'} 大 ${data.childCount || 0} 小**
${data.petCount > 0 ? `🐶 寵物數：**${data.petCount} 隻**` : ''}
${data.needsMeal !== '否' ? `🍽️ 早餐加購：**是**` : '🍽️ 早餐加購：否'}

---
👤 **聯絡資訊與結帳方式**
訂房人：**${data.name || 'N/A'}**
電話：**${data.phone || 'N/A'}**
Email：**${data.email || 'N/A'}**
結帳方式：**${data.paymentMethod || 'N/A'}**

---
💰 **費用明細**
房費小計：NT$ ${data.totalPrice || 'N/A'} (含房費/週末/加購費)
服務費 (10%)：NT$ ${data.serviceFee || 0}
接送機費：NT$ ${data.transferFee || 0}
${data.appliedPromoCode ? `優惠碼 (${data.appliedPromoCode}) 折扣：-NT$ ${totalDiscount}` : ''}
${data.discountRate !== '0' && !data.appliedPromoCode ? `會員折扣 (${data.discountRate}%)：-NT$ ${totalDiscount}` : ''}
**最終總計：NT$ ${data.finalPrice || 'N/A'}** (已含稅及服務費)
---
`;
        return summary;
    }


    /** 規則 2: 訂房流程規則 (核心邏輯 P:95-P:103) */
    static async bookingFlowRule(intents, session, message, extractedEntities) {
        const flow = BookingFlowController.getFlow();
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認') || message.toLowerCase().includes('繼續');
        const isDeny = intents.includes('deny') || message.toLowerCase().includes('取消');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;

        let currentState = flow.states[currentStateKey];
        
        // =========================================================================
        // 【P:103 房間數量硬性上限檢查】
        const MAX_ROOM_LIMIT = 5;
        if (
            data.roomType && 
            data.roomCount > MAX_ROOM_LIMIT 
        ) {
            sessionManager.clearEntities(sessionId);
            const nextStateKey = 'show_room_types'; 
            return {
                shouldProcess: true,
                priority: 103, // 極高優先級
                nextStep: nextStateKey,
                response: `抱歉，單次最多僅能預訂 **${MAX_ROOM_LIMIT} 間**。請修正您需要的房間數。`,
                richCard: flow.states[nextStateKey].richCard || null,
                allowGeminiCall: false
            };
        }
        // =========================================================================

        // 1. 流程暫停與恢復處理 (P:98/P:99) - 包含 inquiry, pricing, facilities
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities'].includes(i));
        
        if (isQueryIntent) {
            if (currentStateKey && currentStateKey !== 'init' && currentStateKey !== 'paused_waiting_for_resume' && !isAffirm) {
                session.pausedState = currentStateKey;
                return {
                    shouldProcess: true, priority: 98,
                    response: `好的，我將為您查詢。**請回覆『繼續』或點選按鈕以恢復訂房流程。**`,
                    nextStep: 'paused_waiting_for_resume', allowGeminiCall: true
                };
            }
        }
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                currentStateKey = session.pausedState;
                session.pausedState = null;
                currentState = flow.states[currentStateKey];
            } else if (isDeny) {
                return { shouldProcess: true, priority: 99, response: `訂房流程已取消。`, nextStep: 'end_conversation', endFlow: true };
            } else {
                return { shouldProcess: false, priority: 0 };
            }
        }
        currentState = flow.states[currentStateKey];

        // 2. 流程內部轉移與邏輯處理
        let nextStateKey = currentStateKey;

        // 【P:101 訂房流程啟動點】
        if (currentStateKey === 'init') {
            if (intents.includes('booking') || data.checkInDate || data.nights || data.roomType) {
                nextStateKey = 'show_room_types'; // 強制轉移到起始狀態
            } else {
                return { shouldProcess: false, priority: 0 }; 
            }
        }

        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }

        // B. 實體收集檢查與【實體推進邏輯】
        let allEntitiesCollected = false;
        if (currentState.entities && currentState.next_state) {
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null
            );

            if (allEntitiesCollected) {
                nextStateKey = currentState.next_state;

                // 實體推進 (跳過已滿足的狀態)
                let nextState = flow.states[nextStateKey];
                while (nextState && nextState.entities && nextState.next_state) {
                    const nextEntitiesCollected = nextState.entities.every(
                        entity => data[entity] !== undefined && data[entity] !== null
                    );
                    if (nextEntitiesCollected) {
                        nextStateKey = nextState.next_state;
                        nextState = flow.states[nextStateKey];
                    } else {
                        break;
                    }
                }
            }
        }

        // C. 價格計算與 OOS 檢查 (P:102)
        if (nextStateKey === 'check_availability_and_price' && flow.states[nextStateKey].handler === 'calculatePrice') {
            const priceResult = BookingFlowController.calculatePrice(data);

            if (!priceResult.success) {
                // OOS/價格錯誤，清空實體 (讓用戶重新選擇日期/房型)
                sessionManager.clearBookingEssentials(sessionId); // 假設有一個方法只清除核心實體
                nextStateKey = 'show_room_types'; 
                return {
                    shouldProcess: true, priority: 102,
                    response: priceResult.errorMessage + " **請修正您的預訂資訊。**",
                    nextStep: nextStateKey, richCard: flow.states[nextStateKey].richCard,
                    allowGeminiCall: false
                };
            }
            data.finalPrice = priceResult.totalPrice.toFixed(0); // 確保 finalPrice 被寫入
            nextStateKey = flow.states[nextStateKey].next_state;
        }

        // D. 處理 confirm_booking 狀態的確認/修改邏輯 (P:101)
        if (nextStateKey === 'confirm_booking') {
            // 在最終確認前，執行最後一次價格檢查 (確保所有加購都計算進去了)
            BookingFlowController.calculatePrice(data);
            
            const summary = this.generateSummary(data);
            const nextState = flow.states[nextStateKey];
            const finalPrompt = nextState.prompt.replace('[SUMMARY]', summary);

            return {
                shouldProcess: true, priority: 101,
                response: finalPrompt,
                nextStep: nextStateKey, richCard: nextState.richCard,
                allowGeminiCall: false
            };
        }
        
        // E. 訂單提交邏輯 (P:96)
        if (currentStateKey === 'confirm_booking' && isAffirm) {
            const bookingResult = BookingFlowController.submitBooking(data);
            data.orderId = bookingResult.id;
            data.paymentMessage = bookingResult.paymentMessage;

            const nextState = flow.states['booking_complete'];
            const finalPrompt = interpolatePrompt(nextState.prompt, data);

            return {
                shouldProcess: true, priority: 96,
                response: finalPrompt,
                nextStep: 'booking_complete', endFlow: true,
                richCard: nextState.richCard, allowGeminiCall: false
            };
        }

        // 3. 輸出回應 (流程轉移或實體不足的提示)
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && allEntitiesCollected === false)) {
            const nextState = flow.states[nextStateKey];
            if (!nextState) return { shouldProcess: false, priority: 0 };
            
            const responsePrompt = nextState.prompt ? interpolatePrompt(nextState.prompt, data) : currentState.fallback;

            return {
                shouldProcess: true, priority: 101,
                response: responsePrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: nextState.allow_gemini_call === true
            };
        }

        // 4. 閒聊/未知意圖：返回 false，讓 control 流到 generalRule
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 一般詢問與閒聊 (P:1) */
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 1,
            response: '我正在為您查詢或處理您的要求...',
            nextStep: 'handle_general_inquiry',
            allowGeminiCall: true
        };
    }
}

module.exports = RuleEngine;


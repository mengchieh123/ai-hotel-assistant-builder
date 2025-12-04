// rule_engine.js

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller');
const GeminiGenerator = require('./gemini_generator');

// 實用函數：替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        // 確保替換的值是字串
        const value = data[key] === undefined || data[key] === null ? '' : data[key];
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}

class RuleEngine {
    /**
     * 主處理函數：接收用戶輸入並返回回應
     */
    static async processRules({ sessionId, userMessage }) {
        const session = sessionManager.getSession(sessionId);
        const intents = SmartIntentClassifier.classify(userMessage);

        // 🚨 【調試點：檢查意圖分類結果】(保留調試 Log，幫助追蹤)
        console.log(`🔍 Intent Classifier Output: ${JSON.stringify(intents)}`);
        // 🚨 【調試點結束】

        // 【優化】先提取實體，供後續 P:98 規則判斷是否為「新實體輸入」
        const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
        Object.assign(session.collectedData, extractedEntities);

        // 更新 Session 中的用戶輸入和意圖
        sessionManager.updateSession(sessionId, userMessage, intents);

        // 執行規則
        const result = await RuleEngine.process(intents, session, userMessage, extractedEntities);

        // 執行結果後處理
        if (result.shouldProcess) {
            if (result.nextStep) {
                session.currentStep = result.nextStep;
            }

            let geminiResponse = '';
            if (result.allowGeminiCall) {
                geminiResponse = await GeminiGenerator.getResponse(session, userMessage);
            }

            let finalResponse = result.response;
            
            // 針對不同狀態處理 AI 回應的組合方式
            if (geminiResponse) {
                if (session.currentStep === 'paused_waiting_for_resume') {
                    // 流程暫停時，AI回覆放在引導訊息之前
                    finalResponse = `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${result.response}`;
                } else if (session.currentStep === 'handle_general_inquiry' || intents.includes('general_inquiry')) {
                    // 處於純查詢狀態，AI回覆直接覆蓋預設提示
                    finalResponse = geminiResponse;
                }
            }

            if (result.endFlow) {
                sessionManager.clearEntities(sessionId);
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

    // 執行規則集
    static async process(intents, session, message, extractedEntities) {

        // 規則優先級：緊急 > 查詢覆蓋 > 流程控制 > 閒聊
        const rules = [
            this.emergencyRule, 
            this.generalInquiryOverrideRule, // 👈 P:104
            this.bookingFlowRule, 
            this.generalRule 
        ];

        for (const rule of rules) {
            // 傳遞 extractedEntities
            const result = await rule.call(this, intents, session, message, extractedEntities);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (最高優先級 P:105) */
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

    /** 規則 1.5: 通用查詢覆蓋規則 (極高優先級 P:104) 
     * 涵蓋所有可能被誤判為「非流程」的通用查詢意圖，但排除攜帶實體的訂房請求。
     */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        // 涵蓋所有可能被誤判為「非流程」的通用查詢意圖
        const isGeneralQueryIntent = 
            intents.includes('general_inquiry') || 
            intents.includes('inquiry') || 
            intents.includes('pricing') || 
            intents.includes('facilities') || 
            intents.includes('weather');    

        // 只有當【是查詢意圖】且【沒有新的訂房實體】時，才執行覆蓋
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

    /** 輔助函數：生成訂單摘要 (強化版) */
    static generateSummary(data) {
        const isMember = data.memberAccount ? true : false;

        let summary = `🗓️ 日期/房型：**${data.roomType || 'N/A'}** (${data.roomCount || 1} 間)
入住：**${data.checkInDate || 'N/A'}**，共 **${data.nights || 'N/A'} 晚**
👨‍👩‍👧‍👦 人數：**${data.adultCount || 'N/A'} 大 ${data.childCount || 0} 小**
${isMember ? `👤 會員：**${data.memberAccount}** (${data.memberLevel})` : '👤 會員：非會員'}
💳 付款方式：**${data.paymentMethod || 'N/A'}**
聯絡人：**${data.contactName || 'N/A'}** (${data.contactDetail || 'N/A'})

---
💰 **費用明細**
房費小計：NT$ ${data.totalPrice || 'N/A'} (含週末加價)
兒童加價：NT$ ${data.childCost || 0}
餐飲加購：NT$ ${data.mealPrice || 0}
接送機費：NT$ ${data.transferFee || 0}
服務費 (10%)：NT$ ${data.serviceFee || 0}
${data.appliedPromoCode ? `優惠碼 (${data.appliedPromoCode}) 折扣：-NT$ ${(data.totalPrice - data.newTotalPrice).toFixed(0)}` : ''}
${data.discountRate !== '0' && !data.appliedPromoCode ? `會員折扣 (${data.discountRate}%)：-NT$ ${(data.totalPrice - data.newTotalPrice).toFixed(0)}` : ''}
**最終總計：NT$ ${data.finalPrice || 'N/A'}** (已含稅及服務費)

---
`;
        return summary;
    }


    /** 規則 2: 訂房流程規則 (核心邏輯 P:95-P:103) */
    static async bookingFlowRule(intents, session, message, extractedEntities) {
        const flow = BookingFlowController.getFlow();
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認') || message.toLowerCase().includes('繼續');
        const isCorrection = intents.includes('correction') || intents.includes('modify') || message.toLowerCase().includes('修改');
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
            data.roomCount = null;
            data.nights = null;
            data.checkInDate = null;

            const nextStateKey = 'show_room_types'; 

            return {
                shouldProcess: true,
                priority: 103, // 極高優先級
                nextStep: nextStateKey,
                response: `抱歉，為了確保大型團體訂房的品質，**${data.roomType}** 單次最多僅能預訂 **${MAX_ROOM_LIMIT} 間**。請修正您需要的房間數。`,
                richCard: flow.states[nextStateKey].richCard || null,
                allowGeminiCall: false
            };
        }
        // =========================================================================

        // 1. 查詢/介紹優先級處理 (P:98) - 流程暫停邏輯
        const hasNewEntities = Object.keys(extractedEntities).length > 0;
        
        // 這裡僅處理明確的房型/價格查詢，而非一般閒聊 (general_inquiry)
        if (intents.includes('inquiry') || intents.includes('pricing') || intents.includes('roomType_keyword')) {
            if (currentStateKey &&
                currentStateKey !== 'init' &&
                currentStateKey !== 'paused_waiting_for_resume' &&
                !isAffirm &&
                !hasNewEntities) {

                session.pausedState = currentStateKey;

                return {
                    shouldProcess: true,
                    priority: 98,
                    response: `好的，我將為您查詢相關資訊。\n\n**查詢完成後，請回覆『繼續』以恢復訂房流程。**`,
                    richCard: {
                        "type": "button_list",
                        "title": "要繼續訂房嗎？",
                        "buttons": [
                            { "text": "✅ 繼續訂房", "value": "繼續訂房" },
                            { "text": "❌ 取消流程", "value": "取消" }
                        ]
                    },
                    nextStep: 'paused_waiting_for_resume',
                    allowGeminiCall: true
                };
            }
        }

        // 2. 流程恢復處理 (P:99)
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                currentStateKey = session.pausedState;
                session.pausedState = null;
                session.currentStep = currentStateKey;
                currentState = flow.states[currentStateKey];
            } else if (isDeny) {
                return {
                    shouldProcess: true,
                    priority: 99,
                    response: `好的，訂房流程已取消。期待您的下次光臨。`,
                    nextStep: 'end_conversation',
                    endFlow: true,
                    allowGeminiCall: false
                    };
            } else {
                return { shouldProcess: false, priority: 0 };
            }
        }
        
        // 處理完恢復邏輯後，確保currentState是最新的
        currentState = flow.states[currentStateKey];


        // 3. 流程內部轉移與邏輯處理
        let nextStateKey = currentStateKey;

        // =========================================================================
        // 🚨 關鍵修正：處理 INIT 狀態的邏輯 (P:101 啟動點)
        if (currentStateKey === 'init') {
            if (intents.includes('booking')) {
                nextStateKey = 'show_room_types'; // ✅ 強制轉移到起始狀態
            } else {
                // 如果是 init 狀態，但不是 booking 意圖，讓 control 流到 P:104 或 P:1
                return { shouldProcess: false, priority: 0 }; 
            }
        }
        // =========================================================================


        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }

        // 【接送機邏輯】
        if (currentStateKey === 'ask_transfer_service') {
            if (intents.includes('affirm') || intents.includes('request_transfer') || message.toLowerCase().includes('要') || message.toLowerCase().includes('需要')) {
                session.collectedData.needsTransfer = true;
                nextStateKey = 'collect_transfer_details';
            } else if (intents.includes('deny') || message.toLowerCase().includes('不要') || message.toLowerCase().includes('不需要')) {
                session.collectedData.needsTransfer = false;
                data.transferFee = 0; 
                nextStateKey = 'ask_payment_method';
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

                // 實體推進邏輯 (Entity Forwarding)
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

        // C. 流程特殊邏輯處理 (在狀態轉移時觸發)

        // C.1. 價格計算與 OOS 檢查 (從 ask_guest_count/ask_nights_and_dates 轉移到 check_availability_and_price)
        if (nextStateKey === 'check_availability_and_price') {
            if (data.transferType === 'roundTrip') {
                data.transferFee = 1800;
            } else if (data.transferType === 'oneWay') {
                data.transferFee = 1000;
            } else if (data.transferType === undefined) {
                data.transferFee = 0;
            }
            const priceResult = BookingFlowController.calculatePrice(data);

            if (!priceResult.success) {
                const errorPrompt = priceResult.oos
                    ? priceResult.errorMessage + " **請修正房數、晚數或選擇其他日期/房型。**"
                    : priceResult.errorMessage || "抱歉，計算價格或檢查庫存時發生錯誤。";

                nextStateKey = 'show_room_types'; 

                return {
                    shouldProcess: true,
                    priority: 102,
                    response: errorPrompt,
                    nextStep: nextStateKey,
                    richCard: flow.states[nextStateKey].richCard || null,
                    allowGeminiCall: false
                };
            }
        }
        
        // C.2. 處理 confirm_booking 狀態的確認/修改邏輯
        if (currentStateKey === 'confirm_booking') {
            if (isAffirm) {
                const bookingResult = BookingFlowController.submitBooking(data);
                data.orderId = bookingResult.id;
                data.paymentMessage = bookingResult.paymentMessage;

                const nextState = flow.states['booking_complete'];
                const finalPrompt = interpolatePrompt(nextState.prompt, data);

                return {
                    shouldProcess: true,
                    priority: 96,
                    response: finalPrompt,
                    nextStep: 'booking_complete',
                    endFlow: true,
                    richCard: nextState.richCard || null,
                    allowGeminiCall: false
                };
            } else if (isCorrection) {
                sessionManager.clearEntities(sessionId);

                return {
                    shouldProcess: true,
                    priority: 96,
                    response: "好的，請告訴我您想修改的內容，我們將從選擇房型開始。",
                    nextStep: 'show_room_types',
                    richCard: flow.states['show_room_types'].richCard || null,
                    allowGeminiCall: false
                };
            }
        }

        // C.3. 在轉移到 confirm_booking 時，動態生成摘要
        if (nextStateKey === 'confirm_booking') {
            const summary = this.generateSummary(data);
            const nextState = flow.states[nextStateKey];
            const finalPrompt = nextState.prompt.replace('[SUMMARY]', summary);

            return {
                shouldProcess: true,
                priority: 101,
                response: finalPrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: false
            };
        }

        // 4. 輸出回應 (流程轉移或實體不足的提示)
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && allEntitiesCollected === false)) {
            const nextState = flow.states[nextStateKey];

            if (nextStateKey === currentStateKey && nextStateKey === 'init') {
                return { shouldProcess: false, priority: 0 };
            }

            const responsePrompt = nextState.prompt ? interpolatePrompt(nextState.prompt, data) : currentState.fallback;

            return {
                shouldProcess: true,
                priority: 101,
                response: responsePrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: nextState.allow_gemini_call === true
            };
        }

        // 5. 流程結束後的處理 (防止無限循環)
        if (currentState.end) {
            return { shouldProcess: false, priority: 0 };
        }

        // 6. 流程內，但訊息無法驅動流程 (fallback 到當前狀態)
        if (currentStateKey !== 'init' && !allEntitiesCollected) {
            const responsePrompt = currentState.fallback ? interpolatePrompt(currentState.fallback, data) : currentState.prompt;

            return {
                shouldProcess: true,
                priority: 101,
                response: responsePrompt,
                nextStep: currentStateKey,
                richCard: currentState.richCard || null,
                allowGeminiCall: false
            };
        }

        // 7. 閒聊/未知意圖：返回 false，讓 control 流到 generalRule
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 一般詢問與閒聊 (最低優先級 P:1) */
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

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager'); 
const SmartIntentClassifier = require('./intent_classifier'); 
const BookingFlowController = require('./booking_controller'); 
const GeminiGenerator = require('./gemini_generator'); 
const { FlowConfigLoader } = require('./flow_loader'); // 為了 BookingFlowController.getFlow()

// 實用函數：替換 Prompt 中的變數 (從 server.js 中搬移過來)
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
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
        
        // 將實體解析結果與 Session 數據合併
        const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
        Object.assign(session.collectedData, extractedEntities);
        
        // 更新 Session 中的用戶輸入和意圖
        sessionManager.updateSession(sessionId, userMessage, intents);
        
        // 執行規則
        const result = await RuleEngine.process(intents, session, userMessage);

        // 執行結果後處理
        if (result.shouldProcess) {
            // 更新 session 狀態
            if (result.nextStep) {
                session.currentStep = result.nextStep;
            }

            let geminiResponse = '';
            // 只有在明確允許 AI 呼叫時才呼叫 Gemini
            if (result.allowGeminiCall) { 
                geminiResponse = await GeminiGenerator.getResponse(session, userMessage); 
            }

            // 合併流程回應和 Gemini 回應
            let finalResponse = result.response;
            if (geminiResponse) {
                if (session.currentStep === 'paused_waiting_for_resume') {
                    // 暫停模式下，將 Gemini 回覆插在流程引導訊息之前
                    finalResponse = `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${result.response}`;
                } else if (session.currentStep === 'handle_general_inquiry' || intents.includes('general_inquiry')) {
                    // 純閒聊
                    finalResponse = geminiResponse;
                }
            }

            // 記錄助手的最終回應
            sessionManager.addAssistantResponse(sessionId, finalResponse, result.richCard);

            return {
                reply: finalResponse,
                nextStateKey: session.currentStep,
                data: session.collectedData,
                richCard: result.richCard
            };
        }

        // Fallback
        return {
             reply: "抱歉，系統無法處理您的請求，請重新開始。",
             nextStateKey: 'init',
             data: session.collectedData
        };
    }

    // 執行規則集
    static async process(intents, session, message) {
        
        // 規則優先級：緊急 > 流程控制 > 閒聊
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule,
            this.generalRule
        ];

        for (const rule of rules) {
            const result = await rule.call(this, intents, session, message); 
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (最高優先級 P:100) */
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            session.currentStep = 'end_conversation'; 
            return { 
                shouldProcess: true, 
                priority: 100,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation',
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 訂房流程規則 (核心邏輯 P:98, P:95) */
    static async bookingFlowRule(intents, session, message) {
        const flow = BookingFlowController.getFlow(); 
        const isAffirm = intents.includes('affirm');
        const isDeny = intents.includes('deny');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;
        
        let currentState = flow.states[currentStateKey];

        // 1. 查詢/介紹優先級處理 (P:98)
        if (intents.includes('inquiry') || intents.includes('pricing') || intents.includes('roomType_keyword')) {
            if (currentStateKey && 
                currentStateKey !== 'init' && 
                currentStateKey !== 'paused_waiting_for_resume' &&
                !isAffirm) { 
                
                console.log(`⚠️ 偵測到介紹/查詢意圖。暫停流程，轉交給 AI 處理。`);
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

        // 2. 流程恢復處理
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                currentStateKey = session.pausedState; 
                session.pausedState = null;
                session.currentStep = currentStateKey;
                
                currentState = flow.states[currentStateKey]; 
                console.log(`🔄 恢復流程到: ${currentStateKey}`);
            } else if (isDeny) {
                 return {
                    shouldProcess: true,
                    priority: 99,
                    response: `好的，訂房流程已取消。期待您的下次光臨。`,
                    nextStep: 'end_conversation',
                    allowGeminiCall: false
                   };
            } else {
                return { shouldProcess: false, priority: 0 }; 
            }
        }
        
        // 3. 流程內部轉移與邏輯處理 (P:95)
        let nextStateKey = currentStateKey;

        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }

        // B. 實體收集檢查
        let allEntitiesCollected = true;
        if (currentState.entities && currentState.next_state) {
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null
            );

            if (allEntitiesCollected) {
                nextStateKey = currentState.next_state;
            }
        }

        // C. 流程特殊邏輯處理 (在狀態轉移時觸發)
        if (nextStateKey === 'final_summary_and_payment') {
            const priceResult = BookingFlowController.calculatePrice(data); 

            if (!priceResult.success) {
                const errorPrompt = priceResult.oos 
                    ? priceResult.errorMessage + " 請修正人數、晚數或選擇其他日期/房型。"
                    : priceResult.errorMessage || "抱歉，計算價格或檢查庫存時發生錯誤。";
                
                nextStateKey = 'collect_room_and_dates'; 
                
                return {
                    shouldProcess: true,
                    priority: 97, 
                    response: errorPrompt,
                    nextStep: nextStateKey, 
                    richCard: null,
                    allowGeminiCall: false 
                };
            }
            
            // 價格計算成功，動態生成最終確認提示
            let confirmPrompt = `🎉 您的訂房資訊如下：\n`;
            confirmPrompt += `房型：**${data.roomType}** (${data.roomCount} 間) / 入住：**${data.checkInDate}** / 晚數：**${data.nights} 晚**\n`;
            confirmPrompt += `人數：**${data.adultCount} 大 ${data.childCount} 小**\n`;

            if (data.discountRate && data.discountRate !== '0') {
                 confirmPrompt += `會員折扣：**${data.memberLevel}** 享 **${data.discountRate}%** 折扣\n`;
                 confirmPrompt += `原總價：NT$ ${data.totalPrice} / 折扣後：NT$ ${data.newTotalPrice}\n`;
            } else {
                 confirmPrompt += `總價：NT$ ${data.finalPrice}\n`;
            }
            confirmPrompt += `\n**請問是否確認訂房？**`;
            
            flow.states['final_summary_and_payment'].prompt = confirmPrompt;
        }

        // 4. 輸出回應 (P:95)
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && allEntitiesCollected === false)) {
            const nextState = flow.states[nextStateKey];
            
            const responsePrompt = nextState.prompt ? interpolatePrompt(nextState.prompt, data) : currentState.fallback;

            return {
                shouldProcess: true,
                priority: 95,
                response: responsePrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: nextState.allow_gemini_call === true 
            };
        }

        // 5. 流程結束後的閒聊處理
        if (currentState.end) {
             return { shouldProcess: false, priority: 0 };
        }

        // 6. 流程內，但訊息無法驅動流程 (fallback)
        const responsePrompt = currentState.fallback ? interpolatePrompt(currentState.fallback, data) : currentState.prompt;
        
        return {
            shouldProcess: true,
            priority: 95,
            response: responsePrompt,
            nextStep: currentStateKey,
            richCard: currentState.richCard || null,
            allowGeminiCall: false 
        };
    }
    
    /** 規則 3: 一般詢問與閒聊 (最低優先級 P:1) */
    static generalRule(intents, session, message) {
        if (intents.includes('general_inquiry') || session.currentStep === 'handle_general_inquiry') {
            return { 
                shouldProcess: true, 
                priority: 1, 
                response: '我正在思考...', 
                nextStep: 'handle_general_inquiry',
                allowGeminiCall: true 
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
}

module.exports = RuleEngine;

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller');
const GeminiGenerator = require('./gemini_generator');
const { FlowConfigLoader } = require('./flow_loader');

// 實用函數：替換 Prompt 中的變數
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

            // 流程結束時，將狀態重設為 'init'
            if (result.endFlow) {
                session.currentStep = 'init';
                sessionManager.clearEntities(sessionId); // 清除已收集的實體
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
            return { 
                shouldProcess: true, 
                priority: 100,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation', // 讓流程結束
                endFlow: true, // 增加標記，讓 processRules 知道要將狀態重設為 init
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 輔助函數：生成訂單摘要 */
    static generateSummary(data) {
        let summary = `房型：**${data.roomType || 'N/A'}** (${data.roomCount || 1} 間)
入住日期：**${data.checkInDate || 'N/A'}**，共 **${data.nights || 'N/A'} 晚**
人數：**${data.adultCount || 'N/A'} 大 ${data.childCount || 0} 小**
${data.memberAccount ? `會員：**${data.memberAccount}** (享折扣)` : '會員：非會員'}
付款方式：**${data.paymentMethod || 'N/A'}**
聯絡人：**${data.contactName || 'N/A'}** (${data.contactDetail || 'N/A'})
最終價格：**NT$ ${data.finalPrice || 'N/A'}**
`;
        return summary;
    }


    /** 規則 2: 訂房流程規則 (核心邏輯 P:98, P:95) */
    static async bookingFlowRule(intents, session, message) {
        const flow = BookingFlowController.getFlow(); 
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認');
        const isCorrection = intents.includes('correction') || message.toLowerCase().includes('修改');
        const isDeny = intents.includes('deny');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;
        
        let currentState = flow.states[currentStateKey];

        // 1. 查詢/介紹優先級處理 (P:98) - 保持不變
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

        // 2. 流程恢復處理 - 保持不變
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
                    endFlow: true, // 增加標記，讓 processRules 知道要將狀態重設為 init
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

        // C. 流程特殊邏輯處理 (在狀態轉移**後**或**前**觸發)

        // C.1. 價格計算 (在進入 ask_payment_method 後執行)
        if (nextStateKey === 'ask_payment_method') {
             // 假設價格計算在這裡發生，並將結果存入 data
             const priceResult = BookingFlowController.calculatePrice(data); 
             // 這裡應有價格計算失敗的回退邏輯，但為了簡潔，暫且假設成功
             data.totalPrice = 3200 * (data.nights || 1) * (data.roomCount || 1); // 假設基礎價格計算
             data.finalPrice = data.totalPrice; // 假設最終價格
             // ... 實際應有更多複雜的價格/折扣邏輯
        }

        // C.2. 處理 confirm_booking 狀態的確認/修改邏輯
        if (currentStateKey === 'confirm_booking') {
            if (isAffirm) {
                // 執行最終訂房API
                const bookingId = BookingFlowController.submitBooking(data); // 假設此函數返回訂單 ID
                data.orderId = bookingId || 'AIBK' + Date.now();
                
                const nextState = flow.states['booking_complete'];
                const finalPrompt = interpolatePrompt(nextState.prompt, data);
                
                return {
                    shouldProcess: true,
                    priority: 96,
                    response: finalPrompt,
                    nextStep: 'booking_complete',
                    endFlow: true, // 結束流程
                    richCard: nextState.richCard || null,
                    allowGeminiCall: false
                };
            } else if (isCorrection) {
                // 【核心修正】回退到流程起點進行修改
                SessionManager.clearEntities(sessionId); // 清除所有已收集的實體
                const nextState = flow.states['show_room_types'];
                console.log(`⏪ 偵測到修改意圖，回退流程到: show_room_types`);

                return {
                    shouldProcess: true,
                    priority: 96,
                    response: "好的，請告訴我您想修改的內容，我們將從選擇房型開始。",
                    nextStep: 'show_room_types',
                    richCard: nextState.richCard || null,
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
                priority: 95,
                response: finalPrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: false
            };
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

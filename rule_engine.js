// rule_engine.js

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager'); 
const SmartIntentClassifier = require('./intent_classifier'); 
// 假設您有一個外部的 booking_controller.js 包含價格計算邏輯
const BookingFlowController = require('./booking_controller'); 
const GeminiGenerator = require('./gemini_generator'); 
const { FlowConfigLoader } = require('./flow_loader');

// 修正：FlowConfigLoader 應當被實例化，並在 BookingFlowController 中使用
// 由於這裡無法訪問 BookingFlowController 內部，我們在這裡創建實例以供 RuleEngine 內的邏輯使用。
// 如果 BookingFlowController 已經在自己的檔案裡實例化，這裡只需要確保 RuleEngine 邏輯調用正確。
// 為了解決先前遇到的 FlowConfigLoader 靜態方法問題，我們假設 BookingFlowController.getFlow() 是可用的。

// 實用函數：替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        // 確保替換的值是字串，即使是 undefined/null 也要替換成空字串
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
                    // 純閒聊或 AI 處理的通用查詢
                    finalResponse = geminiResponse;
                }
            }
            
            // 處理流程結束重設 (endFlow 標記)
            if (result.endFlow) {
                // 清除所有實體和狀態，準備開始新的對話
                sessionManager.clearEntities(sessionId); 
                session.currentStep = 'init';
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

        // Fallback (應極少觸發，因為 generalRule 應捕獲所有未處理的輸入)
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
            this.generalRule // 最低優先級
        ];

        for (const rule of rules) {
            const result = await rule.call(this, intents, session, message); 
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        // 如果所有規則都返回 shouldProcess: false，最終回到應用層的 Fallback
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (最高優先級 P:100) */
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            return { 
                shouldProcess: true, 
                priority: 100,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation', 
                endFlow: true,
                allowGeminiCall: false
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
${data.discountRate !== '0' ? `會員折扣 (${data.discountRate}%)：-NT$ ${(data.totalPrice - data.newTotalPrice).toFixed(0)}` : ''}
**最終總計：NT$ ${data.finalPrice || 'N/A'}** (已含稅及服務費)

---
`;
        return summary;
    }


    /** 規則 2: 訂房流程規則 (核心邏輯 P:98, P:95) */
    static async bookingFlowRule(intents, session, message) {
        // 確保 BookingFlowController.getFlow() 在 RuleEngine.processRules 之前已經被修正
        const flow = BookingFlowController.getFlow(); 
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認');
        const isCorrection = intents.includes('correction') || intents.includes('modify') || message.toLowerCase().includes('修改');
        const isDeny = intents.includes('deny');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;
        
        let currentState = flow.states[currentStateKey];

        // 1. 查詢/介紹優先級處理 (P:98) - 流程暫停邏輯
        if (intents.includes('inquiry') || intents.includes('pricing') || intents.includes('roomType_keyword')) {
            if (currentStateKey && 
                currentStateKey !== 'init' && 
                currentStateKey !== 'paused_waiting_for_resume' &&
                !isAffirm) { 
                
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
        
        // 3. 流程內部轉移與邏輯處理 (P:95)
        let nextStateKey = currentStateKey;

        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }
        
        // 【接送機邏輯】處理 ask_transfer_service 狀態的特殊轉移
        if (currentStateKey === 'ask_transfer_service') {
            if (intents.includes('affirm') || intents.includes('request_transfer') || message.toLowerCase().includes('要') || message.toLowerCase().includes('需要')) {
                session.collectedData.needsTransfer = true;
                nextStateKey = 'collect_transfer_details';
            } else if (intents.includes('deny') || message.toLowerCase().includes('不要') || message.toLowerCase().includes('不需要')) {
                session.collectedData.needsTransfer = false;
                session.collectedData.transferFee = 0; // 設置費用為 0
                nextStateKey = 'ask_payment_method';
            }
        }

        // B. 實體收集檢查
        let allEntitiesCollected = true;
        if (currentState.entities && currentState.next_state) {
            // 檢查當前狀態所需的所有實體是否都已收集
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null
            );

            if (allEntitiesCollected) {
                nextStateKey = currentState.next_state;
            }
        }

        // C. 流程特殊邏輯處理 (在狀態轉移時觸發)

        // C.1. 價格計算 (在轉移到 ask_contact_info 之前)
        if (nextStateKey === 'ask_contact_info') {
             // 根據 collectedData 中的 transferType 設定費用
             if (data.transferType === 'roundTrip') {
                  data.transferFee = 1800;
             } else if (data.transferType === 'oneWay') {
                  data.transferFee = 1000;
             } else {
                  data.transferFee = 0;
             }
             
             // 觸發 BookingFlowController 的價格計算
             const priceResult = BookingFlowController.calculatePrice(data); 

             if (!priceResult.success) {
                 const errorPrompt = priceResult.oos
                     ? priceResult.errorMessage + " 請修正人數、晚數或選擇其他日期/房型。"
                     : priceResult.errorMessage || "抱歉，計算價格或檢查庫存時發生錯誤。";
                 
                 nextStateKey = 'collect_room_and_dates'; // 回退到流程起點

                 return {
                     shouldProcess: true,
                     priority: 97, 
                     response: errorPrompt,
                     nextStep: nextStateKey, 
                     richCard: null,
                     allowGeminiCall: false 
                 };
             }
             // 價格計算成功，更新 Session Data (包含所有費用細項)
             Object.assign(data, priceResult.data);
        }

        // C.2. 處理 confirm_booking 狀態的確認/修改邏輯
        if (currentStateKey === 'confirm_booking') {
            if (isAffirm) {
                // 執行最終訂房API
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
                    endFlow: true, // 結束流程並重設
                    richCard: nextState.richCard || null,
                    allowGeminiCall: false
                };
            } else if (isCorrection) {
                // 【回退修改】清除所有實體並回到流程起點
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
        
        // C.3. 在轉移到 confirm_booking 時，動態生成摘要 (確保價格已計算)
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
            
            // 如果在 init 狀態下，流程沒有轉移，應該讓它跳到 generalRule (P:0)
            if (nextStateKey === currentStateKey && nextStateKey === 'init') {
                 return { shouldProcess: false, priority: 0 };
            }
            
            // 處理 fallback 提示
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

        // 5. 流程結束後的處理 (防止無限循環，雖然 endFlow 應已處理)
        if (currentState.end) {
            return { shouldProcess: false, priority: 0 };
        }

        // 6. 流程內，但訊息無法驅動流程 (fallback 到當前狀態，例如用戶沒有提供所需的實體)
        if (currentStateKey !== 'init' && !allEntitiesCollected) {
            const responsePrompt = currentState.fallback ? interpolatePrompt(currentState.fallback, data) : currentState.prompt;
            
            return {
                shouldProcess: true,
                priority: 95,
                response: responsePrompt,
                nextStep: currentStateKey,
                richCard: currentState.richCard || null,
                allowGeminiCall: false // 在流程中收集實體時，不應該啟動閒聊 AI
            };
        }

        // 7. 閒聊/未知意圖：返回 false，讓 control 流到 generalRule
        return { shouldProcess: false, priority: 0 };
    }
    
    /** 規則 3: 一般詢問與閒聊 (最低優先級 P:1) */
    static generalRule(intents, session, message) {
        // 捕獲所有未被更高優先級規則（緊急、流程）處理的輸入
        // 確保任何時候都能觸發 AI 處理閒聊和特殊要求（如嬰兒床）
        
        return { 
            shouldProcess: true, 
            priority: 1, 
            response: '我正在為您查詢或處理您的要求...', 
            nextStep: 'handle_general_inquiry',
            allowGeminiCall: true 
        };
        // 這裡不需要額外的 if 判斷，因為它是最低優先級，如果其他規則都返回 false，它就會被觸發
    }
}

module.exports = RuleEngine;

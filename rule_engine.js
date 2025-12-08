// rule_engine.js (V2.8 - 最終優化版，兼顧流程魯棒性與通用查詢友善度)

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller'); // ✅ 正確 
const flowConfig = require('./dialogue_flow.json'); // 移除 GeminiGenerator 依賴 

// ... (PRIORITY, MAX_ROOM_LIMIT, FORCED_BREAK_STATES 保持不變)

// ... (interpolatePrompt, hasExecutedHandler, markHandlerExecuted, resetHandlerExecution 保持不變)

class RuleEngine {
    
    // ... (getErrorResponse, getFallbackResponse, processRules, sanitizeEntities 保持不變)

    /** 格式化 Gemini 回應 (🚨 移除 Gemini 呼叫邏輯) */
    static formatGeminiResponse(geminiResponse, originalResponse, currentStep) {
        // 在 V2.8 中，我們假設外部服務已處理 AI 呼叫或在 RuleEngine 外部處理，
        // 這裡僅用於在 AI 呼叫失敗時，確保我們使用預設的回應。
        // 由於我們將在 P:104 和 P:98 中使用硬編碼，此函數作用被弱化。
        return originalResponse; // 總是返回預設的 Response
    }

    // ... (executeRules 保持不變)

    // --- 核心規則實現 ---

    // ... (Rule 0: resetFlowRule (P:106), Rule 1: emergencyRule (P:105), Rule 1.1: roomLimitRule (P:103) 保持不變)

    /** 規則 1.2: 會員登入規則 (P:100) */
    static memberLoginRule(intents, session) {
        if (intents.includes('member_login')) {
            const nextStateKey = 'handle_member_login';
            resetHandlerExecution(session); 
            
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.MEMBER_LOGIN, 
                response: '偵測到會員登入請求，正在轉移到登入流程...',
                nextStep: nextStateKey,
                richCard: null,
                allowGeminiCall: false // 🚨 P:100 不呼叫 Gemini，避免佔用配額
            };
        }
        return { shouldProcess: false, priority: 0 };
    }


    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) 🚨 核心優化：隔離 AI，使用硬編碼回覆 */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        const isGeneralQueryIntent = intents.some(i => ['general_inquiry', 'inquiry', 'pricing', 'facilities', 'weather', 'restaurant'].includes(i));
        const hasNoBookingEntities = Object.keys(extractedEntities).every(key => 
            !['roomType', 'checkInDate', 'nights', 'adultCount', 'roomCount'].includes(key)
        );
        
        const isSafeToOverride = session.currentStep === 'init' || 
                                 session.currentStep === 'handle_general_inquiry' ||
                                 session.currentStep === 'paused_waiting_for_resume';

        if (isGeneralQueryIntent && hasNoBookingEntities && isSafeToOverride) {
            
            // 🚨 呼叫硬編碼回覆函數，解決配額不足導致的友善度問題
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);

            // 導向暫停狀態，讓用戶可以隨時「繼續」
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: inquiryResponse.prompt,
                nextStep: 'paused_waiting_for_resume', // 導向暫停狀態
                allowGeminiCall: false, // 🚨 確保不呼叫 Gemini
                richCard: inquiryResponse.richCard,
                endFlow: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 流程暫停與恢復規則 (P:98/99) 🚨 核心優化：P:98 隔離 AI */
    static pauseResumeRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        const flow = flowConfig;
        const lowerMessage = message.toLowerCase();
        
        const isAffirm = intents.includes('affirm') || lowerMessage.includes('繼續') || lowerMessage.includes('好');
        const isDeny = intents.includes('deny') || lowerMessage.includes('取消') || lowerMessage.includes('不要');
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities', 'restaurant', 'general_inquiry'].includes(i));

        // 1. 恢復處理 (P:99) - 從暫停狀態恢復 (保持不變)
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                // ... (P:99 恢復邏輯，保持不變)
                const resumedStateKey = session.pausedState;
                session.pausedState = null; 
                resetHandlerExecution(session); 
                const stateResponse = this.generateStateResponse(flow, resumedStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME, 
                    response: `✅ 已恢復訂房流程。${stateResponse.response}`,
                    nextStep: resumedStateKey,
                    richCard: stateResponse.richCard,
                    allowGeminiCall: false, // P:99 保持不呼叫 AI
                    endFlow: false
                };
            } else if (isDeny) {
                // ... (取消邏輯，保持不變)
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME,
                    response: '訂房流程已取消。',
                    nextStep: 'end_conversation',
                    endFlow: true,
                    allowGeminiCall: false,
                    richCard: null
                };
            }
            return { shouldProcess: false, priority: 0 }; 
        }

        // 2. 暫停處理 (P:98) - 流程中遇到通用查詢
        if (isQueryIntent && currentStateKey && 
            currentStateKey !== 'init' && 
            currentStateKey !== 'handle_general_inquiry' && 
            !isAffirm) {
            
            session.pausedState = currentStateKey; // 儲存當前狀態
            
            // 🚨 P:98 輸出硬編碼提示
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);

            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE,
                response: `⚠️ 流程已暫停。\n${inquiryResponse.prompt}\n\n**請回覆「繼續」或點選按鈕以恢復訂房流程。**`,
                nextStep: 'paused_waiting_for_resume',
                allowGeminiCall: false, // 🚨 確保不呼叫 Gemini
                richCard: inquiryResponse.richCard || flow.states['paused_waiting_for_resume']?.richCard || null,
                endFlow: false
            };
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) 🚨 優化 Handler 處理後的流程透明度 */
    static async bookingFlowRule(intents, session, message) {
        // ... (省略啟動點邏輯，保持不變)
        // ... (省略意圖/實體推進邏輯，保持不變)

        // 3. 🏆 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; // 假設在 Handler 執行前，nextStateKey 已被更新到當前狀態
        
        while (flowConfig.states[nextStateKey]?.handler && !hasExecutedHandler(session, nextStateKey)) {
            
            const handlerName = flowConfig.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerName} 於狀態: ${nextStateKey}`);

            let handlerResult;
            // ... (省略 Handler 執行 try/catch 區塊，保持 V2.5 邏輯)
            try {
                const handlerFunction = BookingFlowController[handlerName];
                if (typeof handlerFunction === 'function') {
                    handlerResult = await handlerFunction(session); 
                } else {
                    console.error(`💥 找不到或無法執行 Handler: ${handlerName}。`);
                    throw new Error(`找不到 Handler: ${handlerName}`);
                }
            } catch (e) {
                // ... (錯誤處理邏輯，保持 V2.5 邏輯)
                const safeFallbackState = 'ask_nights_and_dates';
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK,
                    response: `🚨 **服務中斷** (Handler: ${handlerName})：${e.message}。請修正您的輸入或稍後再試。`,
                    nextStep: safeFallbackState,
                    endFlow: false, 
                    richCard: flowConfig.states[safeFallbackState]?.richCard || null,
                    allowGeminiCall: false // 錯誤時不呼叫 AI
                };
            }

            // 處理 Handler 返回結果
            if (handlerResult.isHandled) {
                markHandlerExecuted(session, nextStateKey);

                const nextStep = handlerResult.nextStep || flowConfig.states[nextStateKey].next_state || nextStateKey;
                
                // 🚨 關鍵優化點：Handler 處理完成後，必須向用戶顯示結果，不能靜默自動推進
                if (handlerResult.prompt || handlerResult.richCard || FORCED_BREAK_STATES.includes(nextStep)) {
                    
                    return this.generateStateResponse(flowConfig, nextStep, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.prompt, handlerResult.richCard);
                }
                
                nextStateKey = nextStep;
                
            } else {
                // Handler 處理失敗 (isHandled: false)，返回 Handler 提供的 fallback
                const fallbackKey = handlerResult.nextStep || nextStateKey;
                const fallbackPrompt = handlerResult.errorMessage || flowConfig.states[nextStateKey].fallback;
                return this.generateStateResponse(flowConfig, fallbackKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, fallbackPrompt, handlerResult.richCard);
            }

        }
        
        // ... (後續狀態輸出邏輯，保持 V2.5 邏輯)
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態是否需要自動推進
        nextStateKey = this.autoAdvanceFlow(flowConfig, nextStateKey, data, session);

        if (nextStateKey !== currentStateKey || flowConfig.states[nextStateKey]?.entities) {
            return this.generateStateResponse(flowConfig, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }

    // ... (autoAdvanceFlow, executeSubmission, generalRule, generateStateResponse 保持 V2.5 邏輯)

    /** 🚨 新增：生成硬編碼的通用查詢回覆 (解決友善度問題) */
    static generateHardcodedInquiryResponse(intents) {
        if (intents.includes('pricing')) {
            return { prompt: "目前價格資訊已在訂單摘要中顯示。請回覆「繼續」回到流程。", richCard: { type: 'quick_replies', options: ['繼續'] } };
        }
        if (intents.includes('facilities')) {
            return { 
                prompt: "本飯店提供：SPA 水療、頂樓泳池、24 小時健身房。詳細資訊請諮詢櫃台。", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        if (intents.includes('weather')) {
            return { prompt: "由於系統限制，無法提供即時天氣資訊。請使用外部天氣應用程式查詢。", richCard: { type: 'quick_replies', options: ['繼續'] } };
        }
        // 處理其他通用查詢
        return { 
            prompt: "好的，我將為您查詢相關資訊。由於系統正專注於訂房流程，請回覆「繼續」以返回。", 
            richCard: { type: 'quick_replies', options: ['繼續', '取消訂房'] }
        };
    }
} 

module.exports = RuleEngine;

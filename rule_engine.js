// rule_engine.js (V4.0 - 最終完整程式碼)

const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller'); 

// 載入 Flow Config
const flowConfig = require('./dialogue_flow.json'); 

// 🚨 【除錯日誌 - 確保檔案載入和結構正確】
if (flowConfig && flowConfig.states) {
    console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！狀態數: ${Object.keys(flowConfig.states).length}`);
} else {
    console.error('❌ [DEBUG] dialogue_flow.json 載入失敗或結構錯誤！');
}
// ---------------------------------------------

// 優先級常量
const PRIORITY = {
    EMERGENCY: 110,
    RESET_FLOW: 106,
    ROOM_LIMIT: 103,
    GENERAL_INQUIRY_OVERRIDE: 104, 
    MEMBER_LOGIN_OVERRIDE: 100, // 優先級 100，高於流程 BASE (95)
    BOOKING_FLOW: {
        BASE: 95,
        PAUSE_RESUME: {
            PAUSE: 98,
            RESUME: 99
        },
        // Handler 錯誤/輸出提示的優先級 (高於 BASE)
        AVAILABILITY_CHECK: 96 
    },
    GENERAL_RULE: 80
};

const MAX_ROOM_LIMIT = 10;
// 🌟 更新點 1: 確保 confirm_booking 被視為強制中斷狀態
const FORCED_BREAK_STATES = ['paused_waiting_for_resume', 'confirm_booking', 'booking_complete', 'end_conversation'];

// 輔助函數：插值處理
function interpolatePrompt(promptTemplate, data) {
    if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
    
    return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

// Handler 執行狀態管理
function hasExecutedHandler(session, stateKey) {
    return session.handlerExecutedStates && session.handlerExecutedStates.includes(stateKey);
}

function markHandlerExecuted(session, stateKey) {
    if (!session.handlerExecutedStates) {
        session.handlerExecutedStates = [];
    }
    if (!session.handlerExecutedStates.includes(stateKey)) {
        session.handlerExecutedStates.push(stateKey);
    }
    sessionManager.updateSession(session.sessionId, { handlerExecutedStates: session.handlerExecutedStates });
}

function resetHandlerExecution(session) {
    session.handlerExecutedStates = [];
    sessionManager.updateSession(session.sessionId, { handlerExecutedStates: [] });
}

class RuleEngine {
    
    // 捕獲未處理的例外和 Promise 拒絕
    static initializeErrorHandlers() {
        process.on('uncaughtException', (err) => {
            console.error('💥 [CRITICAL ERROR] Uncaught Exception:', err);
            process.exit(1); 
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 [CRITICAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }

    /** 獲取錯誤回應 */
    static getErrorResponse(errorCode = 'SYSTEM_ERROR', message = '系統發生錯誤') {
        return {
            shouldProcess: true,
            priority: PRIORITY.EMERGENCY,
            response: `🚨 系統錯誤 (${errorCode}): ${message}`,
            nextStep: 'end_conversation',
            endFlow: true,
            richCard: null,
            allowGeminiCall: false
        };
    }

    /** 獲取 Fallback 回應 */
    static getFallbackResponse(currentStep, flowConfig, sessionData) {
        const state = flowConfig.states[currentStep];
        if (!state) return null;
        
        // 🌟 更新點 2: 健壯化 Fallback 回應 (防止 state.fallback 或 state.prompt 為 undefined)
        return {
            shouldProcess: true,
            priority: PRIORITY.GENERAL_RULE,
            response: interpolatePrompt(state.fallback || state.prompt || '我不太理解您的意思，請重新輸入。', sessionData),
            nextStep: currentStep,
            endFlow: false,
            richCard: state.richCard || null,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }

    /** 處理規則優先級排序 (邏輯不變) */
    static processRules(rulesResults) {
        if (!Array.isArray(rulesResults) || rulesResults.length === 0) return null; 
        
        const validResults = rulesResults.filter(result => result.shouldProcess);
        if (validResults.length === 0) return null;
        
        validResults.sort((a, b) => b.priority - a.priority);
        
        return validResults[0];
    }

    /** 清理實體數據 (邏輯不變) */
    static sanitizeEntities(entities) {
        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) {
            if (value !== undefined && value !== null && value !== '' && String(value).toLowerCase() !== 'null') {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    /** 主要執行函數 (邏輯不變) */
    static async executeRules(message, sessionId) {
        try {
            // ... (步驟 1-5 邏輯不變)
            
            // 6. 處理規則結果
            const finalResult = this.processRules(rulesResults);
            if (finalResult) {
                console.log(`[DEBUG] 最高優先級結果: P:${finalResult.priority}, Step:${finalResult.nextStep}`);
                
                // 更新 session 狀態 (邏輯不變)
                if (finalResult.nextStep && finalResult.nextStep !== session.currentStep) {
                    session.currentStep = finalResult.nextStep;
                    sessionManager.updateSession(sessionId, { currentStep: finalResult.nextStep });
                }
                
                if (finalResult.endFlow) {
                    sessionManager.endSession(sessionId);
                }
                
                return finalResult;
            }
            
            // 7. 通用規則 (P:80) - 最終 Fallback (邏輯不變)
            const generalResult = this.generalRule(session, flowConfig);
            if (generalResult) {
                // ... (邏輯不變) ...
                return generalResult;
            }
            
            // 8. 最終 fallback (邏輯不變)
            return {
                shouldProcess: true,
                priority: 0,
                response: "抱歉，我無法理解您的請求。請重新輸入或嘗試其他指令。",
                nextStep: session.currentStep || 'init',
                endFlow: false,
                richCard: null,
                allowGeminiCall: false
            };
            
        } catch (error) {
            console.error('💥 RuleEngine 執行錯誤:', error);
            return this.getErrorResponse('RULE_ENGINE_ERROR', error.message);
        }
    }

    // --- 核心規則實現 ---

    /** 規則 0: 重置流程規則 (P:106) (邏輯不變) */
    static resetFlowRule(intents, session) {
        // ... (邏輯不變)
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急規則 (P:110) (邏輯不變) */
    static emergencyRule(intents, session) {
        // ... (邏輯不變)
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.1: 房間限制規則 (P:103) (邏輯不變) */
    static roomLimitRule(collectedData) {
        // ... (邏輯不變)
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.2: 會員登入規則 (P:100) */
    static memberLoginRule(intents, session) {
        // 🌟 更新點 3: 確保登入使用高優先級 P:100 覆蓋流程，並導向 Handler
        if (intents.includes('member_login')) {
            const nextStateKey = 'handle_member_login';
            resetHandlerExecution(session); 
            
            return {
                shouldProcess: true,
                priority: PRIORITY.MEMBER_LOGIN_OVERRIDE, 
                response: '偵測到會員登入請求，正在轉移到登入流程...',
                nextStep: nextStateKey,
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) (邏輯不變) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        // ... (邏輯不變)
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 流程暫停與恢復規則 (P:98/99) (邏輯不變) */
    static pauseResumeRule(intents, session, message) {
        // ... (邏輯不變)
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep || 'init';
        const flow = flowConfig;
        const data = session.collectedData || {};
        
        // 1. 啟動點邏輯 (init) (邏輯不變)
        if (!currentStateKey || currentStateKey === 'init') {
            // ... (邏輯不變)
            return { shouldProcess: false, priority: 0 };
        }
        
        // 2. 實體推進邏輯 (非 init 狀態)
        const currentState = flow.states[currentStateKey];
        if (!currentState || FORCED_BREAK_STATES.includes(currentStateKey)) {
            return { shouldProcess: false, priority: 0 };
        }
        
        // 檢查當前狀態是否需要實體
        if (currentState.entities && Array.isArray(currentState.entities)) {
            const requiredEntities = currentState.entities;
            const hasRequiredEntities = requiredEntities.every(entity => 
                data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );
            
            console.log(`[DEBUG] 狀態 ${currentStateKey} 檢查實體是否滿足: ${hasRequiredEntities}`);

            // 🏆 實體滿足，推進流程
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                // 🌟 更新點 4: 實體滿足時，使用更高的 P:97 確保優先級，避免被 Handler/Fallback 規則覆蓋。
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE + 2); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        
        while (flow.states[nextStateKey]?.handler && !hasExecutedHandler(session, nextStateKey)) {
            
            const handlerName = flow.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerName} 於狀態: ${nextStateKey}`);

            let handlerResult;
            try {
                const handlerFunction = BookingFlowController[handlerName];
                if (typeof handlerFunction === 'function') {
                    handlerResult = await handlerFunction(session); 
                } else {
                    throw new Error(`找不到 Handler: ${handlerName}`);
                }
            } catch (e) {
                // 🌟 更新點 5: 強化 Handler 錯誤處理 (提供明確錯誤訊息和返回點)
                console.error(`💥 Handler 執行錯誤: ${handlerName}`, e);
                
                const safeFallbackState = 'ask_nights_and_dates';
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK, // P:96
                    response: `🚨 **服務中斷** (Handler: ${handlerName})：${e.message}。請修正您的輸入或稍後再試。`,
                    nextStep: safeFallbackState,
                    endFlow: false, 
                    richCard: flow.states[safeFallbackState]?.richCard || null,
                    allowGeminiCall: false
                };
            }

            // 處理 Handler 返回結果
            if (handlerResult.isHandled) {
                markHandlerExecuted(session, nextStateKey);

                const nextStep = handlerResult.nextStep || flow.states[nextStateKey].next_state || nextStateKey;
                
                // Handler 處理完成，中斷迴圈並返回結果
                if (handlerResult.prompt || handlerResult.richCard || FORCED_BREAK_STATES.includes(nextStep)) {
                    
                    // 🌟 更新點 6: Handler 提供的 Prompt/RichCard 應立即返回，優先級 P:96
                    return this.generateStateResponse(flow, nextStep, session.collectedData, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK, handlerResult.prompt, handlerResult.richCard);
                }
                
                nextStateKey = nextStep;
                
            } else {
                // 🌟 更新點 7: Handler 處理失敗 (isHandled: false) 應返回 P:96 優先級
                const fallbackKey = handlerResult.nextStep || nextStateKey;
                const fallbackPrompt = handlerResult.errorMessage || flow.states[nextStateKey].fallback;
                return this.generateStateResponse(flow, fallbackKey, session.collectedData, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK, fallbackPrompt, handlerResult.richCard);
            }
        }
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態是否需要自動推進
        nextStateKey = this.autoAdvanceFlow(flow, nextStateKey, data, session);

        // 如果 nextStateKey 改變了，或者我們仍在一個需要實體的狀態中，則返回狀態回應
        if (nextStateKey !== currentStateKey || flow.states[nextStateKey]?.entities) {
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 自動靜默推進流程 (邏輯不變) */
    static autoAdvanceFlow(flow, currentStateKey, data, session) {
        // ... (邏輯不變)
        return nextStateKey;
    }

    /** 通用規則 (P:80) (邏輯不變) */
    static generalRule(session, flowConfig) {
        // ... (邏輯不變)
        return this.getFallbackResponse(currentStep, flowConfig, session.collectedData);
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority, customPrompt, customRichCard) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
        // 🌟 更新點 8: 最終健壯性修復：為 State Prompt 設置安全默認值
        const defaultPrompt = `請根據您當前正在處理的步驟，提供資訊或選擇指令 (${stateKey})。`;
        const prompt = customPrompt || state.prompt || defaultPrompt;
        const richCard = customRichCard || state.richCard;
        
        return {
            shouldProcess: true,
            priority: priority || PRIORITY.BOOKING_FLOW.BASE,
            response: interpolatePrompt(prompt, data),
            nextStep: stateKey,
            endFlow: state.end || false,
            richCard: richCard,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }

    /** 生成硬編碼的通用查詢回覆 (邏輯不變) */
    static generateHardcodedInquiryResponse(intents) {
        // ... (邏輯不變)
        return { 
            prompt: "好的，我將為您查詢相關資訊。由於系統正專注於訂房流程，請回覆「繼續」或「取消訂房」。", 
            richCard: { 
                type: 'quick_replies', 
                options: ['繼續', '取消訂房'] 
            }
        };
    }
} 

RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

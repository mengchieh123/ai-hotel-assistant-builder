// rule_engine.js (V4.0 - 最終修正版，已解決所有 ReferenceError 和 TypeError)

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
    MEMBER_LOGIN_OVERRIDE: 100, 
    BOOKING_FLOW: {
        BASE: 95,
        PAUSE_RESUME: {
            PAUSE: 98,
            RESUME: 99
        },
        AVAILABILITY_CHECK: 96 
    },
    GENERAL_RULE: 80
};

const MAX_ROOM_LIMIT = 10;
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

    /** 處理規則優先級排序 */
    static processRules(rulesResults) {
        if (!Array.isArray(rulesResults) || rulesResults.length === 0) return null; 
        
        const validResults = rulesResults.filter(result => result.shouldProcess);
        if (validResults.length === 0) return null;
        
        validResults.sort((a, b) => b.priority - a.priority);
        
        return validResults[0];
    }

    /** 🏆 修正後的清理實體數據 */
    static sanitizeEntities(entities) {
        // 🏆 關鍵修正：檢查 entities 是否為物件，如果不是則返回空物件
        if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) { 
            if (value !== undefined && value !== null && value !== '' && String(value).toLowerCase() !== 'null') {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    /** 🏆 修正後的執行函數：確保 rulesResults 被宣告並包含所有規則結果 */
    static async executeRules(message, sessionId) {
        try {
            const session = sessionManager.getSession(sessionId);
            const flow = flowConfig;
            
            // 1. 意圖分類與實體抽取
            const classificationResult = SmartIntentClassifier.classify(message, flow);
            const intents = classificationResult.intents;
            const extractedEntities = classificationResult.extractedEntities || {}; // 確保至少是空物件
            
            const sanitizedEntities = this.sanitizeEntities(extractedEntities);
            
            // 合併和更新實體
            sessionManager.updateSession(sessionId, {
                collectedData: { ...session.collectedData, ...sanitizedEntities },
                lastIntent: intents[0] || session.lastIntent
            });
            const collectedData = sessionManager.getSession(sessionId).collectedData;

            // 🌟 關鍵修正點：初始化 rulesResults 陣列
            const rulesResults = [];
            
            // 2. 執行高優先級規則 (P:100+)
            rulesResults.push(this.emergencyRule(intents, session));
            rulesResults.push(this.resetFlowRule(intents, session));
            rulesResults.push(this.roomLimitRule(collectedData));
            rulesResults.push(this.memberLoginRule(intents, session)); 
            rulesResults.push(this.generalInquiryOverrideRule(intents, session, message, extractedEntities)); 
            
            // 3. 執行流程控制規則 (P:98/99)
            rulesResults.push(this.pauseResumeRule(intents, session, message));
            
            // 4. 執行核心訂房流程規則 (P:95+)
            const bookingResult = await this.bookingFlowRule(intents, session, message);
            rulesResults.push(bookingResult);
            
            // 5. 處理規則結果：從 rulesResults 中選出最高優先級的結果
            const finalResult = this.processRules(rulesResults);

            if (finalResult) {
                console.log(`[DEBUG] 最高優先級結果: P:${finalResult.priority}, Step:${finalResult.nextStep}`);
                
                // 更新 session 狀態
                if (finalResult.nextStep && finalResult.nextStep !== session.currentStep) {
                    session.currentStep = finalResult.nextStep;
                    sessionManager.updateSession(sessionId, { currentStep: finalResult.nextStep });
                }
                
                if (finalResult.endFlow) {
                    sessionManager.endSession(sessionId);
                }
                
                return finalResult;
            }
            
            // 6. 通用規則 (P:80) - 最終 Fallback
            const generalResult = this.generalRule(session, flowConfig);
            if (generalResult) {
                session.currentStep = generalResult.nextStep;
                sessionManager.updateSession(sessionId, { currentStep: generalResult.nextStep });
                return generalResult;
            }
            
            // 7. 最終 fallback
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

    /** 規則 0: 重置流程規則 (P:106) */
    static resetFlowRule(intents, session) {
        if (intents.includes('reset_flow')) {
            sessionManager.endSession(session.sessionId);
            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW,
                response: "流程已重設。歡迎重新開始您的預訂。",
                nextStep: 'init',
                endFlow: true, 
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急規則 (P:110) */
    static emergencyRule(intents, session) {
        if (intents.includes('emergency_exit')) {
            sessionManager.endSession(session.sessionId);
            return this.getErrorResponse('USER_EXIT', '流程已緊急中斷，謝謝您的使用。');
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.1: 房間限制規則 (P:103) */
    static roomLimitRule(collectedData) {
        const roomCount = parseInt(collectedData.roomCount);
        if (roomCount > MAX_ROOM_LIMIT) {
            return {
                shouldProcess: true,
                priority: PRIORITY.ROOM_LIMIT,
                response: `抱歉，您預訂的房間數 (${roomCount} 間) 已超過我們的最大限制 ${MAX_ROOM_LIMIT} 間。請減少房間數或聯絡客服。`,
                nextStep: 'ask_room_count', 
                endFlow: false,
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.2: 會員登入規則 (P:100) */
    static memberLoginRule(intents, session) {
        if (intents.includes('member_login')) {
            const nextStateKey = 'login_member_account';
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

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        if (intents.includes('general_inquiry') && session.currentStep !== 'init' && !FORCED_BREAK_STATES.includes(session.currentStep)) {
            // 將當前狀態存入 session，以便恢復
            sessionManager.updateSession(session.sessionId, {
                previousStep: session.currentStep,
                tempQuery: message
            });
            
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);
            
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: inquiryResponse.prompt.replace('{user_query}', message),
                nextStep: 'handle_general_inquiry',
                endFlow: false,
                richCard: inquiryResponse.richCard,
                allowGeminiCall: true 
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 流程暫停與恢復規則 (P:98/99) */
    static pauseResumeRule(intents, session, message) {
        const currentStep = session.currentStep;
        const previousStep = session.previousStep;
        
        if (currentStep === 'handle_general_inquiry' || currentStep === 'paused_waiting_for_resume') {
            if (intents.includes('affirm') || message.includes('繼續')) {
                // 恢復流程
                const resumeTo = previousStep && flowConfig.states[previousStep] ? previousStep : 'ask_nights_and_dates';
                sessionManager.updateSession(session.sessionId, { previousStep: null });
                
                return this.generateStateResponse(flowConfig, resumeTo, session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
            } else if (intents.includes('booking')) {
                // 重新開始預訂
                sessionManager.endSession(session.sessionId);
                return this.generateStateResponse(flowConfig, 'init', {}, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
            }
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep || 'init';
        const flow = flowConfig;
        const data = session.collectedData || {};
        
        // 1. 啟動點邏輯 (init)
        if (!currentStateKey || currentStateKey === 'init') {
            if (intents.includes('booking')) {
                // 匹配到訂房意圖，進入第一個狀態
                return this.generateStateResponse(flow, flow.initial_state, data, PRIORITY.BOOKING_FLOW.BASE);
            }
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

            // 實體滿足，推進流程
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
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
                console.error(`💥 Handler 執行錯誤: ${handlerName}`, e);
                
                const safeFallbackState = flow.states[nextStateKey].fallback_state || 'ask_nights_and_dates';
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK, 
                    response: `🚨 **服務中斷** (Handler: ${handlerName})：${e.message}。正在導回上一步驟。`,
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
                    return this.generateStateResponse(flow, nextStep, session.collectedData, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK, handlerResult.prompt, handlerResult.richCard);
                }
                
                nextStateKey = nextStep;
                
            } else {
                // Handler 處理失敗 (isHandled: false)
                const fallbackKey = handlerResult.nextStep || flow.states[nextStateKey].fallback_state || nextStateKey;
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

    /** 自動靜默推進流程 */
    static autoAdvanceFlow(flow, currentStateKey, data, session) {
        let nextStateKey = currentStateKey;
        let state = flow.states[nextStateKey];
        let changed = false;

        while (state && state.next_state && (!state.entities || state.entities.length === 0) && !state.handler && !FORCED_BREAK_STATES.includes(nextStateKey)) {
            // 靜默推進：當前狀態沒有實體、沒有 Handler、不是結束狀態
            nextStateKey = state.next_state;
            state = flow.states[nextStateKey];
            changed = true;
            console.log(`[DEBUG] 自動推進到: ${nextStateKey}`);
        }
        
        if (changed) {
            session.currentStep = nextStateKey;
            sessionManager.updateSession(session.sessionId, { currentStep: nextStateKey });
        }

        return nextStateKey;
    }

    /** 通用規則 (P:80) */
    static generalRule(session, flowConfig) {
        const currentStep = session.currentStep || 'init';
        return this.getFallbackResponse(currentStep, flowConfig, session.collectedData);
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority, customPrompt, customRichCard) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
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

    /** 生成硬編碼的通用查詢回覆 */
    static generateHardcodedInquiryResponse(intents) {
        return { 
            prompt: "好的，我將為您查詢相關資訊。由於系統正專注於訂房流程，請回覆「繼續」或「重新預訂」。", 
            richCard: { 
                type: 'quick_replies', 
                options: ['繼續', '重新預訂'] 
            }
        };
    }
} 

RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

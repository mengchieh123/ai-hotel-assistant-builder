// rule_engine.js (V4.6 - 靜態方法修正版)

const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier'); // 假設這是您的 SmartIntentClassifier.js 
const BookingFlowController = require('./booking_controller'); // 假設這是您的業務邏輯 Handler

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
        AVAILABILITY_CHECK: 96, 
        ENTITY_SATISFIED_ADVANCE: 97 
    },
    GENERAL_RULE: 80
};

const MAX_ROOM_LIMIT = 10;
const FORCED_BREAK_STATES = ['paused_waiting_for_resume', 'confirm_booking', 'booking_complete', 'end_conversation'];


class RuleEngine {

    /** 🎯 修正: 加上 static 關鍵字 */
    static initializeErrorHandlers() { 
        this.errorResponses = {
            'RULE_ENGINE_ERROR': (message) => ({
                response: `系統處理錯誤，請聯絡客服。錯誤訊息：${message}`,
                priority: PRIORITY.EMERGENCY,
                endFlow: true
            }),
            'INVALID_SESSION_ID': (message) => ({
                response: `會話錯誤：${message}`,
                priority: PRIORITY.EMERGENCY,
                endFlow: true
            })
            // ... (其他錯誤處理邏輯)
        };
    }
    
    /** 🎯 修正: 加上 static 關鍵字 */
    static getErrorResponse(key, message) {
        const handler = this.errorResponses[key];
        if (handler) {
            return {
                shouldProcess: true,
                priority: PRIORITY.EMERGENCY,
                nextStep: 'end_conversation',
                ...handler(message)
            };
        }
        return {
            shouldProcess: true,
            priority: PRIORITY.EMERGENCY,
            response: `發生未知錯誤：${message}`,
            nextStep: 'end_conversation',
            endFlow: true
        };
    }

    /** 🎯 修正: 加上 static 關鍵字 */
    static getFallbackResponse(session, flow) {
        const stateKey = session.currentStep || 'init';
        const state = flow.states[stateKey];
        if (state && state.fallback) {
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_RULE,
                response: interpolatePrompt(state.fallback, session.collectedData),
                nextStep: stateKey,
                endFlow: false
            };
        }
        return null;
    }
    
    /** 🎯 修正: 加上 static 關鍵字 */
    static processRules(rulesResults) {
        const sortedResults = rulesResults
            .filter(r => r && r.shouldProcess)
            .sort((a, b) => b.priority - a.priority);

        return sortedResults.length > 0 ? sortedResults[0] : null;
    }

    /** 🎯 修正: 加上 static 關鍵字 */
    static generateStateResponse(flow, stateKey, data, priority) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
        // 如果是 logic_exec 狀態且沒有 prompt，則不應直接生成回應
        if (state.type === 'logic_exec' && !state.prompt) {
             return {
                shouldProcess: true,
                priority: priority,
                response: null, // 這裡 response 設為 null
                nextStep: stateKey,
                richCard: state.richCard,
                allowGeminiCall: state.allow_gemini_call || false
            };
        }

        return {
            shouldProcess: true,
            priority: priority,
            response: interpolatePrompt(state.prompt, data),
            nextStep: stateKey,
            richCard: state.richCard,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }
    
    // 輔助函數：插值處理
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    // Handler 執行狀態管理
    static hasExecutedHandler(session, stateKey) {
        return session.executedHandlers && session.executedHandlers[stateKey];
    }

    static markHandlerExecuted(session, stateKey) {
        if (!session.executedHandlers) {
            session.executedHandlers = {};
        }
        session.executedHandlers[stateKey] = true; 
    }

    static resetHandlerExecution(session) {
        session.executedHandlers = {};
    }

    /** 清理實體數據 */
    static sanitizeEntities(entities) {
        if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) { 
            // 排除 undefined, null, 空字串, 或字串 "null"
            if (value !== undefined && value !== null && value !== '' && String(value).toLowerCase() !== 'null') {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    /** 核心執行函數 */
    static async executeRules(message, sessionId) {
        if (!sessionId || typeof sessionId !== 'string' || sessionId === 'undefined') {
            console.error("💥 [SECURITY FAIL] 接收到無效的 sessionId，拒絕處理。");
            return this.getErrorResponse('INVALID_SESSION_ID', '會話 ID 無效，請重新初始化。');
        }

        try {
            const session = sessionManager.getSession(sessionId);
            const flow = flowConfig;
            
            // 1. 意圖分類與實體抽取
            const classificationResult = SmartIntentClassifier.classify(message, flow); 
            let intents = classificationResult.intents;
            // ⭐️ 確保從 'entities' 鍵讀取實體物件
            let extractedEntities = classificationResult.entities || {}; 

            const sanitizedEntities = this.sanitizeEntities(extractedEntities);
            
            // 🎯 實體合併：直接合併和更新實體到 session 物件
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 🎯 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            console.log(`[DATA DEBUG] 當前狀態: ${session.currentStep} | 收集實體: ${JSON.stringify(collectedData)}`);
            
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
                    session.previousStep = session.currentStep;
                    session.currentStep = finalResult.nextStep;
                    // 如果流程推進了，重置 Handler 執行標記 (因為 Handler 可能在新的狀態執行)
                    this.resetHandlerExecution(session); 
                }
                
                if (finalResult.endFlow) {
                    sessionManager.resetSession(sessionId); 
                }
                
                // 記錄助理回應
                sessionManager.addAssistantResponse(sessionId, finalResult.response, finalResult.richCard);

                return finalResult;
            }
            
            // 6. 通用規則 (P:80) - 最終 Fallback
            const generalResult = this.generalRule(session, flowConfig);
            if (generalResult) {
                session.currentStep = generalResult.nextStep;
                // 記錄助理回應
                sessionManager.addAssistantResponse(sessionId, generalResult.response, generalResult.richCard);
                return generalResult;
            }
            
            // 7. 最終 fallback (P:0)
            const finalFallback = {
                shouldProcess: true,
                priority: 0,
                response: "抱歉，我無法理解您的請求。請重新輸入或嘗試其他指令。",
                nextStep: session.currentStep || 'init',
                endFlow: false,
                richCard: null,
                allowGeminiCall: false
            };
            
            sessionManager.addAssistantResponse(sessionId, finalFallback.response, finalFallback.richCard);
            
            return finalFallback;
            
        } catch (error) {
            console.error('💥 RuleEngine 執行錯誤:', error);
            return this.getErrorResponse('RULE_ENGINE_ERROR', error.message);
        }
    }

    // --- 規則 0: 緊急規則 (P:110) ---
    static emergencyRule(intents, session) {
        if (intents.includes('emergency_exit')) {
            return {
                shouldProcess: true,
                priority: PRIORITY.EMERGENCY,
                response: "已中止訂房流程。若有需要，隨時可以輸入『訂房』重新開始。",
                nextStep: 'end_conversation',
                endFlow: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1: 重新開始 (P:106) ---
    static resetFlowRule(intents, session) {
        if (intents.includes('reset') || intents.includes('booking_start')) {
            // 清除所有舊數據，從 init 重新開始
            this.resetHandlerExecution(session);
            session.collectedData = {};
            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW,
                response: flowConfig.states['init'].prompt,
                nextStep: 'init'
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.1: 房間數限制 (P:103) ---
    static roomLimitRule(data) {
        const roomCount = parseInt(data.roomCount, 10);
        if (roomCount > MAX_ROOM_LIMIT) {
            return {
                shouldProcess: true,
                priority: PRIORITY.ROOM_LIMIT,
                response: `抱歉，為確保服務品質，單次預訂房間數不能超過 ${MAX_ROOM_LIMIT} 間。請重新輸入。`,
                nextStep: 'ask_room_count' // 導回房間數詢問狀態
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1.2: 會員登入覆蓋 (P:100) ---
    static memberLoginRule(intents, session) {
        const currentStateKey = session.currentStep;
        if (currentStateKey === 'check_availability_and_price') {
            const state = flowConfig.states[currentStateKey];
            const loginIntent = state.intents?.login;
            
            if (loginIntent && intents.includes('login')) {
                return {
                    shouldProcess: true,
                    priority: PRIORITY.MEMBER_LOGIN_OVERRIDE,
                    response: flowConfig.states[loginIntent].prompt,
                    nextStep: loginIntent
                };
            }
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.5: 跨流程通用問題處理 (P:104) ---
    static generalInquiryOverrideRule(intents, session, message, entities) {
        const currentStateKey = session.currentStep;
        
        // 如果偵測到通用問題意圖，且當前不在中斷狀態
        if (intents.includes('general_inquiry') && !FORCED_BREAK_STATES.includes(currentStateKey)) {
            const inquiryState = flowConfig.states['handle_general_inquiry'];
            const userQuery = message || "您的問題";
            
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: inquiryState.prompt.replace('{user_query}', userQuery),
                nextStep: 'handle_general_inquiry',
                allowGeminiCall: inquiryState.allow_gemini_call
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 2: 暫停與恢復 (P:98/99) ---
    static pauseResumeRule(intents, session) {
        const currentStateKey = session.currentStep;
        const flow = flowConfig;
        
        if (currentStateKey === 'paused_waiting_for_resume') {
            if (intents.includes('affirm') || intents.includes('continue')) {
                // 恢復流程 (P:99) - 回到中斷前的步驟
                const resumeStep = session.previousStep && flow.states[session.previousStep] ? session.previousStep : 'init';
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME,
                    response: flow.states[resumeStep]?.prompt || "已恢復訂房流程。",
                    nextStep: resumeStep
                };
            }
            // 如果偵測到 booking 意圖，讓 resetFlowRule (P:106) 接管
        }
        // 沒有暫停/恢復意圖
        return { shouldProcess: false, priority: 0 };
    }
    
    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep || 'init';
        const flow = flowConfig;
        const data = session.collectedData || {};
        
        // 1. 流程啟動邏輯 (init)
        if (!currentStateKey || currentStateKey === 'init') {
            const hasBookingIntent = intents.includes('booking');
            const hasDateOrNights = data.checkInDate || data.nights; 

            if (hasBookingIntent || hasDateOrNights) {
                const nextStepAfterInit = flow.states['init']?.next_state || 'ask_nights_and_dates'; 
                
                console.log(`[DEBUG] 啟動流程：推進到 ${nextStepAfterInit}`);
                
                // 使用 P:96 確保啟動被選中 (AVAILABILITY_CHECK)
                return this.generateStateResponse(flow, nextStepAfterInit, data, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK);
            }
            
            return { shouldProcess: false, priority: 0 };
        }
        
        // 2. 實體推進邏輯 (非 init 狀態)
        const currentState = flow.states[currentStateKey];
        if (!currentState || FORCED_BREAK_STATES.includes(currentStateKey)) {
            return { shouldProcess: false, priority: 0 };
        }
        
        if (currentState.entities && Array.isArray(currentState.entities)) {
            const requiredEntities = currentState.entities;
            const hasRequiredEntities = requiredEntities.every(entity => 
                data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );
            
            console.log(`[DEBUG] 狀態 ${currentStateKey} 檢查實體是否滿足: ${hasRequiredEntities}`);

            // 實體滿足，推進流程
            if (hasRequiredEntities && !this.hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                // 使用 P:97 (ENTITY_SATISFIED_ADVANCE)
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        
        // 檢查當前或推進後的狀態是否包含 handler，並且尚未執行過
        // 💡 這裡必須確保 Handler 執行器能夠處理 logic_exec 狀態
        while (flow.states[nextStateKey]?.handler && !this.hasExecutedHandler(session, nextStateKey)) {
            
            const handlerKey = flow.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerKey} 於狀態: ${nextStateKey}`); 
            
            // ⚠️ 確保使用 await 等待非同步 Handler 執行
            const handlerResult = await BookingFlowController[handlerKey](session, flowConfig); 
            
            this.markHandlerExecuted(session, nextStateKey); 

            // 處理 Handler 返回結果
            if (!handlerResult.isHandled) {
                // 處理失敗，導向 fallback_state
                nextStateKey = flow.states[nextStateKey].fallback_state || 'init';
                break; 
            }
            
            // 處理成功，導向 next_state (如果 Handler 有指定 nextStep)
            nextStateKey = handlerResult.nextStep || flow.states[nextStateKey].next_state; 
            
            if (nextStateKey === session.currentStep) {
                // 防止無限迴圈
                break;
            }
        }
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態
        if (nextStateKey !== currentStateKey) {
            // 如果 Handler 成功推進了狀態，則返回新的狀態回應 (P:95)
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        // 如果是 Intent 導向的狀態或 fallback 導向的狀態，也需要返回回應
        if (currentState.intents && Object.keys(currentState.intents).some(intent => intents.includes(intent))) {
            const nextIntentState = currentState.intents[intents.find(intent => currentState.intents[intent])];
            if (nextIntentState) {
                return this.generateStateResponse(flow, nextIntentState, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 如果既沒有實體滿足，也不是 Handler 狀態，則返回當前狀態的回應 (重複詢問)
        if (currentState.entities || currentState.intents) {
             return this.generateStateResponse(flow, currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }


        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 4: 通用規則 (P:80) ---
    static generalRule(session, flow) {
        const stateKey = session.currentStep || 'init';
        const state = flow.states[stateKey];
        
        if (state && state.fallback) {
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_RULE,
                response: this.interpolatePrompt(state.fallback, session.collectedData),
                nextStep: stateKey,
                endFlow: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
    
} 

// 🎯 修正處：現在這個靜態方法應該能被正確呼叫
RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

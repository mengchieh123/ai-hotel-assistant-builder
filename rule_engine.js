// rule_engine.js (V4.5 - 最終修正版)

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

// 優先級常量 (與 V4.4 保持一致)
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

// 輔助函數：插值處理 (保持一致)
function interpolatePrompt(promptTemplate, data) {
    if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
    
    return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

// Handler 執行狀態管理 (保持一致)
function hasExecutedHandler(session, stateKey) {
    return session.executedHandlers && session.executedHandlers[stateKey];
}

function markHandlerExecuted(session, stateKey) {
    if (!session.executedHandlers) {
        session.executedHandlers = {};
    }
    session.executedHandlers[stateKey] = true; 
}

function resetHandlerExecution(session) {
    session.executedHandlers = {};
}

class RuleEngine {
    
    // ... (initializeErrorHandlers, getErrorResponse, getFallbackResponse, processRules, generateHardcodedInquiryResponse, generateStateResponse 保持一致，此處省略以保持簡潔)

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
            // ⭐️ 關鍵修正：從 'entities' 鍵讀取實體物件，解決讀取空實體的問題
            let extractedEntities = classificationResult.entities || {}; 

            // 🌟🌟🌟 【隔離測試程式碼：強制實體】V4.5 🌟🌟🌟
            if (message.includes('測試訂房')) {
                extractedEntities = {
                    checkInDate: '2025-12-15', 
                    nights: 3, 
                    adultCount: 2, 
                    roomCount: 1 
                };
                if (!intents.includes('booking')) {
                    intents = ['booking', ...intents];
                }
                console.log('[ISOLATION TEST] 已強制設定實體，模擬抽取成功。');
            }
            // 🌟🌟🌟 🌟🌟🌟 🌟🌟🌟 🌟🌟🌟

            // 🌟 【除錯點 1】查看原始輸出 (修正後這裡會顯示完整的實體)
            console.log(`[RAW ENTITY DEBUG] 原始實體: ${JSON.stringify(extractedEntities)}`);
            
            const sanitizedEntities = this.sanitizeEntities(extractedEntities);
            
            // 🎯 實體合併：直接合併和更新實體到 session 物件
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 🎯 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            // 🌟 【除錯點 2】用於除錯 RuleEngine 實際看到的實體
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
                    session.currentStep = finalResult.nextStep;
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

    // --- 核心規則實現 (Rule 0, 1, 1.1, 1.2, 1.5, 2, 3) 保持與 V4.4 一致，此處省略 ---
    
    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep || 'init';
        const flow = flowConfig;
        const data = session.collectedData || {};
        
        // 🎯 V4.3 實體驅動啟動邏輯 (init)
        if (!currentStateKey || currentStateKey === 'init') {
            const hasBookingIntent = intents.includes('booking');
            const hasDateOrNights = data.checkInDate || data.nights; 

            if (hasBookingIntent || hasDateOrNights) {
                const nextStepAfterInit = flow.states['init']?.next_state || 'ask_nights_and_dates'; 
                
                console.log(`[DEBUG] 啟動流程：偵測到意圖(${hasBookingIntent}) 或實體(${!!hasDateOrNights})，推進到 ${nextStepAfterInit}`);
                
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
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                // 使用 P:97 (ENTITY_SATISFIED_ADVANCE)
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器) - (與 V4.4 保持一致，此處省略)
        let nextStateKey = session.currentStep; 
        
        // ... (while 迴圈處理 Handler 邏輯) ...
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態是否需要自動推進
        nextStateKey = this.autoAdvanceFlow(flow, nextStateKey, data, session);

        if (nextStateKey !== currentStateKey || flow.states[nextStateKey]?.entities) {
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }
    
    // ... (其他規則函數)
    
} 

RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

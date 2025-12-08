// rule_engine.js (V4.6 - 語法修復版)

const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier'); 
const BookingFlowController = require('./booking_controller'); 
const flowConfig = require('./dialogue_flow.json'); 

// 🚨 【除錯日誌 - 確保檔案載入和結構正確】
if (flowConfig && flowConfig.states) {
    console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！狀態數: ${Object.keys(flowConfig.states).length}`);
} else {
    console.error('❌ [DEBUG] dialogue_flow.json 載入失敗或結構錯誤！');
}

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

// 輔助函數：插值處理
function interpolatePrompt(promptTemplate, data) {
    if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
    
    return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

// Handler 執行狀態管理
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

    /** 🎯 獲取 Fallback 回應 (P:80) */
    static getFallbackResponse(currentStep, flowConfig, sessionData) {
        const state = flowConfig.states[currentStep];
        if (!state) return null;
        
        const responseText = state.fallback || state.prompt || '我不太理解您的意思，請重新輸入。';

        return {
            shouldProcess: true,
            priority: PRIORITY.GENERAL_RULE,
            response: interpolatePrompt(responseText, sessionData),
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

    /** 🎯 關鍵修復：執行函數 */
    static async executeRules(message, sessionId) {
        if (!sessionId || typeof sessionId !== 'string' || sessionId === 'undefined') {
            console.error("💥 [SECURITY FAIL] 接收到無效的 sessionId，拒絕處理。");
            return this.getErrorResponse('INVALID_SESSION_ID', '會話 ID 無效，請重新初始化。');
        }

        try {
            // 1. 獲取或創建 session
            let session = sessionManager.getSession(sessionId);
            if (!session) {
                console.log(`[SESSION] 找不到現有會話，創建新會話: ${sessionId}`);
                session = sessionManager.createSession(sessionId);
            }
            
            // 2. 意圖分類與實體抽取
            const classificationResult = await SmartIntentClassifier.classify(message, session);
            let intents = classificationResult.intents || [];
            let extractedEntities = classificationResult.entities || {};

            // 🌟 除錯日誌
            console.log(`--- SmartIntentClassifier DEBUG OUTPUT ---`);
            console.log(`Intents: ${JSON.stringify(intents)}`);
            console.log(`Extracted Entities: ${JSON.stringify(extractedEntities)}`);
            console.log(`[RAW ENTITY DEBUG] 原始實體: ${JSON.stringify(extractedEntities)}`);
            
            // 清理實體
            const sanitizedEntities = this.sanitizeEntities(extractedEntities);
            console.log(`[RULE_ENGINE] 清理後實體: ${JSON.stringify(sanitizedEntities)}`);
            
            // 🎯 將實體更新到 session
            if (Object.keys(sanitizedEntities).length > 0) {
                console.log(`[RULE_ENGINE] 將實體更新到會話:`, sanitizedEntities);
                
                session.collectedData = { 
                    ...(session.collectedData || {}), 
                    ...sanitizedEntities 
                };
                
                sessionManager.updateSession(sessionId, { 
                    collectedData: session.collectedData 
                });
                
                console.log(`[RULE_ENGINE] 更新後會話實體:`, session.collectedData);
            }
            
            session.lastIntent = intents[0] || session.lastIntent;
            session.lastMessage = message;

            // 🌟 當前狀態和收集的實體
            console.log(`[DATA DEBUG] 當前狀態: ${session.currentStep} | 收集實體: ${JSON.stringify(session.collectedData)}`);
            
            // 初始化 rulesResults
            const rulesResults = [];
            
            // 3. 執行高優先級規則
            rulesResults.push(this.emergencyRule(intents, session));
            rulesResults.push(this.resetFlowRule(intents, session));
            rulesResults.push(this.roomLimitRule(session.collectedData));
            rulesResults.push(this.memberLoginRule(intents, session)); 
            rulesResults.push(this.generalInquiryOverrideRule(intents, session, message, extractedEntities)); 
            
            // 4. 執行流程控制規則
            rulesResults.push(this.pauseResumeRule(intents, session, message));
            
            // 5. 執行核心訂房流程規則
            const bookingResult = await this.bookingFlowRule(intents, session, message);
            rulesResults.push(bookingResult);
            
            // 6. 處理規則結果
            const finalResult = this.processRules(rulesResults);

            if (finalResult) {
                console.log(`[DEBUG] 最高優先級結果: P:${finalResult.priority}, Step:${finalResult.nextStep}`);
                
                // 更新 session 狀態
                if (finalResult.nextStep && finalResult.nextStep !== session.currentStep) {
                    session.currentStep = finalResult.nextStep;
                    sessionManager.updateSession(sessionId, { 
                        currentStep: finalResult.nextStep 
                    });
                }
                
                if (finalResult.endFlow) {
                    sessionManager.resetSession(sessionId); 
                }
                
                return finalResult;
            }
            
            // 🔧 【關鍵修復】這裡的 this 要改為 RuleEngine
            // 7. 通用規則 (P:80) - 最終 Fallback
            const generalResult = RuleEngine.generalRule(session, flowConfig);
            if (generalResult) {
                session.currentStep = generalResult.nextStep;
                sessionManager.updateSession(sessionId, { 
                    currentStep: generalResult.nextStep 
                });
                return generalResult;
            }
            
            // 8. 最終 fallback (P:0)
            const finalFallback = {
                shouldProcess: true,
                priority: 0,
                response: "抱歉，我無法理解您的請求。請重新輸入或嘗試其他指令。",
                nextStep: session.currentStep || 'init',
                endFlow: false,
                richCard: null,
                allowGeminiCall: false
            };
            
            return finalFallback;
            
        } catch (error) {
            console.error('💥 RuleEngine 執行錯誤:', error);
            return this.getErrorResponse('RULE_ENGINE_ERROR', error.message);
        }
    }

    // --- 核心規則實現 ---

    /** 規則 0: 重置流程規則 (P:106) */
    static resetFlowRule(intents, session) {
        const lowerMessage = session.lastMessage ? session.lastMessage.toLowerCase() : '';
        const isResetIntent = intents.includes('reset') || 
                             intents.includes('restart') || 
                             lowerMessage.includes('重新開始') || 
                             lowerMessage.includes('重來');
        
        if (isResetIntent) {
            sessionManager.resetSession(session.sessionId);
            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW,
                response: "✅ 流程已重置，請重新開始預訂。",
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
        const lowerMessage = session.lastMessage ? session.lastMessage.toLowerCase() : '';
        const isEmergency = intents.includes('emergency') || 
                           intents.includes('help') || 
                           lowerMessage.includes('救命') || 
                           lowerMessage.includes('緊急');
        
        if (isEmergency) {
            return {
                shouldProcess: true,
                priority: PRIORITY.EMERGENCY,
                response: '🚨 緊急情況！請撥打旅萌大酒店緊急專線：0800-123-456。',
                nextStep: 'end_conversation',
                endFlow: true,
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.1: 房間限制規則 (P:103) */
    static roomLimitRule(collectedData) {
        if (!collectedData) return { shouldProcess: false, priority: 0 };
        
        const roomCount = parseInt(collectedData.roomCount) || 0;
        if (roomCount > MAX_ROOM_LIMIT) {
            return {
                shouldProcess: true,
                priority: PRIORITY.ROOM_LIMIT,
                response: `抱歉，單次預訂最多 ${MAX_ROOM_LIMIT} 間房間。請調整房間數量。`,
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
            resetHandlerExecution(session); 
            
            return {
                shouldProcess: true,
                priority: PRIORITY.MEMBER_LOGIN_OVERRIDE, 
                response: '偵測到會員登入請求，正在轉移到登入流程...',
                nextStep: 'login_member_account',
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        const isGeneralQueryIntent = intents.some(i => ['general_inquiry', 'inquiry'].includes(i));
        
        if (isGeneralQueryIntent) {
            session.pausedState = session.currentStep;
            
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: `我注意到您可能想詢問其他事情。請問您是想「繼續」原來的訂房流程，還是需要其他協助？`,
                nextStep: 'paused_waiting_for_resume',
                endFlow: false,
                richCard: {
                    type: 'button_list',
                    buttons: [
                        {"text": "繼續訂房", "value": "繼續", "intent": "affirm"},
                        {"text": "重新預訂", "value": "重新預訂", "intent": "booking"}
                    ]
                },
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 流程暫停與恢復規則 (P:98/99) */
    static pauseResumeRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        const lowerMessage = message.toLowerCase();
        
        const isAffirm = intents.includes('affirm') || lowerMessage.includes('繼續') || lowerMessage.includes('好');

        // 恢復處理 - 從暫停狀態恢復
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                const resumedStateKey = session.pausedState;
                session.pausedState = null; 
                resetHandlerExecution(session); 
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME, 
                    response: `✅ 已恢復訂房流程。`,
                    nextStep: resumedStateKey,
                    richCard: null,
                    allowGeminiCall: false,
                    endFlow: false
                };
            }
            return { shouldProcess: false, priority: 0 }; 
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
            const hasBookingIntent = intents.includes('booking') || 
                                     intents.includes('book') || 
                                     message.toLowerCase().includes('訂房') || 
                                     message.toLowerCase().includes('預訂');
            
            if (hasBookingIntent) {
                console.log(`[DEBUG] 啟動流程：偵測到意圖(${hasBookingIntent})，推進到 ask_nights_and_dates`);
                return this.generateStateResponse(flow, 'ask_nights_and_dates', data, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK);
            }
        }
        
        // 2. 意圖/實體推進邏輯
        const currentState = flow.states[currentStateKey];
        if (!currentState) {
            return { shouldProcess: false, priority: 0 };
        }
        
        // 檢查當前狀態是否需要實體
        if (currentState.entities && Array.isArray(currentState.entities)) {
            const requiredEntities = currentState.entities;
            const hasRequiredEntities = requiredEntities.every(entity => 
                data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );
            
            console.log(`[DEBUG] 狀態 ${currentStateKey} 檢查實體是否滿足: ${hasRequiredEntities}`);

            // 如果已有所需實體，自動推進到下一個狀態
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 返回當前狀態的提示
        return this.generateStateResponse(flow, currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
    }

    /** 通用規則 (P:80) */
    static generalRule(session, flowConfig) {
        const currentStep = session.currentStep || 'init';
        return RuleEngine.getFallbackResponse(currentStep, flowConfig, session.collectedData);
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority, customPrompt, customRichCard) {
        const state = flow.states[stateKey];
        if (!state) {
            console.error(`狀態機中找不到狀態: ${stateKey}`);
            return this.getErrorResponse('FLOW_STATE_NOT_FOUND', `找不到流程狀態: ${stateKey}`);
        }
        
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
} 

RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

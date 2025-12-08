// rule_engine.js (V3.0 - 語法修正與強化檢查版，兼顧流程魯棒性與通用查詢友善度)

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller'); 

// 載入 Flow Config
const flowConfig = require('./dialogue_flow.json'); 

// 🚨 【除錯日誌 - 確保檔案載入和結構正確】
if (flowConfig && flowConfig.states) {
    console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！狀態數: ${Object.keys(flowConfig.states).length}`);
    console.log(`   初始狀態 'init' 存在: ${!!flowConfig.states['init']}`);
} else {
    // 如果載入失敗，則紀錄錯誤
    const errorMessage = '❌ [DEBUG] dialogue_flow.json 載入失敗或結構錯誤！請檢查路徑和 JSON 格式。';
    console.error(errorMessage);
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
        MEMBER_LOGIN: 100,
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
            response: interpolatePrompt(state.fallback || '請重新輸入或嘗試其他指令。', sessionData),
            nextStep: currentStep,
            endFlow: false,
            richCard: state.richCard || null,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }

    /** 處理規則優先級排序 */
    static processRules(rulesResults) {
        if (!Array.isArray(rulesResults) || rulesResults.length === 0) return null; 
        
        // 過濾掉不應該處理的規則
        const validResults = rulesResults.filter(result => result.shouldProcess);
        if (validResults.length === 0) return null;
        
        // 按優先級排序
        validResults.sort((a, b) => b.priority - a.priority);
        
        // 返回最高優先級的規則結果
        return validResults[0];
    }

    /** 清理實體數據 */
    static sanitizeEntities(entities) {
        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) {
            if (value !== undefined && value !== null && value !== '') {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    /** 格式化 Gemini 回應 (假設 RuleEngine 外部處理 AI 呼叫) */
    static formatGeminiResponse(geminiResponse, originalResponse, currentStep) {
        return originalResponse; // 總是返回預設的 Response
    }

    /** 主要執行函數 */
    static async executeRules(message, sessionId) {
        try {
            // 1. 獲取或創建 session
            let session = sessionManager.getSession(sessionId);
            if (!session) {
                session = sessionManager.createSession(sessionId);
            }
            
            // 2. 進行意圖分類
            const intentResult = await SmartIntentClassifier.classify(message, session);
            const intents = intentResult.intents || [];
            
            // 3. 實體提取
            const extractedEntities = this.sanitizeEntities(intentResult.entities || {});
            
            // 4. 更新 session 數據
            if (Object.keys(extractedEntities).length > 0) {
                session.collectedData = { ...session.collectedData, ...extractedEntities };
                sessionManager.updateSession(sessionId, { collectedData: session.collectedData });
            }
            
            // 5. 執行所有規則
            const rulesResults = [];
            
            // 規則 0: 重置流程規則 (P:106)
            const resetResult = this.resetFlowRule(intents, session);
            if (resetResult.shouldProcess) rulesResults.push(resetResult);
            
            // 規則 1: 緊急規則 (P:105)
            const emergencyResult = this.emergencyRule(intents, session);
            if (emergencyResult.shouldProcess) rulesResults.push(emergencyResult);
            
            // 規則 1.1: 房間限制規則 (P:103)
            const roomLimitResult = this.roomLimitRule(session.collectedData);
            if (roomLimitResult.shouldProcess) rulesResults.push(roomLimitResult);
            
            // 規則 1.2: 會員登入規則 (P:100)
            const memberLoginResult = this.memberLoginRule(intents, session);
            if (memberLoginResult.shouldProcess) rulesResults.push(memberLoginResult);
            
            // 規則 1.5: 通用查詢覆蓋規則 (P:104)
            const inquiryResult = this.generalInquiryOverrideRule(intents, session, message, extractedEntities);
            if (inquiryResult.shouldProcess) rulesResults.push(inquiryResult);
            
            // 規則 2: 流程暫停與恢復規則 (P:98/99)
            const pauseResumeResult = this.pauseResumeRule(intents, session, message);
            if (pauseResumeResult.shouldProcess) rulesResults.push(pauseResumeResult);
            
            // 規則 3: 訂房流程規則 (P:95)
            const bookingFlowResult = await this.bookingFlowRule(intents, session, message);
            if (bookingFlowResult.shouldProcess) rulesResults.push(bookingFlowResult);
            
            // 6. 處理規則結果
            const finalResult = this.processRules(rulesResults);
            if (finalResult) {
                // 更新 session 狀態
                if (finalResult.nextStep) {
                    session.currentStep = finalResult.nextStep;
                    sessionManager.updateSession(sessionId, { currentStep: finalResult.nextStep });
                }
                
                // 如果流程結束，清理 session
                if (finalResult.endFlow) {
                    sessionManager.endSession(sessionId);
                }
                
                return finalResult;
            }
            
            // 7. 通用規則 (P:80)
            const generalResult = this.generalRule(session, flowConfig);
            if (generalResult) {
                // 更新狀態，雖然這通常是錯誤情況，但仍確保流程返回 init
                if (generalResult.nextStep) {
                    session.currentStep = generalResult.nextStep;
                    sessionManager.updateSession(sessionId, { currentStep: generalResult.nextStep });
                }
                return generalResult;
            }
            
            // 8. 最終 fallback
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
        const lowerMessage = session.lastMessage ? session.lastMessage.toLowerCase() : '';
        const isResetIntent = intents.includes('reset') || 
                              intents.includes('restart') || 
                              lowerMessage.includes('重新開始') || 
                              lowerMessage.includes('重來');
        
        if (isResetIntent) {
            resetHandlerExecution(session);
            sessionManager.updateSession(session.sessionId, {
                currentStep: 'init',
                collectedData: {},
                handlerExecutedStates: []
            });
            
            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW,
                response: '✅ 流程已重置，請重新開始預訂。',
                nextStep: 'init',
                richCard: null,
                allowGeminiCall: false // 修正：此處已添加逗號
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急規則 (P:105) */
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
            const nextStateKey = 'handle_member_login';
            resetHandlerExecution(session); 
            
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.MEMBER_LOGIN, 
                response: '偵測到會員登入請求，正在轉移到登入流程...',
                nextStep: nextStateKey,
                richCard: null,
                allowGeminiCall: false // 修正：此處應有逗號，但前一個是 richCard: null，沒問題
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        const isGeneralQueryIntent = intents.some(i => ['general_inquiry', 'inquiry', 'pricing', 'facilities', 'weather', 'restaurant'].includes(i));
        const hasNoBookingEntities = Object.keys(extractedEntities).every(key => 
            !['roomType', 'checkInDate', 'nights', 'adultCount', 'roomCount'].includes(key)
        );
        
        const isSafeToOverride = session.currentStep === 'init' || 
                                 session.currentStep === 'handle_general_inquiry' ||
                                 session.currentStep === 'paused_waiting_for_resume';

        if (isGeneralQueryIntent && hasNoBookingEntities && isSafeToOverride) {
            
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);

            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: inquiryResponse.prompt,
                nextStep: 'paused_waiting_for_resume', // 導向暫停狀態
                allowGeminiCall: false, // 確保不呼叫 Gemini
                richCard: inquiryResponse.richCard,
                endFlow: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 流程暫停與恢復規則 (P:98/99) */
    static pauseResumeRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        const flow = flowConfig;
        const lowerMessage = message.toLowerCase();
        
        const isAffirm = intents.includes('affirm') || lowerMessage.includes('繼續') || lowerMessage.includes('好');
        const isDeny = intents.includes('deny') || lowerMessage.includes('取消') || lowerMessage.includes('不要');
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities', 'restaurant', 'general_inquiry'].includes(i));

        // 1. 恢復處理 (P:99) - 從暫停狀態恢復
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
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
            
            // P:98 輸出硬編碼提示
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);

            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE,
                response: `⚠️ 流程已暫停。\n${inquiryResponse.prompt}\n\n**請回覆「繼續」或點選按鈕以恢復訂房流程。**`,
                nextStep: 'paused_waiting_for_resume',
                allowGeminiCall: false, // 確保不呼叫 Gemini
                richCard: inquiryResponse.richCard || flow.states['paused_waiting_for_resume']?.richCard || null,
                endFlow: false
            };
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
            // 檢查是否有立即的預訂意圖
            const hasBookingIntent = intents.includes('booking') || 
                                     intents.includes('book') || 
                                     message.toLowerCase().includes('訂房') || 
                                     message.toLowerCase().includes('預訂');
            
            if (hasBookingIntent) {
                // 初始化實體
                const newEntities = this.sanitizeEntities({ ...data, ...session.lastEntities });
                if (Object.keys(newEntities).length > 0) {
                    session.collectedData = newEntities;
                    sessionManager.updateSession(session.sessionId, { collectedData: newEntities });
                }
                
                return this.generateStateResponse(flow, 'ask_nights_and_dates', newEntities, PRIORITY.BOOKING_FLOW.BASE);
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
            
            // 如果已有所需實體，自動推進到下一個狀態
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 3. 🏆 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; // 假設在 Handler 執行前，nextStateKey 已被更新到當前狀態
        
        while (flow.states[nextStateKey]?.handler && !hasExecutedHandler(session, nextStateKey)) {
            
            const handlerName = flow.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerName} 於狀態: ${nextStateKey}`);

            let handlerResult;
            try {
                const handlerFunction = BookingFlowController[handlerName];
                if (typeof handlerFunction === 'function') {
                    handlerResult = await handlerFunction(session); 
                } else {
                    console.error(`💥 找不到或無法執行 Handler: ${handlerName}。`);
                    throw new Error(`找不到 Handler: ${handlerName}`);
                }
            } catch (e) {
                console.error(`💥 Handler 執行錯誤: ${handlerName}`, e);
                
                const safeFallbackState = 'ask_nights_and_dates';
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK,
                    response: `🚨 **服務中斷** (Handler: ${handlerName})：${e.message}。請修正您的輸入或稍後再試。`,
                    nextStep: safeFallbackState,
                    endFlow: false, 
                    richCard: flow.states[safeFallbackState]?.richCard || null,
                    allowGeminiCall: false // 錯誤時不呼叫 AI
                };
            }

            // 處理 Handler 返回結果
            if (handlerResult.isHandled) {
                markHandlerExecuted(session, nextStateKey);

                const nextStep = handlerResult.nextStep || flow.states[nextStateKey].next_state || nextStateKey;
                
                // 關鍵優化點：Handler 處理完成後，必須向用戶顯示結果，不能靜默自動推進
                if (handlerResult.prompt || handlerResult.richCard || FORCED_BREAK_STATES.includes(nextStep)) {
                    
                    return this.generateStateResponse(flow, nextStep, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.prompt, handlerResult.richCard);
                }
                
                nextStateKey = nextStep;
                
            } else {
                // Handler 處理失敗 (isHandled: false)，返回 Handler 提供的 fallback
                const fallbackKey = handlerResult.nextStep || nextStateKey;
                const fallbackPrompt = handlerResult.errorMessage || flow.states[nextStateKey].fallback;
                return this.generateStateResponse(flow, fallbackKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, fallbackPrompt, handlerResult.richCard);
            }
        }
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態是否需要自動推進
        nextStateKey = this.autoAdvanceFlow(flow, nextStateKey, data, session);

        if (nextStateKey !== currentStateKey || flow.states[nextStateKey]?.entities) {
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 自動推進流程 */
    static autoAdvanceFlow(flow, currentStateKey, data, session) {
        let nextStateKey = currentStateKey;
        let state = flow.states[nextStateKey];
        
        while (state && !state.handler && !FORCED_BREAK_STATES.includes(nextStateKey)) {
            // 檢查是否需要實體
            if (state.entities && Array.isArray(state.entities)) {
                const hasRequiredEntities = state.entities.every(entity => 
                    data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
                );
                
                if (!hasRequiredEntities) {
                    break; // 缺少必要實體，停在當前狀態
                }
            }
            
            // 推進到下一個狀態
            if (state.next_state && state.next_state !== nextStateKey) {
                nextStateKey = state.next_state;
                state = flow.states[nextStateKey];
            } else {
                break;
            }
        }
        
        return nextStateKey;
    }

    /** 執行提交邏輯 */
    static executeSubmission(flow, stateKey, data, priority) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
        return {
            shouldProcess: true,
            priority: priority || PRIORITY.BOOKING_FLOW.BASE,
            response: interpolatePrompt(state.prompt, data),
            nextStep: state.next_state || stateKey,
            endFlow: state.end || false,
            richCard: state.richCard || null,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }

    /** 通用規則 (P:80) */
    static generalRule(session, flowConfig) {
        const currentStep = session.currentStep || 'init';
        const state = flowConfig.states ? flowConfig.states[currentStep] : null; // 增加 flowConfig.states 檢查
        
        if (!state) {
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_RULE,
                response: '目前無法處理您的請求，請重新開始對話。',
                nextStep: 'init',
                endFlow: false,
                richCard: null,
                allowGeminiCall: false
            };
        }
        
        return null;
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority, customPrompt, customRichCard) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
        const prompt = customPrompt || state.prompt;
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
        if (intents.includes('pricing')) {
            return { 
                prompt: "目前價格資訊已在訂單摘要中顯示。請回覆「繼續」回到流程。", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        if (intents.includes('facilities')) {
            return { 
                prompt: "本飯店提供：SPA 水療、頂樓泳池、24 小時健身房。詳細資訊請諮詢櫃台。", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        if (intents.includes('weather')) {
            return { 
                prompt: "由於系統限制，無法提供即時天氣資訊。請使用外部天氣應用程式查詢。", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        // 處理其他通用查詢
        return { 
            prompt: "好的，我將為您查詢相關資訊。由於系統正專注於訂房流程，請回覆「繼續」以返回。", 
            richCard: { 
                type: 'quick_replies', 
                options: ['繼續', '取消訂房'] 
            }
        };
    }
} 

module.exports = RuleEngine;

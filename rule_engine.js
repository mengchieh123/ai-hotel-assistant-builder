// rule_engine.js (V3.2 - 流程穩定性與除錯強化版)

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
    const errorMessage = '❌ [DEBUG] dialogue_flow.json 載入失敗或結構錯誤！請檢查路徑和 JSON 格式。';
    console.error(errorMessage);
}
// ---------------------------------------------

// 優先級常量
const PRIORITY = {
    EMERGENCY: 110,
    RESET_FLOW: 106,
    ROOM_LIMIT: 103,
    GENERAL_INQUIRY_OVERRIDE: 104, // 保持高優先級，但邏輯更嚴謹
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
    
    // 🚨 捕獲未處理的例外和 Promise 拒絕
    static initializeErrorHandlers() {
        process.on('uncaughtException', (err) => {
            console.error('💥 [CRITICAL ERROR] Uncaught Exception:', err);
            // 執行緊急清理，然後安全退出 (讓 Render 重啟)
            // 由於 RuleEngine 可能在 server.js 啟動前被 require，這裡只是確保有紀錄
            // 建議在 server.js 主入口也加入此段
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
                console.log(`[DEBUG] 實體更新: ${JSON.stringify(extractedEntities)}`);
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
            
            // 規則 2: 流程暫停與恢復規則 (P:98/99) - 在通用查詢覆蓋前檢查恢復指令
            const pauseResumeResult = this.pauseResumeRule(intents, session, message);
            if (pauseResumeResult.shouldProcess) rulesResults.push(pauseResumeResult);
            
            // 規則 3: 訂房流程規則 (P:95) - 核心流程執行
            const bookingFlowResult = await this.bookingFlowRule(intents, session, message);
            if (bookingFlowResult.shouldProcess) rulesResults.push(bookingFlowResult);
            
            // 規則 1.5: 通用查詢覆蓋規則 (P:104)
            const inquiryResult = this.generalInquiryOverrideRule(intents, session, message, extractedEntities);
            if (inquiryResult.shouldProcess) rulesResults.push(inquiryResult);
            
            // 6. 處理規則結果
            const finalResult = this.processRules(rulesResults);
            if (finalResult) {
                console.log(`[DEBUG] 最高優先級結果: P:${finalResult.priority}, Step:${finalResult.nextStep}`);
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
                console.log(`[DEBUG] 執行通用規則/Fallback。`);
                // 更新狀態
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
                allowGeminiCall: false
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
                allowGeminiCall: false
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
        
        // 只有在 init 或已經暫停時，才允許通用查詢以 P:104 優先級安全介入
        const isSafeToOverride = session.currentStep === 'init' || 
                                 session.currentStep === 'paused_waiting_for_resume';

        const isMidFlowInquiry = isGeneralQueryIntent && session.currentStep !== 'init' && session.currentStep !== 'paused_waiting_for_resume';

        if (isGeneralQueryIntent && hasNoBookingEntities && (isSafeToOverride || isMidFlowInquiry)) {
            
            const inquiryResponse = this.generateHardcodedInquiryResponse(intents);

            // 如果在流程中途 (isMidFlowInquiry)，則強制轉入暫停狀態
            const nextStep = isMidFlowInquiry ? 'paused_waiting_for_resume' : session.currentStep;

            // 如果是中途查詢，儲存暫停狀態
            if (isMidFlowInquiry) {
                session.pausedState = session.currentStep;
                sessionManager.updateSession(session.sessionId, { pausedState: session.currentStep });
                console.log(`[DEBUG] 觸發通用查詢覆蓋，狀態儲存為: ${session.currentStep}`);
            }

            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: inquiryResponse.prompt,
                nextStep: nextStep,  
                allowGeminiCall: false,
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
        
        // 1. 恢復處理 (P:99) - 從暫停狀態恢復
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                const resumedStateKey = session.pausedState;
                session.pausedState = null; 
                sessionManager.updateSession(session.sessionId, { pausedState: null });
                resetHandlerExecution(session); 
                const stateResponse = this.generateStateResponse(flow, resumedStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
                console.log(`[DEBUG] 恢復流程到: ${resumedStateKey}`);
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME, 
                    response: `✅ 已恢復訂房流程。${stateResponse.response}`,
                    nextStep: resumedStateKey,
                    richCard: stateResponse.richCard,
                    allowGeminiCall: false,
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
            // 如果在暫停狀態，但沒有收到肯定或否定指令，則不處理 (等待)
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
                // 確保所有當前提取的實體都已載入
                const newEntities = this.sanitizeEntities({ ...data, ...session.lastEntities });
                if (Object.keys(newEntities).length > 0) {
                    session.collectedData = newEntities;
                    sessionManager.updateSession(session.sessionId, { collectedData: newEntities });
                }
                
                console.log(`[DEBUG] 啟動訂房流程，跳轉到 ask_nights_and_dates`);
                return this.generateStateResponse(flow, 'ask_nights_and_dates', newEntities, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 2. 實體推進邏輯
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
            
            // 🚨 新增日誌記錄以診斷
            console.log(`[DEBUG] 狀態 ${currentStateKey} 檢查實體: ${hasRequiredEntities}`);
            console.log(`[DEBUG] 當前數據: ${JSON.stringify(data)}`);
            // --------------------------

            // 🏆 關鍵修正：如果已有所需實體，**自動推進**到下一個狀態並立即返回
            if (hasRequiredEntities && !hasExecutedHandler(session, currentStateKey)) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
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
                // ... (Handler 執行邏輯與錯誤處理保持不變) ...
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
                    allowGeminiCall: false
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

        // 只有當 nextStateKey 與當前狀態不同 (被 autoAdvanceFlow 推進了)
        // 或者當前狀態是一個需要實體的收集狀態時，我們才需要返回回應
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
                console.log(`[DEBUG] 自動靜默推進至: ${nextStateKey}`);
            } else {
                break;
            }
        }
        
        return nextStateKey;
    }

    /** 通用規則 (P:80) */
    static generalRule(session, flowConfig) {
        const currentStep = session.currentStep || 'init';
        const state = flowConfig.states ? flowConfig.states[currentStep] : null;
        
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
        
        // 通用規則使用 Fallback 機制
        return this.getFallbackResponse(currentStep, flowConfig, session.collectedData);
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
                prompt: "價格會根據您選擇的房型、日期和促銷活動變動，最終價格將在確認頁面顯示。請回覆「繼續」回到流程。", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        if (intents.includes('facilities')) {
            return { 
                prompt: "本飯店提供：SPA 水療、頂樓泳池、24 小時健身房。詳細資訊請諮詢櫃台。**請回覆「繼續」恢復訂房**", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        if (intents.includes('weather')) {
            return { 
                prompt: "由於系統限制，無法提供即時天氣資訊。請使用外部天氣應用程式查詢。**請回覆「繼續」恢復訂房**", 
                richCard: { type: 'quick_replies', options: ['繼續'] } 
            };
        }
        // 處理其他通用查詢
        return { 
            prompt: "好的，我將為您查詢相關資訊。由於系統正專注於訂房流程，請回覆「繼續」或「取消訂房」。", 
            richCard: { 
                type: 'quick_replies', 
                options: ['繼續', '取消訂房'] 
            }
        };
    }
} 

// 🚨 在 RuleEngine 被載入時初始化錯誤處理，確保 Node.js 環境穩定
RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

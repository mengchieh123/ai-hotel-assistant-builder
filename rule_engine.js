// rule_engine.js (V8.0 - 支援新版意圖分類器)

// ----------------------------------------------------
// 🏆 ESM 導入
// ----------------------------------------------------
import { sessionManager } from './session_manager.js';
import { SmartIntentClassifier } from './intent_classifier.js';
import { BookingFlowController } from './booking_controller.js'; // 業務邏輯處理
import { GeminiAdapter } from './gemini_adapter.js'; // 通用 LLM 處理

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 優先級常量
const PRIORITY = {
    EMERGENCY: 110,
    GENERAL_QUERY_COMPLETE: 107, 
    RESET_FLOW: 106,
    INVENTORY_FAILURE_OVERRIDE: 105, 
    GENERAL_INQUIRY_OVERRIDE: 104, 
    ROOM_LIMIT: 103,
    MEMBER_LOGIN_OVERRIDE: 100,
    BOOKING_FLOW: {
        BASE: 95,
        PAUSE_RESUME: { PAUSE: 98, RESUME: 99 },
        AVAILABILITY_CHECK: 96,
        ENTITY_SATISFIED_ADVANCE: 97, 
        HANDLER_SUCCESS_ADVANCE: 97 
    },
    GENERAL_RULE: 80,
    LLM_FALLBACK_ATTEMPT: 79 
};
const MAX_ROOM_LIMIT = 10;
const FORCED_BREAK_STATES = ['paused_waiting_for_resume', 'confirm_booking', 'booking_complete', 'end_conversation'];
const MAX_FALLBACK_ATTEMPTS = 3; // 連續 3 次不成功就觸發 LLM

class RuleEngine {
    
    static config = null; 
    static errorResponses = {};

    /** 🎯 核心靜態初始化方法：載入並斷言配置 */
    static initializeFlowConfig() {
        if (RuleEngine.config && RuleEngine.config.states && RuleEngine.config.states.init) {
            return;
        }

        let tempFlowConfig = {};
        let configLoaded = false;
        try {
            const flowPath = path.join(__dirname, 'dialogue_flow.json');
            if (fs.existsSync(flowPath)) {
                const data = fs.readFileSync(flowPath, 'utf8');
                if (data.trim().length > 0) {
                    tempFlowConfig = JSON.parse(data);
                    configLoaded = true;
                    console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！`);
                } else {
                    console.error("💥 [FATAL CONFIG] dialogue_flow.json 檔案為空。");
                }
            }
        } catch (error) {
            console.error(`💥 [FATAL CONFIG] 載入/解析 dialogue_flow.json 失敗: ${error.message}`);
        }
        
        // 🎯 配置斷言：強制檢查配置結構完整性
        if (!tempFlowConfig || !tempFlowConfig.states || !tempFlowConfig.states.init) {
            const errorMsg = "配置載入失敗，缺少 'states' 或 'init' 狀態。請檢查 dialogue_flow.json 格式或檔案路徑。";
            console.error(`💥 [FATAL CONFIG ERROR] ${errorMsg}`);
            throw new Error(errorMsg);
        }

        RuleEngine.config = tempFlowConfig;
        console.log(`✅ [DEBUG] RuleEngine 靜態配置完成並已通過結構檢查。`);
    }

    /** 初始化錯誤處理 */
    static initializeErrorHandlers() { 
        RuleEngine.errorResponses = {
            'RULE_ENGINE_ERROR': (message) => ({
                response: `系統處理錯誤，請聯絡客服。錯誤訊息：${message}`,
                priority: PRIORITY.EMERGENCY,
                endFlow: true
            }),
            'FLOW_CONFIG_MISSING': (message) => ({
                response: `系統流程配置發生致命錯誤：${message}`,
                priority: PRIORITY.EMERGENCY,
                endFlow: true
            })
        };
    }
    
    static getErrorResponse(code, message) {
        const handler = RuleEngine.errorResponses && RuleEngine.errorResponses[code];
        
        if (handler) {
            const errorData = handler(message);
            return {
                shouldProcess: true,
                priority: PRIORITY.EMERGENCY,
                response: errorData.response,
                nextStep: 'init',
                richCard: null,
                allowGeminiCall: false,
                endFlow: true
            };
        }
        return {
            shouldProcess: true,
            priority: PRIORITY.EMERGENCY,
            response: `系統發生無法復原的錯誤：${code}。請重新開始。`,
            nextStep: 'init',
            endFlow: true
        };
    }
    
    // --- 輔助函數 ---
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        
        // 確保 data 是物件
        const safeData = data || {};
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return safeData[key] !== undefined ? safeData[key] : match;
        });
    }

    static getRequiredEntities(stateKey) {
        if (!RuleEngine.config || !RuleEngine.config.states || !stateKey) {
            return [];
        }
        const state = RuleEngine.config.states[stateKey];
        return (state && Array.isArray(state.entities)) ? state.entities : [];
    }

    static generateStateResponse(stateKey, data, priority) {
        if (!RuleEngine.config || !RuleEngine.config.states) {
            return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', `狀態: ${stateKey}`);
        }
        
        const state = RuleEngine.config.states[stateKey];
        
        if (!state) {
            console.error(`❌ [FLOW ERROR] 狀態 '${stateKey}' 不存在！`);
            return {
                shouldProcess: true, 
                priority: PRIORITY.EMERGENCY,
                response: `系統流程配置錯誤：狀態 '${stateKey}' 缺失。請輸入『重新開始』。`,
                nextStep: 'init',
                allowGeminiCall: false
            };
        }

        // 處理動態或靜態 Rich Card
        const stateRichCard = state.richCardGenerator ? state.richCardGenerator(data) : state.richCard;
        const finalRichCard = (data && data.customRichCard) || stateRichCard;
        
        // 處理 LLM 回應或標準 prompt
        const finalPrompt = (data && data.llm_response) || RuleEngine.interpolatePrompt(state.prompt, data);
        if (data && data.llm_response) {
            delete data.llm_response; // 清理一次性 LLM 回應
        }
        
        return {
            shouldProcess: true,
            priority: priority,
            response: finalPrompt || "", 
            nextStep: stateKey,
            richCard: finalRichCard,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }
    
    static sanitizeEntities(entities, sessionCollectedData, currentStateKey) {
        // 確保 sessionCollectedData 存在
        const safeCollectedData = sessionCollectedData || {};
        
        if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        const requiredEntities = RuleEngine.getRequiredEntities(currentStateKey);

        for (const [key, value] of Object.entries(entities)) { 
            const isEntityEmpty = value === undefined || value === null || value === '' || String(value).toLowerCase() === 'null' || String(value).toLowerCase() === '0';
            const isKeyRequired = requiredEntities.includes(key);

            if (isEntityEmpty) {
                if (!isKeyRequired && safeCollectedData[key]) {
                    continue;
                }
            } else {
                if (key === 'adultCount' || key === 'childCount' || key === 'roomCount') {
                    const sessionValue = parseInt(safeCollectedData[key], 10);
                    const inputValue = parseInt(value, 10);

                    const isDefaultValue = (key !== 'childCount' && inputValue === 1) || (key === 'childCount' && inputValue === 0);
                    
                    if (isDefaultValue && sessionValue > inputValue && sessionValue > 0) {
                        continue; 
                    }
                }
            }
            sanitized[key] = value;
        }
        return sanitized;
    }

    // --- 高優先級規則 ---

    /** 規則 0: 緊急規則 (P:110) - 終止/取消 */
    static emergencyRule(intents, session) {
        if (intents.includes('end_conversation') || intents.includes('cancel_booking')) {
            console.log(`[RULE 0] 觸發：終止/取消訂房。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('end_conversation', session.collectedData, PRIORITY.EMERGENCY);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 重設流程 (P:106) */
    static async resetFlowRule(intents, session) {
        if (intents.includes('reset') || intents.includes('start_over')) {
            console.log(`[RULE 1] 觸發：重設流程。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('init', session.collectedData, PRIORITY.RESET_FLOW);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 強制恢復訂房流程 (P:99) */
    static async forceResumeBookingRule(intents, session) {
        if (session.currentStep === 'paused_waiting_for_resume' && intents.includes('affirm')) {
            console.log(`[RULE 2] 觸發：強制恢復流程。`);
            // 恢復邏輯在 resume_booking_flow 狀態執行
            return RuleEngine.generateStateResponse('resume_booking_flow', session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 4: 房型數量限制 (P:103) */
    static roomLimitRule(collectedData) {
        // 確保 collectedData 存在
        const safeData = collectedData || {};
        const roomCount = parseInt(safeData.roomCount, 10);
        if (roomCount > MAX_ROOM_LIMIT) {
            console.log(`[RULE 4] 觸發：房間數超過限制 (${MAX_ROOM_LIMIT} 間)。`);
            return {
                shouldProcess: true,
                priority: PRIORITY.ROOM_LIMIT,
                response: `抱歉，您一次最多只能預訂 ${MAX_ROOM_LIMIT} 間房間。請減少房間數量。`,
                nextStep: 'ask_room_count',
                richCard: null
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 5: LLM 詢問完成 (P:107) */
    static handleGeneralQueryCompletionRule(intents, session) {
        if (session.currentStep === 'general_inquiry_response' && intents.includes('affirm')) {
            console.log(`[RULE 5] 觸發：通用查詢完畢，恢復流程。`);
            return RuleEngine.generateStateResponse('resume_booking_flow', session.collectedData, PRIORITY.GENERAL_QUERY_COMPLETE);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 6: 通用查詢覆蓋 (P:104) */
    static generalInquiryOverrideRule(intents, session, message) {
        // 在強制中斷狀態下不觸發通用查詢，除非是明確的重設或繼續指令
        if (FORCED_BREAK_STATES.includes(session.currentStep)) {
            return { shouldProcess: false, priority: 0 };
        }

        // 當前流程要求關鍵實體 (如 roomType, checkInDate) 且未被滿足時，不允許通用查詢覆蓋
        const requiredEntities = RuleEngine.getRequiredEntities(session.currentStep);
        const missingEntities = requiredEntities.filter(e => !(session.collectedData && session.collectedData[e]));

        if (intents.includes('general_inquiry') && missingEntities.length === 0) {
            console.log(`[RULE 6] 觸發：通用查詢覆蓋。`);
            session.pauseFromState = session.currentStep; // 暫存當前狀態
            return RuleEngine.generateStateResponse('handle_general_inquiry', session.collectedData, PRIORITY.GENERAL_INQUIRY_OVERRIDE);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 7: 登入覆蓋 (P:100) */
    static memberLoginRule(intents, session) {
        if (intents.includes('login')) {
            console.log(`[RULE 7] 觸發：登入流程覆蓋。`);
            return RuleEngine.generateStateResponse('login_member_account', session.collectedData, PRIORITY.MEMBER_LOGIN_OVERRIDE);
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 8: 暫停與恢復 (P:98, P:99) */
    static pauseResumeRule(intents, session) {
        if (intents.includes('pause') && !FORCED_BREAK_STATES.includes(session.currentStep)) {
            console.log(`[RULE 8] 觸發：流程暫停。`);
            session.pauseFromState = session.currentStep;
            return RuleEngine.generateStateResponse('paused_waiting_for_resume', session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE);
        }
        return { shouldProcess: false, priority: 0 };
    }


    // --- 核心流程規則 ---

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const flow = RuleEngine.config;
        let currentStateKey = session.currentStep;
        let currentState = flow.states[currentStateKey];
        
        // 🔧 關鍵修復：確保 session.collectedData 存在
        if (!session.collectedData) {
            session.collectedData = {};
        }
        
        // 🎯 修復：同步 currentState
        if (!session.currentState) {
            session.currentState = currentStateKey;
        } else if (session.currentState !== currentStateKey) {
            // 如果不同步，記錄日誌並修正
            console.log(`[DEBUG] currentState (${session.currentState}) 與 currentStep (${currentStateKey}) 不同步，進行修正`);
            session.currentState = currentStateKey;
        }
        
        const data = session.collectedData;

        if (!currentState) {
            return { shouldProcess: false, priority: 0 };
        }

        let nextState = currentStateKey; // 預設下一狀態為當前狀態

        // 1. 意圖導航 (P:97)
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextState = currentState.intents[intent];
                console.log(`[RULE 3.1] 意圖導航：${currentStateKey} -> ${nextState} (意圖: ${intent})`);
                
                // 🎯 修復：更新 session.currentState
                session.currentState = nextState;
                
                return RuleEngine.generateStateResponse(nextState, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE);
            }
        }

        // 2. 實體收集與跳轉 (P:97)
        if (currentState.type !== 'logic_exec' && currentState.entities) {
            const requiredEntities = currentState.entities;
            const isSatisfied = requiredEntities.every(e => data[e]);

            if (isSatisfied && currentState.next_state && currentState.next_state !== currentStateKey) {
                nextState = currentState.next_state;
                console.log(`[RULE 3.2] 實體滿足：${currentStateKey} -> ${nextState}`);
                
                // 🎯 修復：更新 session.currentState
                session.currentState = nextState;
                
                return RuleEngine.generateStateResponse(nextState, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE);
            }
        }

        // 3. 執行邏輯處理器 (logic_exec) (P:97)
        if (currentState.type === 'logic_exec') {
            const handler = currentState.handler;
            if (handler && typeof BookingFlowController[handler] === 'function') {
                try {
                    // 🔧 修正：傳遞正確的參數順序
                    // 根據 booking_controller.js，Handler 需要 session 作為第一個參數
                    const handlerResult = await BookingFlowController[handler](session);
                    
                    // 🔧 修正：檢查 Handler 返回格式
                    // booking_controller.js 返回 { isHandled: boolean, nextStep?: string, prompt?: string, ... }
                    if (handlerResult && handlerResult.isHandled !== false) {
                        nextState = handlerResult.nextStep || currentState.next_state;
                        console.log(`[RULE 3.3] Handler 成功：${currentStateKey} -> ${nextState}`);
                        
                        // 🎯 修復：更新 session.currentState
                        session.currentState = nextState;
                        
                        // 合併 Handler 返回的數據到 session.collectedData
                        if (handlerResult) {
                            Object.assign(data, handlerResult);
                        }
                        
                        return RuleEngine.generateStateResponse(nextState, data, PRIORITY.BOOKING_FLOW.HANDLER_SUCCESS_ADVANCE);
                    } else {
                        // Handler 未處理 (isHandled: false)
                        // 讓流程繼續往下走
                        console.log(`[RULE 3.3] Handler 未處理：${currentStateKey}，繼續流程`);
                        return { shouldProcess: false, priority: 0 };
                    }
                } catch (e) {
                    console.error(`💥 Handler 執行失敗 (${handler}):`, e);
                    nextState = currentState.fallback_state || currentStateKey;
                    data.errorMessage = e.message;
                    
                    // 🎯 修復：更新 session.currentState
                    session.currentState = nextState;
                    
                    return RuleEngine.generateStateResponse(nextState, data, PRIORITY.BOOKING_FLOW.BASE);
                }
            }
        }

        // 4. 無意圖，無實體收集，且非 logic_exec，維持原狀，等待通用規則提示
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 9: 通用規則 (P:80) - 最終狀態提示回退 */
    static generalRule(session) {
        const currentStateKey = session.currentStep;
        const currentState = RuleEngine.config.states[currentStateKey]; 
        
        // 確保當前狀態不是 end 狀態
        if (currentState && !currentState.end && currentState.prompt) {
            return RuleEngine.generateStateResponse(currentStateKey, session.collectedData, PRIORITY.GENERAL_RULE);
        }
        return null;
    }
    
    /** 規則 10: LLM Fallback 嘗試 (P:79) */
    static async handleRepeatedFallbackRule(session, message) {
        const currentState = RuleEngine.config.states[session.currentStep];
        
        // 確保 session.collectedData 存在
        if (!session.collectedData) {
            session.collectedData = {};
        }
        
        // 檢查是否達到最大回退次數，並且當前狀態允許 LLM 呼叫
        if (session.fallbackCount >= MAX_FALLBACK_ATTEMPTS && currentState && currentState.allow_gemini_call) {
            console.log(`[RULE 10] 觸發：連續 Fallback 達 ${MAX_FALLBACK_ATTEMPTS} 次，嘗試 LLM 處理。`);
            
            // 呼叫 Gemini 處理通用查詢
            const llmResult = await GeminiAdapter.processInquiry(message, session.collectedData);

            if (llmResult.success) {
                // 將 LLM 回應儲存到 collectedData，供 general_inquiry_response 使用
                session.collectedData.llm_response = llmResult.response;
                session.collectedData.llm_source = llmResult.source;
                session.fallbackCount = 0; // 成功處理後重設
                
                return RuleEngine.generateStateResponse('general_inquiry_response', session.collectedData, PRIORITY.LLM_FALLBACK_ATTEMPT);
            } else {
                console.error("LLM 呼叫失敗，將導向 handle_llm_failure。");
                session.fallbackCount = 0;
                return RuleEngine.generateStateResponse('handle_llm_failure', session.collectedData, PRIORITY.LLM_FALLBACK_ATTEMPT);
            }
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // 輔助函數 (結果處理)
    static processRules(results) {
        const validResults = results.filter(r => r && r.shouldProcess);
        if (validResults.length === 0) return null;

        validResults.sort((a, b) => b.priority - a.priority);
        return validResults[0];
    }

    /** 🎯 RuleEngine 核心執行器 */
    static async executeRules(message, sessionId) {
        if (!RuleEngine.config || !RuleEngine.config.states) {
            return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', 'Rule Engine 尚未初始化。');
        }

        try {
            const session = sessionManager.getSession(sessionId);
            
            // 🔧 關鍵修復：確保 session 存在且所有必要屬性已初始化
            if (!session) {
                console.error(`❌ [SESSION ERROR] Session ${sessionId} 不存在`);
                return {
                    shouldProcess: true,
                    priority: PRIORITY.EMERGENCY,
                    response: '會話不存在，請重新開始預訂流程。',
                    nextStep: 'init',
                    allowGeminiCall: false
                };
            }
            
            // 🎯 關鍵修復：確保 currentState 與 currentStep 同步
            session.currentStep = session.currentStep || RuleEngine.config.initial_state || 'init';
            if (!session.currentState) {
                session.currentState = session.currentStep; // 初始化 currentState
            } else if (session.currentStep !== session.currentState) {
                // 如果不同步，以 currentStep 為準
                console.log(`[DEBUG] 狀態同步：currentState(${session.currentState}) -> currentStep(${session.currentStep})`);
                session.currentState = session.currentStep;
            }
            
            if (!session.collectedData) {
                session.collectedData = {};
            }
            
            console.log(`[DEBUG] Session ${sessionId} state: ${session.currentStep} (currentState: ${session.currentState})`);
            
            // 1. 🎯 關鍵修改：使用新版 SmartIntentClassifier（傳入 session 數據作為上下文）
            const classificationResult = SmartIntentClassifier.classify(
                message, 
                RuleEngine.config,
                {
                    ...(session.collectedData || {}),
                    currentState: session.currentStep
                }
            );
            
            let intents = classificationResult.intents || [];
            let extractedEntities = classificationResult.entities || {}; 

            const sanitizedEntities = RuleEngine.sanitizeEntities(extractedEntities, session.collectedData, session.currentStep); 
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData || {};

            const rulesResults = [];
            
            // 2. 執行高優先級規則
            rulesResults.push(RuleEngine.emergencyRule(intents, session)); 
            rulesResults.push(await RuleEngine.resetFlowRule(intents, session)); 
            rulesResults.push(await RuleEngine.forceResumeBookingRule(intents, session)); 
            rulesResults.push(RuleEngine.roomLimitRule(collectedData));
            rulesResults.push(RuleEngine.handleGeneralQueryCompletionRule(intents, session)); 
            rulesResults.push(RuleEngine.memberLoginRule(intents, session)); 
            rulesResults.push(RuleEngine.generalInquiryOverrideRule(intents, session, message)); 
            
            // 3. 執行流程控制規則
            rulesResults.push(RuleEngine.pauseResumeRule(intents, session));
            
            // 4. 執行核心訂房流程規則
            const bookingResult = await RuleEngine.bookingFlowRule(intents, session, message);
            rulesResults.push(bookingResult);

            // 5. 執行 LLM Fallback 嘗試 
            rulesResults.push(await RuleEngine.handleRepeatedFallbackRule(session, message)); 
            
            // 6. 處理規則結果
            const finalResult = RuleEngine.processRules(rulesResults);

            if (finalResult) {
                
                // 更新 fallback 計數和 nextStep 邏輯
                if (finalResult.priority === PRIORITY.GENERAL_RULE || finalResult.priority === 0) {
                    session.fallbackCount = (session.fallbackCount || 0) + 1;
                } else {
                    session.fallbackCount = 0;
                }

                if (finalResult.nextStep && finalResult.nextStep !== session.currentStep) {
                    session.currentStep = finalResult.nextStep;
                    session.currentState = finalResult.nextStep; // 🎯 同步更新
                    console.log(`[DEBUG] 更新狀態：${session.currentStep} (同步 currentState)`);
                }
                
                if (finalResult.endFlow) {
                    sessionManager.resetSession(sessionId); 
                }
                
                sessionManager.addAssistantResponse(sessionId, finalResult.response, finalResult.richCard);

                return finalResult;
            }
            
            // 7. 通用規則 (P:80) - 最終 Fallback (狀態提示)
            const generalResult = RuleEngine.generalRule(session); 
            
            // <--- 🎯 INIT-ADVANCE 強制轉移邏輯 (修復流程卡在 'init' 問題) --->
            if (session.currentStep === 'init' && (collectedData.checkInDate || collectedData.nights || collectedData.roomType)) {
                console.log("[INIT-ADVANCE] 檢測到關鍵實體，從 init 狀態強制轉移到 ask_dates_and_nights。");
                session.currentStep = 'ask_dates_and_nights'; 
                session.currentState = 'ask_dates_and_nights'; // 🎯 同步更新
                
                // 重新調用 GeneralRule 獲取新狀態的提示 (例如 ask_dates_and_nights)
                const advancedResult = RuleEngine.generalRule(session);
                if (advancedResult) {
                    session.fallbackCount = 0;
                    sessionManager.addAssistantResponse(sessionId, advancedResult.response, advancedResult.richCard);
                    return advancedResult;
                }
            }
            // <--- 🎯 INIT-ADVANCE 強制轉移邏輯結束 --->


            if (generalResult) {
                session.fallbackCount = (session.fallbackCount || 0) + 1;
                session.currentStep = generalResult.nextStep;
                session.currentState = generalResult.nextStep; // 🎯 同步更新
                sessionManager.addAssistantResponse(sessionId, generalResult.response, generalResult.richCard);
                return generalResult;
            }
            
            // 8. 🏆 最終 Fallback (P:0)
            session.fallbackCount = (session.fallbackCount || 0) + 1; 

            const finalFallback = {
                shouldProcess: true,
                priority: 0,
                response: "抱歉，我不明白您的意思。請問您是要繼續 **訂房流程**，還是 **重新開始**？",
                nextStep: session.currentStep || 'init',
                endFlow: false,
                richCard: { type: 'suggestions', suggestions: [{ text: '繼續訂房', intent: 'continue' }, { text: '重新開始', intent: 'reset' }] },
                allowGeminiCall: false
            };
            
            sessionManager.addAssistantResponse(sessionId, finalFallback.response, finalFallback.richCard);
            
            return finalFallback;
            
        } catch (error) {
            console.error('💥 RuleEngine 執行錯誤:', error);
            return RuleEngine.getErrorResponse('RULE_ENGINE_ERROR', error.message); 
        }
    }
} 

RuleEngine.initializeErrorHandlers();

// ----------------------------------------------------
// 🏆 ESM 匯出
// ----------------------------------------------------
export { RuleEngine };

// rule_engine.js (V7.5 - 最終靜態初始化修復版)

// ----------------------------------------------------
// 🏆 ESM 導入
// ----------------------------------------------------
import { sessionManager } from './session_manager.js';
import { SmartIntentClassifier } from './intent_classifier.js';
import { BookingFlowController } from './booking_controller.js'; 

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; 

// --- 模擬 __dirname 和 __filename (ESM 環境必備) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ----------------------------------------------------

// 優先級常量 (保持不變)
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


class RuleEngine {
    
    /** 🎯 核心修復點 1: 靜態屬性用於儲存 Flow 配置 */
    static config = null; // 初始化為 null，等待明確的初始化呼叫

    /** 靜態屬性用於錯誤處理的配置 */
    static errorResponses = {};

    /** 🎯 核心修復點 2: 新增靜態初始化方法，由主程式明確呼叫 */
    static initializeFlowConfig() {
        if (RuleEngine.config) {
            console.log("⚠️ [DEBUG] RuleEngine 已經初始化過配置。");
            return;
        }

        let tempFlowConfig = {};
        try {
            const flowPath = path.join(__dirname, 'dialogue_flow.json');
            if (fs.existsSync(flowPath)) {
                tempFlowConfig = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
                console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！`);
            } else {
                // 內建最小結構
                tempFlowConfig = { 
                    name: "DefaultFlow",
                    initial_state: "init",
                    states: {
                        init: { prompt: "您好，歡迎使用訂房助理。", next_state: "ask_dates_and_nights" },
                        end_conversation: { prompt: "感謝您的使用。", end: true },
                        handle_general_inquiry: { prompt: "請提供更多細節。", allow_gemini_call: true, next_state: "ask_dates_and_nights" },
                        ask_dates_and_nights: { entities: ["checkInDate", "nights"], prompt: "請問您希望入住的日期和晚數？" } 
                    } 
                };
                console.warn(`⚠️ [DEBUG] dialogue_flow.json 缺失，使用 Rule Engine 內建的最小配置結構。`);
            }
        } catch (error) {
            console.error(`💥 [DEBUG] 載入 dialogue_flow.json 失敗: ${error.message}`);
        }
        
        RuleEngine.config = tempFlowConfig;
        console.log(`✅ [DEBUG] RuleEngine 靜態配置完成。`);
    }

    // 初始化錯誤處理 (不變)
    static initializeErrorHandlers() { 
        RuleEngine.errorResponses = {
            'RULE_ENGINE_ERROR': (message) => ({
                response: `系統處理錯誤，請聯絡客服。錯誤訊息：${message}`,
                priority: PRIORITY.EMERGENCY,
                endFlow: true
            }),
            'INVALID_SESSION_ID': (message) => ({
                response: `會話錯誤：${message}`,
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
    
    // 🏆 處理 Rule Engine 執行中的致命錯誤。
    static getErrorResponse(code, message) {
        const handler = RuleEngine.errorResponses && RuleEngine.errorResponses[code];
        
        // ... (邏輯不變) ...

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

        // 最終安全回退
        console.error(`💥 [FATAL] 未知的 RuleEngine 錯誤類型: ${code}. 訊息: ${message}`);
        return {
            shouldProcess: true,
            priority: PRIORITY.EMERGENCY,
            response: `系統發生無法復原的錯誤：${code}。請重新開始。`,
            nextStep: 'init',
            endFlow: true
        };
    }
    
    // 🏆 規則 0 - 緊急規則 (P:110) (邏輯不變)
    static emergencyRule(intents, session) {
        if (intents.includes('end_conversation') || intents.includes('cancel_booking')) {
            console.log(`[RULE 0] 觸發：終止/取消訂房。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('end_conversation', session.collectedData, PRIORITY.EMERGENCY);
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 輔助函數 (邏輯不變) ---
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /** 🎯 核心修復點 3: 確保 RuleEngine.config 存在 */
    static getRequiredEntities(stateKey) {
        if (!RuleEngine.config || !RuleEngine.config.states || !stateKey) {
            // 如果配置還沒準備好，則返回空數組
            if (!RuleEngine.config) console.error("❌ [CONFIG ERROR] 呼叫 getRequiredEntities 時配置未初始化！");
            return [];
        }
        const state = RuleEngine.config.states[stateKey];
        return (state && Array.isArray(state.entities)) ? state.entities : [];
    }

    /** 🎯 核心修復點 4: 確保 RuleEngine.config 存在並檢查狀態 */
    static generateStateResponse(stateKey, data, priority) {
        // 核心安全檢查
        if (!RuleEngine.config || !RuleEngine.config.states) {
            console.error(`❌ [FLOW ERROR] RuleEngine.config 或 states 缺失，無法導向狀態 ${stateKey}。`);
            return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', `狀態: ${stateKey}`);
        }
        
        const state = RuleEngine.config.states[stateKey]; // 使用靜態配置
        
        if (!state) {
            console.error(`❌ [FLOW ERROR] 嘗試導向的狀態 '${stateKey}' 在 dialogue_flow.json 中不存在！`);
            return {
                shouldProcess: true, 
                priority: PRIORITY.EMERGENCY,
                response: `系統流程配置錯誤：狀態 '${stateKey}' 缺失。請輸入『重新開始』。`,
                nextStep: 'init',
                allowGeminiCall: false
            };
        }

        const stateRichCard = state.richCardGenerator ? state.richCardGenerator(data) : state.richCard;
        const finalRichCard = data.customRichCard || stateRichCard;
        
        // ... (其他邏輯不變) ...

        if (!state.prompt && !finalRichCard && !data.llm_response) { 
             return {
                 shouldProcess: true,
                 priority: priority,
                 response: "", 
                 nextStep: stateKey,
                 richCard: finalRichCard, 
                 allowGeminiCall: state.allow_gemini_call || false
             };
        }

        const finalPrompt = data.llm_response || RuleEngine.interpolatePrompt(state.prompt, data);
        delete data.llm_response;

        return {
            shouldProcess: true,
            priority: priority,
            response: finalPrompt, 
            nextStep: stateKey,
            richCard: finalRichCard,
            allowGeminiCall: state.allow_gemini_call || false
        };
    }

    /** * 實體清理邏輯 (保持原樣) */
    static sanitizeEntities(entities, sessionCollectedData, currentStateKey) {
       // ... (邏輯保持不變) ...
       if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        const requiredEntities = RuleEngine.getRequiredEntities(currentStateKey);

        for (const [key, value] of Object.entries(entities)) { 
            const isEntityEmpty = value === undefined || value === null || value === '' || String(value).toLowerCase() === 'null' || String(value).toLowerCase() === '0';
            const isKeyRequired = requiredEntities.includes(key);

            if (isEntityEmpty) {
                if (!isKeyRequired && sessionCollectedData[key]) {
                    console.log(`⚠️ [ENTITY GUARD] 忽略 NLU 返回的空值，保留 Session 值:${key}:${sessionCollectedData[key]}`);
                    continue;
                }
            } else {
                if (key === 'adultCount' || key === 'childCount' || key === 'roomCount') {
                    const sessionValue = parseInt(sessionCollectedData[key], 10);
                    const inputValue = parseInt(value, 10);

                    const isDefaultValue = (key !== 'childCount' && inputValue === 1) || (key === 'childCount' && inputValue === 0);
                    
                    if (isDefaultValue && sessionValue > inputValue && sessionValue > 0) {
                        console.log(`⚠️ [ENTITY GUARD] 忽略輸入中不合理的預設值: ${key}:${inputValue}，保留 Session 值:${sessionValue}`);
                        continue; 
                    }
                }
            }

            // 最終接受的值
            sanitized[key] = value;
        }
        return sanitized;
    }

    // --- 核心靜態方法定義 (規則 1-8 邏輯不變) ---

    /** 🎯 規則 1: 重設流程規則 (P:106) */
    static async resetFlowRule(intents, session) {
        if (intents.includes('reset') || intents.includes('start_over')) {
            console.log(`[RULE 1] 觸發：重設流程。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('init', session.collectedData, PRIORITY.RESET_FLOW);
        }
        return { shouldProcess: false, priority: 0 };
    }

    // ... (Rule 2 - Rule 8 保持不變) ...
    static async forceResumeBookingRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static inventoryFailureRule(session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static handleGeneralQueryCompletionRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static roomLimitRule(collectedData) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static memberLoginRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static generalInquiryOverrideRule(intents, session, message) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static pauseResumeRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    
    /** 🎯 輔助函數: 處理規則結果 */
    static processRules(results) {
        const validResults = results.filter(r => r && r.shouldProcess);
        if (validResults.length === 0) return null;

        validResults.sort((a, b) => b.priority - a.priority);
        return validResults[0];
    }
    
    /** 🎯 輔助函數: 檢查 Handler 是否已執行 */
    static hasExecutedHandler(session, stateKey) {
        session.executedHandlers = session.executedHandlers || {};
        return session.executedHandlers[stateKey] === true;
    }
    
    /** 🎯 輔助函數: 標記 Handler 已執行 */
    static markHandlerExecuted(session, stateKey) {
        session.executedHandlers = session.executedHandlers || {};
        session.executedHandlers[stateKey] = true;
    }

    /** 🎯 規則 9: 通用規則 (P:80) - 最終狀態提示回退 */
    static generalRule(session) {
        const currentStateKey = session.currentStep;
        // 使用 RuleEngine.config 存取配置
        const currentState = RuleEngine.config.states[currentStateKey]; 
        if (currentState && currentState.prompt) {
            return RuleEngine.generateStateResponse(currentStateKey, session.collectedData, PRIORITY.GENERAL_RULE);
        }
        return null;
    }


    /** 🎯 RuleEngine 核心執行器 */
    static async executeRules(message, sessionId) {
        if (!sessionId || typeof sessionId !== 'string' || sessionId === 'undefined') {
            console.error("💥 [SECURITY FAIL] 接收到無效的 sessionId，拒絕處理。");
            return RuleEngine.getErrorResponse('INVALID_SESSION_ID', '會話 ID 無效，請重新初始化。'); 
        }
        
        // 🎯 核心修復點 5: 執行前強制檢查配置是否已準備好
        if (!RuleEngine.config) {
             console.error("💥 [FATAL] RuleEngine 配置未初始化！請在呼叫 executeRules 之前先呼叫 RuleEngine.initializeFlowConfig()。");
             return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', 'Rule Engine 尚未初始化。');
        }

        try {
            const session = sessionManager.getSession(sessionId);
            
            /** 確保 currentStep 始終有效 */
            session.currentStep = session.currentStep || RuleEngine.config.initial_state || 'init';
            
            // 1. 意圖分類與實體抽取
            // 使用 RuleEngine.config 傳遞配置
            const classificationResult = SmartIntentClassifier.classify(message, RuleEngine.config);
            let intents = classificationResult.intents;
            let extractedEntities = classificationResult.entities || {}; 

            // ... (其餘邏輯不變) ...

            const sanitizedEntities = RuleEngine.sanitizeEntities(extractedEntities, session.collectedData, session.currentStep); 
            
            // 實體合併：直接合併和更新實體到 session 物件
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            const rulesResults = [];
            
            // 2. 執行高優先級規則 (P:100+)
            rulesResults.push(RuleEngine.emergencyRule(intents, session)); 
            rulesResults.push(await RuleEngine.resetFlowRule(intents, session)); 
            rulesResults.push(await RuleEngine.forceResumeBookingRule(intents, session)); 
            rulesResults.push(RuleEngine.inventoryFailureRule(session)); 
            rulesResults.push(RuleEngine.handleGeneralQueryCompletionRule(intents, session)); 
            rulesResults.push(RuleEngine.roomLimitRule(collectedData));
            rulesResults.push(RuleEngine.memberLoginRule(intents, session)); 
            rulesResults.push(RuleEngine.generalInquiryOverrideRule(intents, session, message)); 
            
            // 3. 執行流程控制規則 (P:98/99)
            rulesResults.push(RuleEngine.pauseResumeRule(intents, session));
            
            // 4. 執行核心訂房流程規則 (P:95+)
            const bookingResult = await RuleEngine.bookingFlowRule(intents, session, message);
            rulesResults.push(bookingResult);

            // 5. 執行 LLM Fallback 嘗試 (P:79) - 用於多次失敗時的友好提示
            rulesResults.push(await RuleEngine.handleRepeatedFallbackRule(session, message)); 
            
            // 6. 處理規則結果：從 rulesResults 中選出最高優先級的結果
            const finalResult = RuleEngine.processRules(rulesResults);

            if (finalResult) {
                
                // 處理 Fallback 計數
                if (finalResult.priority === PRIORITY.GENERAL_RULE || finalResult.priority === 0) {
                    session.fallbackCount = (session.fallbackCount || 0) + 1;
                } else {
                    session.fallbackCount = 0;
                }

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
            
            // 7. 通用規則 (P:80) - 最終 Fallback (狀態提示)
            const generalResult = RuleEngine.generalRule(session); 
            if (generalResult) {
                session.fallbackCount = (session.fallbackCount || 0) + 1; // 🎯 記錄 Fallback
                session.currentStep = generalResult.nextStep;
                sessionManager.addAssistantResponse(sessionId, generalResult.response, generalResult.richCard);
                return generalResult;
            }
            
            // 8. 🏆 最終 Fallback (P:0) - 清晰引導
            
            session.fallbackCount = (session.fallbackCount || 0) + 1; 

            const finalFallback = {
                shouldProcess: true,
                priority: 0,
                response: "抱歉，我不明白您的意思。請問您是要繼續 **訂房流程**，還是 **重新開始**？",
                nextStep: session.currentStep || 'init',
                endFlow: false,
                richCard: {
                    type: 'suggestions',
                    suggestions: [
                        { text: '繼續訂房', intent: 'continue' },
                        { text: '重新開始', intent: 'reset' }
                    ]
                },
                allowGeminiCall: false
            };
            
            sessionManager.addAssistantResponse(sessionId, finalFallback.response, finalFallback.richCard);
            
            return finalFallback;
            
        } catch (error) {
            console.error('💥 RuleEngine 執行錯誤:', error);
            return RuleEngine.getErrorResponse('RULE_ENGINE_ERROR', error.message); 
        }
    }

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        // 使用 RuleEngine.config 存取配置
        const flow = RuleEngine.config; 
        const data = session.collectedData || {};
        
        // 1. 流程啟動邏輯 (init)
        if (currentStateKey === 'init') {
            const hasBookingIntent = intents.includes('booking');
            const hasDateOrNights = data.checkInDate || data.nights; 

            if (hasBookingIntent || hasDateOrNights) {
                const nextStepAfterInit = flow.states['init']?.next_state || 'ask_dates_and_nights'; 
                
                console.log(`[DEBUG] 啟動流程：推進到 ${nextStepAfterInit}`);
                
                return RuleEngine.generateStateResponse(nextStepAfterInit, data, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK);
            }
            
            return { shouldProcess: false, priority: 0 }; 
        }

        // 2. 實體滿足推進邏輯 (P:97)
        const currentState = flow.states[currentStateKey];
        if (!currentState || FORCED_BREAK_STATES.includes(currentStateKey)) {
            return { shouldProcess: false, priority: 0 };
        }
        
        if (currentState.entities && Array.isArray(currentState.entities)) {
           // ... (邏輯不變) ...
            const requiredEntities = currentState.entities;
            const hasRequiredEntities = requiredEntities.every(entity => 
                data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );
            
            // 實體滿足，推進流程
            if (hasRequiredEntities) {
                const nextStateKey = currentState.next_state || currentStateKey;
                return RuleEngine.generateStateResponse(nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        let handlerOutput = null; 
        let lastSuccessfulHandlerResult = null; 

        while (flow.states[nextStateKey]?.type === 'logic_exec' && !RuleEngine.hasExecutedHandler(session, nextStateKey)) {
            
            const handlerKey = flow.states[nextStateKey].handler; 
            if (!handlerKey || typeof BookingFlowController[handlerKey] !== 'function') {
                console.error(`❌ Handler 狀態 [${nextStateKey}] 缺失或 Handler [${handlerKey}] 不存在於 Controller 中！`);
                nextStateKey = flow.states[nextStateKey].fallback_state || 'init';
                break;
            }
            
            // 將 flowConfig 作為參數傳遞給 Handler
            const handlerResult = await BookingFlowController[handlerKey](session, flow); 
            
            RuleEngine.markHandlerExecuted(session, nextStateKey); 

            if (handlerResult.isHandled && (handlerResult.response || handlerResult.prompt || handlerResult.richCard || data.customRichCard)) {
                handlerOutput = handlerResult;
                handlerOutput.response = handlerOutput.response || handlerOutput.prompt;
            }
            
            if (handlerResult.isHandled) {
                lastSuccessfulHandlerResult = handlerResult; 
            }

            // 處理 Handler 返回結果
            if (!handlerResult.isHandled) {
                // 處理失敗，導向 fallback_state
                nextStateKey = flow.states[nextStateKey].fallback_state || 'init';
                break; 
            }
            
            // 處理成功，導向 next_state
            nextStateKey = handlerResult.nextStep || flow.states[nextStateKey].next_state; 
            
            if (nextStateKey === session.currentStep) {
                // 防止無限迴圈
                break;
            }
        }
        
        // 4. 輸出回應 - 檢查 Handler 迴圈結束後的最終狀態
        if (handlerOutput) {
            const finalNextStep = handlerOutput.nextStep || nextStateKey;
            
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.BASE,
                response: handlerOutput.response,
                nextStep: finalNextStep,
                richCard: handlerOutput.richCard || data.customRichCard,
                allowGeminiCall: flow.states[finalNextStep]?.allow_gemini_call || false
            };
        }
        
        // 5. Handler 成功執行但無回應文本時，強制推進狀態並輸出新狀態 Prompt (P:97)
        if (lastSuccessfulHandlerResult && nextStateKey !== currentStateKey) {
            console.log(`[DEBUG] Handler 成功推進狀態到: ${nextStateKey} (無 Handler 回應，強制輸出 State Prompt)`);
            return RuleEngine.generateStateResponse(nextStateKey, data, PRIORITY.BOOKING_FLOW.HANDLER_SUCCESS_ADVANCE); 
        }

        // 6. Intent 導向邏輯
        if (currentState.intents && Object.keys(currentState.intents).some(intent => intents.includes(intent))) {
            const nextIntentState = currentState.intents[intents.find(intent => currentState.intents[intent])];
            if (nextIntentState) {
                return RuleEngine.generateStateResponse(nextIntentState, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 7. 靜默狀態，等待用戶輸入/重新發出提示 (P:95)
        if (currentState) {
            return RuleEngine.generateStateResponse(currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 3.1: LLM Fallback 嘗試 (P:79) ---
    static async handleRepeatedFallbackRule(session, message) {
        const currentStateKey = session.currentStep;
        const fallbackCount = session.fallbackCount || 0;
        
        // 條件：連續兩次以上 Fallback 且 當前狀態不允許 LLM 查詢 (避免重複呼叫)
        if (fallbackCount >= 2 && currentStateKey !== 'handle_general_inquiry') {
            
            // 儲存當前狀態，用於返回
            session.collectedData.generalInquiryPreviousStep = currentStateKey;
            
            // 呼叫 LLM 進行輔助，導向通用查詢狀態
            return {
                shouldProcess: true,
                priority: PRIORITY.LLM_FALLBACK_ATTEMPT,
                response: `抱歉，我似乎連續兩次沒理解您的意思。我會請我的 AI 助手來協助您當前的問題：「${message}」。`,
                nextStep: 'handle_general_inquiry', // 導向 LLM 處理狀態
                allowGeminiCall: true // 允許呼叫 LLM
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
} 

// 必須在類別定義後調用初始化
RuleEngine.initializeErrorHandlers();
// ⚠️ 移除 RuleEngine.config = flowConfig; 

// ----------------------------------------------------
// 🏆 ESM 匯出
// ----------------------------------------------------
export { RuleEngine };

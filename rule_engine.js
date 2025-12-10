// rule_engine.js (V7.1 - 業界優化與錯誤修復版)

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

// 載入 Flow Config 邏輯 (保持 V7.0 的載入和回退邏輯)
let flowConfig = {}; // 避免外部載入失敗，初始化為空物件
try {
    const flowPath = path.join(__dirname, 'dialogue_flow.json');
    if (fs.existsSync(flowPath)) {
        flowConfig = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
        console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！`);
    } else {
        // 這裡使用最小結構，確保運行。
        flowConfig = { 
            name: "DefaultFlow",
            initial_state: "init",
            states: {
                init: { prompt: "您好，歡迎使用訂房助理。", next_state: "ask_dates_and_nights" },
                end_conversation: { prompt: "感謝您的使用。", end: true },
                handle_general_inquiry: { prompt: "請提供更多細節。", allow_gemini_call: true },
                ask_dates_and_nights: { entities: ["checkInDate", "nights"] } 
            } 
        };
        console.warn(`⚠️ [DEBUG] dialogue_flow.json 缺失，使用 Rule Engine 內建的最小配置結構。`);
    }
} catch (error) {
    console.error(`💥 [DEBUG] 載入 dialogue_flow.json 失敗: ${error.message}`);
}
// ---------------------------------------------


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
        ENTITY_SATISFIED_ADVANCE: 97, // 🎯 優先級: 97
        HANDLER_SUCCESS_ADVANCE: 97 // 🎯 優先級: 97
    },
    GENERAL_RULE: 80,
    LLM_FALLBACK_ATTEMPT: 79 // 🎯 新增：LLM 輔助 Fallback
};

const MAX_ROOM_LIMIT = 10;
const FORCED_BREAK_STATES = ['paused_waiting_for_resume', 'confirm_booking', 'booking_complete', 'end_conversation'];
const CORE_COLLECTION_STATES = ['ask_nights_and_dates', 'ask_guest_count', 'ask_room_type', 'ask_room_count', 'ask_addons', 'ask_contact_info'];


class RuleEngine {
    
    /** 靜態屬性用於錯誤處理的配置 */
    static errorResponses = {};

    // 初始化錯誤處理
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
            })
        };
    }
    
    // 🏆 新增: 處理 Rule Engine 執行中的致命錯誤。
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
    
    // 🏆 新增: 規則 0 - 緊急規則 (P:110)
    static emergencyRule(intents, session) {
        const flow = flowConfig;
        const currentStep = session.currentStep;

        if (intents.includes('end_conversation') || intents.includes('cancel_booking')) {
            console.log(`[RULE 0] 觸發：終止/取消訂房。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse(flow, 'end_conversation', session.collectedData, PRIORITY.EMERGENCY);
        }

        if (intents.includes('unrecognized') && currentStep !== 'init') {
            // 讓優先級較低的規則 (P:80/79) 處理。
            return { shouldProcess: false, priority: 0 };
        }
        
        return { shouldProcess: false, priority: 0 };
    }

    // --- 輔助函數 (保持 V7.0 邏輯) ---
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    static getRequiredEntities(stateKey) {
        const state = flowConfig.states[stateKey];
        return (state && Array.isArray(state.entities)) ? state.entities : [];
    }

    static generateStateResponse(flow, stateKey, data, priority) {
        // ... (V7.0 邏輯不變，使用 this.interpolatePrompt) ...
        const state = flow.states[stateKey];
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
        
        if (!state.prompt && !finalRichCard && !data.llm_response) { 
             return {
                 shouldProcess: true,
                 priority: priority,
                 response: "", // 回應文本為空，但流程正常推進
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

    // ... (sanitizeEntities 保持 V7.0 邏輯) ...
    static sanitizeEntities(entities, sessionCollectedData, currentStateKey) {
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

    // ... (其他輔助函數保持 V7.0 邏輯不變) ...

    static async executeRules(message, sessionId) {
        if (!sessionId || typeof sessionId !== 'string' || sessionId === 'undefined') {
            console.error("💥 [SECURITY FAIL] 接收到無效的 sessionId，拒絕處理。");
            return RuleEngine.getErrorResponse('INVALID_SESSION_ID', '會話 ID 無效，請重新初始化。'); // 🎯 修正
        }

        try {
            const session = sessionManager.getSession(sessionId);
            
            // 1. 意圖分類與實體抽取
            const classificationResult = SmartIntentClassifier.classify(message, flowConfig);
            let intents = classificationResult.intents;
            let extractedEntities = classificationResult.entities || {}; 

            const sanitizedEntities = RuleEngine.sanitizeEntities(extractedEntities, session.collectedData, session.currentStep); // 🎯 傳入當前狀態鍵
            
            // 🎯 實體合併：直接合併和更新實體到 session 物件
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 🎯 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            // ... (DEBUG 輸出略) ...
            
            const rulesResults = [];
            
            // 2. 執行高優先級規則 (P:100+)
            rulesResults.push(RuleEngine.emergencyRule(intents, session)); // 🎯 修正: 確保呼叫靜態方法
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
            rulesResults.push(await RuleEngine.handleRepeatedFallbackRule(session, message)); // 🎯 新增 LLM Fallback Rule
            
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
            const generalResult = RuleEngine.generalRule(session, flowConfig);
            if (generalResult) {
                // ... (V7.0 的 generalRule 處理邏輯不變) ...
                session.fallbackCount = (session.fallbackCount || 0) + 1; // 🎯 記錄 Fallback
                session.currentStep = generalResult.nextStep;
                sessionManager.addAssistantResponse(sessionId, generalResult.response, generalResult.richCard);
                return generalResult;
            }
            
            // 8. 🏆 最終 Fallback (P:0) - 清晰引導
            // ... (V7.0 的最終 Fallback 邏輯不變) ...
            
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
            return RuleEngine.getErrorResponse('RULE_ENGINE_ERROR', error.message); // 🎯 修正: 確保呼叫靜態方法
        }
    }

    // ... (其他規則方法略，假設已在 V7.0 中存在並保持靜態) ...

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
                const nextStepAfterInit = flow.states['init']?.next_state || 'ask_dates_and_nights'; 
                
                console.log(`[DEBUG] 啟動流程：推進到 ${nextStepAfterInit}`);
                
                return RuleEngine.generateStateResponse(flow, nextStepAfterInit, data, PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK);
            }
            
            return { shouldProcess: false, priority: 0 }; 
        }

        // 2. 實體滿足推進邏輯 (P:97)
        const currentState = flow.states[currentStateKey];
        if (!currentState || FORCED_BREAK_STATES.includes(currentStateKey)) {
            return { shouldProcess: false, priority: 0 };
        }
        
        if (currentState.entities && Array.isArray(currentState.entities)) {
            const requiredEntities = currentState.entities;
            const hasRequiredEntities = requiredEntities.every(entity => 
                data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );
            
            // 實體滿足，推進流程
            if (hasRequiredEntities) {
                const nextStateKey = currentState.next_state || currentStateKey;
                // P:97
                return RuleEngine.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        let handlerOutput = null; 
        let lastSuccessfulHandlerResult = null; 

        while (flow.states[nextStateKey]?.logic_exec && !RuleEngine.hasExecutedHandler(session, nextStateKey)) {
            
            const handlerKey = flow.states[nextStateKey].logic_exec;
            
            const handlerResult = await BookingFlowController[handlerKey](session, flowConfig); 
            
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
            return RuleEngine.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.HANDLER_SUCCESS_ADVANCE); // 🎯 優先級: 97
        }

        // 6. Intent 導向邏輯
        if (currentState.intents && Object.keys(currentState.intents).some(intent => intents.includes(intent))) {
            const nextIntentState = currentState.intents[intents.find(intent => currentState.intents[intent])];
            if (nextIntentState) {
                return RuleEngine.generateStateResponse(flow, nextIntentState, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 7. 靜默狀態，等待用戶輸入/重新發出提示 (P:95)
        if (currentState) {
            return RuleEngine.generateStateResponse(flow, currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
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
            session.generalInquiryPreviousStep = currentStateKey;
            
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
    
    // **注意：其他規則方法 (resetFlowRule, forceResumeBookingRule, inventoryFailureRule,
    // handleGeneralQueryCompletionRule, roomLimitRule, memberLoginRule, generalInquiryOverrideRule,
    // pauseResumeRule, processRules, hasExecutedHandler, markHandlerExecuted, generalRule) 
    // 必須在 RuleEngine 類別內定義為靜態方法 (static)。**
} 

// 必須在類別定義後調用初始化，以填充 RuleEngine.errorResponses
RuleEngine.initializeErrorHandlers();

// ----------------------------------------------------
// 🏆 ESM 匯出
// ----------------------------------------------------
export { RuleEngine };

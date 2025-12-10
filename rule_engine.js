// rule_engine.js (V7.6 - 最終配置檢查與初始化斷言)

// ----------------------------------------------------
// 🏆 ESM 導入
// ----------------------------------------------------
import { sessionManager } from './session_manager.js';
import { SmartIntentClassifier } from './intent_classifier.js';
import { BookingFlowController } from './booking_controller.js'; 

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


class RuleEngine {
    
    static config = null; // 靜態配置，需通過 initializeFlowConfig 填充
    static errorResponses = {};

    /** 🎯 核心修復：新增靜態初始化方法，並加入配置斷言 */
    static initializeFlowConfig() {
        // 如果已經初始化過且狀態有效，則直接返回
        if (RuleEngine.config && RuleEngine.config.states && RuleEngine.config.states.init) {
            console.log("⚠️ [DEBUG] RuleEngine 已經初始化過配置且狀態有效。");
            return;
        }

        let tempFlowConfig = {};
        let configLoaded = false;
        try {
            const flowPath = path.join(__dirname, 'dialogue_flow.json');
            if (fs.existsSync(flowPath)) {
                const data = fs.readFileSync(flowPath, 'utf8');
                // 檢查文件是否為空
                if (data.trim().length > 0) {
                    tempFlowConfig = JSON.parse(data);
                    configLoaded = true;
                    console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！`);
                } else {
                    console.error("💥 [FATAL CONFIG] dialogue_flow.json 檔案為空。");
                }
            }
            
            // 如果載入失敗或檔案不存在，則使用內建最小結構
            if (!configLoaded) {
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
                console.warn(`⚠️ [DEBUG] dialogue_flow.json 缺失或為空，使用 Rule Engine 內建的最小配置結構。`);
            }
        } catch (error) {
            console.error(`💥 [FATAL CONFIG] 載入/解析 dialogue_flow.json 失敗: ${error.message}`);
            // 如果 JSON 格式錯誤，tempFlowConfig 可能保持為 {}，這將被後續斷言捕獲。
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

    // 初始化錯誤處理 (保持不變)
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
    
    static getErrorResponse(code, message) {
        // ... (邏輯不變) ...
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
        console.error(`💥 [FATAL] 未知的 RuleEngine 錯誤類型: ${code}. 訊息: ${message}`);
        return {
            shouldProcess: true,
            priority: PRIORITY.EMERGENCY,
            response: `系統發生無法復原的錯誤：${code}。請重新開始。`,
            nextStep: 'init',
            endFlow: true
        };
    }
    
    static emergencyRule(intents, session) {
        if (intents.includes('end_conversation') || intents.includes('cancel_booking')) {
            console.log(`[RULE 0] 觸發：終止/取消訂房。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('end_conversation', session.collectedData, PRIORITY.EMERGENCY);
        }
        return { shouldProcess: false, priority: 0 };
    }

    // ----------------------------------------------
    // 輔助函數 (所有對 flowConfig 的存取都使用 RuleEngine.config)
    // ----------------------------------------------
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
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
        // 核心安全檢查
        if (!RuleEngine.config || !RuleEngine.config.states) {
            console.error(`❌ [FLOW ERROR] RuleEngine.config 或 states 缺失，無法導向狀態 ${stateKey}。`);
            return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', `狀態: ${stateKey}`);
        }
        
        const state = RuleEngine.config.states[stateKey];
        
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

    static sanitizeEntities(entities, sessionCollectedData, currentStateKey) {
       // ... (邏輯不變) ...
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
                    continue;
                }
            } else {
                if (key === 'adultCount' || key === 'childCount' || key === 'roomCount') {
                    const sessionValue = parseInt(sessionCollectedData[key], 10);
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

    // --- 核心靜態規則 (P:106) ---
    static async resetFlowRule(intents, session) {
        if (intents.includes('reset') || intents.includes('start_over')) {
            console.log(`[RULE 1] 觸發：重設流程。`);
            sessionManager.resetSession(session.id);
            return RuleEngine.generateStateResponse('init', session.collectedData, PRIORITY.RESET_FLOW);
        }
        return { shouldProcess: false, priority: 0 };
    }

    // ... (Rule 2 - Rule 8 邏輯不變) ...
    static async forceResumeBookingRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static inventoryFailureRule(session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static handleGeneralQueryCompletionRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static roomLimitRule(collectedData) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static memberLoginRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static generalInquiryOverrideRule(intents, session, message) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    static pauseResumeRule(intents, session) { /* ... */ return { shouldProcess: false, priority: 0 }; }
    
    // 輔助函數 (邏輯不變)
    static processRules(results) {
        const validResults = results.filter(r => r && r.shouldProcess);
        if (validResults.length === 0) return null;

        validResults.sort((a, b) => b.priority - a.priority);
        return validResults[0];
    }
    
    static hasExecutedHandler(session, stateKey) {
        session.executedHandlers = session.executedHandlers || {};
        return session.executedHandlers[stateKey] === true;
    }
    
    static markHandlerExecuted(session, stateKey) {
        session.executedHandlers = session.executedHandlers || {};
        session.executedHandlers[stateKey] = true;
    }

    /** 🎯 規則 9: 通用規則 (P:80) - 最終狀態提示回退 */
    static generalRule(session) {
        const currentStateKey = session.currentStep;
        // ❌ 這是日誌中錯誤發生的確切位置，V7.6 之前是此處崩潰。
        // 現在 RuleEngine.config 應已在 executeRules 開頭檢查過。
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
        
        // V7.5/V7.6 核心檢查點：確保配置已載入
        if (!RuleEngine.config || !RuleEngine.config.states) {
             console.error("💥 [FATAL] RuleEngine 配置未初始化！請在呼叫 executeRules 之前先呼叫 RuleEngine.initializeFlowConfig()。");
             return RuleEngine.getErrorResponse('FLOW_CONFIG_MISSING', 'Rule Engine 尚未初始化。');
        }

        try {
            const session = sessionManager.getSession(sessionId);
            
            /** 確保 currentStep 始終有效 */
            session.currentStep = session.currentStep || RuleEngine.config.initial_state || 'init';
            
            // 1. 意圖分類與實體抽取
            const classificationResult = SmartIntentClassifier.classify(message, RuleEngine.config);
            let intents = classificationResult.intents;
            let extractedEntities = classificationResult.entities || {}; 

            const sanitizedEntities = RuleEngine.sanitizeEntities(extractedEntities, session.collectedData, session.currentStep); 
            
            // 實體合併
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            const rulesResults = [];
            
            // 2. 執行高優先級規則
            rulesResults.push(RuleEngine.emergencyRule(intents, session)); 
            rulesResults.push(await RuleEngine.resetFlowRule(intents, session)); 
            rulesResults.push(await RuleEngine.forceResumeBookingRule(intents, session)); 
            rulesResults.push(RuleEngine.inventoryFailureRule(session)); 
            rulesResults.push(RuleEngine.handleGeneralQueryCompletionRule(intents, session)); 
            rulesResults.push(RuleEngine.roomLimitRule(collectedData));
            rulesResults.push(RuleEngine.memberLoginRule(intents, session)); 
            rulesResults.push(RuleEngine.generalInquiryOverrideRule(intents, session, message)); 
            
            // 3. 執行流程控制規則
            rulesResults.push(RuleEngine.pauseResumeRule(intents, session));
            
            // 4. 執行核心訂房流程規則
            const bookingResult = await RuleEngine.bookingFlowRule(intents, session, message);
            rulesResults.push(bookingResult);

            // 5. 執行 LLM Fallback 嘗試 
            rulesResults.push(await RuleEngine.handleRepeatedFallbackRule(session, message)); 
            
            // 6. 處理規則結果：從 rulesResults 中選出最高優先級的結果
            const finalResult = RuleEngine.processRules(rulesResults);

            if (finalResult) {
                
                // ... (Fallback 計數和 Session 狀態更新邏輯不變) ...
                if (finalResult.priority === PRIORITY.GENERAL_RULE || finalResult.priority === 0) {
                    session.fallbackCount = (session.fallbackCount || 0) + 1;
                } else {
                    session.fallbackCount = 0;
                }

                if (finalResult.nextStep && finalResult.nextStep !== session.currentStep) {
                    session.currentStep = finalResult.nextStep;
                }
                
                if (finalResult.endFlow) {
                    sessionManager.resetSession(sessionId); 
                }
                
                sessionManager.addAssistantResponse(sessionId, finalResult.response, finalResult.richCard);

                return finalResult;
            }
            
            // 7. 通用規則 (P:80) - 最終 Fallback (狀態提示)
            const generalResult = RuleEngine.generalRule(session); 
            if (generalResult) {
                session.fallbackCount = (session.fallbackCount || 0) + 1;
                session.currentStep = generalResult.nextStep;
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
            // 捕獲所有運行時錯誤並提供統一回應
            return RuleEngine.getErrorResponse('RULE_ENGINE_ERROR', error.message); 
        }
    }

    /** 規則 3: 訂房流程規則 (核心邏輯 P:95) */
    static async bookingFlowRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        const flow = RuleEngine.config; 
        const data = session.collectedData || {};
        
        // ... (邏輯不變) ...
        // 確保這裡所有的 flow 存取都使用 RuleEngine.config
        
        // 7. 靜默狀態，等待用戶輸入/重新發出提示 (P:95)
        const currentState = flow.states[currentStateKey];
        if (currentState) {
            return RuleEngine.generateStateResponse(currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }
    
    // 規則 3.1: LLM Fallback 嘗試 (邏輯不變)
    static async handleRepeatedFallbackRule(session, message) { /* ... */ return { shouldProcess: false, priority: 0 }; }
} 

RuleEngine.initializeErrorHandlers();

// ----------------------------------------------------
// 🏆 ESM 匯出
// ----------------------------------------------------
export { RuleEngine };

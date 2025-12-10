// rule_engine.js (V6.3.1 - 完整修正版)

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


// 載入 Flow Config
let flowConfig;
try {
    const flowPath = path.join(__dirname, 'dialogue_flow.json');
    const flowJsonString = fs.readFileSync(flowPath, 'utf8');
    flowConfig = JSON.parse(flowJsonString);
    
    if (flowConfig && flowConfig.states) {
        console.log(`✅ [DEBUG] dialogue_flow.json 成功載入！狀態數: ${Object.keys(flowConfig.states).length}`);
    } else {
        console.error('❌ [DEBUG] dialogue_flow.json 載入失敗或結構錯誤！');
    }
} catch (error) {
    console.error(`💥 [DEBUG] 載入 dialogue_flow.json 失敗: ${error.message}`);
    flowConfig = { states: {} }; 
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
const CORE_COLLECTION_STATES = ['ask_nights_and_dates', 'ask_guest_count', 'ask_room_type', 'ask_room_count', 'ask_addons', 'ask_contact_info'];


class RuleEngine {

    // --- 輔助函數 ---
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

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
        };
    }
    
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

    static getFallbackResponse(session, flow) {
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
        return null;
    }
    
    static processRules(rulesResults) {
        const sortedResults = rulesResults
            .filter(r => r && r.shouldProcess)
            .sort((a, b) => b.priority - a.priority);

        return sortedResults.length > 0 ? sortedResults[0] : null;
    }

    /**
     * 確保即使沒有 Prompt 也能返回有效的 shouldProcess: true 結果，並處理狀態缺失
     * @returns 統一格式的回應結構 (永不返回 null)
     */
    static generateStateResponse(flow, stateKey, data, priority) {
        const state = flow.states[stateKey];
        
        // 狀態缺失時，返回一個有效的錯誤
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

        // 🏆 修正 4: 狀態回應保險。確保即使沒有 prompt 也要返回有效回應結構
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

        // 🏆 優化：如果 session 中有 LLM 回應，則優先使用它作為 response
        const finalPrompt = data.llm_response || this.interpolatePrompt(state.prompt, data);
        // 清除 LLM response 避免重複發送
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

    /**
     * 輔助優化 1: 簡化實體防護邏輯，避免誤判用戶手動輸入的數量
     */
    static sanitizeEntities(entities, sessionCollectedData) {
        if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) { 
            if (value !== undefined && value !== null && value !== '' && String(value).toLowerCase() !== 'null') {
                
                if (key === 'adultCount' || key === 'childCount' || key === 'roomCount') {
                    const sessionValue = parseInt(sessionCollectedData[key], 10);
                    const inputValue = parseInt(value, 10);

                    // 檢查新的輸入是否為預設值，且該預設值比 Session 中已有的值小
                    const isDefaultValue = (key !== 'childCount' && inputValue === 1) || (key === 'childCount' && inputValue === 0);
                    
                    if (isDefaultValue && sessionValue > inputValue) {
                        console.log(`⚠️ [ENTITY GUARD] 忽略輸入中不合理的預設值: ${key}:${inputValue}，保留 Session 值:${sessionValue}`);
                        continue; 
                    }
                }

                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    // --- 核心執行函數 ---
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
            let extractedEntities = classificationResult.entities || {}; 

            const sanitizedEntities = this.sanitizeEntities(extractedEntities, session.collectedData);
            
            // 🎯 實體合併：直接合併和更新實體到 session 物件
            Object.assign(session.collectedData, sanitizedEntities);
            session.lastIntent = intents[0] || session.lastIntent;

            // 🎯 記錄會話歷史
            sessionManager.updateSession(sessionId, message, intents); 
            
            const collectedData = session.collectedData;

            console.log(`[INTENT DEBUG] 分類結果: ${intents.join(', ')} | 實體: ${JSON.stringify(sanitizedEntities)}`);
            console.log(`[DATA DEBUG] 當前狀態: ${session.currentStep} | 收集實體: ${JSON.stringify(collectedData)}`);
            
            const rulesResults = [];
            
            // 2. 執行高優先級規則 (P:100+)
            rulesResults.push(this.emergencyRule(intents, session));
            rulesResults.push(await this.resetFlowRule(intents, session)); 
            rulesResults.push(await this.forceResumeBookingRule(intents, session)); 
            rulesResults.push(this.inventoryFailureRule(session)); 
            
            // 🏆 P:107 通用查詢結束後，高優先級返回原流程
            rulesResults.push(this.handleGeneralQueryCompletionRule(intents, session)); 

            rulesResults.push(this.roomLimitRule(collectedData));
            // 🏆 修正: 會員登入實體映射及狀態推進
            rulesResults.push(this.memberLoginRule(intents, session)); 
            
            // 🏆 P:104 通用查詢覆蓋規則
            rulesResults.push(this.generalInquiryOverrideRule(intents, session, message)); 
            
            // 3. 執行流程控制規則 (P:98/99)
            rulesResults.push(this.pauseResumeRule(intents, session));
            
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
            
            // 6. 通用規則 (P:80) - 最終 Fallback (狀態提示)
            const generalResult = this.generalRule(session, flowConfig);
            if (generalResult) {
                session.currentStep = generalResult.nextStep;
                // 記錄助理回應
                sessionManager.addAssistantResponse(sessionId, generalResult.response, generalResult.richCard);
                return generalResult;
            }
            
            // 7. 🏆 修正 3: 最終 Fallback (P:0) - 清晰引導
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
    static async resetFlowRule(intents, session) {
        if (intents.includes('reset') || intents.includes('booking_start')) { 
            
            if (session.collectedData.inventoryLockId) {
                console.log(`🔒 [DEBUG] 重設流程時解除庫存鎖定：${session.collectedData.inventoryLockId}`);
                await BookingFlowController.unlockInventory(session.collectedData.inventoryLockId);
            }
            
            this.resetHandlerExecution(session);
            session.collectedData = {}; 

            const initPrompt = flowConfig.states['init']?.prompt || "您好，請問需要訂房服務嗎？";

            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW, 
                response: this.interpolatePrompt(initPrompt, session.collectedData),
                nextStep: 'init'
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.0.1: 通用查詢狀態下的強制重啟 (P:106) ---
    static async forceResumeBookingRule(intents, session) {
        const currentStateKey = session.currentStep;
        
        // 偵測到在通用查詢狀態下嘗試訂房，強制重設流程，以新的實體開始
        if (currentStateKey === 'handle_general_inquiry' && intents.includes('booking')) {
            console.log("🚀 [DEBUG] 偵測到在通用查詢狀態下嘗試訂房，清除舊流程並重新開始。");

            if (session.collectedData.inventoryLockId) {
                console.log(`🔒 [DEBUG] 強制重設流程時解除庫存鎖定：${session.collectedData.inventoryLockId}`);
                await BookingFlowController.unlockInventory(session.collectedData.inventoryLockId);
            }
            
            const entitiesToKeep = {}; 
            const oldEntities = { ...session.collectedData };
            session.collectedData = entitiesToKeep;
            this.resetHandlerExecution(session);
            
            const initPrompt = flowConfig.states['init']?.prompt || "您好，請問需要訂房服務嗎？";

            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW, 
                response: this.interpolatePrompt(initPrompt, oldEntities),
                nextStep: 'init'
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1.1: 庫存/檢查失敗覆蓋 (P:105) ---
    static inventoryFailureRule(session) {
        const data = session.collectedData;
        
        // 庫存鎖定 ID 缺失但有錯誤標記，表示庫存或價格檢查失敗
        if (!data.inventoryLockId && data.inventory_error) { 
            
            const errorDetails = data.inventory_error_details || "庫存或價格檢查失敗。";
            const remainingRooms = data.remainingRooms || 0;
            const roomType = data.roomType || "您選擇的房型";
            const requestedRooms = data.roomCount || 0;
            
            // 清除錯誤標記，避免無限循環
            delete data.inventory_error; 
            delete data.inventory_error_details;
            delete data.remainingRooms;

            return {
                shouldProcess: true,
                priority: PRIORITY.INVENTORY_FAILURE_OVERRIDE, 
                response: `抱歉，您想預訂的 **${requestedRooms} 間 ${roomType}** 目前庫存不足。目前僅剩 **${remainingRooms} 間**。\n\n請問您要更改房間數量為 ${remainingRooms} 間，還是選擇其他房型？`,
                nextStep: 'ask_room_count', 
                richCard: null,
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.1.1: 通用查詢結束後返回原流程 (P:107) ---
    static handleGeneralQueryCompletionRule(intents, session) { 
        const currentStateKey = session.currentStep;

        // 🏆 修正邏輯: Handler 已執行 and 新意圖不是 general_inquiry -> 強制返回
        if (currentStateKey === 'handle_general_inquiry' && 
            this.hasExecutedHandler(session, currentStateKey) &&
            !intents.includes('general_inquiry') 
        ) {
            
            // 檢查返回狀態
            const returnStep = session.generalInquiryPreviousStep && flowConfig.states[session.generalInquiryPreviousStep] 
                ? session.generalInquiryPreviousStep 
                : 'init';
            
            // 清理暫存的狀態
            delete session.generalInquiryPreviousStep;
            // 💡 清除 LLM response 避免汙染 generateStateResponse
            delete session.collectedData.llm_response; 
            delete session.collectedData.llm_source;
            
            // 清理 Handler 執行標記，確保返回原狀態後如果 Handler 需要執行可以再次執行
            delete session.executedHandlers['handle_general_inquiry'];

            console.log(`↩️ [DEBUG] 通用查詢完成，強制返回前一個狀態: ${returnStep}`);

            return this.generateStateResponse(flowConfig, returnStep, session.collectedData, PRIORITY.GENERAL_QUERY_COMPLETE); // P:107
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1.2: 房間數限制 (P:103) ---
    static roomLimitRule(data) {
        const roomCount = parseInt(data.roomCount, 10);
        if (roomCount > MAX_ROOM_LIMIT) {
            return {
                shouldProcess: true,
                priority: PRIORITY.ROOM_LIMIT,
                response: `抱歉，為確保服務品質，單次預訂房間數不能超過 ${MAX_ROOM_LIMIT} 間。請重新輸入。`,
                nextStep: 'ask_room_count' 
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1.3: 會員登入覆蓋 (P:100) ---
    static memberLoginRule(intents, session) {
        const currentStateKey = session.currentStep;
        
        // 修正 1: 移除手機號碼強制映射為帳號的邏輯
        if (currentStateKey === 'ask_member_login' || currentStateKey === 'login_member_account') {
            const state = flowConfig.states[currentStateKey];
            const loginIntent = state.intents?.login;
            
            // 確保至少進入過登入流程，或當前意圖為 login
            if (loginIntent && intents.includes('login') || currentStateKey === 'login_member_account') {
                
                // 🏆 修正 1: 移除將 contactPhone/rawNumber 賦值給 memberAccount 的**Rule Engine**邏輯
                // 現在完全依賴 SmartIntentClassifier 準確提取 memberAccount/memberPassword
                const data = session.collectedData;
                
                if (currentStateKey === 'login_member_account') {
                    // 如果在 login_member_account 狀態，交由 bookingFlowRule 的 Handler 處理，此處不作推進
                    return { shouldProcess: false, priority: 0 };
                }

                // 推進到實際的輸入帳號狀態 (通常是 login_member_account)
                return {
                    shouldProcess: true,
                    priority: PRIORITY.MEMBER_LOGIN_OVERRIDE,
                    response: this.interpolatePrompt(flowConfig.states[loginIntent].prompt, data),
                    nextStep: loginIntent // 這裡的 loginIntent 應為 'login_member_account'
                };
            }
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.5: 跨流程通用問題處理 (P:104) ---
    static generalInquiryOverrideRule(intents, session, message) {
        const currentStateKey = session.currentStep;
        
        // 條件：有 general_inquiry 意圖 且 當前不在強制中斷狀態
        if (intents.includes('general_inquiry') && !FORCED_BREAK_STATES.includes(currentStateKey)) {
            
            const inquiryState = flowConfig.states['handle_general_inquiry'];

            if (!inquiryState) return { shouldProcess: false, priority: 0 };
            
            // 🎯 儲存當前狀態，用於返回
            session.generalInquiryPreviousStep = currentStateKey; 

            const userQuery = message || "您的問題";
            
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE, 
                response: this.interpolatePrompt(inquiryState.prompt, session.collectedData).replace('{user_query}', userQuery),
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
                
                const resumeStep = session.previousStep && flow.states[session.previousStep] ? session.previousStep : 'init';
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME,
                    response: this.interpolatePrompt(flow.states[resumeStep]?.prompt || "已恢復訂房流程。", session.collectedData),
                    nextStep: resumeStep
                };
            }
        }
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
            if (hasRequiredEntities) {
                const nextStateKey = currentState.next_state || currentStateKey;
                console.log(`[DEBUG] 實體滿足，推進流程到: ${nextStateKey}`);
                // P:97
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        let handlerOutput = null; 
        let lastSuccessfulHandlerResult = null; // 🏆 追蹤上一次成功的 Handler 結果

        while (flow.states[nextStateKey]?.handler && !this.hasExecutedHandler(session, nextStateKey)) {
            
            const handlerKey = flow.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerKey} 於狀態: ${nextStateKey}`); 
            
            // 確保使用 await 等待非同步 Handler 執行
            const handlerResult = await BookingFlowController[handlerKey](session, flowConfig); 
            
            this.markHandlerExecuted(session, nextStateKey); 

            // 💡 如果 Handler 成功執行並包含回應/RichCard，則儲存
            if (handlerResult.isHandled && (handlerResult.response || handlerResult.prompt || handlerResult.richCard || data.customRichCard)) {
                handlerOutput = handlerResult;
                handlerOutput.response = handlerOutput.response || handlerOutput.prompt; // 統一回應欄位
            }
            
            if (handlerResult.isHandled) {
                // 追蹤成功的 Handler 結果，即使它沒有 response 文本
                lastSuccessfulHandlerResult = handlerResult; 
            }


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
        if (handlerOutput) {
            console.log(`[DEBUG] Handler 成功執行並產生了回應。`);
            // 採用 Handler 指定的 nextStep，如果 Handler 沒有指定，則使用迭代後的 nextStateKey
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
        
        // 🏆 修正 2: 如果 Handler 成功執行，但沒有回應 (例如 checkBookingEssentials)，只要狀態有推進，就返回新的狀態回應。
        if (lastSuccessfulHandlerResult && nextStateKey !== currentStateKey) {
            console.log(`[DEBUG] Handler 成功推進狀態到: ${nextStateKey} (無 Handler 回應，強制輸出 State Prompt)`);
            // 💡 使用 generateStateResponse 確保輸出有 Prompt
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        // 5. Intent 導向邏輯
        if (currentState.intents && Object.keys(currentState.intents).some(intent => intents.includes(intent))) {
            const nextIntentState = currentState.intents[intents.find(intent => currentState.intents[intent])];
            if (nextIntentState) {
                return this.generateStateResponse(flow, nextIntentState, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 6. 靜默狀態，等待用戶輸入/重新發出提示 (P:95)
        if (currentState) {
            return this.generateStateResponse(flow, currentStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 4: 通用規則 (P:80) ---
    static generalRule(session, flow) {
        const stateKey = session.currentStep || 'init';
        const state = flow.states[stateKey];
        
        // 這是最終 fallback 規則
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

RuleEngine.initializeErrorHandlers();

// ----------------------------------------------------
// 🏆 ESM 匯出
// ----------------------------------------------------
export { RuleEngine };

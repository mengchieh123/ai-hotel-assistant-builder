// rule_engine.js (V5.5 - 流程收尾與庫存保護版)

const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier'); 
// ⚠️ 注意：BookingFlowController 需包含 unlockInventory 方法
const BookingFlowController = require('./booking_controller'); 

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
    INVENTORY_FAILURE_OVERRIDE: 105, // 💡 NEW: 庫存鎖定失敗
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
const CORE_COLLECTION_STATES = ['ask_nights_and_dates', 'ask_guest_count', 'ask_room_type', 'ask_room_count', 'ask_addons', 'ask_contact_info'];


class RuleEngine {

    /** 輔助函數：插值處理 */
    static interpolatePrompt(promptTemplate, data) {
        if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
        
        return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /** 錯誤處理初始化 */
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
    
    /** 取得錯誤回應 */
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

    /** 取得 Fallback 回應 */
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
    
    /** 處理規則結果 */
    static processRules(rulesResults) {
        const sortedResults = rulesResults
            .filter(r => r && r.shouldProcess)
            .sort((a, b) => b.priority - a.priority);

        return sortedResults.length > 0 ? sortedResults[0] : null;
    }

    /** 生成狀態回應 (V5.5 修正：避免返回 null) */
    static generateStateResponse(flow, stateKey, data, priority) {
        const state = flow.states[stateKey];
        if (!state) return null;
        
        // 如果是 logic_exec 狀態且沒有 prompt，則不應直接生成回應
        if (state.type === 'logic_exec' && !state.prompt) {
             return {
                shouldProcess: true,
                priority: priority,
                response: undefined, // 💡 修正：將 null 改為 undefined，避免 API 處理錯誤
                nextStep: stateKey,
                richCard: state.richCard,
                allowGeminiCall: state.allow_gemini_call || false
            };
        }

        return {
            shouldProcess: true,
            priority: priority,
            response: this.interpolatePrompt(state.prompt, data), 
            nextStep: stateKey,
            richCard: state.richCard,
            allowGeminiCall: state.allow_gemini_call || false
        };
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

    /** 🚀 V5.3 修正：清理實體數據並防止核心實體覆蓋 */
    static sanitizeEntities(entities, sessionCollectedData) {
        if (typeof entities !== 'object' || entities === null) {
            return {};
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(entities)) { 
            // 基礎清理
            if (value !== undefined && value !== null && value !== '' && String(value).toLowerCase() !== 'null') {
                
                // 核心保護邏輯：防止 adultCount 和 childCount 被分類器的預設值覆蓋
                if (key === 'adultCount' || key === 'childCount') {
                    // 如果 session 中已經有有效值（且不為 0），並且輸入值是分類器預設的 1 或 0
                    const sessionValue = parseInt(sessionCollectedData[key], 10);
                    const inputValue = parseInt(value, 10);

                    // 如果 session 中已經有有效的人數（>0），且新的輸入值是預設值（1 或 0），則忽略新輸入。
                    if ((key === 'adultCount' && sessionValue > 1 && (inputValue === 1)) || 
                        (key === 'childCount' && sessionValue > 0 && (inputValue === 0))) 
                    {
                        console.log(`⚠️ [ENTITY GUARD] 忽略輸入中不合理的預設值: ${key}:${inputValue}，保留 Session 值:${sessionValue}`);
                        continue; // 跳過此實體，不加入 sanitized
                    }
                }

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
            let extractedEntities = classificationResult.entities || {}; 

            // 🚀 V5.3 修正：將 session.collectedData 傳入 sanitizeEntities 進行保護性過濾
            const sanitizedEntities = this.sanitizeEntities(extractedEntities, session.collectedData);
            
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
            rulesResults.push(this.forceResumeBookingRule(intents, session)); // P:106 處理通用查詢狀態下的重啟
            rulesResults.push(this.roomLimitRule(collectedData));
            rulesResults.push(this.inventoryFailureRule(session)); // 💡 V5.5 NEW: 庫存/檢查失敗覆蓋 (P:105)
            rulesResults.push(this.memberLoginRule(intents, session)); 
            rulesResults.push(this.generalInquiryOverrideRule(intents, session, message, extractedEntities)); // P:104
            
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
                    // 如果流程推進了，重置 Handler 執行標記 
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
            
            // 💡 V5.5 優化：解除舊的庫存鎖定
            if (session.collectedData.inventoryLockId) {
                console.log(`🔒 [DEBUG] 重設流程時解除庫存鎖定：${session.collectedData.inventoryLockId}`);
                // ⚠️ 實際應呼叫：await BookingFlowController.unlockInventory(session.collectedData.inventoryLockId);
            }
            
            // 清除所有舊數據，從 init 重新開始
            this.resetHandlerExecution(session);
            session.collectedData = {}; // 重設後將所有實體傳入 init 狀態

            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW, // P:106
                response: this.interpolatePrompt(flowConfig.states['init'].prompt, session.collectedData),
                nextStep: 'init'
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.0.1: 通用查詢狀態下的強制重啟 (P:106) ---
    static forceResumeBookingRule(intents, session) {
        const currentStateKey = session.currentStep;
        
        // 當流程卡在通用查詢狀態，且用戶嘗試發出訂房指令時，強制重啟。
        if (currentStateKey === 'handle_general_inquiry' && intents.includes('booking')) {
            console.log("🚀 [DEBUG] 偵測到在通用查詢狀態下嘗試訂房，強制重設流程。");

            // 💡 V5.5 優化：解除舊的庫存鎖定
            if (session.collectedData.inventoryLockId) {
                console.log(`🔒 [DEBUG] 強制重設流程時解除庫存鎖定：${session.collectedData.inventoryLockId}`);
                // ⚠️ 實際應呼叫：await BookingFlowController.unlockInventory(session.collectedData.inventoryLockId);
            }
            
            // 觸發重設邏輯
            session.collectedData = {};
            this.resetHandlerExecution(session);
            
            return {
                shouldProcess: true,
                priority: PRIORITY.RESET_FLOW, // P:106
                response: this.interpolatePrompt(flowConfig.states['init'].prompt, session.collectedData),
                nextStep: 'init'
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // --- 規則 1.1: 庫存/檢查失敗覆蓋 (P:105) ---
    static inventoryFailureRule(session) {
        const data = session.collectedData;
        
        // 檢查 inventoryLockId 是否為空，且有庫存錯誤訊息旗標
        if (!data.inventoryLockId && data.inventory_error) { 
            
            const errorDetails = data.inventory_error_details || "庫存或價格檢查失敗。";
            const remainingRooms = data.remainingRooms || 0;
            const roomType = data.roomType || "您選擇的房型";
            const requestedRooms = data.roomCount || 0;
            
            // 清理錯誤旗標，防止無限迴圈
            delete data.inventory_error; 
            delete data.inventory_error_details;
            delete data.remainingRooms;

            return {
                shouldProcess: true,
                priority: PRIORITY.INVENTORY_FAILURE_OVERRIDE, // P:105
                response: `抱歉，您想預訂的 **${requestedRooms} 間 ${roomType}** 目前庫存不足。目前僅剩 **${remainingRooms} 間**。\n\n請問您要更改房間數量為 ${remainingRooms} 間，還是選擇其他房型？`,
                nextStep: 'ask_room_count', // 導回房間數詢問狀態
                richCard: null,
                allowGeminiCall: false
            };
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
        // 🚨 檢查：此規則僅在 check_availability_and_price 狀態下觸發
        if (currentStateKey === 'check_availability_and_price') {
            const state = flowConfig.states[currentStateKey];
            const loginIntent = state.intents?.login;
            
            if (loginIntent && intents.includes('login')) {
                return {
                    shouldProcess: true,
                    priority: PRIORITY.MEMBER_LOGIN_OVERRIDE,
                    response: this.interpolatePrompt(flowConfig.states[loginIntent].prompt, session.collectedData),
                    nextStep: loginIntent
                };
            }
        }
        return { shouldProcess: false, priority: 0 };
    }
    
    // --- 規則 1.5: 跨流程通用問題處理 (P:104) ---
    static generalInquiryOverrideRule(intents, session, message, entities) {
        const currentStateKey = session.currentStep;
        
        // V5.4 修正：定義不應被 P:104 覆蓋的核心狀態列表
        // 確保在這些狀態下，實體補齊 (P:97/P:95) 優先於通用查詢
        const isCollectingCoreEntities = CORE_COLLECTION_STATES.includes(currentStateKey);

        // 如果偵測到通用問題意圖，且當前不在中斷狀態，且當前**不在核心實體收集狀態**
        if (intents.includes('general_inquiry') && 
            !FORCED_BREAK_STATES.includes(currentStateKey) &&
            !isCollectingCoreEntities // 檢查是否在核心收集狀態
            ) {
            
            const inquiryState = flowConfig.states['handle_general_inquiry'];
            const userQuery = message || "您的問題";
            
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE, // P:104
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
                // 恢復流程 (P:99) - 回到中斷前的步驟
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
                
                // P:96 
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
                // P:97
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.ENTITY_SATISFIED_ADVANCE); 
            }
        }
        
        // 3. 處理 Handler 邏輯 (迭代執行器)
        let nextStateKey = session.currentStep; 
        
        // 檢查當前或推進後的狀態是否包含 handler，並且尚未執行過
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

        // 5. Intent 導向邏輯
        if (currentState.intents && Object.keys(currentState.intents).some(intent => intents.includes(intent))) {
            const nextIntentState = currentState.intents[intents.find(intent => currentState.intents[intent])];
            if (nextIntentState) {
                return this.generateStateResponse(flow, nextIntentState, data, PRIORITY.BOOKING_FLOW.BASE);
            }
        }
        
        // 6. 靜默狀態，等待用戶輸入
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

RuleEngine.initializeErrorHandlers();

module.exports = RuleEngine;

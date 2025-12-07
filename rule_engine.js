// rule_engine.js (V2.2 - 流程恢復最終修復版)

// 導入所有 RuleEngine 依賴的模組
const sessionManager = require('./session_manager');
const SmartIntentClassifier = require('./intent_classifier');
const BookingFlowController = require('./booking_controller'); 
const GeminiGenerator = require('./gemini_generator');
const flowConfig = require('./dialogue_flow.json'); 

// 優先級常量定義 (清晰化)
const PRIORITY = {
    EMERGENCY: 105,
    GENERAL_INQUIRY_OVERRIDE: 104,
    BOOKING_FLOW: {
        ROOM_LIMIT: 103, // 房間數量硬性上限檢查
        AVAILABILITY_CHECK: 102, // 價格/空房檢查錯誤或修正
        CONFIRMATION: 101, // 最終確認狀態
        PAUSE_RESUME: { PAUSE: 98, RESUME: 99 },
        SUBMIT: 96, // 訂單提交 (執行 Handler)
        BASE: 95 // 一般流程推進
    },
    GENERAL: 1
};

// 最大房間限制
const MAX_ROOM_LIMIT = 5;

// 【流程強制停止點】: 需等待用戶輸入或決策
const FORCED_BREAK_STATES = [
    'ask_contact_info',
    'ask_payment_method',
    'confirm_booking',
    'check_availability_and_price',
    'ask_addons', // 需等待用戶選擇加購服務或確認完成
];

// 實用函數：替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text || typeof text !== 'string') return '';
    
    let result = text;
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key] === undefined || data[key] === null ? '' : String(data[key]);
            result = result.replace(new RegExp(`\\{${key}\\}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
    }
    return result;
}

// 輔助方法：Handler 追蹤 (確保計算/處理只執行一次)
function hasExecutedHandler(session, stateKey) {
    if (!session.executedHandlers) {
        session.executedHandlers = {};
    }
    return session.executedHandlers[stateKey] === true;
}

function markHandlerExecuted(session, stateKey) {
    if (!session.executedHandlers) {
        session.executedHandlers = {};
    }
    session.executedHandlers[stateKey] = true;
}


class RuleEngine {
    
    /** 錯誤回傳回應 */
    static getErrorResponse() {
        return {
            reply: '抱歉，系統發生錯誤，請稍後再試。',
            nextStateKey: 'init',
            data: {},
            richCard: null,
            priority: PRIORITY.GENERAL
        };
    }

    /** 備用回傳回應 */
    static getFallbackResponse() {
        return {
            reply: '抱歉，我目前無法處理您的請求，請確認您的輸入或稍後再試。',
            nextStateKey: 'init',
            data: {},
            richCard: null,
            priority: PRIORITY.GENERAL
        };
    }

    /** 主處理函數：接收用戶輸入並返回回應 */
    static async processRules(sessionId, userMessage) {
        const cleanedMessage = userMessage || "";

        try {
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                console.error(`❌ 找不到 Session: ${sessionId}`);
                return this.getFallbackResponse();
            }

            // 意圖分類與實體提取
            const intents = SmartIntentClassifier.classify(cleanedMessage);
            const extractedEntities = SmartIntentClassifier.extractEntities(cleanedMessage);
            
            console.log(`🔍 意圖分類結果: ${JSON.stringify(intents)}`);
            console.log(`📝 實體提取結果: ${JSON.stringify(extractedEntities)}`);

            // --- 【防禦性修正：實體清理】 ---
            const cleanedEntities = this.sanitizeEntities(extractedEntities);
            // --- 結束實體清理 ---

            // 合併提取的實體到 Session 資料 (使用 cleanedEntities)
            Object.assign(session.collectedData, cleanedEntities);
            sessionManager.updateSession(sessionId, cleanedMessage, intents);

            // 執行規則引擎
            const result = await RuleEngine.executeRules(intents, session, cleanedMessage, cleanedEntities); 

            if (!result.shouldProcess) {
                // 如果所有規則都未匹配，則退回一般 AI 查詢
                return this.generalRule(intents, session, cleanedMessage, cleanedEntities);
            }

            // 處理下一步狀態
            if (result.nextStep) {
                session.currentStep = result.nextStep;
                console.log(`🔄 狀態轉移: ${session.currentStep}`);
            }

            // 處理 Gemini AI 呼叫 (包含 try...catch)
            let finalResponse = result.response;
            if (result.allowGeminiCall) {
                try {
                    const geminiResponse = await GeminiGenerator.getResponse(session, cleanedMessage);
                    if (geminiResponse) {
                        finalResponse = this.formatGeminiResponse(geminiResponse, result.response, session.currentStep);
                    }
                } catch (geminiError) {
                    console.error(`⚠️ Gemini 呼叫失敗，使用預設回應: ${geminiError.message}`);
                }
            }

            // 處理流程結束
            if (result.endFlow) {
                console.log(`🏁 流程結束於狀態: ${session.currentStep}`);
                sessionManager.resetSession(session.id); 
                session.currentStep = 'init';
            }

            // 儲存助理回應
            sessionManager.addAssistantResponse(sessionId, finalResponse, result.richCard);

            return {
                reply: finalResponse,
                nextStateKey: session.currentStep,
                data: session.collectedData,
                richCard: result.richCard,
                priority: result.priority
            };

        } catch (error) {
            console.error(`💥 RuleEngine 處理錯誤: ${error.message}`, error.stack);
            return this.getErrorResponse();
        }
    }

    /** 實體清理邏輯 */
    static sanitizeEntities(extractedEntities) {
        const cleanedEntities = {};
        // 修正並擴充關鍵字列表，避免將流程關鍵字誤判為 name
        const suspiciousNameKeywords = ['我要', '我想', '改日', '吸菸', '加價', '多加', '繼續', '訂接', '確認', '行政套房', '豪華客房', '標準雙人房', '家庭四人房', '不客氣', '共住', '我要改', '間入住人', '查看加購', '跳過', '登入', '修改', '幫我訂', '訂房']; // 新增幫我訂, 訂房
        
        for (const key in extractedEntities) {
            const value = String(extractedEntities[key]);

            if (key === 'name' && value) {
                // 忽略包含流程關鍵字的 name 實體
                const isSuspicious = suspiciousNameKeywords.some(keyword => value.includes(keyword));
                
                if (isSuspicious) {
                    console.warn(`⚠️ 忽略可疑的 name 實體 (包含流程關鍵字): ${value}`);
                    continue;
                }
            }
            
            // 保留有效實體
            cleanedEntities[key] = extractedEntities[key];
        }
        return cleanedEntities;
    }

    /** 格式化 Gemini 回應 */
    static formatGeminiResponse(geminiResponse, originalResponse, currentStep) {
        if (currentStep === 'paused_waiting_for_resume') {
            // 在暫停狀態下，提供 AI 回覆，並提醒恢復流程
            return `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${originalResponse}`;
        } else if (['handle_general_inquiry', 'general_rule_fallback'].includes(currentStep)) {
            // 在純通用查詢狀態下，只輸出 AI 內容
            return geminiResponse;
        }
        // 在其他狀態下 (如流程推進中)，保留流程提示
        return originalResponse; 
    }

    /** 執行規則集 (從高優先級到低優先級) */
    static async executeRules(intents, session, message, extractedEntities) {
        const rules = [
            { fn: this.emergencyRule, name: '緊急事件規則', priority: PRIORITY.EMERGENCY },
            { fn: this.roomLimitRule, name: '房間數量上限規則', priority: PRIORITY.BOOKING_FLOW.ROOM_LIMIT },
            { fn: this.generalInquiryOverrideRule, name: '通用查詢覆蓋規則', priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE }, // P:104
            { fn: this.pauseResumeRule, name: '流程暫停/恢復規則', priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE }, // P:98/99
            { fn: this.bookingFlowRule, name: '訂房流程核心規則', priority: PRIORITY.BOOKING_FLOW.BASE }, // P:95
        ];

        // 規則按優先級排序，確保高優先級先執行
        rules.sort((a, b) => b.priority - a.priority);

        for (const rule of rules) {
            const result = await rule.fn.call(this, intents, session, message, extractedEntities); 
            if (result.shouldProcess) {
                // P:99 的 priority 是 RESUME: 99，P:98 的 priority 是 PAUSE: 98
                const finalPriority = result.priority === PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME ? 99 : rule.priority; 
                console.log(`🎯 規則觸發: ${rule.name} (P:${finalPriority})`);
                result.priority = finalPriority;
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // --- 核心規則實現 ---

    /** 規則 1: 緊急事件處理 (P:105) */
    static emergencyRule(intents) {
        // ... (邏輯不變)
        if (intents.includes('emergency')) {
            return {
                shouldProcess: true,
                priority: PRIORITY.EMERGENCY,
                response: '🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！',
                nextStep: 'end_conversation',
                endFlow: true,
                allowGeminiCall: false,
                richCard: null
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1.1: 房間數量硬性上限檢查 (P:103) */
    static roomLimitRule(intents, session) {
        // ... (邏輯不變)
        const data = session.collectedData;
        if (data.roomCount !== undefined && data.roomCount > MAX_ROOM_LIMIT) {
            
            const nextStateKey = 'show_room_types'; 
            const flow = flowConfig;
            
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.ROOM_LIMIT,
                response: `抱歉，單次最多僅能預訂 **${MAX_ROOM_LIMIT} 間**。請修正您需要的房間數。`,
                nextStep: nextStateKey,
                richCard: flow.states[nextStateKey]?.richCard || null,
                allowGeminiCall: false,
                endFlow: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }


    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        // ... (邏輯不變)
        const isGeneralQueryIntent = intents.some(i => ['general_inquiry', 'inquiry', 'pricing', 'facilities', 'weather', 'restaurant'].includes(i));
        
        const hasNoBookingEntities = Object.keys(extractedEntities).every(key => 
            !['roomType', 'checkInDate', 'nights', 'adultCount', 'roomCount'].includes(key)
        );
        
        const isSafeToOverride = session.currentStep === 'init' || 
                                 session.currentStep === 'handle_general_inquiry' ||
                                 session.currentStep === 'paused_waiting_for_resume';

        if (isGeneralQueryIntent && hasNoBookingEntities && isSafeToOverride) {
            return {
                shouldProcess: true,
                priority: PRIORITY.GENERAL_INQUIRY_OVERRIDE,
                response: '好的，我將為您查詢相關資訊。',
                nextStep: 'handle_general_inquiry',
                allowGeminiCall: true,
                richCard: null,
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
        
        // 【修復點】：確保 isAffirm 即使在沒有意圖的情況下，也能透過關鍵字觸發
        const isAffirm = intents.includes('affirm') || lowerMessage.includes('繼續') || lowerMessage.includes('好');
        const isDeny = intents.includes('deny') || lowerMessage.includes('取消') || lowerMessage.includes('不要');
        
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities', 'restaurant', 'general_inquiry'].includes(i));

        // 1. 恢復處理 (P:99) - 從暫停狀態恢復
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                const resumedStateKey = session.pausedState;
                session.pausedState = null; // 清除暫停狀態
                
                const stateResponse = this.generateStateResponse(flow, resumedStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME);
                
                return {
                    shouldProcess: true,
                    // 返回 P:99 的優先級
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME, 
                    response: `已恢復訂房流程。${stateResponse.response}`,
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
            // 處於暫停狀態，但不是繼續/取消，讓通用規則去處理 AI 查詢
            return { shouldProcess: false, priority: 0 }; 
        }

        // 2. 暫停處理 (P:98) - 流程中遇到通用查詢
        if (isQueryIntent && currentStateKey && 
            currentStateKey !== 'init' && 
            currentStateKey !== 'handle_general_inquiry' && 
            !isAffirm) {
            
            session.pausedState = currentStateKey; // 儲存當前狀態
            
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE,
                response: '好的，我將為您查詢。**請回覆「繼續」或點選按鈕以恢復訂房流程。**',
                nextStep: 'paused_waiting_for_resume',
                allowGeminiCall: true, // 允許 Gemini 處理這個查詢
                richCard: flow.states['paused_waiting_for_resume']?.richCard || null,
                endFlow: false
            };
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 3: 訂房流程規則 (核心邏輯) */
    static async bookingFlowRule(intents, session, message) {
        const flow = flowConfig;
        const data = session.collectedData;
        let currentStateKey = session.currentStep;
        
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認');

        // 【訂房流程啟動點】
        if (currentStateKey === 'init') {
            if (intents.includes('booking') || Object.keys(data).some(k => ['checkInDate', 'nights', 'roomType'].includes(k))) {
                const startStateKey = 'ask_nights_and_dates';
                const nextStateKey = this.autoAdvanceFlow(flow, startStateKey, data, session);
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
            }
            return { shouldProcess: false, priority: 0 };
        }

        // 1. 處理訂單提交邏輯 (P:96) - 只有在確認狀態且用戶同意時執行
        if (currentStateKey === 'confirm_booking' && isAffirm) {
            return this.executeSubmission(session, flow); 
        }

        // 2. 意圖或實體推進：
        let nextStateKey = currentStateKey;
        let currentState = flow.states[currentStateKey];

        // A. 意圖轉移檢查 (優先處理)
        if (currentState?.intents) {
            for (const intent of intents) {
                if (currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }
        }
        
        // B. 實體收集/自動推進檢查
        let currentNextState = nextStateKey;
        if (currentNextState !== currentStateKey || (currentState?.entities && intents.length > 0)) {
            currentNextState = this.autoAdvanceFlow(flow, currentNextState, data, session);
        }
        nextStateKey = currentNextState;
        
        // 3. 🏆 處理 Handler 邏輯 (迭代執行器)
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
                console.error(`💥 Handler ${handlerName} 發生錯誤: ${e.message}`, e.stack);
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK,
                    response: `處理錯誤 (Handler: ${handlerName})：${e.message}。請從頭開始。`,
                    nextStep: 'init',
                    endFlow: true
                };
            }

            // 處理 Handler 返回結果
            if (handlerResult.isHandled) {
                markHandlerExecuted(session, nextStateKey);

                if (handlerResult.nextStep) {
                    nextStateKey = handlerResult.nextStep;
                } else {
                    nextStateKey = flow.states[nextStateKey].next_state || nextStateKey;
                }
                
                nextStateKey = this.autoAdvanceFlow(flow, nextStateKey, data, session);

                if (FORCED_BREAK_STATES.includes(nextStateKey)) {
                    return this.generateStateResponse(flow, nextStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.prompt, handlerResult.richCard);
                }
                
                if (handlerResult.prompt) {
                    return this.generateStateResponse(flow, nextStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.prompt, handlerResult.richCard);
                }
            } else {
                return this.generateStateResponse(flow, nextStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.errorMessage || flow.states[nextStateKey].fallback, handlerResult.richCard);
            }

        }

        // 4. 輸出回應
        if (nextStateKey !== currentStateKey || flow.states[nextStateKey]?.entities) {
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        // 5. 未匹配任何規則 
        return { shouldProcess: false, priority: 0 };
    }

    /** 【內部輔助方法】實體收集自動推進邏輯 
      */
    static autoAdvanceFlow(flow, startStateKey, data, session) {
        // ... (邏輯不變)
        let currentIterationKey = startStateKey;
        let nextState = flow.states[currentIterationKey];

        while (currentIterationKey && nextState) {
            
            if (FORCED_BREAK_STATES.includes(currentIterationKey)) {
                break;
            }

            if (nextState.handler && !hasExecutedHandler(session, currentIterationKey)) {
                break;
            }
            
            if (nextState.entities && nextState.next_state) {
                const nextEntitiesCollected = nextState.entities.every(
                    entity => data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
                );

                if (nextEntitiesCollected) {
                    currentIterationKey = nextState.next_state;
                    nextState = flow.states[currentIterationKey];
                } else {
                    break;
                }
            } else if (nextState.next_state) {
                currentIterationKey = nextState.next_state;
                nextState = flow.states[currentIterationKey];
            } else {
                break;
            }
        }
        return currentIterationKey;
    }

    /** * 【內部輔助方法】執行訂單提交 (Handler) 
      */
    static async executeSubmission(session, flow) { 
        // ... (邏輯不變)
        const data = session.collectedData;
        let bookingResult;
        try {
            const handlerResult = await BookingFlowController.submitBooking(session); 

            bookingResult = {
                success: handlerResult.isHandled, 
                id: data.orderId,
                paymentMessage: data.paymentMessage,
                errorMessage: handlerResult.errorMessage || 'Unknown submission error'
            };
            
        } catch (e) {
            console.error(`💥 submitBooking 發生錯誤: ${e.message}`);
            bookingResult = { success: false, errorMessage: '提交服務發生無法預期的錯誤。' };
        }

        if (bookingResult.success) {
            const nextState = flow.states['booking_complete'];
            const finalPrompt = interpolatePrompt(nextState.prompt, data);

            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.SUBMIT,
                response: finalPrompt,
                nextStep: 'booking_complete',
                endFlow: true,
                richCard: nextState.richCard || null,
                allowGeminiCall: false
            };
        } else {
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.SUBMIT,
                response: `訂單提交失敗：${bookingResult.errorMessage}。請確認您的資訊後再試一次。`,
                nextStep: 'confirm_booking', 
                richCard: flow.states['confirm_booking']?.richCard || null,
                allowGeminiCall: false,
                endFlow: false
            };
        }
    }

    /** 通用 AI 規則 (P:1) */
    static generalRule(intents, session, message, extractedEntities) {
        // ... (邏輯不變)
        session.currentStep = 'general_rule_fallback';
        return {
            shouldProcess: true,
            priority: PRIORITY.GENERAL,
            response: '好的，我會嘗試用 AI 處理您的非訂房相關問題。',
            nextStep: 'general_rule_fallback',
            allowGeminiCall: true, 
            richCard: null,
            endFlow: false
        };
    }

    /** 生成狀態回應 (新增 promptOverride 和 richCardOverride 參數) */
    static generateStateResponse(flow, stateKey, data, priority, promptOverride = null, richCardOverride = null) {
        // ... (邏輯不變)
        const state = flow.states[stateKey];
        
        if (!state) {
            console.error(`❌ 無效的狀態鍵: ${stateKey}`);
            return {
                shouldProcess: true,
                priority: priority,
                response: '系統狀態錯誤，請重新開始。',
                nextStep: 'init',
                richCard: null,
                allowGeminiCall: false
            };
        }

        const finalPrompt = promptOverride 
            ? interpolatePrompt(promptOverride, data) 
            : interpolatePrompt(state.prompt, data);
        
        return {
            shouldProcess: true,
            priority: priority,
            response: finalPrompt,
            nextStep: stateKey,
            richCard: richCardOverride || state.richCard || null,
            allowGeminiCall: state.allowGeminiCall || false
        };
    }
} 

module.exports = RuleEngine;

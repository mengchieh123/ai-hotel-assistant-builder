// rule_engine.js (V2.0 - 最終完整版)

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

// 【流程強制停止點】
const FORCED_BREAK_STATES = [
    'ask_contact_info',
    'ask_payment_method',
    'confirm_booking',
    'check_availability_and_price' // 價格計算後應停止，等待用戶確認或輸入
];

// 實用函數：替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text || typeof text !== 'string') return '';
    
    let result = text;
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key] === undefined || data[key] === null ? '' : String(data[key]);
            // 替換 {key} 格式
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
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
                // 清理所有流程數據，準備下次訂房
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
        const suspiciousNameKeywords = ['我要', '我想', '改日', '吸菸', '加價', '多加', '繼續', '訂接', '確認', '行政套房', '豪華客房', '標準雙人房', '家庭四人房', '不客氣', '共住', '我要改', '間入住人', '查看加購'];
        
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
            // 確保所有規則的呼叫使用 await
            const result = await rule.fn.call(this, intents, session, message, extractedEntities); 
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name} (P:${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // --- 核心規則實現 ---

    /** 規則 1: 緊急事件處理 (P:105) */
    static emergencyRule(intents) {
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
        const data = session.collectedData;
        if (data.roomType && data.roomCount > MAX_ROOM_LIMIT) {
            
            const nextStateKey = 'show_room_types'; // 導回房型選擇，提示用戶修正
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
        const isGeneralQueryIntent = intents.some(i => ['general_inquiry', 'inquiry', 'pricing', 'facilities', 'weather', 'restaurant'].includes(i));
        
        // 如果是通用查詢意圖，且沒有任何訂房核心實體 (避免流程被打斷)
        const hasNoBookingEntities = Object.keys(extractedEntities).every(key => 
            !['roomType', 'checkInDate', 'nights', 'adultCount', 'roomCount'].includes(key)
        );
        
        // 只有在非流程中或暫停狀態下才允許跳過並進行通用查詢
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
    static pauseResumeRule(intents, session, message, extractedEntities) {
        const currentStateKey = session.currentStep;
        const flow = flowConfig;
        
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('繼續');
        const isDeny = intents.includes('deny') || message.toLowerCase().includes('取消') || message.toLowerCase().includes('不要');
        
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities', 'restaurant', 'general_inquiry'].includes(i));

        // 1. 恢復處理 (P:99) - 從暫停狀態恢復
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                const resumedStateKey = session.pausedState;
                session.pausedState = null;
                
                const resumedState = flow.states[resumedStateKey];
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME,
                    response: `已恢復訂房流程。${resumedState?.prompt || '請繼續您的預訂。'}`,
                    nextStep: resumedStateKey,
                    richCard: resumedState?.richCard || null,
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
        const currentStateKey = session.currentStep;
        
        const isAffirm = intents.includes('affirm') || message.toLowerCase().includes('確認');
        const isDeny = intents.includes('deny') || intents.includes('cancel');

        // 【訂房流程啟動點】
        if (currentStateKey === 'init') {
            if (intents.includes('booking') || Object.keys(data).length > 0) {
                const startStateKey = 'ask_nights_and_dates'; // 從 ask_nights_and_dates 開始收集日期
                // 進入自動推進邏輯
                const nextStateKey = this.autoAdvanceFlow(flow, startStateKey, data, session);
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
            }
            return { shouldProcess: false, priority: 0 };
        }

        // 1. 處理訂單提交邏輯 (P:96) - 只有在確認狀態且用戶同意時執行
        if (currentStateKey === 'confirm_booking' && isAffirm) {
            return this.executeSubmission(session, flow); 
        }

        // 2. 意圖或實體推進
        let nextStateKey = currentStateKey;
        let currentState = flow.states[currentStateKey];

        // A. 意圖轉移檢查
        if (currentState?.intents) {
            for (const intent of intents) {
                
                // ⭐ [修正點 A] 處理 check_availability_and_price 狀態下，詢問加購的意圖
                if (currentStateKey === 'check_availability_and_price' && intent === 'addon_selection') {
                    nextStateKey = 'ask_addons'; // 強制轉移到加購狀態
                    break;
                }
                // ⭐ [修正點 B] 處理 check_availability_and_price 狀態下，確認價格的意圖
                if (currentStateKey === 'check_availability_and_price' && intent === 'affirm') {
                    nextStateKey = 'ask_addons'; // 確認價格，也轉移到加購狀態
                    break;
                }

                if (currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }
        }
        
        // B. 實體收集/自動推進檢查
        let currentNextState = nextStateKey;
        if (currentNextState !== currentStateKey || (currentState?.entities)) {
            // 由於用戶輸入了新實體或意圖，重新檢查推進
            currentNextState = this.autoAdvanceFlow(flow, currentNextState, data, session);
        }
        nextStateKey = currentNextState;
        
        // 3. 🏆 處理 Handler 邏輯 (通用執行器)
        // 檢查：Handler 存在 且 Handler 未執行過
        if (flow.states[nextStateKey]?.handler && !hasExecutedHandler(session, nextStateKey)) {
            const handlerName = flow.states[nextStateKey].handler;
            console.log(`💲 觸發 Handler: ${handlerName} 於狀態: ${nextStateKey}`);

            let handlerResult;
            try {
                // 執行 Handler，傳入整個 Session
                const handlerFunction = BookingFlowController[handlerName];

                if (typeof handlerFunction === 'function') {
                    handlerResult = await handlerFunction(session); 
                } else {
                    console.error(`💥 找不到或無法執行 Handler: ${handlerName}。`);
                    throw new Error(`找不到 Handler: ${handlerName}`);
                }
            } catch (e) {
                console.error(`💥 Handler ${handlerName} 發生錯誤: ${e.message}`, e.stack);
                // Handler 執行錯誤，導回初始狀態
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
                // 標記 Handler 執行過 (僅在 isHandled: true 時標記)
                markHandlerExecuted(session, nextStateKey);

                // 如果 Handler 主動指定了下一步 (例如 checkBookingEssentials 檢查失敗導回)
                if (handlerResult.nextStep) {
                    nextStateKey = handlerResult.nextStep;
                }
                
                // 檢查是否能進一步推進
                nextStateKey = this.autoAdvanceFlow(flow, nextStateKey, data, session);

                // 如果 Handler 返回 prompt，覆蓋當前狀態的 prompt
                if (handlerResult.prompt) {
                    // 為了確保輸出，將 prompt 存入 session
                    session.collectedData.CUSTOM_PROMPT = interpolatePrompt(handlerResult.prompt, data);
                    
                    // 由於 Handler 執行後可能立即推進，這裡直接返回 Handler 產生的 prompt
                    return this.generateStateResponse(flow, nextStateKey, session.collectedData, PRIORITY.BOOKING_FLOW.BASE + 1, handlerResult.richCard);
                }
            }
        }


        // 4. 輸出回應 (流程轉移或實體不足的提示)
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && !isAffirm && !isDeny)) {
            // 如果狀態有轉移，或狀態未轉移但需要提示用戶提供新實體
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        // 5. 未匹配任何規則 
        return { shouldProcess: false, priority: 0 };
    }


    /** 【內部輔助方法】實體收集自動推進邏輯 
      */
    static autoAdvanceFlow(flow, startStateKey, data, session) {
        let currentIterationKey = startStateKey;
        let nextState = flow.states[currentIterationKey];

        while (currentIterationKey && nextState) {
            
            // --- 強制停止檢查 ---
            if (FORCED_BREAK_STATES.includes(currentIterationKey)) {
                break;
            }
            
            // --- 實體滿足檢查與推進 (條件跳轉) ---
            if (nextState.entities && nextState.next_state) {
                const nextEntitiesCollected = nextState.entities.every(
                    entity => data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
                );

                if (nextEntitiesCollected) {
                    // 實體滿足，繼續推進到下一個狀態
                    currentIterationKey = nextState.next_state;
                    nextState = flow.states[currentIterationKey];
                } else {
                    // 實體不滿足，停止於當前狀態
                    break;
                }
            } else if (nextState.next_state) {
                // 狀態沒有定義 entities，但有 next_state，自動跳轉 (用於邏輯跳板)
                currentIterationKey = nextState.next_state;
                nextState = flow.states[currentIterationKey];
            } else {
                // 狀態沒有定義 next_state，流程停止推進。
                break;
            }
        }
        return currentIterationKey;
    }

    /** * 【內部輔助方法】執行訂單提交 (Handler) 
      */
    static async executeSubmission(session, flow) { 
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
                nextStep: 'confirm_booking', // 提交失敗，退回確認狀態
                richCard: flow.states['confirm_booking']?.richCard || null,
                allowGeminiCall: false,
                endFlow: false
            };
        }
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority, handlerRichCard = null) {
        const state = flow.states[stateKey];
        
        if (!state) {
            console.error(`❌ 無效的狀態鍵: ${stateKey}`);
            return {
                shouldProcess: true,
                priority: priority,
                response: '系統狀態錯誤，請重新開始。',
                nextStep: 'init',
                richCard: null,
                allowGeminiCall: false,
                endFlow: true
            };
        }
        
        // 優先使用 Handler 產生的 CUSTOM_PROMPT
        let responsePrompt = data.CUSTOM_PROMPT || state.prompt || (state.fallback || '請繼續您的預訂。');
        delete data.CUSTOM_PROMPT; // 清除自訂 Prompt

        responsePrompt = interpolatePrompt(responsePrompt, data);
        
        // 使用 Handler 提供的 RichCard，否則使用流程設定的
        const richCard = handlerRichCard || state.richCard || null;

        return {
            shouldProcess: true,
            priority: priority,
            response: responsePrompt,
            nextStep: stateKey,
            richCard: richCard,
            allowGeminiCall: state.allow_gemini_call === true,
            endFlow: false
        };
    }

    /** 規則 4: 一般詢問與閒聊 (P:1) */
    static generalRule(intents, session) {
        return {
            shouldProcess: true,
            priority: PRIORITY.GENERAL,
            response: '我正在為您查詢或處理您的要求...', // 預設回應，會被 Gemini 取代
            nextStep: 'handle_general_inquiry',
            allowGeminiCall: true,
            richCard: null,
            endFlow: false
        };
    }

    /** 取得後備回應 */
    static getFallbackResponse(session = null) {
        return {
            reply: '抱歉，系統暫時無法處理您的請求。請稍後再試或重新開始。',
            nextStateKey: session?.currentStep || 'init',
            data: session?.collectedData || {},
            richCard: null,
            priority: 0
        };
    }

    /** 取得錯誤回應 */
    static getErrorResponse() {
        return {
            reply: '系統發生嚴重錯誤，請稍後再試。如需立即協助，請聯繫客服。',
            nextStateKey: 'init',
            data: {},
            richCard: null,
            priority: 0
        };
    }
}

module.exports = RuleEngine;

// rule_engine.js - 負責流程控制與狀態轉移 (優化完整版)
// 最後更新: 2024-05-04

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
        ROOM_LIMIT: 103,
        AVAILABILITY_CHECK: 102,
        CONFIRMATION: 101,
        PAUSE_RESUME: { PAUSE: 98, RESUME: 99 },
        SUBMIT: 96,
        BASE: 95
    },
    GENERAL: 1
};

// 最大房間限制
const MAX_ROOM_LIMIT = 5;

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

class RuleEngine {
    
    /** 主處理函數：接收用戶輸入並返回回應 */
    static async processRules(sessionId, userMessage) {
        try {
            const session = sessionManager.getSession(sessionId);
            
            if (!session) {
                console.error(`❌ 找不到 Session: ${sessionId}`);
                return this.getFallbackResponse();
            }

            // 意圖分類與實體提取
            const intents = SmartIntentClassifier.classify(userMessage);
            const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
            
            console.log(`🔍 意圖分類結果: ${JSON.stringify(intents)}`);
            console.log(`📝 實體提取結果: ${JSON.stringify(extractedEntities)}`);

            // 合併提取的實體到 Session 資料
            Object.assign(session.collectedData, extractedEntities);
            sessionManager.updateSession(sessionId, userMessage, intents);

            // 執行規則引擎
            const result = await RuleEngine.executeRules(intents, session, userMessage, extractedEntities);

            if (!result.shouldProcess) {
                return this.getFallbackResponse(session);
            }

            // 處理下一步狀態
            if (result.nextStep) {
                session.currentStep = result.nextStep;
                console.log(`🔄 狀態轉移: ${session.currentStep}`);
            }

            // 處理 Gemini AI 呼叫
            let finalResponse = result.response;
            if (result.allowGeminiCall) {
                const geminiResponse = await GeminiGenerator.getResponse(session, userMessage);
                if (geminiResponse) {
                    finalResponse = this.formatGeminiResponse(geminiResponse, result.response, session.currentStep);
                }
            }

            // 處理流程結束
            if (result.endFlow) {
                console.log(`🏁 流程結束於狀態: ${session.currentStep}`);
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

    /** 格式化 Gemini 回應 */
    static formatGeminiResponse(geminiResponse, originalResponse, currentStep) {
        if (currentStep === 'paused_waiting_for_resume') {
            return `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${originalResponse}`;
        } else if (currentStep === 'handle_general_inquiry') {
            return geminiResponse;
        }
        return originalResponse;
    }

    /** 執行規則集 (從高優先級到低優先級) */
    static async executeRules(intents, session, message, extractedEntities) {
        const rules = [
            { fn: this.emergencyRule, name: '緊急事件規則' },
            { fn: this.generalInquiryOverrideRule, name: '通用查詢覆蓋規則' },
            { fn: this.bookingFlowRule, name: '訂房流程規則' },
            { fn: this.generalRule, name: '一般規則' }
        ];

        for (const rule of rules) {
            const result = await rule.fn.call(this, intents, session, message, extractedEntities);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name} (P:${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

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

    /** 規則 1.5: 通用查詢覆蓋規則 (P:104) */
    static generalInquiryOverrideRule(intents, session, message, extractedEntities) {
        const isGeneralQueryIntent = intents.some(i => 
            ['general_inquiry', 'inquiry', 'pricing', 'facilities', 'weather'].includes(i)
        );
        
        const hasNoBookingEntities = Object.keys(extractedEntities).length === 0;
        
        if (isGeneralQueryIntent && hasNoBookingEntities) {
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

    /** 規則 2: 訂房流程規則 (核心邏輯) */
    static async bookingFlowRule(intents, session, message, extractedEntities) {
        const flow = BookingFlowController.getFlow();
        const data = session.collectedData;
        const currentStateKey = session.currentStep;
        let currentState = flow.states[currentStateKey];
        
        // 確認/取消意圖判斷
        const isAffirm = intents.includes('affirm') || 
                        message.toLowerCase().includes('確認') || 
                        message.toLowerCase().includes('繼續') ||
                        message.toLowerCase().includes('是的');
        
        const isDeny = intents.includes('deny') || 
                      message.toLowerCase().includes('取消') || 
                      message.toLowerCase().includes('不要') ||
                      message.toLowerCase().includes('不用');

        // =========================================================================
        // 【P:103 房間數量硬性上限檢查】
        if (data.roomType && data.roomCount > MAX_ROOM_LIMIT) {
            sessionManager.clearBookingEssentials(session.id);
            const nextStateKey = 'show_room_types';
            
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
        // =========================================================================

        // 1. 流程暫停與恢復處理
        const isQueryIntent = intents.some(i => ['inquiry', 'pricing', 'facilities'].includes(i));
        
        // 暫停處理 (P:98)
        if (isQueryIntent && currentStateKey && 
            currentStateKey !== 'init' && 
            currentStateKey !== 'paused_waiting_for_resume' && 
            !isAffirm) {
            
            session.pausedState = currentStateKey;
            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.PAUSE,
                response: '好的，我將為您查詢。**請回覆「繼續」或點選按鈕以恢復訂房流程。**',
                nextStep: 'paused_waiting_for_resume',
                allowGeminiCall: true,
                richCard: null,
                endFlow: false
            };
        }

        // 恢復處理 (P:99)
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                const resumedStateKey = session.pausedState;
                session.pausedState = null;
                session.currentStep = resumedStateKey;
                currentState = flow.states[resumedStateKey];
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.PAUSE_RESUME.RESUME,
                    response: `已恢復訂房流程。${currentState?.prompt || '請繼續您的預訂。'}`,
                    nextStep: resumedStateKey,
                    richCard: currentState?.richCard || null,
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
        }

        // 2. 流程內部轉移與邏輯處理
        let nextStateKey = currentStateKey;

        // 【訂房流程啟動點】
        if (currentStateKey === 'init') {
            if (intents.includes('booking') || data.checkInDate || data.nights || data.roomType) {
                nextStateKey = 'show_room_types';
                return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
            }
            return { shouldProcess: false, priority: 0 };
        }

        // A. 意圖轉移檢查
        if (currentState?.intents) {
            for (const intent of intents) {
                if (currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }
        }

        // B. 實體收集檢查與實體推進邏輯
        let allEntitiesCollected = false;
        if (currentState?.entities && currentState.next_state) {
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
            );

            if (allEntitiesCollected) {
                nextStateKey = currentState.next_state;

                // 實體推進 (跳過已滿足的狀態)
                let nextState = flow.states[nextStateKey];
                while (nextState && nextState.entities && nextState.next_state) {
                    const nextEntitiesCollected = nextState.entities.every(
                        entity => data[entity] !== undefined && data[entity] !== null && data[entity] !== ''
                    );
                    
                    if (nextEntitiesCollected) {
                        nextStateKey = nextState.next_state;
                        nextState = flow.states[nextStateKey];
                    } else {
                        break;
                    }
                }
            }
        }

        // C. 價格計算與空房檢查 (P:102)
        if (nextStateKey === 'check_availability_and_price' && flow.states[nextStateKey]?.handler === 'calculatePrice') {
            const priceResult = BookingFlowController.calculatePrice(data);

            if (!priceResult.success) {
                sessionManager.clearBookingEssentials(session.id);
                const fallbackStateKey = 'show_room_types';
                
                return {
                    shouldProcess: true,
                    priority: PRIORITY.BOOKING_FLOW.AVAILABILITY_CHECK,
                    response: `${priceResult.errorMessage} **請修正您的預訂資訊。**`,
                    nextStep: fallbackStateKey,
                    richCard: flow.states[fallbackStateKey]?.richCard || null,
                    allowGeminiCall: false,
                    endFlow: false
                };
            }
            
            // 更新最終價格
            data.finalPrice = priceResult.totalPrice.toFixed(0);
            nextStateKey = flow.states[nextStateKey].next_state;
        }

        // D. 處理最終確認狀態 (P:101)
        if (nextStateKey === 'confirm_booking') {
            // 最終價格檢查
            const finalPriceResult = BookingFlowController.calculatePrice(data);
            if (finalPriceResult.success) {
                data.finalPrice = finalPriceResult.totalPrice.toFixed(0);
            }

            const summary = this.generateSummary(data);
            const nextState = flow.states[nextStateKey];
            const finalPrompt = nextState.prompt.replace('[SUMMARY]', summary);

            return {
                shouldProcess: true,
                priority: PRIORITY.BOOKING_FLOW.CONFIRMATION,
                response: finalPrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                allowGeminiCall: false,
                endFlow: false
            };
        }

        // E. 訂單提交邏輯 (P:96)
        if (currentStateKey === 'confirm_booking' && isAffirm) {
            const bookingResult = BookingFlowController.submitBooking(data);
            
            if (bookingResult.success) {
                data.orderId = bookingResult.id;
                data.paymentMessage = bookingResult.paymentMessage;

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
                    response: `訂單提交失敗：${bookingResult.errorMessage}`,
                    nextStep: 'confirm_booking',
                    richCard: flow.states['confirm_booking']?.richCard || null,
                    allowGeminiCall: false,
                    endFlow: false
                };
            }
        }

        // 3. 輸出回應 (流程轉移或實體不足的提示)
        if (nextStateKey !== currentStateKey || !allEntitiesCollected) {
            return this.generateStateResponse(flow, nextStateKey, data, PRIORITY.BOOKING_FLOW.BASE);
        }

        // 4. 未匹配任何規則
        return { shouldProcess: false, priority: 0 };
    }

    /** 生成狀態回應 */
    static generateStateResponse(flow, stateKey, data, priority) {
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
                endFlow: false
            };
        }

        const responsePrompt = state.prompt ? interpolatePrompt(state.prompt, data) : (state.fallback || '請繼續您的預訂。');

        return {
            shouldProcess: true,
            priority: priority,
            response: responsePrompt,
            nextStep: stateKey,
            richCard: state.richCard || null,
            allowGeminiCall: state.allow_gemini_call === true,
            endFlow: false
        };
    }

    /** 規則 3: 一般詢問與閒聊 (P:1) */
    static generalRule(intents) {
        return {
            shouldProcess: true,
            priority: PRIORITY.GENERAL,
            response: '我正在為您查詢或處理您的要求...',
            nextStep: 'handle_general_inquiry',
            allowGeminiCall: true,
            richCard: null,
            endFlow: false
        };
    }

    /** 生成訂單摘要 */
    static generateSummary(data) {
        const isMember = !!data.memberAccount;
        const totalDiscount = data.totalPrice && data.newTotalPrice ? 
            (data.totalPrice - data.newTotalPrice).toFixed(0) : '0';
        
        let summary = `🗓️ **預訂摘要**\n`;
        summary += `房型：**${data.roomType || '未選擇'}** (${data.roomCount || 1} 間)\n`;
        summary += `入住：**${data.checkInDate || '未選擇'}**，共 **${data.nights || '未選擇'} 晚**\n`;
        summary += `人數：**${data.adultCount || '未選擇'} 位大人**，**${data.childCount || 0} 位兒童**\n`;
        
        if (data.petCount > 0) {
            summary += `寵物：**${data.petCount} 隻**\n`;
        }
        
        summary += `早餐：**${data.needsMeal === '是' ? '已加購' : '未加購'}**\n`;
        summary += `接送：**${data.transferFee > 0 ? '已預約' : '未預約'}**\n`;
        
        summary += `\n---\n👤 **聯絡資訊**\n`;
        summary += `訂房人：**${data.name || '未提供'}**\n`;
        summary += `電話：**${data.phone || '未提供'}**\n`;
        summary += `Email：**${data.email || '未提供'}**\n`;
        summary += `結帳方式：**${data.paymentMethod || '未選擇'}**\n`;
        
        summary += `\n---\n💰 **費用明細**\n`;
        summary += `房費小計：NT$ ${data.totalPrice || '0'}\n`;
        
        if (data.serviceFee > 0) {
            summary += `服務費 (10%)：NT$ ${data.serviceFee || '0'}\n`;
        }
        
        if (data.transferFee > 0) {
            summary += `接送機費：NT$ ${data.transferFee || '0'}\n`;
        }
        
        if (data.appliedPromoCode) {
            summary += `優惠碼 (${data.appliedPromoCode}) 折扣：-NT$ ${totalDiscount}\n`;
        } else if (data.discountRate && data.discountRate !== '0') {
            summary += `會員折扣 (${data.discountRate}%)：-NT$ ${totalDiscount}\n`;
        }
        
        summary += `\n**最終總計：NT$ ${data.finalPrice || '0'}** (已含稅及服務費)`;
        summary += `\n---`;
        
        return summary;
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
            reply: '系統發生錯誤，請稍後再試。如需立即協助，請聯繫客服。',
            nextStateKey: 'init',
            data: {},
            richCard: null,
            priority: 0
        };
    }
}

module.exports = RuleEngine;

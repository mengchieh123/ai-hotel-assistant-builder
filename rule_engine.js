import { ModularIntentClassifier } from './intent_classifier.js';
import { sessionManager } from './session_manager.js';
import config from './config.js';
import dialogueFlowConfig from './dialogue_flow.json' assert { type: "json" }; // 載入 JSON 配置
import * as logicHandlers from './logic_handlers.js'; //

// 導入日誌模組，以確保與伺服器日誌格式一致
const LOG_PREFIX = '[RuleEngine]';
const log = (message) => console.log(`${LOG_PREFIX} ${message}`);
const logError = (message, error) => console.error(`${LOG_PREFIX} 💥 ${message}`, error);

/**
 * RuleEngine 負責根據意圖、當前狀態和會話歷史來決定下一步行動。
 * V2.5 修正了狀態屬性、方法名稱和實體合併邏輯。
 */
export class RuleEngine {

    /**
     * @param {Object} flowConfig - 整個對話流程配置，通常從 dialogue_flow.json 載入。
     */
    constructor(flowConfig = dialogueFlowConfig) {
        log('RuleEngine 實例化完成。');
        // 確保配置被正確載入
        if (!flowConfig || !flowConfig.states) {
            logError('初始化失敗：dialogueFlowConfig 結構無效或未載入。');
            throw new Error('RuleEngine initialization failed: Invalid flow configuration.');
        }
        this.flowConfig = flowConfig;
        // 🚨 修復：實例化 ModularIntentClassifier
        this.classifier = new ModularIntentClassifier();
    }

    /**
     * 執行規則引擎的核心方法。
     * @param {string} message - 使用者輸入的原始訊息。
     * @param {string} sessionId - 當前會話 ID。
     * @returns {Promise<Object>} 包含回應訊息、新狀態和可選的 Rich Card。
     */
    async executeRules(message, sessionId) {
        let session = sessionManager.getSession(sessionId);
        
        // 🚨 修復 1：狀態屬性統一。使用 currentStep 或 currentState。
        let currentState = session.currentStep || session.currentState; 

        log(`當前會話狀態: ${currentState}, 接收到訊息: "${message}"`);

        try {
            // 1. 意圖識別 (調用非靜態方法)
            // 傳入 session 數據，以便分類器進行上下文加權
            const classificationResult = this.classifier.classify(message, {
                intents: session.lastIntent ? [session.lastIntent] : [],
                entities: session.collectedData // 傳入舊實體作為參考
            }, session);
            
            // 注意：我們使用 enhancedData 作為最終的實體集
            const { topIntent: primaryIntent, confidence, enhancedData: entities, debugInfo } = classificationResult;

            // 記錄使用者輸入和意圖
            sessionManager.updateSession(sessionId, message, [primaryIntent]);

            log(`意圖識別結果: ${primaryIntent || '無意圖'}, 信心度: ${confidence}%`);

            // 2. 查找當前狀態的配置
            const stateConfig = this.flowConfig.states[currentState];
            if (!stateConfig) {
                logError(`錯誤：無法找到狀態配置: ${currentState}`);
                return this._handleErrorResponse(sessionId, 'Internal error: state not found.');
            }

            // 3. 處理狀態轉換規則
            let actualFinalConfig = null;
            let nextState = currentState;
            let matchedRule = null;

            // 遍歷當前狀態的所有規則
            for (const rule of stateConfig.rules) {
                if (rule.intent === primaryIntent) {
                    matchedRule = rule;
                    nextState = rule.nextState || currentState; // 預設狀態不變
                    actualFinalConfig = rule.response;
                    log(`匹配到規則: 意圖 ${primaryIntent}, 轉換到狀態: ${nextState}`);
                    break;
                }
            }

            // 4. 如果沒有匹配的規則，檢查是否需要觸發 Fallback
            if (!matchedRule) {
                log('未匹配到明確意圖規則，檢查 Fallback 規則。');
                
                const fallbackRule = stateConfig.fallbackRule || this.flowConfig.globalFallbackRule;
                if (fallbackRule) {
                    matchedRule = fallbackRule;
                    nextState = fallbackRule.nextState || 'fallback_end';
                    actualFinalConfig = fallbackRule.response;
                    log(`觸發 Fallback，轉換到狀態: ${nextState}`);
                } else {
                    log('未找到 Fallback 規則，保持當前狀態。');
                    // 如果連 Fallback 都沒有，使用預設回應
                    actualFinalConfig = { text: "抱歉，我目前無法處理您的請求，請嘗試明確的訂房相關問題。", richCard: null };
                }
            }

            // 🚨 修復 2：實體數據合併到會話。必須在 Handler 執行前完成。
            if (entities && Object.keys(entities).length > 0) {
                sessionManager.mergeEntities(sessionId, entities);
                // 重新獲取 session，確保 Handler 使用最新的 collectedData
                session = sessionManager.getSession(sessionId); 
                log(`已將 ${Object.keys(entities).length} 個實體合併到 collectedData。`);
            }
            
            // 5. 執行響應處理器 (Handler)
            let richCard = null;
            let responseText = actualFinalConfig?.text || "我不太明白您的意思，請說得更清楚一點。";

            if (actualFinalConfig) {
                richCard = actualFinalConfig.richCard || null; 
            }
            
            // 檢查是否需要執行額外的處理邏輯
            if (matchedRule && matchedRule.handler) {
                const handlerFunction = logicHandlers[matchedRule.handler];
                if (typeof handlerFunction === 'function') {
                    log(`執行 Handler: ${matchedRule.handler}`);
                    const handlerResult = await handlerFunction({
                        message,
                        session,
                        primaryIntent,
                        entities,
                        config: this.flowConfig,
                        currentConfig: actualFinalConfig 
                    });

                    // 覆蓋回應文本和卡片（如果 Handler 提供了新的內容）
                    responseText = handlerResult.responseText || responseText;
                    richCard = handlerResult.richCard || richCard;
                    nextState = handlerResult.nextState || nextState; // Handler 可以強制改變 nextState
                    log(`Handler 執行完成。新狀態: ${nextState}`);
                } else {
                    logError(`警告：找不到 Handler 函數: ${matchedRule.handler}`);
                }
            }

            // 6. 更新會話狀態
            if (nextState !== currentState) {
                // 🚨 修復 3：使用 sessionManager.updateCurrentState
                sessionManager.updateCurrentState(sessionId, nextState); 
                log(`會話狀態更新為: ${nextState}`);
            }

            // 7. 返回最終結果
            return {
                sessionId,
                state: nextState,
                responseText: responseText,
                richCard: richCard,
                debug: {
                    ...debugInfo,
                    matchedIntent: primaryIntent,
                    matchedRule: matchedRule ? matchedRule.intent : 'N/A'
                }
            };

        } catch (error) {
            logError(`執行規則引擎時發生致命錯誤: ${error.message}`, error);
            return this._handleErrorResponse(sessionId, 'Internal error during rule execution.');
        }
    }

    /**
     * 處理錯誤回應，確保用戶能收到回覆。
     */
    _handleErrorResponse(sessionId, message) {
        const errorState = 'error';
        // 🚨 修復 3：使用 sessionManager.updateCurrentState
        sessionManager.updateCurrentState(sessionId, errorState);
        return {
            sessionId,
            state: errorState,
            responseText: `系統發生錯誤：${message} 請稍後再試。`,
            richCard: null,
            debug: { error: true }
        };
    }
}

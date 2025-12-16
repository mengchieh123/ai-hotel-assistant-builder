import { ModularIntentClassifier } from './intent_classifier.js';
import { sessionManager } from './session_manager.js';
import config from './config.js';
<<<<<<< HEAD
import dialogueFlowConfig from './dialogue_flow.json' assert { type: "json" }; // 載入 JSON 配置
import * as logicHandlers from './logic_handlers.js'; //

// 導入日誌模組，以確保與伺服器日誌格式一致
const LOG_PREFIX = '[RuleEngine]';
const log = (message) => console.log(`${LOG_PREFIX} ${message}`);
const logError = (message, error) => console.error(`${LOG_PREFIX} 💥 ${message}`, error);

/**
 * RuleEngine 負責根據意圖、當前狀態和會話歷史來決定下一步行動。
 * V2.5 修正了狀態屬性、方法名稱和實體合併邏輯。
=======
import dialogueFlowConfig from './dialogue_flow.js';
import * as logicHandlers from './logic_handlers.js'; // 導入所有 Logic Handler

/**
 * 核心 Rule Engine 類別
 * 負責處理使用者輸入、判斷意圖、管理狀態、執行業務邏輯並生成回應。
>>>>>>> 80640f4421749ff79f464629d4db5b7ad0759257
 */
export class RuleEngine {

    /**
<<<<<<< HEAD
     * @param {Object} flowConfig - 整個對話流程配置，通常從 dialogue_flow.json 載入。
     */
    constructor(flowConfig = dialogueFlowConfig) {
        log('RuleEngine 實例化完成。');
        // 確保配置被正確載入
        if (!flowConfig || !flowConfig.states) {
            logError('初始化失敗：dialogueFlowConfig 結構無效或未載入。');
            throw new Error('RuleEngine initialization failed: Invalid flow configuration.');
=======
     * 初始化 RuleEngine。載入所有必要配置。
     */
    constructor() {
        this.intentClassifier = new ModularIntentClassifier(config.modules);
        this.dialogueFlow = dialogueFlowConfig;
        console.log(`✅ RuleEngine 已初始化，載入 ${Object.keys(this.dialogueFlow.states).length} 個狀態。`);
    }

    /**
     * 獲取當前或指定狀態的配置。
     * @param {string} stateKey - 狀態的鍵值 (例如: 'ask_dates_and_nights')。
     * @returns {object|null} - 狀態配置物件或 null。
     */
    getStateConfig(stateKey) {
        return this.dialogueFlow.states[stateKey] || null;
    }

    /**
     * 執行規則流程。
     * @param {string} message - 使用者輸入的訊息。
     * @param {string} sessionId - 當前的會話 ID。
     * @returns {Promise<object>} - 包含回應、新的會話狀態等資訊的結果物件。
     */
    async executeRules(message, sessionId) {
        let session = sessionManager.getSession(sessionId);

        // 1. 如果是新會話，則初始化
        if (!session) {
            const initialConfig = this.getStateConfig(this.dialogueFlow.initial_state);
            // 處理初次載入時的實體清理
            const initialEntities = initialConfig?.clear_entities || [];
            session = sessionManager.createSession(sessionId, this.dialogueFlow.initial_state, initialEntities);
            console.log(`[SESSION] New session created: ${sessionId}, initial state: ${this.dialogueFlow.initial_state}`);
>>>>>>> 80640f4421749ff79f464629d4db5b7ad0759257
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

<<<<<<< HEAD
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
=======
        const currentStateKey = session.currentState;
        const currentStateConfig = this.getStateConfig(currentStateKey);

        if (!currentStateConfig) {
            console.error(`❌ 狀態配置錯誤: 找不到狀態鍵值 ${currentStateKey}`);
            // 無法找到狀態，強制重置
            sessionManager.resetSession(sessionId);
            return {
                response: "系統發生內部錯誤，對話流程已被重置。請重新開始。",
                nextState: this.dialogueFlow.initial_state,
                richCard: null
            };
        }

        // 2. 意圖與實體提取
        const smartAnalysis = await this.intentClassifier.analyze(message, currentStateKey);
        const finalIntent = smartAnalysis.finalIntent;

        // 3. 高優先級意圖處理 (例如：取消流程、通用查詢)
        let nextStateKey = null;
        let response = null;
        let richCard = null;

        // 3.1 處理取消流程 (高優先級)
        if (finalIntent === 'cancel_flow') {
            const cancelStateConfig = this.getStateConfig('global_cancel_flow');
            
            // ❗️ 新增保護: 檢查 global_cancel_flow 是否存在於 dialogue_flow.json
            if (cancelStateConfig) {
                nextStateKey = cancelStateConfig.next_state || this.dialogueFlow.initial_state;
                response = this.interpolatePrompt(cancelStateConfig.response, session.context);
                richCard = cancelStateConfig.richCard || null;
            } else {
                // 如果配置不存在，退回安全狀態
                nextStateKey = this.dialogueFlow.initial_state;
                response = "好的，流程已重置。請重新開始預訂。";
                richCard = null;
            }

            // 清理上下文並返回取消結果
            sessionManager.resetSession(sessionId);
            return { response, nextState: nextStateKey, richCard };
        }

        // 3.2 處理通用查詢意圖 (跳出主流程)
        if (config.generalInquiryIntents.includes(finalIntent)) {
            // 進入通用查詢流程 (handle_general_inquiry 應為邏輯狀態)
            nextStateKey = 'handle_general_inquiry';
            
            // 在通用查詢後，儲存當前狀態，以便返回
            session.context.pauseFromState = currentStateKey;
            sessionManager.updateSession(sessionId, session.context, session.currentState); 
        } else {
            // 4. 處理一般狀態轉換 (流程內部)

            // 4.1. 嘗試從當前狀態的 intents 定義中轉換狀態
            if (currentStateConfig.intents && currentStateConfig.intents[finalIntent]) {
                nextStateKey = currentStateConfig.intents[finalIntent];
            } else if (currentStateConfig.next_state) {
                // 4.2. 否則，使用當前狀態預設的 next_state
                nextStateKey = currentStateConfig.next_state;
            }

            // 4.3. 實體更新: 將提取到的實體合併到會話上下文
            this.updateContextWithEntities(session.context, smartAnalysis.entities);

            // 4.4. 檢查當前狀態的 Rules
            if (currentStateConfig.rules) {
                for (const rule of currentStateConfig.rules) {
                    if (this.evaluateCondition(rule.condition, session.context)) {
                        nextStateKey = rule.next_state;
                        break;
                    }
                }
            }
        }
        
        // 5. 執行狀態轉換邏輯
        let finalStateKey = nextStateKey;
        
        // 5.1. 如果是 logic_exec 狀態，執行 Handler
        while (finalStateKey && this.getStateConfig(finalStateKey)?.type === 'logic_exec') {
            const logicConfig = this.getStateConfig(finalStateKey);
            const handlerName = logicConfig.handler;
            const handler = logicHandlers[handlerName];

            if (handler) {
                try {
                    console.log(`🤖 執行邏輯 Handler: ${handlerName}`);
                    // 執行邏輯，並獲取新的上下文和下一個狀態鍵
                    const logicResult = await handler(session.context, message);
                    session.context = { ...session.context, ...logicResult.context };
                    
                    // 如果邏輯 Handler 執行成功
                    if (logicResult.success) {
                        finalStateKey = logicResult.nextState || logicConfig.next_state;
                    } else {
                        // 如果邏輯 Handler 執行失敗，則進入 fallback_state
                        finalStateKey = logicConfig.fallback_state || this.dialogueFlow.initial_state;
                    }
                } catch (e) {
                    console.error(`💥 邏輯 Handler 執行錯誤 (${handlerName}):`, e);
                    // 邏輯執行發生例外，進入 fallback_state
                    finalStateKey = logicConfig.fallback_state || this.dialogueFlow.initial_state;
                }
            } else {
                console.error(`❌ 邏輯 Handler 錯誤: 找不到 Handler 函數 ${handlerName}`);
                finalStateKey = logicConfig.fallback_state || this.dialogueFlow.initial_state;
            }
        }

        // 6. 確定最終回應
        const finalStateConfig = this.getStateConfig(finalStateKey);
        
        // 6.1. Fallback 檢查：如果最終狀態仍是當前狀態，且訊息未被處理，則觸發 Fallback
        if (finalStateKey === currentStateKey) {
            // 如果無法轉換狀態，嘗試使用 fallback_state
            const fallbackStateKey = currentStateConfig.fallback_state;
            if (fallbackStateKey) {
                finalStateKey = fallbackStateKey;
            } else {
                // 否則，轉到通用 fallback 狀態 (例如: fallback_end 或 init)
                // 檢查是否連續 Fallback
                session.fallbackCount = (session.fallbackCount || 0) + 1;
                if (session.fallbackCount > config.maxFallbackAttempts) {
                    finalStateKey = 'fallback_end'; // 轉到終止狀態
                } else {
                    finalStateKey = currentStateKey; // 留在當前狀態，使用 Fallback 提示
                }
            }
        } else {
             // 成功轉換狀態，重置 Fallback 計數器
             session.fallbackCount = 0;
        }

        // 6.2. 獲取最終回應配置
        let actualFinalConfig = this.getStateConfig(finalStateKey);
        
        // ❗️ 新增保護: 確保 fallback_end 狀態存在
        if (finalStateKey === 'fallback_end' && !actualFinalConfig) {
            console.error("❌ 警告: dialogue_flow.json 缺少 'fallback_end' 狀態配置。");
            actualFinalConfig = {
                prompt: "抱歉，系統遇到連續錯誤，請嘗試重新開始。",
                richCard: null
            };
            finalStateKey = this.dialogueFlow.initial_state;
            sessionManager.resetSession(sessionId); // 遇到嚴重 Fallback，強制重置
        }

        response = this.interpolatePrompt(actualFinalConfig.prompt, session.context);
        richCard = actualFinalConfig.richCard || null;

        // 7. 更新會話狀態
        sessionManager.updateSession(sessionId, session.context, finalStateKey);

        // 8. 返回結果
        return {
            response,
            nextState: finalStateKey,
            richCard
        };
    }

    /**
     * 將實體合併到會話上下文中。
     * @param {object} context - 當前的會話上下文。
     * @param {object} entities - 提取到的實體物件。
     */
    updateContextWithEntities(context, entities) {
        for (const key in entities) {
            if (entities[key] !== undefined && entities[key] !== null) {
                context[key] = entities[key];
            }
>>>>>>> 80640f4421749ff79f464629d4db5b7ad0759257
        }
    }

    /**
<<<<<<< HEAD
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
=======
     * 評估條件字串 (例如: 'checkInDate && nights')。
     * @param {string} condition - 條件字串。
     * @param {object} context - 會話上下文。
     * @returns {boolean} - 條件評估結果。
     */
    evaluateCondition(condition, context) {
        // 使用 with 語句確保上下文變數可用於評估 (注意：實際生產環境應避免使用 with)
        // 在這裡，我們將 context 屬性直接作為區域變數引入
        try {
            const conditionFunc = new Function('context', `with(context) { return ${condition} }`);
            return conditionFunc(context);
        } catch (e) {
            console.error(`❌ 條件評估錯誤: ${condition}`, e);
            return false;
        }
    }

    /**
     * 將提示中的佔位符替換為會話上下文中的值。
     * @param {string} prompt - 包含佔位符的提示。
     * @param {object} context - 會話上下文。
     * @returns {string} - 替換後的提示。
     */
    interpolatePrompt(prompt, context) {
        if (!prompt) return "";
        return prompt.replace(/\{(\w+)\}/g, (match, key) => {
            // 處理 context 中不存在的鍵值，避免輸出 'undefined'
            return context[key] !== undefined && context[key] !== null ? context[key] : `[${key} not set]`;
        });
>>>>>>> 80640f4421749ff79f464629d4db5b7ad0759257
    }
}

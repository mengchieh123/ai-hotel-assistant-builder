// rule_engine.js (V2.0 - 支援 prompt/next_state/rules 結構)

import { ModularIntentClassifier } from './modular_intent_classifier.js';
import { sessionManager } from './session_manager.js';
import config from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- 模擬 __dirname 和 __filename ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🎯 注意：根據您的 JSON 結構，initialState 應從 dialogueFlowConfig.initial_state 讀取
const FLOW_CONFIG_PATH = path.join(__dirname, 'dialogue_flow.json');

/**
 * 🎯 對話流程配置 (靜態變數)
 */
let dialogueFlowConfig = null;

/**
 * 規則引擎 - 負責業務狀態流轉和邏輯決策
 */
export class RuleEngine {

    /**
     * 靜態方法：載入並初始化對話流程配置
     */
    static initializeFlowConfig() {
        if (dialogueFlowConfig) {
            console.log('✅ [DEBUG] dialogue_flow.json 已載入。');
            return;
        }

        try {
            const data = fs.readFileSync(FLOW_CONFIG_PATH, 'utf8');
            dialogueFlowConfig = JSON.parse(data);

            // 執行配置的結構檢查：使用您 JSON 中的 "initial_state" 鍵名
            if (!dialogueFlowConfig.initial_state || !dialogueFlowConfig.states) {
                throw new Error('對話流程配置缺少 initial_state 或 states 結構');
            }

            console.log('✅ [DEBUG] dialogue_flow.json 成功載入！');
            console.log('✅ [DEBUG] RuleEngine 靜態配置完成並已通過結構檢查。');

        } catch (error) {
            console.error(`💥 [ERROR] 無法載入或解析對話流程配置: ${error.message}`);
            throw new Error(`對話流程初始化失敗: ${error.message}`);
        }
    }
    
    /**
     * 靜態方法：安全地評估 condition 字符串
     * @param {string} conditionString - JSON 中 rule 的 condition 字符串，例如 "checkInDate && nights"
     * @param {object} data - 包含會話 collectedData 的物件
     * @returns {boolean} 條件是否滿足
     */
    static _evaluateCondition(conditionString, data) {
        if (!conditionString) return false;
        
        // 解析 "key1 && key2" 格式，檢查所有鍵值是否在 data 中存在且非空
        try {
            // 處理 '&&' 邏輯
            let conditions = conditionString.split('&&').map(key => key.trim());
            
            // 檢查所有 required keys 在 data 中是否存在且非空 (非 null, 非 undefined, 且長度大於 0)
            return conditions.every(key => 
                data[key] !== null && 
                data[key] !== undefined && 
                (typeof data[key] === 'string' ? data[key].length > 0 : true)
            );

        } catch (e) {
            console.error(`💥 條件解析錯誤: ${conditionString}`, e);
            return false;
        }
    }

    /**
     * 靜態方法：執行規則引擎的核心邏輯
     * @param {string} message - 使用者輸入訊息
     * @param {string} sessionId - 會話 ID
     * @returns {object} 包含回應、下一步狀態和會話 ID 的結果
     */
    static async executeRules(message, sessionId) {
        if (!dialogueFlowConfig) {
             this.initializeFlowConfig(); 
        }

        // 1. 獲取會話狀態
        const session = sessionManager.getSession(sessionId);

        // 2. 模擬傳統 NLU（這裡簡化為返回空結構）
        const traditionalResult = { intents: [], entities: {} }; 

        // 3. 執行模組化智慧分類 (NLU Layer)
        const modularResult = ModularIntentClassifier.classify(
            message,
            traditionalResult,
            session
        );

        // 🎯 提取最終意圖和實體
        let finalIntent = modularResult.topIntent;
        let finalEntities = modularResult.enhancedData;

        // 4. 根據當前狀態和意圖進行決策
        // 🚨 使用 JSON 中的 initial_state 鍵名
        const currentStateKey = session.currentStep || dialogueFlowConfig.initial_state;
        const currentStateConfig = dialogueFlowConfig.states[currentStateKey];

        // 🎯 處理高優先級/緊急意圖 (例如：取消、登入)
        if (modularResult.topModule === 'CANCEL') {
            return this._handleEmergencyFlow(session, 'cancel');
        }
        if (modularResult.topModule === 'MEMBER' && !session.collectedData.isLoggedIn) {
            return this._handleEmergencyFlow(session, 'login');
        }

        // 5a. 實體收集：先將 NLU 實體合併到 session
        session.collectedData = { ...session.collectedData, ...finalEntities };

        // 5b. 初始化狀態轉換變數
        let nextStateKey = currentStateKey;
        // 🚨 優先讀取 prompt，如果沒有才讀取 response
        let responseMessage = currentStateConfig.prompt || currentStateConfig.response || ""; 
        let endFlow = currentStateConfig.end || false; // JSON 使用 "end" 而非 "endFlow"
        let richCard = currentStateConfig.richCard || null;


        // --- 6. 狀態轉換邏輯 (匹配新 JSON 結構) ---

        // 6a. 檢查意圖驅動的跳轉 (適用於 ask_member_login 或 ask_addons 等狀態)
        const intentTransition = currentStateConfig.intents?.[finalIntent];
        if (intentTransition) {
             nextStateKey = intentTransition;
             console.log(`➡️ [INTENT_JUMP] 意圖 ${finalIntent} 驅動跳轉至 ${nextStateKey}`);
        }

        // 6b. 檢查條件規則驅動的跳轉 (適用於 init 或 entity_collection 狀態)
        else if (currentStateConfig.rules && Array.isArray(currentStateConfig.rules)) {
            const matchedRule = currentStateConfig.rules.find(rule => {
                return this.constructor._evaluateCondition(rule.condition, session.collectedData);
            });

            if (matchedRule) {
                nextStateKey = matchedRule.next_state;
                console.log(`➡️ [RULE_JUMP] 規則 ${matchedRule.condition} 滿足，跳轉至 ${nextStateKey}`);
            }
        }
        
        // 6c. 處理流程啟動意圖 (特例：當在 init 且意圖為 booking_start 時，強制使用 next_state)
        // 🚨 這是解決您 log 問題的關鍵！當使用者輸入「我要訂房」但沒有提供日期時，走這裡。
        else if (currentStateKey === dialogueFlowConfig.initial_state && finalIntent === 'booking_start') {
             nextStateKey = currentStateConfig.next_state; // next_state: "ask_dates_and_nights"
             console.log(`➡️ [INIT_START] 意圖 ${finalIntent} 啟動流程，跳轉至 ${nextStateKey}`);
        }
        
        // 6d. 預設線性推進 (如果以上規則或意圖都不匹配，且狀態有 next_state 鍵)
        else if (currentStateConfig.next_state && currentStateKey !== nextStateKey) {
             nextStateKey = currentStateConfig.next_state;
             console.log(`➡️ [LINEAR] 預設線性跳轉至 ${nextStateKey}`);
        }


        // --- 7. 處理跳轉後的行為 (LogicExec & EntityCollection) ---

        // 🚨 獲取跳轉後狀態的配置，並更新回應訊息
        const nextStateConfig = dialogueFlowConfig.states[nextStateKey];
        if (nextStateConfig) {
            responseMessage = nextStateConfig.prompt || nextStateConfig.response || responseMessage;
            richCard = nextStateConfig.richCard || richCard;
            endFlow = nextStateConfig.end || endFlow;
        }

        // 🎯 這裡應該加入遞迴邏輯來處理 "type": "logic_exec" 的狀態，但為了保持程式碼簡潔，
        // 我們假設 server.js 或一個中介層會處理邏輯執行狀態。
        // 如果 nextStateKey 是 logic_exec 狀態，它會在下一次執行時被處理。


        // --- 8. Fallback 處理 ---

        // 如果在任何邏輯處理後，流程仍停留在當前狀態，則進行回退
        if (nextStateKey === currentStateKey) {
            session.fallbackCount = (session.fallbackCount || 0) + 1;
            
            if (session.fallbackCount >= 2) {
                responseMessage = "抱歉，我似乎無法理解您的意思。我將為您轉接人工客服或重置預訂流程。請問您是否需要重置？";
                nextStateKey = 'fallback_end';
                endFlow = false;
            } else {
                responseMessage = currentStateConfig.fallback || "抱歉，我不太明白您的意思。您是否可以換個方式說呢？";
            }
            // 檢查是否有 fallback_state
            if (currentStateConfig.fallback_state) {
                 nextStateKey = currentStateConfig.fallback_state;
            }
        } else {
             // 如果成功跳轉，則重置 Fallback 計數
             session.fallbackCount = 0;
        }


        // 9. 更新會話狀態
        session.lastMessage = message;
        session.lastIntent = finalIntent;
        session.currentStep = nextStateKey;
        sessionManager.updateSession(session);
        
        // 10. 返回結果
        return {
            response: responseMessage,
            nextStep: nextStateKey,
            endFlow: endFlow,
            sessionId: sessionId,
            richCard: richCard,
            analysis: {
                module: modularResult.topModule,
                confidence: modularResult.confidence,
                intent: finalIntent
            }
        };
    }
    
    // ... (其他靜態方法 _handleEmergencyFlow 和 _generateMissingDataPrompt 保持不變)
    static _handleEmergencyFlow(session, flowType) {
        // ... (保持不變)
        if (flowType === 'cancel') {
             session.currentStep = 'cancel_request';
             sessionManager.updateSession(session);
             return {
                 response: "您好，您啟動了取消流程。請問您要取消哪一筆訂單呢？請提供訂單號碼。",
                 nextStep: 'cancel_request',
                 endFlow: false
             };
        }
        if (flowType === 'login') {
              session.currentStep = 'login_prompt';
              sessionManager.updateSession(session);
              return {
                  response: "好的，請您提供會員帳號或手機號碼以便登入，享受會員專屬優惠。",
                  nextStep: 'login_prompt',
                  endFlow: false
              };
         }
         return {
             response: "抱歉，我目前無法處理這個緊急流程。",
             nextStep: session.currentStep,
             endFlow: false
         };
    }

    static _generateMissingDataPrompt(dataKey) {
        // ... (保持不變)
        const prompts = {
             checkInDate: "請問您預計入住的日期是哪一天呢？",
             nights: "請問您要住幾晚呢？",
             adultCount: "請問有幾位大人入住呢？",
             roomType: "請問您喜歡哪種房型？（例如：雙人房、豪華套房、家庭房）",
             contactName: "請問您的聯絡人姓名是？",
             contactPhone: "請問您的手機號碼是？",
        };
        return prompts[dataKey] || `請問關於 ${dataKey} 的資訊？`;
    }
}

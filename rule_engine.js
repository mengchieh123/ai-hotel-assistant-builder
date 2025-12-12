// rule_engine.js (V2.2.1 - 最終優化：修復 dialogueFlowConfig 拼寫錯誤)

import { ModularIntentClassifier } from './intent_classifier.js';
import { sessionManager } from './session_manager.js';
import config from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- 模擬 __dirname 和 __filename ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
     */
    static _evaluateCondition(conditionString, data) {
        if (!conditionString) return false;

        try {
            let conditions = conditionString.split('&&').map(key => key.trim());

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
     */
    static async executeRules(message, sessionId) {
        if (!dialogueFlowConfig) {
            this.initializeFlowConfig();
        }

        // 1. 獲取會話狀態
        const session = sessionManager.getSession(sessionId);

        // 2. 執行模組化智慧分類 (NLU Layer)
        const traditionalResult = { intents: [], entities: {} };
        const modularResult = ModularIntentClassifier.classify(
            message,
            traditionalResult,
            session
        );

        let finalIntent = modularResult.topIntent;
        let finalEntities = modularResult.enhancedData;

        // 3. 獲取當前狀態配置
        const currentStateKey = session.currentStep || dialogueFlowConfig.initial_state;
        
        // 🏆 修正點 1: dialogueFlowFlowConfig -> dialogueFlowConfig
        const currentStateConfig = dialogueFlowConfig.states[currentStateKey]; 

        // 🎯 處理高優先級/緊急意圖 (省略部分程式碼)

        // =========================================================
        // 【核心修改 A: 實體隔離 (解決密碼誤判)】
        // =========================================================
        if (currentStateKey === 'ask_member_password') {
            // 在密碼輸入狀態，強制清除所有可能被誤判為密碼的實體
            delete finalEntities.roomCount; 
            delete finalEntities.rawNumber; 
            delete finalEntities.nights; 
            
            // 將輸入的原始文本視為密碼
            if (message && message.length > 0) {
                 finalEntities.memberPassword = message.trim();
                 console.log(`🔒 [ENTITY_ISOLATION] 忽略 RoomCount/RawNumber, 強制設定 memberPassword`);
            }
        }
        // =========================================================

        // 4. 實體收集：先將 NLU 實體合併到 session
        session.collectedData = { ...session.collectedData, ...finalEntities };

        // 5. 初始化狀態轉換變數
        let nextStateKey = currentStateKey;
        let jumped = false; 
        let richCard = currentStateConfig.richCard || null;
        let responseMessage = ""; 
        let endFlow = currentStateConfig.end || false;

        // --- 6. 狀態轉換邏輯 ---

        // 6a. 檢查意圖驅動的跳轉
        const intentTransition = currentStateConfig.intents?.[finalIntent];
        if (intentTransition) {
            nextStateKey = intentTransition;
            jumped = true;
            console.log(`➡️ [INTENT_JUMP] 意圖 ${finalIntent} 驅動跳轉至 ${nextStateKey}`);
        }

        // 6b. 檢查條件規則驅動的跳轉
        else if (currentStateConfig.rules && Array.isArray(currentStateConfig.rules)) {
            const matchedRule = currentStateConfig.rules.find(rule => {
                return this.constructor._evaluateCondition(rule.condition, session.collectedData);
            });

            if (matchedRule) {
                nextStateKey = matchedRule.next_state;
                jumped = true;
                console.log(`➡️ [RULE_JUMP] 規則 ${matchedRule.condition} 滿足，跳轉至 ${nextStateKey}`);
            }
        }

        // 6c. 處理流程啟動意圖
        else if (currentStateKey === dialogueFlowConfig.initial_state && finalIntent === 'booking_start') {
            nextStateKey = currentStateConfig.next_state; 
            jumped = true;
            console.log(`➡️ [INIT_START] 意圖 ${finalIntent} 啟動流程，跳轉至 ${nextStateKey}`);
        }

        // --- 7. 處理跳轉後的行為和回應 ---

        // 🏆 修正點 2: dialogueFlowFlowConfig -> dialogueFlowConfig
        const nextStateConfig = dialogueFlowConfig.states[nextStateKey]; 
        if (nextStateConfig) {
            richCard = nextStateConfig.richCard || richCard;
            endFlow = nextStateConfig.end || endFlow;

            // =========================================================
            // 【核心修改 B: 回應抑制 (解決 Handler 通用回應)】
            // =========================================================
            if (jumped) {
                // 如果成功跳轉到新狀態
                if (nextStateConfig.type === 'handler' || nextStateConfig.type === 'logic_exec') {
                    responseMessage = ""; // 內部處理狀態不對用戶回應
                    console.log(`🤫 [RESPONSE_SUPPRESS] 跳轉到 Handler 狀態 (${nextStateKey})，回應已抑制。`);
                } else {
                    // 否則，新狀態是詢問/提示狀態，輸出其提示
                    responseMessage = nextStateConfig.prompt || nextStateConfig.response || "";
                }
            } else {
                // 如果流程停留在當前狀態 (沒有跳轉)
                responseMessage = currentStateConfig.prompt || currentStateConfig.response || "";
            }
            // =========================================================
        }
        
        // --- 8. Fallback 處理 (省略部分程式碼) ---

        if (nextStateKey === currentStateKey && !jumped) { 
            session.fallbackCount = (session.fallbackCount || 0) + 1;
            
            if (session.fallbackCount >= 2) {
                responseMessage = "抱歉，我似乎無法理解您的意思。我將為您轉接人工客服或重置預訂流程。請問您是否需要重置？";
                nextStateKey = 'fallback_end';
                endFlow = false;
            } else {
                 responseMessage = currentStateConfig.fallback || "抱歉，我不太明白您的意思。您是否可以換個方式說呢？"; 
            }
            if (currentStateConfig.fallback_state) {
                 nextStateKey = currentStateConfig.fallback_state;
            }
        } else {
             session.fallbackCount = 0;
        }


        // 9. 更新會話狀態
        session.lastMessage = message;
        session.lastIntent = finalIntent;
        session.currentStep = nextStateKey;
        sessionManager.updateSession(session);
        
        // 10. 返回結果
        const result = {
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

        // =========================================================
        // 【最終優化 C: Handler 狀態的即時鏈式執行 (遞迴)】
        // 確保 lock_inventory/login_verification 等 Handler 狀態能立即推進流程。
        // =========================================================
        
        // 🏆 修正點 3: dialogueFlowFlowConfig -> dialogueFlowConfig
        const finalNextStateConfig = dialogueFlowConfig.states[result.nextStep]; 
        
        // 如果成功跳轉到 Handler 狀態且沒有回應，我們就立即遞迴推進流程
        if (jumped && (finalNextStateConfig?.type === 'handler' || finalNextStateConfig?.type === 'logic_exec') && result.response === "") {
             console.log(`🔗 [CHAIN_EXEC] 進入 Handler 狀態 (${result.nextStep})，將立即遞迴執行下一步。`);
             
             // 確保 Handler 狀態有定義 next_state，否則會無限遞迴
             if (finalNextStateConfig.next_state) {
                 // 在遞迴時，我們使用 **空訊息** 呼叫 RuleEngine，這樣它會使用 session 中已更新的 nextStep
                 // 且不會被 NLU 誤判為新意圖或實體。
                 const chainResult = await this.executeRules('', sessionId);
                 return chainResult;
             } else {
                 console.error(`💥 [CHAIN_ERROR] Handler 狀態 ${result.nextStep} 缺少 next_state，流程卡住！`);
             }
        }
        
        return result;
    }

    // ... (其他靜態方法 _handleEmergencyFlow 和 _generateMissingDataPrompt 保持不變)
    static _handleEmergencyFlow(session, flowType) {
        // ...
    }

    static _generateMissingDataPrompt(dataKey) {
        // ...
    }
}

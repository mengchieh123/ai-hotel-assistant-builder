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
 * 
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
     * 檢查 collectedData 中是否包含所有需要的 key
     */
    static _evaluateCondition(conditionString, data) {
        if (!conditionString) return false;

        try {
            // 處理多個條件 (例如: roomType && checkInDate)
            let conditions = conditionString.split('&&').map(key => key.trim());

            return conditions.every(key =>
                data[key] !== null &&
                data[key] !== undefined &&
                (typeof data[key] === 'string' ? data[key].length > 0 : true) // 確保字串非空
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
        // 確保配置已初始化
        if (!dialogueFlowConfig) {
            this.initializeFlowConfig();
        }

        // 1. 獲取會話狀態
        const session = sessionManager.getSession(sessionId);

        // 2. 執行模組化智慧分類 (NLU Layer)
        // 🚨 僅在訊息非空時執行 NLU (避免遞迴鏈式執行時再次執行 NLU)
        let finalIntent = null;
        let finalEntities = {};
        let modularResult = { topModule: null, confidence: 0, enhancedData: {} };

        if (message.trim().length > 0) {
            const traditionalResult = { intents: [], entities: {} };
            modularResult = ModularIntentClassifier.classify(
                message,
                traditionalResult,
                session
            );
            finalIntent = modularResult.topIntent;
            finalEntities = modularResult.enhancedData;
        } else {
             // 如果是空訊息 (用於鏈式執行)，則從 session 繼承上一次的意圖
             finalIntent = session.lastIntent || null;
             console.log(`🔗 [CHAIN_EXEC] 繼承上一個意圖: ${finalIntent}`);
        }

        // 3. 獲取當前狀態配置
        const currentStateKey = session.currentStep || dialogueFlowConfig.initial_state;
        const currentStateConfig = dialogueFlowConfig.states[currentStateKey];

        // 🎯 錯誤檢查：當前狀態是否存在
        if (!currentStateConfig) {
            console.error(`💥 [CRITICAL_CONFIG_ERROR] dialogue_flow.json 缺少狀態配置：'${currentStateKey}'`);
            return {
                response: `系統配置錯誤：缺少 '${currentStateKey}' 的定義。`,
                nextStep: 'error_end',
                endFlow: true,
                sessionId: sessionId,
                richCard: null,
                analysis: { module: 'SYSTEM', confidence: 100, intent: 'critical_error' }
            };
        }


        // =========================================================
        // 【修正 1：處理高優先級/緊急意圖，確保配置存在且參數呼叫正確】
        // =========================================================
        if (finalIntent === 'cancel_flow') {
            const cancelStateKey = 'global_cancel_flow';
            const cancelStateConfig = dialogueFlowConfig.states[cancelStateKey];
            
            // 🚨 錯誤保護：檢查取消狀態配置是否存在
            if (!cancelStateConfig || !cancelStateConfig.response) {
                 console.error(`💥 [CRITICAL_CONFIG_ERROR] dialogue_flow.json 缺少必要狀態或回應：'${cancelStateKey}'`);
                 sessionManager.updateSession(sessionId, message, [finalIntent]); 
                 return {
                     response: `系統配置錯誤：缺少 '${cancelStateKey}' 的定義。請重試或聯繫管理員。`,
                     nextStep: 'error_end',
                     endFlow: true,
                     sessionId: sessionId,
                     richCard: null,
                     analysis: { module: 'SYSTEM', confidence: 100, intent: 'critical_error' }
                 };
            }

            session.currentStep = cancelStateKey;
            sessionManager.updateSession(sessionId, message, [finalIntent]); 
            
            return {
                response: cancelStateConfig.response,
                nextStep: cancelStateKey,
                endFlow: true,
                sessionId: sessionId,
                richCard: cancelStateConfig.richCard || null,
                analysis: { module: 'SYSTEM', confidence: 100, intent: 'cancel_flow' }
            };
        }
        // =========================================================

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

        // 4. 實體收集：將 NLU 實體合併到 session (確保 collectedData 存在)
        if (!session.collectedData) {
            session.collectedData = {};
        }
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
                // 修正點：使用 RuleEngine._evaluateCondition 呼叫靜態方法
                return RuleEngine._evaluateCondition(rule.condition, session.collectedData);
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
                    responseMessage = ""; // 內部處理狀態不對用戶回應 (將在遞迴中由下一狀態產生)
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

        // --- 8. Fallback 處理 ---

        if (nextStateKey === currentStateKey && !jumped && message.trim().length > 0) {
            session.fallbackCount = (session.fallbackCount || 0) + 1;

            if (session.fallbackCount >= 2) {
                // 連續兩次 fallback 失敗，建議轉接或重置
                responseMessage = "抱歉，我似乎無法理解您的意思。我將為您轉接人工客服或重置預訂流程。請問您是否需要重置？";
                nextStateKey = 'fallback_end'; // 進入終止狀態
                endFlow = false;
            } else {
                // 第一次或第二次 fallback
                responseMessage = currentStateConfig.fallback || "抱歉，我不太明白您的意思。您是否可以換個方式說呢？";
            }
            if (currentStateConfig.fallback_state) {
                nextStateKey = currentStateConfig.fallback_state;
            }
        } else {
             // 成功跳轉後重置 fallback 計數
             session.fallbackCount = 0;
        }


        // 9. 更新會話狀態 (使用正確的參數簽名)
        session.lastMessage = message;
        session.lastIntent = finalIntent;
        session.currentStep = nextStateKey;
        // 🚨 關鍵修正：確保使用正確的參數呼叫 updateSession
        sessionManager.updateSession(sessionId, message, finalIntent ? [finalIntent] : []); 

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
        // =========================================================

        const finalNextStateConfig = dialogueFlowConfig.states[result.nextStep];

        // 檢查：如果剛跳轉到 Handler 狀態 (且不是遞迴中的空訊息)，則立即執行下一步
        if (jumped && (finalNextStateConfig?.type === 'handler' || finalNextStateConfig?.type === 'logic_exec') && finalNextStateConfig.next_state) {
            
             // 確保 Handler 狀態不進入無限遞迴
             if (finalNextStateConfig.next_state === finalNextStateConfig.name) {
                 console.error(`💥 [CHAIN_ERROR] Handler 狀態 ${result.nextStep} 存在無限遞迴鏈接！`);
                 return result; // 避免崩潰，直接返回當前結果
             }

             console.log(`🔗 [CHAIN_EXEC] 進入 Handler 狀態 (${result.nextStep})，將立即遞迴執行下一步。`);
             
             // 在遞迴時，使用 **空訊息** 呼叫 RuleEngine，避免 NLU 干擾
             // 遞迴呼叫將從下一狀態開始，並使用上一次的意圖 (finalIntent)
             const chainResult = await this.executeRules('', sessionId);
             return chainResult;
        }

        return result;
    }
    
    // 註：這兩個方法沒有邏輯變動，保持原樣
    static _handleEmergencyFlow(session, flowType) {
        // ... (保持原樣)
    }

    static _generateMissingDataPrompt(dataKey) {
        // ... (保持原樣)
    }
}

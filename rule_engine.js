// rule_engine.js (V1.8 - 核心業務邏輯整合)

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

const FLOW_CONFIG_PATH = path.join(__dirname, 'dialogue_flow.json');

/**
 * 🎯 對話流程配置 (靜態變數)
 * 應在服務啟動時載入，避免重複讀取。
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

            // 執行配置的結構檢查（簡化版）
            if (!dialogueFlowConfig.initialState || !dialogueFlowConfig.states) {
                throw new Error('對話流程配置缺少 initialState 或 states 結構');
            }

            console.log('✅ [DEBUG] dialogue_flow.json 成功載入！');
            console.log('✅ [DEBUG] RuleEngine 靜態配置完成並已通過結構檢查。');

        } catch (error) {
            console.error(`💥 [ERROR] 無法載入或解析對話流程配置: ${error.message}`);
            throw new Error(`對話流程初始化失敗: ${error.message}`);
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
             // 確保配置已載入
            this.initializeFlowConfig(); 
        }

        // 1. 獲取會話狀態
        const session = sessionManager.getSession(sessionId);

        // 2. 模擬傳統 NLU（這裡簡化為返回空結構）
        // 如果您有外部服務 (例如 Google Dialogflow/Rasa/自研 NLU) 則在此處呼叫
        const traditionalResult = {
            intents: [],
            entities: {}
        }; 

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
        const currentStateKey = session.currentStep || dialogueFlowConfig.initialState;
        const currentStateConfig = dialogueFlowConfig.states[currentStateKey];

        // 🎯 處理高優先級/緊急意圖 (例如：取消、登入)
        if (modularResult.topModule === 'CANCEL') {
            return this._handleEmergencyFlow(session, 'cancel');
        }
        if (modularResult.topModule === 'MEMBER' && !session.collectedData.isLoggedIn) {
            return this._handleEmergencyFlow(session, 'login');
        }

        // 5. 狀態轉換邏輯
        let nextStateKey = currentStateKey;
        let responseMessage = currentStateConfig.response;
        let endFlow = false;
        let richCard = null;

        // 檢查是否有匹配的意圖轉換規則
        const transitionRule = currentStateConfig.transitions.find(t => 
            t.onIntent === finalIntent
        );

        if (transitionRule) {
            nextStateKey = transitionRule.nextState;

            // 🎯 執行數據檢查和實體收集
            const requiredData = dialogueFlowConfig.states[nextStateKey]?.requires || [];
            let missingData = [];

            // 5a. 合併實體
            session.collectedData = { ...session.collectedData, ...finalEntities };
            
            // 5b. 檢查遺漏數據
            for (const key of requiredData) {
                if (!session.collectedData[key]) {
                    missingData.push(key);
                }
            }

            if (missingData.length > 0) {
                // 如果缺少數據，則進入數據收集的子步驟
                nextStateKey = missingData[0]; // 簡單地以第一個缺失項作為下一步
                responseMessage = this._generateMissingDataPrompt(missingData[0]);
                console.log(`⚠️ [DATA_COLLECT] 缺少數據: ${missingData.join(', ')}. 跳轉至 ${nextStateKey}`);
            } else {
                // 數據收集完整，跳轉到目標狀態並產生回應
                const nextConfig = dialogueFlowConfig.states[nextStateKey];
                responseMessage = nextConfig.response;
                richCard = nextConfig.richCard || null;
                endFlow = nextConfig.endFlow || false;
            }

        } else if (currentStateConfig.transitions.length === 0) {
            // 當前狀態是葉節點（如：訂單完成、流程結束）
            endFlow = currentStateConfig.endFlow || true;
            responseMessage = currentStateConfig.response;
        } else {
            // 意圖不匹配：處理回退 (Fallback)
            nextStateKey = currentStateKey; // 留在當前狀態
            session.fallbackCount = (session.fallbackCount || 0) + 1;
            
            if (session.fallbackCount >= 2) {
                // 連續回退，跳轉到人工客服或重新開始
                responseMessage = "抱歉，我似乎無法理解您的意思。我將為您轉接人工客服或重置預訂流程。請問您是否需要重置？";
                nextStateKey = 'fallback_end';
                endFlow = false;
            } else {
                // 簡單回退回應
                responseMessage = currentStateConfig.fallback || "抱歉，我不太明白您的意思。您是否可以換個方式說呢？";
            }
        }
        
        // 6. 更新會話狀態
        session.lastMessage = message;
        session.lastIntent = finalIntent;
        session.currentStep = nextStateKey;
        sessionManager.updateSession(session);
        
        // 7. 返回結果
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
    
    /**
     * 處理緊急或高優先級的流程中斷
     * @param {object} session - 當前會話
     * @param {string} flowType - 流程類型 ('cancel' 或 'login')
     */
    static _handleEmergencyFlow(session, flowType) {
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
        // 默認返回一般回退
        return {
            response: "抱歉，我目前無法處理這個緊急流程。",
            nextStep: session.currentStep,
            endFlow: false
        };
    }

    /**
     * 根據缺失的數據生成提示語句
     * @param {string} dataKey - 缺失數據的鍵值
     */
    static _generateMissingDataPrompt(dataKey) {
        const prompts = {
            checkInDate: "請問您預計入住的日期是哪一天呢？",
            nights: "請問您要住幾晚呢？",
            adultCount: "請問有幾位大人入住呢？",
            roomType: "請問您喜歡哪種房型？（例如：雙人房、豪華套房、家庭房）",
            contactName: "請問您的聯絡人姓名是？",
            contactPhone: "請問您的手機號碼是？",
            // ... 可擴展其他數據提示
        };
        return prompts[dataKey] || `請問關於 ${dataKey} 的資訊？`;
    }
}

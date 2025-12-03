// server.js (第五步重構後版本)
require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const path = require('path');

// 使用 Node.js 18+ 內建的 fetch
const fetch = global.fetch || require('node-fetch');

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// --- 導入模組 ---
const config = require('./config'); 
const sessionManager = require('./session_manager'); 
const SmartIntentClassifier = require('./intent_classifier'); 
const BookingFlowController = require('./booking_controller'); // 導入訂房控制器
const { FlowConfigLoader } = require('./flow_loader'); // 雖然只在 RuleEngine 中被 BookingFlowController.getFlow() 依賴，但 RuleEngine 仍需 BookingFlowController 

// 由於 flowLoader 實例化已移至 session_manager.js 和 booking_controller.js，這裡不再需要實例化。

// --- Gemini API 配置 (僅保留 ResponseGenerator 需要的) ---
const {
    CHAT_INSTRUCTIONS,
    apiUrl,
    MAX_RETRIES,
    INITIAL_BACKOFF_MS
} = config;

const app = express();

// ---------------------------------------------
// 1. EXPRESS 中間件與靜態檔案
// ---------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ---------------------------------------------
// 2. 實用函數 (保留)
// ---------------------------------------------

// 替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        const value = data[key] === undefined || data[key] === null ? '' : data[key];
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}

// ---------------------------------------------
// 3. Gemini 回應生成器 (ResponseGenerator) - 暫時保留
// ---------------------------------------------

class ResponseGenerator {
    /**
     * @param {object} session - 當前會話物件
     * @returns {string} - Gemini 的文字回應
     */
    static async getGeminiResponse(session, userMessage) {
        if (!apiUrl) return "Gemini API Key 未設定，無法提供 AI 自由問答。";

        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                // 1. 組裝歷史記錄 (Gemini API 格式)
                const contents = session.conversationHistory
                    .filter(item => item.role === 'user' || item.role === 'model') // 只保留用戶和模型的回覆
                    .map(item => ({
                        role: item.role,
                        parts: [{ text: item.message }]
                    }));
                
                // 2. 確定當前發送給 AI 的內容
                const currentContents = contents.concat([{
                    role: 'user',
                    parts: [{ text: userMessage }]
                }]);

                // 3. 準備 Payload
                const payload = {
                    contents: currentContents,
                    config: {
                        systemInstruction: CHAT_INSTRUCTIONS,
                        temperature: 0.5,
                        maxOutputTokens: 2048,
                    },
                };

                // 4. 呼叫 Gemini API
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorBody)}`);
                }

                const data = await response.json();
                
                // 5. 提取回應文本
                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
                    return data.candidates[0].content.parts[0].text;
                } else {
                    return "抱歉，AI 助理目前無法生成有效回應。";
                }

            } catch (error) {
                console.error(`❌ Gemini API 呼叫失敗 (第 ${retries + 1} 次重試):`, error.message);
                retries++;
                if (retries < MAX_RETRIES) {
                    const delay = INITIAL_BACKOFF_MS * (2 ** retries);
                    console.log(`⏱️ 延遲 ${delay}ms 後重試...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        return "很抱歉，由於伺服器連線問題，AI 助理目前無法提供服務。";
    }
}


// ---------------------------------------------
// 4. 規則引擎 (RuleEngine) - 暫時保留
// ---------------------------------------------

class RuleEngine {
    /**
     * 主處理函數：接收用戶輸入並返回回應
     */
    static async processRules({ sessionId, userMessage }) {
        const session = sessionManager.getSession(sessionId);
        const intents = SmartIntentClassifier.classify(userMessage);
        
        // 將實體解析結果與 Session 數據合併
        const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
        Object.assign(session.collectedData, extractedEntities);
        
        // 更新 Session 中的用戶輸入和意圖
        sessionManager.updateSession(sessionId, userMessage, intents);
        
        // 執行規則
        const result = await RuleEngine.process(intents, session, userMessage);

        // 執行結果後處理
        if (result.shouldProcess) {
            // 更新 session 狀態
            if (result.nextStep) {
                session.currentStep = result.nextStep;
            }

            let geminiResponse = '';
            // 只有在明確允許 AI 呼叫時才呼叫 Gemini
            if (result.allowGeminiCall) { 
                geminiResponse = await ResponseGenerator.getGeminiResponse(session, userMessage);
            }

            // 合併流程回應和 Gemini 回應
            let finalResponse = result.response;
            if (geminiResponse) {
                if (session.currentStep === 'paused_waiting_for_resume') {
                    // 暫停模式下，將 Gemini 回覆插在流程引導訊息之前
                    finalResponse = `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${result.response}`;
                } else if (session.currentStep === 'handle_general_inquiry' || intents.includes('general_inquiry')) {
                    // 純閒聊
                    finalResponse = geminiResponse;
                }
            }

            // 記錄助手的最終回應
            sessionManager.addAssistantResponse(sessionId, finalResponse, result.richCard);

            return {
                reply: finalResponse,
                nextStateKey: session.currentStep,
                data: session.collectedData,
                richCard: result.richCard
            };
        }

        // Fallback
        return {
             reply: "抱歉，系統無法處理您的請求，請重新開始。",
             nextStateKey: 'init',
             data: session.collectedData
        };
    }

    // 執行規則集
    static async process(intents, session, message) {
        
        // 規則優先級：緊急 > 流程控制 > 閒聊
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule, // 這是主要的流程控制規則，包含 P:98 (查詢暫停) 和 P:95 (流程推進)
            this.generalRule
        ];

        for (const rule of rules) {
            // 注意：這裡的 rule 可能是一個同步函數，所以用 await 確保
            const result = await rule.call(this, intents, session, message); 
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (最高優先級 P:100) */
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            session.currentStep = 'end_conversation'; // 結束流程
            return { 
                shouldProcess: true, 
                priority: 100,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation',
                allowGeminiCall: false
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 訂房流程規則 (核心邏輯 P:98, P:95) */
    static async bookingFlowRule(intents, session, message) {
        const flow = BookingFlowController.getFlow(); // 使用導入的 BookingFlowController
        const isAffirm = intents.includes('affirm');
        const isDeny = intents.includes('deny');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;
        
        let currentState = flow.states[currentStateKey];

        // ----------------------------------------------------
        // 1. 查詢/介紹優先級處理 (P:98)
        // ----------------------------------------------------
        // 只要有查詢、價格或房型關鍵字，且**不在**閒聊或結束狀態，就觸發暫停
        if (intents.includes('inquiry') || intents.includes('pricing') || intents.includes('roomType_keyword')) {
            if (currentStateKey && 
                currentStateKey !== 'init' && 
                currentStateKey !== 'paused_waiting_for_resume' &&
                !isAffirm) { // 除非用戶明確說"確認/繼續"
                
                console.log(`⚠️ 偵測到介紹/查詢意圖。暫停流程，轉交給 AI 處理。`);
                session.pausedState = currentStateKey; // 儲存當前狀態

                return {
                    shouldProcess: true,
                    priority: 98, // 介於流程暫停 99 和流程推進 95 之間
                    response: `好的，我將為您查詢相關資訊。\n\n**查詢完成後，請回覆『繼續』以恢復訂房流程。**`,
                    richCard: {
                        "type": "button_list",
                        "title": "要繼續訂房嗎？",
                        "buttons": [
                            { "text": "✅ 繼續訂房", "value": "繼續訂房" },
                            { "text": "❌ 取消流程", "value": "取消" }
                        ]
                    },
                    nextStep: 'paused_waiting_for_resume',
                    allowGeminiCall: true // 必須允許 AI 介入
                };
            }
        }

        // ----------------------------------------------------
        // 2. 流程恢復處理 (用戶回復 "繼續" 或 "確認")
        // ----------------------------------------------------
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                currentStateKey = session.pausedState; // 恢復到暫停前的狀態
                session.pausedState = null;
                session.currentStep = currentStateKey;
                
                currentState = flow.states[currentStateKey]; 

                console.log(`🔄 恢復流程到: ${currentStateKey}`);
                // 繼續執行後續的 P:95 流程推進邏輯 (不再直接 return)
            } else if (isDeny) {
                 return {
                    shouldProcess: true,
                    priority: 99,
                    response: `好的，訂房流程已取消。期待您的下次光臨。`,
                    nextStep: 'end_conversation',
                    allowGeminiCall: false
                   };
            } else {
                // 如果用戶在暫停狀態，但沒有回復「繼續」，讓它走 AI 自由問答 (P: 1)
                return { shouldProcess: false, priority: 0 }; 
            }
        }
        
        // ----------------------------------------------------
        // 3. 流程內部轉移與邏輯處理 (P:95)
        // ----------------------------------------------------
        let nextStateKey = currentStateKey;

        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }

        // B. 實體收集檢查
        let allEntitiesCollected = true;
        if (currentState.entities && currentState.next_state) {
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null
            );

            if (allEntitiesCollected) {
                // 如果實體收齊，即使沒有明確的意圖，也轉到 next_state
                nextStateKey = currentState.next_state;
            }
        }

        // C. 流程特殊邏輯處理 (在狀態轉移時觸發)
        if (nextStateKey === 'final_summary_and_payment') {
            // 進入最終總結狀態前，執行價格/庫存檢查
            const priceResult = BookingFlowController.calculatePrice(data); // 呼叫導入的模組方法

            if (!priceResult.success) {
                // 庫存不足 (OOS) 或其他錯誤
                const errorPrompt = priceResult.oos 
                    ? priceResult.errorMessage + " 請修正人數、晚數或選擇其他日期/房型。"
                    : priceResult.errorMessage || "抱歉，計算價格或檢查庫存時發生錯誤。";
                
                // 庫存不足，回溯到收集房型日期的步驟
                nextStateKey = 'collect_room_and_dates'; 
                
                return {
                    shouldProcess: true,
                    priority: 97, // 比 P:95 略高，確保錯誤優先處理
                    response: errorPrompt,
                    nextStep: nextStateKey, 
                    richCard: null,
                    allowGeminiCall: false // 錯誤修正不需要 AI
                };
            }
            
            // 價格計算成功，動態生成最終確認提示
            let confirmPrompt = `🎉 您的訂房資訊如下：\n`;
            confirmPrompt += `房型：**${data.roomType}** (${data.roomCount} 間) / 入住：**${data.checkInDate}** / 晚數：**${data.nights} 晚**\n`;
            confirmPrompt += `人數：**${data.adultCount} 大 ${data.childCount} 小**\n`;

            if (data.discountRate && data.discountRate !== '0') {
                 confirmPrompt += `會員折扣：**${data.memberLevel}** 享 **${data.discountRate}%** 折扣\n`;
                 confirmPrompt += `原總價：NT$ ${data.totalPrice} / 折扣後：NT$ ${data.newTotalPrice}\n`;
            } else {
                 confirmPrompt += `總價：NT$ ${data.finalPrice}\n`;
            }
            confirmPrompt += `\n**請問是否確認訂房？**`;
            
            // 更新狀態和回應
            flow.states['final_summary_and_payment'].prompt = confirmPrompt;
        }

        // 4. 輸出回應 (P:95)
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && allEntitiesCollected === false)) {
            // 狀態發生轉移 或 實體未收齊且需要回應
            const nextState = flow.states[nextStateKey];
            
            const responsePrompt = nextState.prompt ? interpolatePrompt(nextState.prompt, data) : currentState.fallback;

            return {
                shouldProcess: true,
                priority: 95,
                response: responsePrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                // 只有在明確允許閒聊時才呼叫 Gemini (handle_general_inquiry/paused_waiting_for_resume)
                allowGeminiCall: nextState.allow_gemini_call === true 
            };
        }

        // 5. 流程結束後的閒聊處理 (交給 generalRule 處理，這裡直接跳過)
        if (currentState.end) {
             return { shouldProcess: false, priority: 0 };
        }

        // 6. 流程內，但訊息無法驅動流程 (例如：重複回答)，使用 fallback
        const responsePrompt = currentState.fallback ? interpolatePrompt(currentState.fallback, data) : currentState.prompt;
        
        return {
            shouldProcess: true,
            priority: 95,
            response: responsePrompt,
            nextStep: currentStateKey,
            richCard: currentState.richCard || null,
            allowGeminiCall: false // 流程等待實體時，通常不需要 AI 閒聊
        };
    }
    
    /** 規則 3: 一般詢問與閒聊 (最低優先級 P:1) */
    static generalRule(intents, session, message) {
        // 如果沒有任何流程規則被觸發，且用戶是閒聊，則交給 Gemini 處理
        if (intents.includes('general_inquiry') || session.currentStep === 'handle_general_inquiry') {
            return { 
                shouldProcess: true, 
                priority: 1, 
                response: '我正在思考...', 
                nextStep: 'handle_general_inquiry',
                allowGeminiCall: true // 呼叫 Gemini API
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
}


// ---------------------------------------------
// 5. API ENDPOINT 和伺服器啟動
// ---------------------------------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 主要聊天 API
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
        return res.status(400).send({ error: '缺少 sessionId 或 message' });
    }

    try {
        // 將流程處理交給 RuleEngine
        const result = await RuleEngine.processRules({ sessionId, userMessage: message });
        res.json(result);
    } catch (error) {
        console.error('API 處理錯誤:', error);
        res.status(500).json({ reply: '伺服器內部錯誤，請稍後再試。' });
    }
});

// 啟動伺服器
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器運行在 http://${HOST}:${PORT}`);
    console.log(`Gemini API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`);
});

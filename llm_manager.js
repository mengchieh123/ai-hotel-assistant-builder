// llm_manager.js (V1.2 - LLM 優先級切換與容錯)

const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// --- 🔑 API 密鑰與 Client 初始化 ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; 

// 初始化 Gemini Client：如果密鑰不存在，ai 會是 null，呼叫時會被捕獲並觸發容錯
const ai = GEMINI_API_KEY ? new GoogleGenAI({apiKey: GEMINI_API_KEY}) : null;

// --- 配置區 ---
const LLM_PRIORITY = {
    PRIMARY: 'Gemini',
    SECONDARY: 'HuggingFace'
};
const LLM_TIMEOUT = 10000; // 10 秒

// --- 核心類別 ---
class LLMManager {

    /**
     * 呼叫 Gemini API 進行通用查詢 (高優先級/主要)
     * @param {string} query 使用者問題
     * @param {object} context 會話數據 (collectedData)
     * @returns {Promise<{response: string, source: string}>}
     */
    static async callGemini(query, context) {
        if (!ai) {
            // 如果 Client 未初始化，直接拋出錯誤，讓容錯機制切換到備用 LLM
            throw new Error("Gemini Client 未初始化，請檢查 GEMINI_API_KEY。");
        }
        
        console.log("➡️ 呼叫 LLM: Gemini API");

        // 構造系統提示：定義 LLM 的角色和風格
        const systemInstruction = "您是一個專業的旅館聊天機器人。請用簡潔、友善的口吻回答用戶的通用問題，並引導他們回到訂房流程。";
        // 構造用戶請求內容：包含當前會話收集到的上下文
        const userPrompt = `用戶的通用問題是："${query}"。以下是當前會話收集到的數據（作為上下文）：${JSON.stringify(context)}`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ 
                    role: "user", 
                    parts: [{ text: userPrompt }] 
                }],
                config: {
                    systemInstruction: systemInstruction,
                    timeout: LLM_TIMEOUT 
                }
            });

            const textResponse = response.text;
            
            if (!textResponse) {
                 throw new Error("Gemini API 返回了空內容。");
            }
            
            return { 
                response: textResponse, 
                source: 'Gemini' 
            };
            
        } catch (error) {
            console.error(`💥 Gemini API 呼叫錯誤: ${error.message}`);
            // 拋出錯誤，觸發容錯機制
            throw new Error(`Gemini Call Failed: ${error.message}`);
        }
    }

    /**
     * 呼叫 Hugging Face LLM (透過 Inference API) (備用)
     * @param {string} query 使用者問題
     * @param {object} context 會話數據 (collectedData)
     * @returns {Promise<{response: string, source: string}>}
     */
    static async callHuggingFace(query, context) {
        if (!HUGGINGFACE_API_KEY) {
             throw new Error("Hugging Face API Key 未設置。");
        }
        
        console.log("➡️ 呼叫 LLM: HuggingFace LLM (備用)");

        // 讀取 Render 中設置的 Endpoint URL
        const hfApiEndpoint = process.env.HUGGINGFACE_API_ENDPOINT; 
        
        if (!hfApiEndpoint) {
             throw new Error("Hugging Face API Endpoint 未設置。");
        }

        // 構造請求 Body：傳入問題和參數
        const requestBody = {
            inputs: `你是旅館聊天機器人。請簡潔地回答此問題：${query}。上下文數據：${JSON.stringify(context)}`,
            parameters: { 
                max_new_tokens: 256,
                temperature: 0.7 
            }
        };

        try {
            const apiResponse = await axios.post(hfApiEndpoint, requestBody, {
                headers: {
                    // 使用 Access Token 進行授權
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: LLM_TIMEOUT 
            });
            
            let textResponse = '';
            
            // 處理 Hugging Face Inference API 的常見響應格式
            if (Array.isArray(apiResponse.data) && apiResponse.data[0]?.generated_text) {
                 textResponse = apiResponse.data[0].generated_text;
            } else if (apiResponse.data.generated_text) {
                 textResponse = apiResponse.data.generated_text;
            } else {
                 throw new Error("Hugging Face API 返回的格式無法解析。");
            }

            return { 
                response: textResponse, 
                source: 'HuggingFace' 
            };
            
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message;
            console.error(`💥 Hugging Face LLM 呼叫錯誤: ${errorMessage}`);
            throw new Error(`HuggingFace Call Failed: ${errorMessage}`);
        }
    }

    /**
     * 核心切換與容錯邏輯：優先嘗試主要 LLM，失敗後自動切換到備用 LLM。
     */
    static async getGeneralAnswer(query, sessionData) {
        let result = null;
        
        // 1. 嘗試主要 LLM (PRIMARY: Gemini)
        if (LLM_PRIORITY.PRIMARY === 'Gemini') {
            try {
                result = await this.callGemini(query, sessionData);
                return result;
            } catch (error) {
                console.error("⚠️ 主要 LLM (Gemini) 呼叫失敗，切換到備用 LLM。");
            }
        }

        // 2. 嘗試備用 LLM (SECONDARY: Hugging Face)
        if (LLM_PRIORITY.SECONDARY === 'HuggingFace') {
            try {
                result = await this.callHuggingFace(query, sessionData);
                return result;
            } catch (error) {
                // 如果備用 LLM 也失敗，則拋出最終錯誤
                console.error("❌ 備用 LLM (Hugging Face) 呼叫也失敗。");
                throw new Error("所有 LLM 服務均不可用。無法提供通用資訊。");
            }
        }
        
        // 3. 服務均不可用或設定錯誤
        if (!result) {
            console.error("❌ LLMManager 設定錯誤或所有 LLM 服務均不可用。");
            throw new Error("LLM 服務設定錯誤或服務均不可用。");
        }
    }
}

module.exports = LLMManager;

// llm_manager.js (V1.0 - LLM 優先級切換與容錯)

const axios = require('axios'); // 假設用於外部 API 呼叫 (如 Hugging Face 或自託管 LLM)
// TODO: 引入必要的 LLM SDKs 或配置 (例如 Gemini SDK)
// const { GoogleGenAI } = require('@google/genai'); 
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
// const ai = new GoogleGenAI(GEMINI_API_KEY);

// --- 配置區 ---
// 配置 LLM 優先級
const LLM_PRIORITY = {
    PRIMARY: 'Gemini',
    SECONDARY: 'HuggingFace'
    // 未來可擴展: TERTIARY: 'LocalCache'
};

// 建議配置：設定呼叫 LLM 的逾時時間 (毫秒)
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
        // TODO: 實際的 Gemini API 呼叫邏輯
        try {
            // 示例：使用 Gemini SDK (假設已引入)
            /*
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: "user", parts: [{ text: `請根據以下上下文資訊回答問題：${query}。上下文：${JSON.stringify(context)}` }] }],
                config: { timeout: LLM_TIMEOUT }
            });
            const textResponse = response.text;
            */

            // 模擬 API 成功回應
            console.log("➡️ 呼叫 LLM: Gemini API");
            return { 
                response: `[Gemini 回覆]: 這是關於 **"${query}"** 的通用資訊。`, 
                source: 'Gemini' 
            };
            
        } catch (error) {
            console.error(`💥 Gemini API 呼叫錯誤: ${error.message}`);
            // 拋出錯誤，觸發容錯機制
            throw new Error(`Gemini Call Failed: ${error.message}`);
        }
    }

    /**
     * 呼叫 Hugging Face LLM (假設是透過本地或託管服務的 API) (備用)
     * @param {string} query 使用者問題
     * @param {object} context 會話數據 (collectedData)
     * @returns {Promise<{response: string, source: string}>}
     */
    static async callHuggingFace(query, context) {
        // TODO: 實際的 Hugging Face 模型 API 呼叫邏輯
        try {
            const hfApiEndpoint = process.env.HUGGINGFACE_API_ENDPOINT || 'http://localhost:8080/v1/generate';
            
            // 示例：使用 axios 呼叫外部 API
            /*
            const apiResponse = await axios.post(hfApiEndpoint, {
                inputs: `請根據以下上下文資訊回答問題：${query}。上下文：${JSON.stringify(context)}`,
                parameters: { max_new_tokens: 256 }
            }, {
                timeout: LLM_TIMEOUT
            });

            const textResponse = apiResponse.data.generated_text; 
            */

            // 模擬 API 成功回應
            console.log("➡️ 呼叫 LLM: HuggingFace LLM (備用)");
            return { 
                response: `[HuggingFace 回覆]: 這是關於 **"${query}"** 的通用資訊。`, 
                source: 'HuggingFace' 
            };
            
        } catch (error) {
            // 檢查是否為 axios 錯誤 (例如網路或超時)
            const errorMessage = error.response?.data?.error || error.message;
            console.error(`💥 Hugging Face LLM 呼叫錯誤: ${errorMessage}`);
            // 拋出錯誤，觸發最終的失敗機制
            throw new Error(`HuggingFace Call Failed: ${errorMessage}`);
        }
    }

    /**
     * 核心切換與容錯邏輯
     * 優先嘗試主要 LLM，失敗後自動切換到備用 LLM。
     * @param {string} query 使用者問題
     * @param {object} sessionData 會話數據
     * @returns {Promise<{response: string, source: string}>} 包含回應內容和來源
     * @throws {Error} 如果所有 LLM 服務均不可用
     */
    static async getGeneralAnswer(query, sessionData) {
        let result = null;
        
        // 1. 嘗試主要 LLM (PRIMARY)
        if (LLM_PRIORITY.PRIMARY === 'Gemini') {
            try {
                result = await this.callGemini(query, sessionData);
                return result;
            } catch (error) {
                console.error("⚠️ 主要 LLM (Gemini) 呼叫失敗，切換到備用 LLM。");
            }
        }

        // 2. 嘗試備用 LLM (SECONDARY)
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
        
        // 3. 如果主要 LLM 失敗，但沒有設定備用 LLM (或 LLM_PRIORITY 設置錯誤)
        if (!result) {
            console.error("❌ LLMManager 設定錯誤或所有 LLM 服務均不可用。");
            throw new Error("LLM 服務設定錯誤或服務均不可用。");
        }
        
        // 理論上不會執行到此處，但作為最終防禦
        return result;
    }
}

module.exports = LLMManager;

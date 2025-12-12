// gemini_adapter.js

import { GoogleGenAI } from '@google/genai';

// 假設您已經在 package.json 中安裝了 @google/genai 並在環境變數中設定了 GEMINI_API_KEY
// 例如：
// npm install @google/genai

// 初始化 GoogleGenAI 客戶端
const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY 
});

// 定義 LLM 模型的名稱
const LLM_MODEL = 'gemini-2.5-flash'; 

class GeminiAdapter {
    
    /**
     * 處理通用查詢，允許使用者在訂房流程中詢問酒店相關問題。
     * * @param {string} message - 使用者輸入的消息
     * @param {object} collectedData - 當前會話收集到的數據
     * @returns {Promise<{success: boolean, response: string, source: string}>}
     */
    static async processInquiry(message, collectedData) {
        
        if (!process.env.GEMINI_API_KEY) {
            console.error("💥 Gemini API Key 未設定。");
            return { 
                success: false, 
                response: "抱歉，目前無法使用 AI 服務來回答您的通用查詢，因為 API 密鑰缺失。", 
                source: "SYSTEM_FAILURE" 
            };
        }

        try {
            // 構建一個包含上下文的提示 (Prompt)
            // 這裡將收集到的數據作為背景知識傳遞給 LLM
            const contextHistory = `目前訂房流程已收集數據: ${JSON.stringify(collectedData)}。`;
            
            const prompt = `您是一個專業的酒店 AI 助理，您的主要職責是協助處理訂房流程中的額外通用查詢。
            
            **您的目標:** 根據用戶的輸入，提供簡潔、專業的回覆。
            **重要限制:** 不要嘗試繼續或推進訂房流程（例如，不要說「請給我您的房型」），只需回答用戶提出的問題。
            
            ${contextHistory}
            
            用戶查詢: "${message}"
            
            請專注於回答用戶的問題，並保持友善的語氣。`;

            // 呼叫 Gemini API 
            const response = await ai.models.generateContent({
                model: LLM_MODEL,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });

            const llmResponse = response.text.trim();
            
            return { 
                success: true, 
                response: llmResponse, 
                source: "GEMINI" 
            };
            
        } catch (error) {
            console.error("💥 Gemini API 呼叫失敗:", error.message);
            return { 
                success: false, 
                response: "抱歉，AI 服務在處理您的查詢時發生網路或 API 錯誤。", 
                source: "API_ERROR" 
            };
        }
    }
}

export { GeminiAdapter };

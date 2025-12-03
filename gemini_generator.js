// 導入依賴
const config = require('./config');
const fetch = global.fetch || require('node-fetch'); // 確保 Node.js 環境支援 fetch

// 從配置中解構 Gemini 相關常數
const {
    CHAT_INSTRUCTIONS,
    apiUrl,
    MAX_RETRIES,
    INITIAL_BACKOFF_MS
} = config;

class GeminiGenerator {
    /**
     * @param {object} session - 當前會話物件
     * @param {string} userMessage - 當前用戶訊息
     * @returns {string} - Gemini 的文字回應
     */
    static async getResponse(session, userMessage) {
        if (!apiUrl) return "Gemini API Key 未設定，無法提供 AI 自由問答。";

        let retries = 0;

        while (retries < MAX_RETRIES) {
            try {
                // 1. 組裝歷史記錄 (Gemini API 格式)
                // 歷史記錄來自 sessionManager
                const contents = session.conversationHistory
                    .filter(item => item.role === 'user' || item.role === 'model') // 只保留用戶和模型的回覆
                    .map(item => ({
                        role: item.role,
                        parts: [{ text: item.message }]
                    }));
                
                // 2. 確定當前發送給 AI 的內容 (將當前用戶訊息追加到歷史記錄末尾)
                const currentContents = contents.concat([{
                    role: 'user',
                    parts: [{ text: userMessage }]
                }]);

                // 3. 準備 Payload (已修正 systemInstruction 位置)
                const payload = {
                    contents: currentContents,
                    // [修正] 移除頂層的 systemInstruction
                    generationConfig: { // 使用 generationConfig
                        temperature: 0.5,
                        maxOutputTokens: 2048,
                        // [修正] 將 systemInstruction 移入 generationConfig 內（應為最兼容的舊版格式）
                        systemInstruction: CHAT_INSTRUCTIONS,
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

module.exports = GeminiGenerator;

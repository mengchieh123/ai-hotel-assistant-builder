// 導入依賴
const config = require('./config');
const fetch = global.fetch || require('node-fetch');

// 從配置中解構 Gemini 相關常數
const {
    CHAT_INSTRUCTIONS, // 雖然導入了，但暫時不使用
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
                const contents = session.conversationHistory
                    .filter(item => item.role === 'user' || item.role === 'model')
                    .map(item => ({
                        role: item.role,
                        parts: [{ text: item.message }]
                    }));
                
                // 2. 確定當前發送給 AI 的內容
                const currentContents = contents.concat([{
                    role: 'user',
                    parts: [{ text: userMessage }]
                }]);

                // 3. 準備 Payload (最簡潔版本)
                const payload = {
                    contents: currentContents,
                    generationConfig: {
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

module.exports = GeminiGenerator;

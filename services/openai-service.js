const OpenAI = require('openai');
const hotelData = require('./hotel-data');

class OpenAIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
        
        if (this.apiKey && this.apiKey !== 'sk-your-actual-api-key-here') {
            try {
                this.client = new OpenAI({
                    apiKey: this.apiKey
                });
                this.available = true;
                console.log('✅ OpenAI 服務已初始化');
                console.log(`📊 模型: ${this.model}`);
            } catch (error) {
                console.error('❌ OpenAI 初始化失敗:', error.message);
                this.available = false;
            }
        } else {
            console.log('⚠️  OpenAI API Key 未設置');
            this.available = false;
        }
        
        // 對話歷史記憶（簡單版本，生產環境應使用資料庫）
        this.conversations = new Map();
    }

    isAvailable() {
        return this.available && this.client;
    }

    /**
     * 生成系統 Prompt
     * 定義 AI 的角色、知識和行為
     */
    getSystemPrompt() {
        const { hotelInfo, roomTypes, facilities } = hotelData;
        
        return `你是「${hotelInfo.name}」的智能客服助手，一位專業、親切、樂於助人的飯店服務人員。

🏨 飯店基本資訊：
- 名稱：${hotelInfo.name}
- 星級：${hotelInfo.stars}星級飯店
- 地址：${hotelInfo.address}
- 電話：${hotelInfo.phone}
- 入住時間：${hotelInfo.checkIn}
- 退房時間：${hotelInfo.checkOut}

🛏️ 房型與價格：
${roomTypes.map(room => `
【${room.name}】
- 大小：${room.size}
- 入住人數：${room.capacity}人
- 床型：${room.bed}
- 每晚價格：NT$ ${room.price.toLocaleString()}
- 特色：${room.features.join('、')}
- 說明：${room.description}
`).join('\n')}

🎯 設施與服務：
${facilities.map(f => `${f.category}：${f.items.join('、')}`).join('\n')}

📋 你的職責：
1. 熱情回答客人關於房型、價格、設施的問題
2. 根據客人需求（預算、人數、偏好）推薦合適房型
3. 提供預訂流程指引
4. 解答入住相關政策和問題
5. 保持專業、友善、簡潔的溝通風格

💡 對話原則：
- 使用繁體中文回覆
- 保持親切專業的語氣
- 提供具體的房型和價格資訊
- 主動詢問客人需求以提供更好的建議
- 如果客人詢問預訂，引導他們提供：入住日期、退房日期、人數
- 當客人表達預訂意願時，提供聯繫電話 ${hotelInfo.phone}

❌ 限制：
- 你只能回答與本飯店相關的問題
- 如果問題與飯店無關，請禮貌地引導回主題
- 不要編造不存在的房型或服務`;
    }

    /**
     * 智能對話功能
     */
    async chat(message, sessionId = 'default') {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'AI 服務未配置',
                message: '很抱歉，AI 服務目前不可用。'
            };
        }

        try {
            // 獲取或創建對話歷史
            if (!this.conversations.has(sessionId)) {
                this.conversations.set(sessionId, []);
            }
            
            const history = this.conversations.get(sessionId);
            
            // 構建對話訊息
            const messages = [
                {
                    role: 'system',
                    content: this.getSystemPrompt()
                },
                ...history,
                {
                    role: 'user',
                    content: message
                }
            ];

            // 調用 OpenAI API
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            });

            const reply = completion.choices[0].message.content;

            // 更新對話歷史（保留最近5輪對話）
            history.push(
                { role: 'user', content: message },
                { role: 'assistant', content: reply }
            );
            
            if (history.length > 10) {
                history.splice(0, 2); // 移除最舊的一輪對話
            }

            return {
                success: true,
                message: reply,
                sessionId: sessionId
            };

        } catch (error) {
            console.error('Chat Error:', error);
            return {
                success: false,
                error: error.message,
                message: '抱歉，處理您的請求時發生錯誤。請稍後再試。'
            };
        }
    }

    /**
     * 房型推薦功能
     */
    async recommendRoom(preferences) {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'AI 服務未配置'
            };
        }

        const { guests, budget, nights, preferences: prefs } = preferences;
        
        const prompt = `客人需求：
- 入住人數：${guests || '未提供'}人
- 預算：${budget ? `NT$ ${budget}` : '未提供'}
- 入住天數：${nights || '未提供'}晚
- 偏好：${prefs ? prefs.join('、') : '未提供'}

請根據客人需求，從我們的房型中推薦最合適的選項，並說明推薦理由。`;

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: this.getSystemPrompt() },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 300
            });

            return {
                success: true,
                recommendation: completion.choices[0].message.content
            };

        } catch (error) {
            console.error('Recommendation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 翻譯功能
     */
    async translate(text, targetLanguage) {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'AI 服務未配置'
            };
        }

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是專業翻譯，請將文字翻譯成${targetLanguage}，保持原意和專業性。`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            });

            return {
                success: true,
                translatedText: completion.choices[0].message.content,
                originalText: text,
                targetLanguage: targetLanguage
            };

        } catch (error) {
            console.error('Translation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new OpenAIService();

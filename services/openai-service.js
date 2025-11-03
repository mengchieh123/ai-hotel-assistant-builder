const OpenAI = require('openai');

/**
 * OpenAI 服務層
 * 提供 AI 對話、推薦、翻譯等功能
 */
class OpenAIService {
    constructor() {
        // 檢查 API Key 是否配置
        this.isConfigured = !!process.env.OPENAI_API_KEY;
        
        if (this.isConfigured) {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            
            this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
            this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
            this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
            
            console.log('✅ OpenAI 服務已初始化');
            console.log(`📊 模型: ${this.model}`);
        } else {
            console.warn('⚠️  OpenAI API Key 未配置，AI 功能已禁用');
        }
        
        // 系統提示詞
        this.systemPrompt = `你是台北晶華酒店的專業 AI 客服助手。

你的職責：
- 專業且友善地回答客戶關於飯店的問題
- 提供房型、價格、設施和服務的詳細資訊
- 協助客戶預訂房間和選擇促銷方案
- 解答會員制度和積分系統的問題
- 使用繁體中文回答（除非客戶使用其他語言）

飯店資訊：
- 名稱：台北晶華酒店 Regent Taipei
- 星級：5 星級
- 地址：台北市中山區中山北路二段39巷3號
- 設施：室外泳池、健身房、Spa、餐廳、商務中心

會員制度：
- 銅卡：5% 折扣，0-999 積分
- 銀卡：10% 折扣，1000-4999 積分
- 金卡：15% 折扣，5000-14999 積分
- 白金卡：20% 折扣，15000+ 積分

回答風格：
- 專業但不失親切
- 簡潔明瞭
- 提供具體數字和細節
- 主動推薦合適的選項`;
    }

    /**
     * 檢查服務是否可用
     */
    isAvailable() {
        return this.isConfigured;
    }

    /**
     * 基礎對話 API
     */
    async chat(userMessage, conversationHistory = []) {
        if (!this.isConfigured) {
            return {
                success: false,
                error: 'OpenAI API Key 未配置',
                fallback: '抱歉，AI 功能目前不可用。請聯繫客服：+886-2-2523-8000'
            };
        }

        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature
            });

            return {
                success: true,
                message: response.choices[0].message.content,
                usage: {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                    estimatedCost: this.calculateCost(response.usage)
                }
            };
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return {
                success: false,
                error: error.message,
                fallback: '抱歉，AI 服務暫時不可用。請稍後再試或聯繫客服。'
            };
        }
    }

    /**
     * 智能房型推薦
     */
    async recommendRoom(userPreferences) {
        const prompt = `根據以下客戶需求，推薦最適合的房型：

客戶需求：
${JSON.stringify(userPreferences, null, 2)}

可用房型：
1. 標準雙人房（28平方米，NT$4,500/晚）
2. 豪華客房（35平方米，NT$6,500/晚）
3. 行政套房（55平方米，NT$12,000/晚）
4. 總統套房（120平方米，NT$35,000/晚）

請提供：
1. 最推薦的房型
2. 推薦理由
3. 預估總價（考慮會員折扣）
4. 是否有適用的促銷活動`;

        return await this.chat(prompt);
    }

    /**
     * 多語言翻譯
     */
    async translate(text, targetLanguage) {
        const prompt = `將以下文字翻譯成${targetLanguage}：

原文：
"${text}"

要求：
- 保持專業語氣
- 適合飯店業務場景
- 文化適當性`;

        return await this.chat(prompt);
    }

    /**
     * 計算 API 成本（使用 GPT-4o-mini 價格）
     */
    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * 0.15; // $0.15 per 1M tokens
        const outputCost = (usage.completion_tokens / 1000000) * 0.60; // $0.60 per 1M tokens
        return (inputCost + outputCost).toFixed(6);
    }
}

// 導出單例
module.exports = new OpenAIService();

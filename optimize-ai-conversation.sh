#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 優化 AI 對話系統"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 創建飯店資料庫
cat > services/hotel-data.js << 'EOFDATA'
/**
 * 飯店業務資料
 * 包含房型、價格、設施等完整信息
 */

const hotelData = {
  hotelInfo: {
    name: "台北晶華酒店",
    stars: 5,
    address: "台北市中山區中山北路二段39巷3號",
    phone: "+886-2-2523-8000",
    checkIn: "15:00",
    checkOut: "12:00"
  },

  roomTypes: [
    {
      id: "deluxe",
      name: "豪華客房",
      size: "35平方公尺",
      capacity: 2,
      bed: "一張特大床或兩張單人床",
      price: 8800,
      features: ["市景", "免費WiFi", "迷你吧", "保險箱", "浴缸"],
      description: "舒適寬敞的客房，配有現代化設施，適合商務和休閒旅客"
    },
    {
      id: "executive",
      name: "行政客房",
      size: "42平方公尺",
      capacity: 2,
      bed: "一張特大床",
      price: 12800,
      features: ["行政酒廊使用權", "免費早餐", "晚間雞尾酒", "市景", "獨立浴缸和淋浴間"],
      description: "位於高樓層的行政客房，享有城市美景和額外禮遇"
    },
    {
      id: "suite",
      name: "套房",
      size: "68平方公尺",
      capacity: 3,
      bed: "一張特大床",
      price: 18800,
      features: ["獨立客廳", "用餐區", "迷你廚房", "兩間浴室", "全景落地窗"],
      description: "奢華套房提供獨立起居空間，適合家庭或長期入住"
    },
    {
      id: "presidential",
      name: "總統套房",
      size: "120平方公尺",
      capacity: 4,
      bed: "主臥特大床 + 客房雙人床",
      price: 38800,
      features: ["兩間臥室", "餐廳", "私人管家", "360度全景視野", "奢華浴室配備"],
      description: "頂級總統套房，提供無與倫比的奢華體驗"
    }
  ],

  facilities: [
    {
      category: "餐飲",
      items: ["三間餐廳", "行政酒廊", "大廳酒吧", "24小時客房服務"]
    },
    {
      category: "休閒",
      items: ["室內溫水游泳池", "健身中心", "SPA水療中心", "三溫暖"]
    },
    {
      category: "商務",
      items: ["商務中心", "會議室", "多功能宴會廳"]
    },
    {
      category: "服務",
      items: ["24小時禮賓服務", "機場接送", "洗衣服務", "停車場"]
    }
  ],

  policies: {
    cancellation: "入住前24小時免費取消",
    payment: "接受信用卡、現金",
    pets: "不允許攜帶寵物",
    smoking: "全館禁菸",
    children: "12歲以下兒童免費加床"
  }
};

module.exports = hotelData;
EOFDATA

echo "✅ 飯店資料庫已創建"

# 2. 優化 OpenAI Service
cat > services/openai-service.js << 'EOFSERVICE'
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
EOFSERVICE

echo "✅ OpenAI Service 已優化"

# 3. 提交變更
git add services/hotel-data.js services/openai-service.js
git commit -m "feat: add intelligent hotel conversation system

- Add comprehensive hotel data (rooms, prices, facilities)
- Implement context-aware AI assistant with business knowledge
- Add conversation memory for natural multi-turn dialogues
- Define AI role and behavior with detailed system prompts
- Support room recommendations based on guest needs

Features:
✅ Business context integration
✅ Natural conversation flow
✅ Multi-turn dialogue memory
✅ Room recommendations
✅ Professional hotel assistant persona

This solves the 'unnatural conversation' problem by providing:
1. Hotel business knowledge
2. Conversation context
3. Clear AI role definition
4. Structured response patterns"

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AI 對話優化完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 部署（60秒）..."
sleep 60

echo ""
echo "🧪 測試優化後的對話..."
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好，我想訂房", "sessionId": "test-optimized"}' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 優化完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


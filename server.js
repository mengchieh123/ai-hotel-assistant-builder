// server.js (完整修正版 - 2025/11/27)
// 海灣麗景酒店 AI 智能助理

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// --- API Key 和配置 ---
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-1.5-flash"; 
// 🚨 修正後的 URL：將 /v1/ 改為 /v1beta/
const apiUrl = `${API_BASE}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// --- 指數退避重試配置 ---
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// ---------------------------------------------
// 2. 核心工具類
// ---------------------------------------------

// 增強版智能意圖分類器
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // 🎯 增強意圖識別
        if (/(訂房|預訂|入住|房間|住.*晚|房型|幫我訂|想要訂|預約房間)/.test(lowerMessage)) intents.add('booking');
        if (/(接送|機場|接機|送機|交通|距離|多遠|車程)/.test(lowerMessage)) intents.add('transfer');
        if (/(餐廳|推薦|美食|吃|海鮮|晚餐|早餐|午餐|訂位)/.test(lowerMessage)) intents.add('restaurant');
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (/(景點|觀光|好玩|旅遊|推薦.*地方|去哪玩|遊玩)/.test(lowerMessage)) intents.add('attractions');
        if (/(購物|夜市|商店|超市|便利商店|買東西)/.test(lowerMessage)) intents.add('shopping');
        if (/(醫院|醫療|診所|醫生|藥局|不舒服)/.test(lowerMessage)) intents.add('medical');
        if (/(設施|泳池|健身房|spa|按摩|三溫暖)/.test(lowerMessage)) intents.add('facilities');
        if (/(天氣|氣象|溫度|下雨|颱風|氣溫)/.test(lowerMessage)) intents.add('weather');
        if (/(行程|規劃|安排|旅遊計畫|一日遊)/.test(lowerMessage)) intents.add('itinerary');
        if (this.containsDatePatterns(message)) intents.add('date_input');
        if (/(取消|退訂|改期|變更|修改)/.test(lowerMessage)) intents.add('modification');
        if (/(緊急|救命|幫忙|協助|問題|麻煩|火災|小偷)/.test(lowerMessage)) intents.add('emergency');
        
        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }

    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /明天|後天|週末|下週|月底|今天|今晚/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    static detectUserType(message) {
        const lowerMessage = message.toLowerCase();
        if (/(家庭|小孩|兒童|親子|寶寶)/.test(lowerMessage)) return 'family';
        if (/(團體|大型|多人|公司|企業)/.test(lowerMessage)) return 'group';
        if (/(商務|會議|出差|辦公)/.test(lowerMessage)) return 'business';
        if (/(情侶|夫妻|蜜月|浪漫)/.test(lowerMessage)) return 'couple';
        if (/(個人|單人|自己)/.test(lowerMessage)) return 'solo';
        return 'individual';
    }
}

// 規則引擎類別
class RuleEngine {
    static process(intents, session, message) {
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule,
            this.transferRule,
            this.pricingRule,
            this.memberRule,
            this.weatherRule,
            this.restaurantRule,
            this.facilityRule,
            this.generalRule
        ];

        for (const rule of rules) {
            const result = rule(intents, session, message);
            if (result.shouldProcess) {
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // 🚨 緊急規則
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            return {
                shouldProcess: true,
                priority: 100,
                response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：**02-1199-1199**\n• 聯絡前台：**分機 0**\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！",
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🏨 訂房流程規則
    static bookingFlowRule(intents, session, message) {
        const hasBookingIntent = intents.includes('booking');
        const hasDateIntent = intents.includes('date_input');
        // 這裡簡化判斷，實際應用中應有更嚴謹的狀態機
        const isInBookingFlow = session.conversationHistory.slice(-3).some(msg => msg.intents?.includes('booking'));

        if (hasBookingIntent || isInBookingFlow) {
            // 這裡使用簡化的 session.askedTopics 來模擬流程
            if (!hasDateIntent && !session.askedTopics.includes('date')) {
                return {
                    shouldProcess: true, priority: 90,
                    response: "🏨 **訂房服務**\n\n請告訴我您的入住日期和退房日期？\n例如：12/25-12/28 或 明天入住，住2晚",
                    nextStep: 'date', updateSession: true
                };
            }
            // 更多流程省略...
            return { shouldProcess: true, priority: 90, response: "✅ 已收到您的訂房請求！請前往訂房頁面完成預訂：[點擊這裡預訂]" };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🚗 接送服務規則
    static transferRule(intents, session, message) {
        if (intents.includes('transfer')) {
            return {
                shouldProcess: true,
                priority: 85,
                response: "🚗 **機場接送服務**\n\n我們提供24小時機場接送服務！\n\n• **桃園機場**：600 TWD/單程\n• **松山機場**：400 TWD/單程\n\n請提供您的**航班號碼**、**到達時間**和**乘客人數**，為您立即安排！"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 💰 價格查詢規則
    static pricingRule(intents, session, message) {
        if (intents.includes('pricing')) {
            return {
                shouldProcess: true,
                priority: 80,
                response: "💰 **房價資訊**\n\n• 標準雙人房：2,200 TWD/晚\n• 豪華海景房：3,200 TWD/晚\n• 家庭套房：3,800 TWD/晚\n\n**優惠方案：** 會員享額外95折，提前預訂享早鳥優惠。需要為您推薦房型嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🎯 會員規則 (硬編碼解決宣傳語問題)
    static memberRule(intents, session, message) {
        if (intents.includes('member')) {
            if (message.includes('宣傳語') || message.includes('標語')) {
                return {
                    shouldProcess: true,
                    priority: 76,
                    response: "✨ **金卡會員簡短宣傳語** ✨\n\n「海灣麗景金卡會員 - 不只是住宿，更是尊榮體驗！」\n\n期待您的加入，尊享特權！"
                };
            }
            return {
                shouldProcess: true,
                priority: 75,
                response: "🌟 **金卡會員尊榮禮遇** 🌟\n\n• 住宿享95折優惠\n• 免費房型升等機會\n• 專屬會員積分兌換\n\n立即加入，讓您的旅程更奢華！",
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🌤️ 天氣查詢規則
    static weatherRule(intents, session, message) {
        if (intents.includes('weather')) {
            // 簡化版天氣資訊 (台北)
            const weather = { temp: 24, condition: '多雲時晴', humidity: 68 };
            
            const response = `🌤️ **台北天氣資訊**\n\n` +
                `• 溫度：${weather.temp}°C\n` +
                `• 天氣：${weather.condition}\n` +
                `• 濕度：${weather.humidity}%\n\n` +
                `建議：天氣舒適，適合外出觀光。`;

            return { shouldProcess: true, priority: 75, response: response };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🍽️ 餐廳規則
    static restaurantRule(intents, session, message) {
        if (intents.includes('restaurant')) {
            return {
                shouldProcess: true,
                priority: 70,
                response: "🍽️ **餐廳推薦**\n\n• **龍鳳廳**：粵式料理 | 11:30-14:30\n• **星空牛排館**：頂級牛排 | 17:30-22:30\n\n需要為您預訂位子嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🏊 設施規則
    static facilityRule(intents, session, message) {
        if (intents.includes('facilities')) {
            return {
                shouldProcess: true,
                priority: 65,
                response: "🏊 **飯店設施**\n\n• **泳池**：無邊際泳池 | 06:00-22:00 | 頂樓\n• **健身房**：24小時開放 | 最新器材\n• **SPA**：需預約 | 10:00-21:00\n\n需要預約任何設施嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 📞 一般規則 (預設 fallback)
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理小智。\n\n我可以協助您：訂房、接送、餐廳推薦、價格查詢、景點導覽等服務。\n\n請問今天需要什麼協助呢？",
        };
    }
}

// 會話狀態管理器
class SessionManager {
    constructor() {
        this.sessions = new Map();
    }
    
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                currentStep: 'welcome',
                userType: 'unknown',
                askedTopics: [],
                conversationHistory: [],
                lastActive: new Date().toISOString()
            });
        }
        return this.sessions.get(sessionId);
    }
    
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.lastActive = new Date().toISOString();
        session.conversationHistory.push({
            role: 'user',
            message,
            intents,
            timestamp: new Date().toISOString()
        });
        session.userType = SmartIntentClassifier.detectUserType(message);
        return session;
    }

    addAssistantResponse(sessionId, reply) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model',
            message: reply,
            timestamp: new Date().toISOString()
        });
    }
}

const sessionManager = new SessionManager();

// ---------------------------------------------
// 3. API 通訊工具
// ---------------------------------------------
async function fetchWithRetry(url, options, attempt = 1) {
    try {
        console.log(`[Gemini API] Sending request to: ${url}`);
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            
            // 400/404 錯誤不重試，直接拋出
            if (response.status === 400 || response.status === 404) {
                throw new Error(`API response error: ${response.status} ${response.statusText} (${errorText.substring(0, 100)}...)`);
            }
            
            // 429 Rate Limit 或其他伺服器錯誤 (5xx) 重試
            if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                console.warn(`[Gemini API] Error ${response.status}. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, attempt + 1);
            }
            
            throw new Error(`API response error: ${response.status} ${response.statusText} (${errorText.substring(0, 100)}...)`);
        }
        return response;
    } catch (error) {
        if (attempt < MAX_RETRIES && !error.message.includes('400') && !error.message.includes('404')) {
            console.error(`[Gemini API] Request failed: ${error.message}. Retrying...`);
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, attempt + 1);
        }
        throw error;
    }
}

// ---------------------------------------------
// 4. 回應生成與 LLM 邏輯
// ---------------------------------------------
class ResponseGenerator {
    static isInBookingFlow(session) {
        // 簡單檢查會話歷史中是否有訂房意圖
        return session.conversationHistory.slice(-3).some(msg => msg.intents?.includes('booking'));
    }

    static async generateResponse(intents, session, message) {
        console.log(`🎯 意圖識別: ${intents.join(', ')}, 用戶類型: ${session.userType}`);
        
        // 🚨 第一步：使用規則引擎處理高優先級/確定性問題
        const ruleResult = RuleEngine.process(intents, session, message);
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            // 模擬更新 session 流程步驟 (簡化)
            if (ruleResult.updateSession && ruleResult.nextStep) {
                session.askedTopics.push(ruleResult.nextStep);
            }
            return ruleResult.response;
        }

        // 🤖 複雜問題使用 AI (景點、行程、多重意圖、一般非規則查詢)
        const complexIntents = ['attractions', 'itinerary', 'shopping', 'general_inquiry'];
        const shouldUseAI = intents.some(intent => complexIntents.includes(intent)) || 
                            intents.length > 1;

        if (shouldUseAI) {
            try {
                return await this.getGeminiResponse(session);
            } catch (error) {
                console.error("AI 服務失敗，使用規則回覆:", error.message);
                // AI 服務失敗時，使用規則引擎的結果作為回退 (Fallback)
                return ruleResult.shouldProcess ? ruleResult.response : 
                       RuleEngine.generalRule(intents, session, message).response;
            }
        }

        // 最終使用規則引擎結果 (低優先級/一般規則)
        return ruleResult.response;
    }

    static async getGeminiResponse(session) {
        if (!apiKey) {
            throw new Error("API Key is empty.");
        }

        // 將會話歷史轉換為 Gemini API 要求的格式
        const contents = session.conversationHistory.map(item => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.message }]
        }));

        // 確保模型具有上下文指導，尤其在多輪對話中
        const systemInstruction = {
            role: "system",
            parts: [{
                text: "您是海灣麗景酒店（Bayview Grand Hotel）的AI助理。您的回答必須專業、友善、以服務客人為目標。當客人詢問景點或行程時，請以台北市（飯店所在城市）為中心提供旅遊推薦。請用繁體中文回應，並適當使用 Markdown 格式來強調重點。"
            }]
        };

        const payload = {
            contents: [systemInstruction, ...contents], // 始終將系統指令放在最前面
            generationConfig: {
                maxOutputTokens: 800,
                temperature: 0.5,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        const response = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.error) {
            console.error("[Gemini API] Error:", result.error);
            throw new Error(`API Error: ${result.error.message}`);
        }
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text;
        } else {
            console.error("[Gemini API] Empty/Blocked Response:", JSON.stringify(result, null, 2));
            throw new Error("No valid text in response (Content blocked or empty)");
        }
    }
}

// ---------------------------------------------
// 5. Express 中介軟體與設定
// ---------------------------------------------
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('.'));

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// ---------------------------------------------
// 6. 路由定義
// ---------------------------------------------

// 根路徑 / 健康檢查
app.get(['/', '/health', '/api/health'], (req, res) => {
    res.status(200).json({
        status: "OK",
        service: '🏨 海灣麗景酒店 AI 助理',
        model: MODEL_NAME,
        api_url: apiUrl, // 顯示當前使用的 API URL
        timestamp: new Date().toISOString()
    });
});

// 前端頁面路由
app.get('/working-chat.html', (req, res) => {
    res.sendFile(__dirname + '/working-chat.html');
});

// 主要聊天路由
app.post(['/chat', '/api/chat'], async (req, res) => {
    const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            reply: "請輸入訊息內容",
            sessionId,
            errorCode: "EMPTY_MESSAGE"
        });
    }

    try {
        console.log("💬 收到請求:", { sessionId, message });
        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);
        const reply = await ResponseGenerator.generateResponse(intents, session, message);
        sessionManager.addAssistantResponse(sessionId, reply);

        res.json({
            success: true,
            reply,
            sessionId,
            userType: session.userType,
            timestamp: new Date().toISOString(),
            triggeredIntents: intents.join(', ')
        });
    } catch (e) {
        console.error("主處理錯誤:", e.message);
        res.status(500).json({
            success: false,
            reply: `系統處理錯誤 (Error: ${e.message.includes('404') ? 'API URL 錯誤' : 'AI 服務失敗'})，請稍後再試。`,
            sessionId,
            timestamp: new Date().toISOString()
        });
    }
});

// 處理所有未定義的路由
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `找不到此路由：${req.url}。`,
        suggestion: "請使用 /health, /chat, /api/health, /api/chat",
        errorCode: "ROUTE_NOT_FOUND"
    });
});

// ---------------------------------------------
// 7. 啟動伺服器
// ---------------------------------------------
const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器成功啟動！`);
    console.log(`🌐 監聽端口: ${PORT}`);
    console.log(`❤️  健康檢查: http://localhost:${PORT}/health`);
    console.log(`💬 聊天端點: http://localhost:${PORT}/chat`);
    console.log(`📱 前端頁面: http://localhost:${PORT}/working-chat.html`);
    console.log(`🔑 Gemini API: ${apiKey ? '已配置' : '未配置'}`);
    console.log(`🤖 規則引擎: 已啟用`);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信號，開始優雅關閉...');
    server.close(() => {
        console.log('伺服器已關閉');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信號，關閉伺服器...');
    server.close(() => {
        process.exit(0);
    });
});

// 未處理異常捕獲
process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
});

// server.js (完整修正版 - 2025/11/26)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// --- API Key 和配置 ---
const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBMOdSKtUDMcwXXbg_Zu0cXMOPedmyr_Q0";
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-pro"; // 使用標準模型名稱
const apiUrl = `${API_BASE}/v1/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// --- 指數退避重試配置 ---
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ---------------------------------------------
// 2. 核心工具類
// ---------------------------------------------

// 智能意圖分類器
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = [];
        if (/(訂房|預訂|入住|房間|住.*晚|房型)/.test(lowerMessage)) intents.push('booking');
        if (/(接送|機場|接機|送機|交通)/.test(lowerMessage)) intents.push('transfer');
        if (/(餐廳|推薦|美食|吃|海鮮|晚餐)/.test(lowerMessage)) intents.push('restaurant');
        if (/(價格|價錢|多少錢|房價)/.test(lowerMessage)) intents.push('pricing');
        if (/(會員|積分|優惠|折扣)/.test(lowerMessage)) intents.push('member');
        if (/(景點|觀光|好玩|旅遊|推薦.*地方)/.test(lowerMessage)) intents.push('attractions');
        if (/(購物|夜市|商店|超市|便利商店)/.test(lowerMessage)) intents.push('shopping');
        if (/(醫院|醫療|診所|醫生|藥局)/.test(lowerMessage)) intents.push('medical');
        if (/(設施|泳池|健身房|spa|按摩)/.test(lowerMessage)) intents.push('facilities');
        if (this.containsDatePatterns(message)) intents.push('date_input');
        return intents.length ? intents : ['general_inquiry'];
    }

    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /明天|後天|週末|下週|月底/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    static detectUserType(message) {
        const lowerMessage = message.toLowerCase();
        if (/(家庭|小孩|兒童|親子)/.test(lowerMessage)) return 'family';
        if (/(團體|大型|多人|公司)/.test(lowerMessage)) return 'group';
        if (/(商務|會議|出差)/.test(lowerMessage)) return 'business';
        if (/(情侶|夫妻|蜜月)/.test(lowerMessage)) return 'couple';
        return 'individual';
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
        intents.forEach(intent => {
            if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
        });
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
        const response = await fetch(url, options);
        if (response.status === 429 && attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`[Gemini API] Rate limit hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, attempt + 1);
        }
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API response error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return response;
    } catch (error) {
        if (attempt < MAX_RETRIES) {
            console.error(`[Gemini API] Request failed: ${error.message}. Retrying...`);
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, attempt + 1);
        }
        throw new Error(`[Gemini API] Final attempt failed after ${MAX_RETRIES} retries: ${error.message}`);
    }
}

// ---------------------------------------------
// 4. 回應生成與 LLM 邏輯
// ---------------------------------------------
class ResponseGenerator {
    static isInBookingFlow(session) {
        const lastMessages = session.conversationHistory.slice(-3);
        return lastMessages.some(msg =>
            msg.intents?.includes('booking') ||
            msg.message?.includes('訂房') ||
            msg.message?.includes('日期') ||
            msg.message?.includes('入住')
        );
    }

    static handleBookingDate(dateMessage, session) {
        let response = "📅 ";
        const rangeMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/);
        if (rangeMatch) {
            const [_, startMonth, startDay, endMonth, endDay] = rangeMatch;
            const nights = (parseInt(endDay) - parseInt(startDay)) || 1;
            response += `好的！${startMonth}/${startDay} 到 ${endMonth}/${endDay}，共 ${nights} 晚住宿。\n\n`;
        } else if (/\d{1,2}\/\d{1,2}/.test(dateMessage)) {
            const dateMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
                response += `收到入住日期 ${dateMatch[0]}！請問住幾晚？\n\n`;
            }
        } else if (/\d{1,2}月\d{1,2}日/.test(dateMessage)) {
            const dateMatch = dateMessage.match(/(\d{1,2})月(\d{1,2})日/);
            if (dateMatch) {
                response += `收到入住日期 ${dateMatch[0]}！\n\n`;
            }
        } else {
            response += `收到您的日期資訊！\n\n`;
        }

        response += "請問需要什麼房型？幾位入住？";
        return response;
    }

    static async generateResponse(intents, session, message) {
        if (intents.includes('date_input') && this.isInBookingFlow(session)) {
            return this.handleBookingDate(message, session);
        }

        if (intents.length > 1) return this.generateMultiIntentResponse(intents, session, message);

        switch (intents[0]) {
            case 'booking': return this.generateBookingResponse(session, message);
            case 'transfer': return this.generateTransferResponse(session);
            case 'restaurant': return this.generateRestaurantResponse(session, message);
            case 'pricing': return this.generatePricingResponse(session);
            case 'member': return this.generateMemberResponse(session);
            case 'attractions': return this.generateAttractionsResponse(session);
            case 'shopping': return this.generateShoppingResponse(session);
            case 'medical': return this.generateMedicalResponse(session);
            case 'facilities': return this.generateFacilitiesResponse(session);
            case 'date_input':
                return "📅 收到您的日期資訊！請問您需要什麼服務？訂房還是查詢空房？";
            case 'general_inquiry':
                return await this.getGeminiResponse(session);
            default: return this.generateGeneralResponse();
        }
    }

    static async getGeminiResponse(session) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Using fallback response.");
            return this.generateHelpfulLocalResponse(session);
        }

        const contents = session.conversationHistory.map(item => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.message }]
        }));

        const systemPrompt = `你是一家五星級飯店的智能客服助理，你的名字是「小智」。
你的語氣必須專業、親切、熱情，並優先使用繁體中文。
請簡潔回答旅客的問題，專注於提供有用的資訊。`;

        const payload = {
            contents: contents,
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7
            }
        };

        console.log("[Gemini API] Sending request...");

        try {
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("[Gemini API] No text in response");
                return this.generateHelpfulLocalResponse(session);
            }
        } catch (e) {
            console.error("Error communicating with Gemini API:", e.message);
            return this.generateHelpfulLocalResponse(session);
        }
    }

    static generateHelpfulLocalResponse(session) {
        const lastMessage = session.conversationHistory[session.conversationHistory.length - 1]?.message || "";

        if (lastMessage.includes('海灣麗景酒店') || lastMessage.includes('有趣事實')) {
            return "🏨 **關於海灣麗景酒店的有趣事實**：\n\n" +
                "• 我們的酒店建築靈感來自傳統中國園林設計\n" +
                "• 頂樓的空中花園可以360度欣賞城市全景\n" +
                "• 酒店內收藏了多位台灣藝術家的原創作品\n" +
                "• 我們的米其林三星餐廳主廚曾獲國際烹飪大獎\n\n" +
                "請問您對酒店的哪個方面特別感興趣呢？";
        }

        return "您好！我是飯店AI助理，可以為您提供：\n\n" +
            "🏨 訂房服務 • 🚗 接送服務 • 🍽️ 餐廳推薦\n" +
            "💰 價格查詢 • 🎯 景點導覽 • 💎 會員服務\n\n" +
            "請問需要什麼協助？";
    }

    // 靜態回覆方法
    static generateMultiIntentResponse(intents, session, message) {
        let response = "感謝您的查詢！我來為您詳細介紹：\n\n";
        intents.forEach(intent => {
            switch (intent) {
                case 'booking': response += this.generateBookingResponse(session, message, true); break;
                case 'transfer': response += this.generateTransferResponse(session, true); break;
                case 'restaurant': response += this.generateRestaurantResponse(session, message, true); break;
                case 'pricing': response += this.generatePricingResponse(session, true); break;
                case 'member': response += this.generateMemberResponse(session, true); break;
                case 'attractions': response += this.generateAttractionsResponse(session, true); break;
                case 'shopping': response += this.generateShoppingResponse(session, true); break;
                case 'medical': response += this.generateMedicalResponse(session, true); break;
                case 'facilities': response += this.generateFacilitiesResponse(session, true); break;
                case 'date_input':
                    response += "📅 日期資訊已記錄。\n";
                    break;
            }
        });
        return response;
    }

    static generateBookingResponse(session, message, isMultiIntent = false) {
        let resp = isMultiIntent ? "🏨 **訂房服務**\n" : "";
        if (session.userType === 'family') resp += "• 推薦家庭房型及親子設施。\n";
        else if (session.userType === 'group') resp += "• 提供團體優惠。\n";
        resp += "請告訴我入住人數、房型與日期。";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateTransferResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "🚗 **機場接送服務**\n" : "";
        resp += "24小時機場接送，費用600 TWD單程";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateRestaurantResponse(session, message, isMultiIntent = false) {
        let resp = isMultiIntent ? "🍽️ **餐廳推薦**\n" : "";
        resp += message.includes('海鮮') ? "• 港灣海鮮樓\n• 海味坊\n" : "• 龍鳳廳\n• 櫻花日本料理\n• 星空牛排館\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generatePricingResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "💰 **價格資訊**\n" : "";
        resp += "• 標準雙人房: 2200 TWD/晚\n• 豪華雙人房: 2800 TWD/晚\n• 家庭房: 3800 TWD/晚\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateMemberResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "💎 **會員服務**\n" : "";
        resp += "銀卡九折 + 免費早餐\n金卡85折\n白金卡8折\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateAttractionsResponse(session, isMultiIntent = false) {
        if (session.userType === 'family')
            return (isMultiIntent ? "🏞️ **親子景點**\n" : "") + "兒童樂園、動物園、自然公園\n" + (isMultiIntent ? "\n" : "");
        return (isMultiIntent ? "🏞️ **熱門景點**\n" : "") + "歷史博物館、藝術特區、觀景台\n" + (isMultiIntent ? "\n" : "");
    }

    static generateShoppingResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "🛍️ **購物指南**\n" : "";
        resp += "24H便利商店、大型超市、夜市\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateMedicalResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "🏥 **醫療服務**\n" : "";
        resp += "24H診所、綜合醫院、緊急119\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateFacilitiesResponse(session, isMultiIntent = false) {
        let resp = isMultiIntent ? "🏊 **飯店設施**\n" : "";
        resp += "泳池、健身房、SPA水療\n";
        return resp + (isMultiIntent ? "\n" : "");
    }

    static generateGeneralResponse() {
        return "您好！我是飯店AI助理，可協助您訂房、接送、餐廳、景點、購物等服務。";
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

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// ---------------------------------------------
// 6. 路由定義
// ---------------------------------------------

// 根路徑
app.get('/', (req, res) => {
    res.json({
        service: '🏨 海灣麗景酒店 AI 助理',
        status: '運行中',
        version: '5.6.0',
        endpoints: {
            health: '/health',
            chat: '/chat',
            api_health: '/api/health',
            api_chat: '/api/chat',
            frontend: '/working-chat.html'
        },
        timestamp: new Date().toISOString()
    });
});

// 健康檢查 (兼容路徑)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        server: "Bayview Grand Hotel Assistant API",
        model: MODEL_NAME,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        server: "Bayview Grand Hotel Assistant API",
        model: MODEL_NAME,
        timestamp: new Date().toISOString()
    });
});

// 前端頁面路由
app.get('/working-chat.html', (req, res) => {
    res.sendFile(__dirname + '/working-chat.html');
});

// 主要聊天路由 (兼容路徑)
app.post('/chat', async (req, res) => {
    await handleChatRequest(req, res);
});

app.post('/api/chat', async (req, res) => {
    await handleChatRequest(req, res);
});

// 聊天請求處理函數
async function handleChatRequest(req, res) {
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
        console.error("主處理錯誤:", e);
        res.status(500).json({
            success: false,
            reply: "系統處理錯誤，請稍後再試。",
            sessionId,
            timestamp: new Date().toISOString()
        });
    }
}

// 訂房 API
app.post('/api/booking', (req, res) => {
    res.json({
        success: true,
        message: "✅ 您的訂房請求已收到，正在處理中。"
    });
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
    console.log(`❤️  健康檢查: http://localhost:${PORT}/health`);
    console.log(`💬 聊天端點: http://localhost:${PORT}/chat`);
    console.log(`📱 前端頁面: http://localhost:${PORT}/working-chat.html`);
    console.log(`🔑 Gemini API: ${apiKey ? '已配置' : '未配置'}`);
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

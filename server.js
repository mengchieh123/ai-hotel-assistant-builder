// server.js (最終修正版 - 2025/11/26)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // 確保 node-fetch 存在
const app = express();


// --- API Key 和配置 (已合併所有變數，只宣告一次) ---
const apiKey = process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY_HERE";
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025-V3"; // <-- 確保只在此處宣告一次
const apiUrl = `${API_BASE}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// --- 指數退避重試配置 ---
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;


// ---------------------------------------------
// 2. 核心工具類：SessionManager & IntentClassifier
// ---------------------------------------------
// ... (此處省略 SmartIntentClassifier 和 SessionManager 類別，內容不變)

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
        const datePatterns = [/\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/, /\d{1,2}\/\d{1,2}/, /\d{1,2}月\d{1,2}日/, /\d{1,2}月\d{1,2}號/, /明天|後天|週末|下週|月底/];
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
    constructor() {this.sessions = new Map();}
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
        session.conversationHistory.push({ role: 'user', message, intents, timestamp: new Date().toISOString() });
        session.userType = SmartIntentClassifier.detectUserType(message);
        intents.forEach(intent => {
            if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
        });
        return session;
    }
    addAssistantResponse(sessionId, reply) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({ role: 'model', message: reply, timestamp: new Date().toISOString() });
    }
}
const sessionManager = new SessionManager(); // 實例化 SessionManager


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
        
        if (intents.length > 1 || intents[0] === 'general_inquiry') {
            return await this.getGeminiResponse(session); 
        }

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
            case 'date_input': return "📅 收到您的日期資訊！請問您需要什麼服務？訂房還是查詢空房？";
            default: return this.generateGeneralResponse();
        }
    }

    static async getGeminiResponse(session) {
        if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
            console.warn("[Gemini API] API Key is empty. Skipping LLM call and returning fallback response.");
            return this.generateFallbackResponse("🚨 錯誤：API 金鑰遺失或無效。請在 Railway 環境變數中設置您的 **GEMINI_API_KEY** 以啟用 AI 查詢功能。");
        }

        const contents = session.conversationHistory.map(item => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.message }]
        }));

        const systemPrompt = `
            你是一家五星級飯店的智能客服助理，你的名字是「小智」。
            你的語氣必須專業、親切、熱情，並優先使用繁體中文。
            你的目標是回答旅客的任何問題，但對於特定功能（如訂房），你必須引導使用者提供必要的資訊（如日期、房型、人數）。
            飯店資訊：名稱：海灣麗景酒店 (Bayview Grand Hotel)。地理位置：近市中心和海灘。特色：設有空中花園、米其林三星餐廳。
            
            請根據以上對話歷史，提供一個簡潔、有幫助的回應：
        `;

        const payload = {
            contents: contents,
            config: {
                 systemInstruction: systemPrompt 
            },
            tools: [{ "google_search": {} }], 
        };
        
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
                console.error("[Gemini API] No text in response or safety block:", JSON.stringify(result, null, 2));
                return this.generateFallbackResponse("抱歉，AI 服務回覆結構異常或內容被安全過濾，請換個方式提問。");
            }
        } catch (e) {
            console.error("Error communicating with Gemini API:", e);
            return this.generateFallbackResponse("抱歉，API 連線發生錯誤，請檢查您的網路或 API Key 是否有效。詳細錯誤已記錄於後端日誌。");
        }
    }
    
    // --- 靜態回覆內容 (保持精簡) ---
    static generateFallbackResponse(reason) { return reason; }
    static generateMultiIntentResponse(intents, session, message) { return "感謝您的查詢！已為您處理多項查詢，請確認是否有其他問題？"; }
    static generateBookingResponse() { return "🏨 請告訴我入住人數、房型與日期。當您提供完整資訊後，我們將會啟動**專門的訂房 API 流程**來完成預訂！"; }
    static generateTransferResponse() { return "🚗 飯店提供 24小時機場接送服務，費用為 600 TWD 單程。請問您需要預約嗎？"; }
    static generateRestaurantResponse() { return "🍽️ 飯店內設有龍鳳廳 (中式)、櫻花日本料理及星空牛排館 (米其林三星)。請問您想了解哪一個餐廳？"; }
    static generatePricingResponse() { return "💰 我們的標準雙人房每晚約 2200 TWD起，豪華雙人房約 2800 TWD起。實際價格依日期會有所變動。"; }
    static generateMemberResponse() { return "💎 我們有銀卡 (九折+免費早餐) 和金卡 (85折) 會員。請問您想申請哪一種會員？"; }
    static generateAttractionsResponse() { return "🏞️ 飯店附近有歷史博物館、藝術特區、和海景觀景台。我還可以幫您規劃一日遊行程！"; }
    static generateShoppingResponse() { return "🛍️ 飯店步行五分鐘內有 24H 便利商店及一間大型超市。如果您想去夜市，步行約 15 分鐘可達。"; }
    static generateMedicalResponse() { return "🏥 飯店設有緊急聯絡機制。最近的 24H 綜合醫院在車程十分鐘處。若遇緊急情況請直接撥打 119。"; }
    static generateFacilitiesResponse() { return "🏊 飯店設施包括室內恆溫泳池、頂級健身房、和 SPA 水療中心。請問您想預約哪項設施？"; }
    static generateGeneralResponse() { return "您好！我是海灣麗景酒店的 AI 助理「小智」，很高興為您服務。請問您想了解什麼呢？"; }
}


// ---------------------------------------------
// 5. Express 中介軟體與設定
// ---------------------------------------------
app.use(cors()); 
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// 🚀 關鍵：讓 Express 可以解析 JSON 格式的請求體，必須在所有 app.post 前
app.use(express.json()); 


// ---------------------------------------------
// 6. 路由定義
// ---------------------------------------------

// 🏆 修正後的健康檢查路由 (Health Check Route)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "OK", server: "Bayview Grand Hotel Assistant API", model: MODEL_NAME });
});

// 訂房專用 API 範例
app.post('/api/booking', (req, res) => {
    res.json({ success: true, message: "✅ 您的訂房請求已收到，正在處理中。" });
});

// 💡 主要對話路由：/api/chat
app.post('/api/chat', async (req, res) => {
    const rawMessage = req.body.prompt || req.body.message || req.body.text || req.body.query;
    const { sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2,9)}` } = req.body;
    
    if (!rawMessage) {
        return res.status(400).json({ 
            success: false, 
            reply: "🚨 錯誤：後端收到的請求體是空的，無法解析訊息內容。",
            sessionId,
            errorCode: "EMPTY_MESSAGE"
        });
    }
    
    const message = String(rawMessage).trim();

    try {
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
        console.error(`[FATAL ERROR] Session ${sessionId}:`, e);
        res.status(500).json({
            success: false,
            reply: "系統處理發生嚴重錯誤，請檢查後端日誌。",
            sessionId,
            timestamp: new Date().toISOString()
        });
    }
});


// 處理所有未定義的路由 (必須是最後一個 app.use)
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `找不到此路由：${req.url}。`,
        suggestion: "請確認您是否使用 /api/chat 或 /api/health 端點",
        errorCode: "ROUTE_NOT_FOUND"
    });
});


// ---------------------------------------------
// 7. 啟動伺服器
// ---------------------------------------------
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器已啟動，監聽 ${HOST}:${PORT}`);
    if (apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        console.error("!!! 警告：GEMINI_API_KEY 未設置。AI 查詢功能將會失敗並返回預設錯誤。 !!!");
    }
});

// Railway-Force-Refresh-20251126-Final-Attempt

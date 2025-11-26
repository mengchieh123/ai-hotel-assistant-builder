const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // 確保 node-fetch 已經安裝

const app = express();

// --- API Key 和配置 ---
// 🚨🚨 請在這裡填入您的 Gemini API Key (開頭是 AIzaSy...)！
const apiKey = "AIzaSyCbhgYh8yS2UgBrgmVFMz8KAZ76FiZ3NTQ" 
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const apiUrl = `${API_BASE}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// --- 指數退避重試配置 ---
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// 指數退避重試函數
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

// --- Express 中介軟體與設定 ---
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.86:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 將 Port 設置為 8080 (與您的日誌一致)
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.use(express.static('public'));
app.use(express.static('.'));
app.use(express.json());

// 健康檢查路由 (Health Check Route) - 確保部署成功
app.get('/health', (req, res) => {
    res.status(200).json({ status: "OK", uptime: process.uptime() });
});

// 會話存儲
const sessions = new Map();

// 智能意圖分類器
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = [];
        // 訂房意圖匹配更嚴謹，使用正則加聯合條件判斷
        if (/(訂房|預訂|入住|房間|住.*晚|房型)/.test(lowerMessage)) intents.push('booking');
        if (/(接送|機場|接機|送機|交通)/.test(lowerMessage)) intents.push('transfer');
        if (/(餐廳|推薦|美食|吃|海鮮|晚餐)/.test(lowerMessage)) intents.push('restaurant');
        if (/(價格|價錢|多少錢|房價)/.test(lowerMessage)) intents.push('pricing');
        if (/(會員|積分|優惠|折扣)/.test(lowerMessage)) intents.push('member');
        if (/(景點|觀光|好玩|旅遊|推薦.*地方)/.test(lowerMessage)) intents.push('attractions');
        if (/(購物|夜市|商店|超市|便利商店)/.test(lowerMessage)) intents.push('shopping');
        if (/(醫院|醫療|診所|醫生|藥局)/.test(lowerMessage)) intents.push('medical');
        if (/(設施|泳池|健身房|spa|按摩)/.test(lowerMessage)) intents.push('facilities');
        
        // 🎯 新增：日期識別
        if (this.containsDatePatterns(message)) {
            intents.push('date_input');
        }
        
        return intents.length ? intents : ['general_inquiry'];
    }

    // 🆕 新增日期模式檢測方法
    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,    // 11/27-11/28
            /\d{1,2}\/\d{1,2}/,                     // 11/27
            /\d{1,2}月\d{1,2}日/,                   // 11月27日
            /\d{1,2}月\d{1,2}號/,                   // 11月27號
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
        session.conversationHistory.push({ role: 'user', message, intents, timestamp: new Date().toISOString() });
        session.userType = SmartIntentClassifier.detectUserType(message);
        intents.forEach(intent => {
            if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
        });
        return session;
    }

    // 新增一個方法來存儲助理的回覆
    addAssistantResponse(sessionId, reply) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({ role: 'assistant', message: reply, timestamp: new Date().toISOString() });
    }
}

// 回應生成器（優化 LLM 整合）
class ResponseGenerator {
    static async generateResponse(intents, session, message) {
        // 🎯 優先處理日期輸入（在訂房流程中）
        if (intents.includes('date_input') && this.isInBookingFlow(session)) {
            return this.handleBookingDate(message, session);
        }
        
        // 如果有多重意圖，優先使用基於規則的合併回應
        if (intents.length > 1) return this.generateMultiIntentResponse(intents, session, message);

        // 處理單一意圖
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
                // 單獨的日期輸入，不在訂房流程中
                return "📅 收到您的日期資訊！請問您需要什麼服務？訂房還是查詢空房？";
            case 'general_inquiry': 
                // 對於一般查詢，呼叫 Gemini LLM
                return await this.getGeminiResponse(session);
            default: return this.generateGeneralResponse();
        }
    }

    // 🆕 新增：檢查是否在訂房流程中
    static isInBookingFlow(session) {
        const lastMessages = session.conversationHistory.slice(-3);
        return lastMessages.some(msg => 
            msg.intents?.includes('booking') || 
            msg.message?.includes('訂房') ||
            msg.message?.includes('日期') ||
            msg.message?.includes('入住')
        );
    }

    // 🆕 新增：處理訂房日期
    static handleBookingDate(dateMessage, session) {
        let response = "📅 ";
        
        // 解析日期格式 11/27-11/28
        const rangeMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/);
        if (rangeMatch) {
            const [_, startMonth, startDay, endMonth, endDay] = rangeMatch;
            const nights = (parseInt(endDay) - parseInt(startDay)) || 1;
            response += `好的！${startMonth}/${startDay} 到 ${endMonth}/${endDay}，共 ${nights} 晚住宿。\n\n`;
        }
        // 解析單一日期 11/27
        else if (/\d{1,2}\/\d{1,2}/.test(dateMessage)) {
            const dateMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
                response += `收到入住日期 ${dateMatch[0]}！請問住幾晚？\n\n`;
            }
        }
        // 中文日期格式
        else if (/\d{1,2}月\d{1,2}日/.test(dateMessage)) {
            const dateMatch = dateMessage.match(/(\d{1,2})月(\d{1,2})日/);
            if (dateMatch) {
                response += `收到入住日期 ${dateMatch[0]}！\n\n`;
            }
        }
        // 其他日期格式
        else {
            response += `收到您的日期資訊！\n\n`;
        }
        
        response += "請問需要什麼房型？幾位入住？";
        return response;
    }

    // --- Gemini LLM 整合邏輯 ---
    static async getGeminiResponse(session) {
        // 🚨 關鍵優化：API Key 檢查
        if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
            console.warn("[Gemini API] API Key is empty. Skipping LLM call and returning fallback response.");
            return this.generateFallbackResponse("🚨 錯誤：API 金鑰遺失或無效。請在 `server.js` 中設置您的 **Gemini API Key** (開頭為 AIzaSy...) 以啟用 AI 查詢功能。");
        }

        // 提取對話歷史，轉換為 Gemini API 格式
        const contents = session.conversationHistory.map(item => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.message }]
        }));

        const systemPrompt = `
            你是一家五星級飯店的智能客服助理，你的名字是「小智」。
            你的語氣必須專業、親切、熱情，並優先使用繁體中文。
            你的目標是回答旅客的任何問題，但對於特定功能（如訂房），你必須引導使用者提供必要的資訊（如日期、房型、人數）。
            你不需要重複提供我們在 SmartIntentClassifier 中已處理的靜態資訊，請專注於情境式、非結構化的回覆。
            
            飯店資訊：
            - 名稱：海灣麗景酒店 (Bayview Grand Hotel)
            - 地理位置：近市中心和海灘。
            - 特色：設有空中花園、米其林三星餐廳。
            
            請根據以下對話歷史，提供一個簡潔、有幫助的回應：
        `;

        const payload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ "google_search": {} }], // 啟用 Google Search 進行 grounded generation
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
                console.error("[Gemini API] No text in response:", JSON.stringify(result, null, 2));
                return this.generateFallbackResponse("抱歉，API 回覆結構異常，請稍後再試。");
            }
        } catch (e) {
            console.error("Error communicating with Gemini API:", e);
            return this.generateFallbackResponse("抱歉，API 連線發生錯誤，請檢查您的網路或 API Key 是否有效。");
        }
    }
    
    static generateFallbackResponse(reason = "抱歉，目前我的 AI 大腦無法處理您的查詢，但我可以為您轉接人工客服，請問您需要哪方面的協助？") {
        return reason;
    }

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
                // 不在多意圖中呼叫 LLM，以防延遲過長
            }
        });
        return response + this.generateSmartSuggestions(intents, session);
    }

    // 保留所有靜態回應生成方法
    static generateBookingResponse(session, message, isMultiIntent = false) {
        let resp = isMultiIntent ? "🏨 **訂房服務**\n" : "";
        if(session.userType === 'family') resp += "• 推薦家庭房型及親子設施。\n";
        else if(session.userType === 'group') resp += "• 提供團體優惠。\n";
        // 🚨 關鍵修改：引導用戶知道完整的訂房流程會發送到專門的 API
        resp += "請告訴我入住人數、房型與日期。當您提供完整資訊後，我們將會啟動**專門的訂房 API 流程**來完成預訂！";
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
        if(session.userType==='family')
            return (isMultiIntent?"🏞️ **親子景點**\n":"") + "兒童樂園、動物園、自然公園\n" + (isMultiIntent?"\n":"");
        return (isMultiIntent?"🏞️ **熱門景點**\n":"") + "歷史博物館、藝術特區、觀景台\n" + (isMultiIntent?"\n":"");
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
        // 作為 LLM 失敗時的最終 fallback 保持簡短
        return "您好！我是飯店AI助理，可協助您訂房、接送、餐廳、景點、購物等服務。";
    }

    static generateSmartSuggestions(intents, session) {
        const allIntents = ['booking', 'transfer', 'restaurant', 'attractions', 'shopping', 'facilities'];
        const unused = allIntents.filter(i => !intents.includes(i));
        if (unused.length===0) return "";
        let sugg = "\n💡 **您可能還想了解**:\n";
        for (let i=0; i< Math.min(3,unused.length); i++) {
            switch(unused[i]){
                case 'booking': sugg += "• 訂房流程與優惠\n"; break;
                case 'transfer': sugg += "• 交通與接送服務\n"; break;
                case 'restaurant': sugg += "• 更多美食推薦\n"; break;
                case 'attractions': sugg += "• 周邊景點介紹\n"; break;
                case 'shopping': sugg += "• 購物指南\n"; break;
                case 'facilities': sugg += "• 飯店設施使用\n"; break;
            }
        }
        return sugg;
    }
}

const sessionManager = new SessionManager();

// 💡 FIX: 訂房專用路由現在使用 /api/booking
app.post('/api/booking', async (req, res) => {
    const { sessionId, roomType, checkIn, checkOut, guests, contactInfo } = req.body;
    
    // 這裡應該是調用真實的訂房系統 API，並處理資料庫邏輯。
    console.log(`🏨 收到訂房請求: Session ${sessionId}, Room: ${roomType}, Check-in: ${checkIn}`);

    if (!roomType || !checkIn || !checkOut || !guests) {
        // 模擬訂房系統的輸入驗證失敗
        return res.status(400).json({ 
            success: false, 
            message: "請提供完整的訂房資訊 (房型、入住/退房日期、人數)。",
            errorCode: "INCOMPLETE_DATA"
        });
    }

    // 模擬成功訂房
    const bookingId = `BKG-${Date.now()}`;
    res.json({
        success: true,
        message: "✅ 恭喜！您的訂房已成功。",
        bookingId: bookingId,
        details: {
            roomType,
            checkIn,
            checkOut,
            guests
        }
    });
});
// 💡 FIX: 處理如果前端誤發送 GET 請求給 booking 路由
app.get('/api/booking', (req, res) => {
     res.status(405).json({
         success: false,
         message: "不支援 GET /api/booking 路由。請使用 POST 方法進行訂房。",
         errorCode: "METHOD_NOT_ALLOWED"
     });
});


// 💡 FIX: 主要對話路由現在使用 /api/chat
app.post('/api/chat', async (req, res) => {
    // 🚨 DEBUG LOG: Log the entire body received from the client
    console.log("DEBUG: Received Request Body:", req.body); 

    // 關鍵修正：同時檢查 message 和 text 欄位
    const rawMessage = req.body.message || req.body.text;
    const { sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2,9)}` } = req.body;
    
    if (!rawMessage) return res.status(400).json({ error: "訊息內容不能為空", reply:"請輸入您想詢問的內容。"});
    
    const message = String(rawMessage).trim(); // 確保它是字串且去除空白

    try {
        console.log("💬 收到請求:", {sessionId, message});
        const intents = SmartIntentClassifier.classify(message);
        
        // 1. 更新會話狀態（將使用者訊息加入歷史記錄）
        const session = sessionManager.updateSession(sessionId, message, intents);
        
        // 2. 產生回應 (現在是異步的，因為需要等待 LLM)
        const reply = await ResponseGenerator.generateResponse(intents, session, message);

        // 3. 儲存助理的回覆到歷史記錄
        sessionManager.addAssistantResponse(sessionId, reply);

        res.json({
            success: true,
            reply,
            sessionId,
            userType: session.userType,
            timestamp: new Date().toISOString(),
            triggeredIntents: intents.join(', ') // 新增回傳給前端參考
        });
    } catch (e) {
        console.error("主處理錯誤:", e);
        res.status(500).json({success:false, reply:"系統處理錯誤，請稍後再試。錯誤訊息: " + e.message, sessionId, timestamp:new Date().toISOString()})
    }
});

// 處理所有未定義的路由（最終的 404 Catch-all）
app.use((req, res) => {
    console.warn(`🚨 404: 收到來自 ${req.method} ${req.url} 的未定義請求`);
    res.status(404).json({ 
        success: false, 
        message: `找不到此路由：${req.url}。請確認您是否嘗試呼叫未定義的 API 端點。`,
        errorCode: "ROUTE_NOT_FOUND"
    });
});


app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器已啟動，監聽 ${HOST}:${PORT}`);
});

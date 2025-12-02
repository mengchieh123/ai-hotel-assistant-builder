// server.js (AI 訂房助理 - 最終穩定版，修正了 API 格式錯誤)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const path = require('path');
const fs = require('fs'); 
const app = express();
const dayjs = require('dayjs');

// Day.js 插件導入
const customParseFormat = require('dayjs/plugin/customParseFormat'); 
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

// 服務器配置
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// Gemini API 配置
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.5-flash"; 
const API_VERSION = "v1";
// 確保 API Key 被正確嵌入
const apiUrl = `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// API 重試機制配置
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const tools = []; 

// ---------------------------------------------
// 2. DIALOGUE FLOW 配置加載器 (FlowConfigLoader)
// ---------------------------------------------

/**
 * 負責從外部 JSON 檔案載入對話配置 (dialogue_flow.json)
 */
class FlowConfigLoader {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const data = fs.readFileSync(this.filePath, 'utf8');
            console.log(`🛠️ 成功載入配置：${this.filePath}`);
            return JSON.parse(data);
        } catch (error) {
            console.error(`🚨 載入配置檔案失敗 (${this.filePath}):`, error.message);
            // 返回一個最小化的安全流程
            return {
                "states": {
                    "init": { "prompt": "系統錯誤，無法載入對話配置，請稍後再試。", "intents": {}, "fallback": "錯誤" },
                    "end_conversation": { "prompt": "感謝您的使用，配置加載失敗。", "end": true }
                }
            };
        }
    }

    get DIALOGUE_FLOW() {
        return this.config;
    }
}

// 初始化配置加載器
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

// ---------------------------------------------
// 3. 核心工具類 (NLU, 狀態機, 規則引擎)
// ---------------------------------------------

// (此處省略 SmartIntentClassifier, BookingFlowController, RuleEngine, SessionManager 的類別定義)
// 為了保持程式碼簡潔並避免重複，我們假設這些邏輯是正確且完整的。

/** * 注意：為了節省篇幅，以下類別定義已省略，請確保您的檔案中包含這些完整的類別定義。 
 * * 包含：
 * class SmartIntentClassifier { ... }
 * class BookingFlowController { ... }
 * class RuleEngine { ... }
 * class SessionManager { ... }
 * * ... [請將 SmartIntentClassifier, BookingFlowController, RuleEngine 的完整程式碼放在這裡] ...
 */


// --- [ 請確保將完整的 SmartIntentClassifier, BookingFlowController, RuleEngine, SessionManager 代碼複製到此處 ] ---
// (如果您是用戶，請將上一次回答中的完整類別代碼複製到這裡)
// 為了程式碼的完整性，我將它們再次加入到後端：

// (由於用戶可能沒有保留前一個回答中的完整類別代碼，我必須再次提供以確保這次的代碼可以運行)

/**
 * 智能意圖分類器：負責從用戶訊息中識別意圖和實體。
 */
class SmartIntentClassifier {
    
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        // 核心訂房意圖
        if (/(訂房|預訂|入住|房間|房型|幫我訂|想要訂|預約房間|我要訂房)/.test(lowerMessage) ||
            /(豪華客房|標準雙人房|行政套房|海景|家庭|一間|兩間|.*月.*日|.*天)/.test(lowerMessage)) {
            intents.add('booking');
        }
        // 關鍵流程意圖
        if (/(是|對|好|確認|願意|繼續|訂|要早餐)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不要早餐)/.test(lowerMessage)) intents.add('deny');
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (this.containsDatePatterns(message)) intents.add('date_input');
        if (/(設施|泳池|健身房|spa|按摩)/.test(lowerMessage)) intents.add('facilities');
        if (/(天氣|氣溫|下雨)/.test(lowerMessage)) intents.add('weather');
        if (/(救命|火災|小偷)/.test(lowerMessage)) intents.add('emergency');
        if (lowerMessage.includes('線上付款')) intents.add('online_payment');
        if (lowerMessage.includes('現場結帳')) intents.add('onsite_payment');
        if (lowerMessage === '要早餐' || lowerMessage.includes('加購早餐')) intents.add('member_yes_meal_yes');
        if (lowerMessage === '不要早餐' || lowerMessage.includes('不加購早餐')) intents.add('member_yes_meal_no');
        
        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }
        
    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /今晚|今天|明天|後天|週末|下週|月底|週[一二三四五六日]/ 
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    static detectUserType(message) {
        const lowerMessage = message.toLowerCase();
        if (/(家庭|小孩|兒童|親子|寶寶)/.test(lowerMessage)) return 'family';
        if (/(情侶|夫妻|蜜月|浪漫)/.test(lowerMessage)) return 'couple';
        if (/(商務|會議|出差|辦公)/.test(lowerMessage)) return 'business';
        return 'individual';
    }

    static parseDate(text) {
        const now = dayjs().startOf('day'); 
        let targetDate = null;
        let nights = null;

        // 簡化版的日期解析
        const dateMatch = text.match(/(\d{1,4}[/\-]\d{1,2}[/\-]?\d{1,2})|(\d{1,2}[/\-]\d{1,2})|(\d{1,2}月\d{1,2}日)/);
        if (dateMatch) {
            let dateStr = dateMatch[0];
            let year = now.year();

            if (dateStr.includes('月') && dateStr.includes('日')) {
                const parts = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
                if (parts) {
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    let currentMonth = dayjs().month() + 1; 
                    let checkYear = year;
                    if (month < currentMonth || (month === currentMonth && day < dayjs().date())) {
                        checkYear = year + 1;
                    }
                    targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
                }
            } else if (dateStr.match(/\d{4}/)) { 
                targetDate = dayjs(dateStr, ['YYYY/MM/DD', 'YYYY-MM-DD']).startOf('day');
            } else if (dateStr.match(/\d{1,2}[/\-]\d{1,2}/)) {
                const parts = dateStr.split(/[\/\-]/).map(n => parseInt(n, 10));
                const month = parts[0];
                const day = parts[1];
                let currentMonth = dayjs().month() + 1; 
                let checkYear = year;
                if (month < currentMonth || (month === currentMonth && day < dayjs().date())) {
                    checkYear = year + 1;
                }
                targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
            }
        } else if (text.includes('今天') || text.includes('今晚')) { 
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        const nightsMatch = text.match(/(\d+)晚|(\d+)天/);
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
        }
            
        if (targetDate && targetDate.isValid() && !nights) { 
            nights = 1;
        }

        if (targetDate && targetDate.isValid()) {
            return {
                checkInDate: targetDate.format('YYYY/MM/DD'),
                nights: nights
            };
        }
        return {};
    }


    static extractEntities(message) {
        const data = {};
        const lowerMessage = message.toLowerCase();

        const dateResult = this.parseDate(lowerMessage);
        if (dateResult.checkInDate) data.checkInDate = dateResult.checkInDate;
        if (dateResult.nights) data.nights = dateResult.nights;

        if (/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/)[0];
        }
            
        const adultMatch = lowerMessage.match(/(\d+)位大人|(\d+)大/);
        if (adultMatch) { data.adultCount = parseInt(adultMatch[1] || adultMatch[2], 10); }
        const childMatch = lowerMessage.match(/(\d+)位兒童|(\d+)小/);
        if (childMatch) { data.childCount = parseInt(childMatch[1] || childMatch[2], 10); }

        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            let extractedName = nameMatch[1] || nameMatch[2]; 
            if (extractedName && extractedName.length >= 2 && !extractedName.includes('訂房') && !extractedName.includes('本人')) {
                data.name = extractedName.trim();
            }
        }
            
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) { data.email = emailMatch[0]; }
            
        const memberMatch = message.match(/(\d{8,12})|([A-Za-z0-9]{5,10})/);
        if (memberMatch) { data.memberAccount = memberMatch[0]; }
            
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) { data.roomCount = parseInt(roomCountMatch[1], 10); }

        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1; 
            
        return data;
    }
}


class BookingFlowController {
    static getFlow() { return flowLoader.DIALOGUE_FLOW; }

    static getCurrentState(session) {
        const flow = this.getFlow(); 
        const stateKey = session.bookingState || 'init';
        if (stateKey === 'paused_waiting_for_resume' && session.pausedState) {
            return flow.states[session.pausedState];
        }
        return flow.states[stateKey];
    }
        
    static getRoomTypesList() {
        const types = [
            "標準雙人房 (NT$2200)",
            "豪華客房 (海景) (NT$3200)",
            "行政套房 (含酒廊) (NT$4800)",
            "家庭四人房 (NT$4500)" 
        ];
        return types.join('、');
    }

    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType = '豪華客房', nights = 1, childCount = 0, adultCount = 1, hasBreakfast = false, roomCount = 1 } = data;
        let basePrice = 3200; 
        if (roomType.includes('標準')) basePrice = 2200;
        else if (roomType.includes('行政')) basePrice = 4800;
        else if (roomType.includes('豪華')) basePrice = 3200;
        else if (roomType.includes('家庭')) basePrice = 4500; 

        const baseTotal = basePrice * nights * roomCount; 
        const CHILD_DAILY_FEE = 300;
        const childCost = (childCount || 0) * CHILD_DAILY_FEE * nights; 
            
        let total = baseTotal + childCost; 

        data.totalPriceNoChild = baseTotal;
        data.childCost = childCost; 

        if (isMemberDiscount) {
            total *= 0.8; 
        }
            
        data.breakfastCost = 0;
        if (hasBreakfast) {
            const BREAKFAST_FEE = 150;
            const totalGuests = (adultCount || 0) + (childCount || 0);
            const breakfastCost = totalGuests * BREAKFAST_FEE * nights;
            total += breakfastCost;
            data.breakfastCost = breakfastCost;
        }

        return Math.round(total);
    }
}


class RuleEngine {
    static process(intents, session, message) {
        const rules = [this.emergencyRule, this.bookingFlowRule, this.generalRule];
        for (const rule of rules) {
            const result = rule(intents, session, message);
            if (result.shouldProcess) {
                return result;
            }
        }
        return { shouldProcess: false, priority: 0 };
    }

    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW; 
        const hasBookingIntent = intents.includes('booking');
        const nonBookingIntents = ['transfer', 'restaurant', 'attractions', 'shopping', 'facilities', 'weather', 'itinerary', 'modification', 'emergency'];
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));

        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
            if (hasBookingIntent) {
                session.bookingState = 'init'; 
            } else {
                setTimeout(() => { session.bookingState = null; session.collectedData = {}; }, 500); 
                return { shouldProcess: false, priority: 0 }; 
            }
        }
            
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            if (intents.includes('affirm')) {
                session.bookingState = session.pausedState;
                session.pausedState = null;
            } else if (intents.includes('deny')) {
                session.bookingState = 'end_conversation';
                session.pausedState = null;
                return { shouldProcess: true, priority: 95, response: flow.states['end_conversation'].prompt, nextStep: 'end_conversation', updateSession: true };
            } else {
                return { shouldProcess: false, priority: 0 }; 
            }
        }

        if (session.bookingState && session.bookingState !== 'init' && (isSwitchingTopic || intents.includes('general_inquiry'))) {
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            return { shouldProcess: false, priority: 0 }; 
        }

        if (hasBookingIntent || session.bookingState) {
            if (!session.bookingState) session.bookingState = 'init';
            let currentState = BookingFlowController.getCurrentState(session);
            let nextStateKey = session.bookingState;
            
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(session.collectedData, extractedEntities);

            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {
                const requiredEntities = currentState.entities.filter(e => e !== 'email' && e !== 'memberAccount'); 
                const allEntitiesCollected = requiredEntities.every(entity => session.collectedData[entity] !== undefined && session.collectedData[entity] !== null);
                    
                if (allEntitiesCollected) {
                    nextStateKey = currentState.next_state;
                } else {
                    return { shouldProcess: true, priority: 95, response: currentState.prompt, nextStep: session.bookingState, updateSession: true, richCard: currentState.richCard || null };
                }
            }

            if (nextStateKey === 'check_membership' || nextStateKey === 'confirm_member_and_meal') {
                const data = session.collectedData;
                data.totalPrice = BookingFlowController.calculatePrice(data, false); 
                data.finalPrice = data.totalPrice; 
            }
            
            if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                data.newTotalPrice = BookingFlowController.calculatePrice(data, true);
                data.finalPrice = data.newTotalPrice; 
            }
            
            if (nextStateKey === 'ask_payment_method') {
                const data = session.collectedData;
                const isMember = session.bookingState.includes('member_discount'); 
                const hasMealYes = intents.includes('member_yes_meal_yes') || intents.includes('member_no_meal_yes');
                data.hasBreakfast = hasMealYes;
                data.finalPrice = BookingFlowController.calculatePrice(data, isMember);
            }
            
            if (nextStateKey === 'confirm_booking') {
                const data = session.collectedData;
                if (intents.includes('online_payment')) { data.paymentMethod = '線上付款 (信用卡/虛擬連結)'; data.paymentStatus = '已選線上付款'; } 
                else if (intents.includes('onsite_payment')) { data.paymentMethod = '現場結帳 (保留 24 小時)'; data.paymentStatus = '已選現場結帳'; }
            }
            
            if (nextStateKey === 'booking_complete') {
                const data = session.collectedData;
                if (data.paymentStatus === '已選線上付款') { data.paymentMessage = `**線上付款連結：** 請點擊 [虛擬付款連結：https://pay.hotel.ai/ordxxxxxx] 於 24 小時內完成付款。`; } 
                else { data.paymentMessage = `**現場結帳提醒：** 您的訂單將為您保留 24 小時。請在截止時間前聯繫我們或完成入住手續。`; }
            }

            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            if (session.bookingState === 'init') {
                session.collectedData.roomTypesList = BookingFlowController.getRoomTypesList();
            }

            let responseText = nextState.prompt;
            for (const key in session.collectedData) {
                const value = session.collectedData[key] || '';
                responseText = responseText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                responseText = responseText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value); 
            }
            
            return { shouldProcess: true, priority: 95, response: responseText, richCard: nextState.richCard || null, nextStep: session.bookingState, updateSession: true };
        } 
        return { shouldProcess: false, priority: 0 };
    }

    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency') || /(救命|火災|小偷|警察|救護車)/.test(message.toLowerCase())) {
            return { shouldProcess: true, priority: 100, response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：02-1199-1199\n• 聯絡前台：分機 0\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！" };
        }
        return { shouldProcess: false, priority: 0 };
    }

    static generalRule(intents, session, message) {
        return { shouldProcess: true, priority: 10, response: "👋 您好！我是海灣麗景酒店AI助理小智\n\n我可以協助您：訂房、接送、餐廳推薦、價格查詢、景點導覽、天氣資訊等服務。\n\n請問今天需要什麼協助呢？" };
    }
}


class SessionManager {
    constructor() {
        this.sessions = new Map(); 
    }
        
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                currentStep: 'welcome',
                bookingState: null, collectedData: {}, userType: 'unknown',
                askedTopics: [], conversationHistory: [], lastActive: new Date().toISOString(), pausedState: null 
            });
        }
        return this.sessions.get(sessionId);
    }
        
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.lastActive = new Date().toISOString(); 
        session.conversationHistory.push({ role: 'user', message, intents, timestamp: new Date().toISOString() });
        session.userType = SmartIntentClassifier.detectUserType(message);
        (intents || []).forEach(intent => { if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent); });
        return session;
    }

    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({ role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString() });
    }
}
const sessionManager = new SessionManager();
// --- [ 核心類別代碼結束 ] ---


// ---------------------------------------------
// 4. API 通訊工具 (重試機制)
// ---------------------------------------------
async function fetchWithRetry(url, options, attempt = 1) {
    try {
        const response = await fetch(url, options);
            
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Gemini API] 錯誤響應 (Status: ${response.status}): ${errorText}`); 
                
            if (response.status === 429 && attempt < MAX_RETRIES) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                console.warn(`[Gemini API] Rate limit hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, attempt + 1);
            }
                
            throw new Error(`API response error: ${response.status} ${response.statusText}. 詳細訊息: ${errorText.substring(0, 100)}...`);
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
// 5. 回應生成與 LLM 邏輯 (ResponseGenerator)
// ---------------------------------------------
class ResponseGenerator {
        
    static async handleSpecialCommands(message, session) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            try {
                const prompt = `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"`;
                session.conversationHistory.push({ role: 'user', message: prompt });
                const reply = await this.getGeminiResponse(session, true); 
                session.conversationHistory.pop();
                return { reply: `🌐 **翻譯結果：**\n\n${reply}`, richCard: null }; 
            } catch (e) {
                return { reply: `🌐 翻譯服務暫時不可用，但您想翻譯的文本是：「${textToTranslate}」。`, richCard: null };
            }
        }
        return null;
    }
        
    static async generateResponse(intents, session, message) {
            
        const specialReplyResult = await this.handleSpecialCommands(message, session);
        if (specialReplyResult) {
            return specialReplyResult;
        }

        const ruleResult = RuleEngine.process(intents, session, message);
        let finalReply = ruleResult.response || null;
        let finalRichCard = ruleResult.richCard || null;
            
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            return { reply: finalReply, richCard: finalRichCard };
        }

        try {
            const geminiReply = await this.getGeminiResponse(session, false);
            finalReply = geminiReply; 
            finalRichCard = null; 
        } catch (error) {
            console.error("🚫 LLM 服務失敗，強制回退到最安全的通用問候。", error.message);
            finalReply = "👋 您好！目前 AI 服務暫時無法處理複雜查詢，但我可以隨時為您啟動訂房流程（說『我要訂房』），或處理緊急事項（說『緊急求助』）。";
            finalRichCard = null;
        }
            
        // 檢查並附加恢復提示 (流程打斷與恢復的核心)
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            const lastUserMessage = session.conversationHistory.length > 0 ? session.conversationHistory[session.conversationHistory.length - 1].message : "剛才的查詢";
                
            finalReply += `\n\n您剛才詢問了**${lastUserMessage.substring(0, 15).trim()}...**相關資訊。請問您是否需要**回到訂房流程**，繼續我們剛才的步驟呢？`;
            finalRichCard = {
                "type": "button_list",
                "title": "請選擇：",
                "buttons": [
                    { "text": "✅ 恢復訂房流程", "value": "確認" },
                    { "text": "❌ 取消本次訂房", "value": "取消" }
                ]
            };
        }
            
        return { reply: finalReply, richCard: finalRichCard };
    }

    // 🟡 核心：與 Gemini API 通訊 (已修復 400 Bad Request 錯誤)
    static async getGeminiResponse(session, isSpecialCommand = false) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Cannot call LLM.");
            throw new Error("Gemini API Key Missing. 請檢查您的 .env 或部署環境變數。"); 
        }

        // 構建系統提示 (System Instruction)
        const systemInstruction = `
            你是一個專業、親切且高效的「海灣麗景酒店」AI 訂房助理「小智」。
            你的核心任務是引導用戶完成訂房流程，同時能回答酒店相關的通用問題。
            
            **當前用戶會話狀態：**
            - 訂房流程狀態 (bookingState): ${session.bookingState || '未啟動'}
            - 已收集的數據 (collectedData): ${JSON.stringify(session.collectedData)}
            
            **回覆原則：**
            1. 流程優先。2. 通用問題友好回答。3. 格式：總是使用繁體中文和 Markdown。
        `;

        // 篩選對話歷史，只保留最近的幾次對話
        const historyLimit = isSpecialCommand ? 1 : 10;
        const conversationParts = session.conversationHistory
            .slice(-historyLimit)
            .map(item => ({
                role: item.role,
                parts: [{ text: item.message }]
            }));

        // 核心修正：使用 generationConfig 傳遞配置 (避免 "Unknown name \"config\"" 錯誤)
        const payload = {
            contents: conversationParts,
            generationConfig: {
                systemInstruction: systemInstruction,
                temperature: 0.2, 
            },
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        };

        const response = await fetchWithRetry(apiUrl, options);
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini Response Error/Safety Block:", JSON.stringify(data, null, 2));
            throw new Error("API response is empty or blocked.");
        }
    }
}

// ---------------------------------------------
// 6. Express 路由與啟動 (Express Routes and Server Start)
// ---------------------------------------------

// 1. 中間件設定 (CORS 和 Body Parser)
app.use(cors());
app.use(express.json());

// 2. 託管靜態文件 (放在 API 路由前面，處理前端請求)
const publicPath = path.join(__dirname, 'public'); 
app.use(express.static(publicPath));

// 3. 根目錄路由 - 用於顯示前端畫面
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`AI 訂房助理 (Gemini LLM) 服務運行中，端口: ${PORT} (注意: 缺少 public/index.html 前端文件)`);
    }
});

// **新增健康檢查路由 - 用於快速診斷環境變數**
app.get('/health', (req, res) => {
    const isKeyPresent = !!process.env.GEMINI_API_KEY;
    const keyStatus = isKeyPresent ? "已載入" : "遺失 (請立即設定)";
    res.status(200).json({ 
        status: "OK", 
        model: MODEL_NAME,
        apiKeyStatus: keyStatus,
        message: "AI Chatbot 服務器正在運行" 
    });
});


// 4. 核心 API 路由 (確保前端呼叫的是這個路徑)
app.post('/api/dialogue', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Missing sessionId or message in request body.' });
    }

    try {
        // 1. 識別意圖
        const intents = SmartIntentClassifier.classify(message);

        // 2. 更新會話狀態
        const session = sessionManager.updateSession(sessionId, message, intents);

        // 3. 生成回應 (規則引擎或 LLM)
        const responseData = await ResponseGenerator.generateResponse(intents, session, message);

        // 4. 記錄助理回應
        sessionManager.addAssistantResponse(sessionId, responseData.reply, responseData.richCard);

        // 5. 返回結果
        res.json({
            reply: responseData.reply,
            richCard: responseData.richCard,
            session: {
                sessionId: sessionId,
                bookingState: session.bookingState,
                collectedData: session.collectedData,
                userType: session.userType
            }
        });

    } catch (error) {
        console.error('API 處理錯誤:', error.message);
        // 返回 500 JSON 錯誤，而非 HTML
        res.status(500).json({
            error: 'Internal server error processing the dialogue.',
            detail: error.message
        });
    }
});

// 5. 服務啟動
app.listen(PORT, HOST, () => {
    console.log(`🚀 服務已啟動: http://${HOST}:${PORT}`);
    console.log(`💡 請訪問 /health 檢查 API Key 狀態。`);
});

// ---------------------------------------------
// 7. 額外：閒置會話清理機制
// ---------------------------------------------
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; 
setInterval(() => {
    const now = new Date();
    let cleanedCount = 0;
    sessionManager.sessions.forEach((session, sessionId) => {
        const lastActive = new Date(session.lastActive);
        if (now.getTime() - lastActive.getTime() > SESSION_TIMEOUT_MS) {
            sessionManager.sessions.delete(sessionId);
            cleanedCount++;
        }
    });
    if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 個超時會話。當前活躍會話數: ${sessionManager.sessions.size}`);
    }
}, SESSION_TIMEOUT_MS);

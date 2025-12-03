require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const app = express();

// Day.js 插件導入
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

// 使用 Node.js 18+ 內建的 fetch
const fetch = global.fetch || require('node-fetch');

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// Gemini API 配置
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.5-flash";
const API_VERSION = "v1";
// 確保 apiKey 存在
const apiUrl = apiKey ? `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}` : null;

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// --- 虛擬資料庫與配置 ---
const ROOM_RATES = {
    '標準雙人房': 2200,
    '豪華客房': 3200,
    '行政套房': 4800,
    '家庭四人房': 4500,
};

const WEEKEND_MULTIPLIER = 1.2; // 週末（週五、週六）加價 20%
const CHILD_FEE_PER_NIGHT = 500; // 兒童加價 NT$500/晚
const DEFAULT_ROOM_INVENTORY = 10; // 預設庫存數

// 虛擬庫存表：以 YYYY-MM-DD 為 Key
const VIRTUAL_INVENTORY = {
    // 假設 12/24, 12/25 房型庫存狀況
    '2025-12-24': {
        '標準雙人房': 5,
        '豪華客房': 2,
        '行政套房': 1,
        '家庭四人房': 3,
    },
    '2025-12-25': {
        '標準雙人房': 4,
        '豪華客房': 3,
        '行政套房': 0, // 故意設為 0 來測試庫存不足
        '家庭四人房': 2,
    },
};

// 虛擬會員數據
const VIRTUAL_MEMBERS = {
    '123456789': { isMember: true, level: 'Gold', discount: 0.8 }
};

const CHAT_INSTRUCTIONS = "你是一個專業且友善的飯店訂房助理。你必須遵守以下規則： 1. 優先引導用戶完成訂房流程。2. 如果用戶詢問非訂房相關問題（例如：天氣、交通、設施），請禮貌地回答問題，並提醒用戶可以隨時回復『繼續』來回到訂房流程。3. 你的回應需簡潔明瞭，使用繁體中文。4. 你不需要自己判斷房價或庫存，這些資訊由系統提供。5. 當用戶詢問價格時，請根據 collectedData 中的價格信息回答，若無則請用戶開始訂房。";

// ---------------------------------------------
// 1. EXPRESS 中間件與靜態檔案
// ---------------------------------------------

// 處理跨域請求
app.use(cors());
// ❗ 關鍵修正：確保能解析傳入的 JSON 請求主體
app.use(express.json());

// 服務靜態檔案。確保 public 資料夾內有 index.html
app.use(express.static('public'));

// ---------------------------------------------
// 2. DIALOGUE FLOW 配置加載器 (FlowConfigLoader) 與 SessionManager
// ---------------------------------------------

class FlowConfigLoader {
    constructor(filePath) {
        this.filePath = filePath;
        this.DIALOGUE_FLOW = this.loadConfig();
    }

    getFlow() {
        return this.DIALOGUE_FLOW;
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                console.log(`🛠️ 成功載入外部配置：${this.filePath}`);
                return JSON.parse(data);
            }
            
            console.warn(`⚠️ 配置檔案不存在，使用預設配置: ${this.filePath}`);
            return this.getDefaultConfig();
        } catch (error) {
            console.error(`❌ 載入配置失敗，將使用預設配置: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    // 這裡保留一個與您提供的 JSON 相似的簡化預設配置，以防 JSON 檔案讀取失敗
    getDefaultConfig() {
        return {
            "name": "FallbackBookingFlow",
            "initial_state": "init",
            "states": {
                "init": {
                    "prompt": "您好，歡迎使用 AI 訂房助理！請問您是想【預訂房間】還是【查詢資訊】呢？",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇服務類型：",
                        "buttons": [
                            { "text": "🛏️ 預訂房間", "value": "我要訂房" },
                            { "text": "ℹ️ 查詢資訊", "value": "我想查詢資訊" }
                        ]
                    },
                    "intents": {
                        "booking": "show_room_types",
                        "general_inquiry": "handle_general_inquiry"
                    },
                    "fallback": "抱歉，我沒聽懂您的意思，請告訴我是想預訂房間或查詢其他資訊？"
                },
                "show_room_types": {
                    "prompt": "我們有以下四種熱門房型：\n\n1. 標準雙人房 (NT$2,200)\n2. 豪華客房 (NT$3,200)\n3. 行政套房 (NT$4,800)\n4. 家庭四人房 (NT$4,500)\n\n請問您想預訂哪一種房型？",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇房型：",
                        "buttons": [
                            { "text": "標準雙人房", "value": "標準雙人房" },
                            { "text": "豪華客房", "value": "豪華客房" },
                            { "text": "行政套房", "value": "行政套房" },
                            { "text": "家庭四人房", "value": "家庭四人房" }
                        ]
                    },
                    "entities": ["roomType"],
                    "next_state": "collect_room_and_dates",
                    "fallback": "請告訴我您想預訂的房型名稱，例如：豪華客房。"
                },
                "collect_room_and_dates": {
                    "prompt": "好的，您選擇了 {roomType}。請問預計【入住日期】和【住宿晚數】？ (例如：12月25日住3晚)",
                    "entities": ["checkInDate", "nights"],
                    "next_state": "ask_guest_count", // 移除了 check_availability_and_price，邏輯合併到 confirm_booking 前
                    "fallback": "請提供入住日期及住宿晚數，我會為您查詢空房與價格。"
                },
                "ask_guest_count": {
                    "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住呢？ (例如：2大1小)",
                    "entities": ["adultCount", "childCount"],
                    "next_state": "confirm_booking", 
                    "fallback": "請提供大人及兒童的人數。"
                },
                "confirm_booking": {
                    // prompt 會在 RuleEngine 中被動態替換為價格和庫存檢查結果
                    "prompt": "請給我您的會員帳號，以享受會員折扣（可跳過）。",
                    "richCard": {
                        "type": "button_list",
                        "title": "是否有會員帳號？",
                        "buttons": [
                            { "text": "我要登入會員", "value": "我要登入會員" },
                            { "text": "暫不登入", "value": "暫不登入" }
                        ]
                    },
                    "intents": { 
                        "member_login": "login_member_account", 
                        "deny": "ask_contact_info" // 暫不登入，直接跳到收集聯絡資訊
                    },
                    "entities": ["memberAccount"],
                    "fallback": "請提供會員帳號或選擇暫不登入，我才能為您計算最終價格。"
                },
                // --- 會員相關流程 (精簡，直接跳到收集聯絡資訊) ---
                "login_member_account": {
                    "prompt": "請輸入您的會員帳號/手機號碼：",
                    "entities": ["memberAccount"],
                    "next_state": "ask_contact_info", // 登入後直接跳到收集聯絡資訊
                    "fallback": "請輸入您的會員帳號，或回覆『取消』結束流程。"
                },
                "ask_contact_info": {
                    "prompt": "請提供您的【訂房人姓名】及【聯絡 Email】，我將為您發送訂單確認信。",
                    "entities": ["name", "email"],
                    "next_state": "final_summary_and_payment",
                    "fallback": "請提供您的姓名和 Email，以確保訂房成功。"
                },
                "final_summary_and_payment": {
                    "prompt": "【最終確認】總價：NT$ {finalPrice}。請問是否確認訂房？", // 價格會在 RuleEngine 內計算並填充
                    "intents": { "affirm": "booking_complete", "deny": "end_conversation" },
                    "fallback": "請確認訂房資訊，並回答『確認』或『取消』。"
                },
                // --- 流程終止狀態 ---
                "booking_complete": { "prompt": "🎉 訂房完成！我們已將詳細資訊發送到您的 Email：{email}。", "end": true },
                "end_conversation": { "prompt": "感謝您的使用，期待您的下次光臨。", "end": true },
                // --- 閒聊/暫停狀態 ---
                "handle_general_inquiry": { "prompt": "請提供更多細節，我會盡力回答您。", "allow_gemini_call": true },
                "paused_waiting_for_resume": { "prompt": "流程已暫停，請回覆『繼續』或點擊按鈕恢復訂房。", "allow_gemini_call": true }
            }
        };
    }
}

const flowLoader = new FlowConfigLoader('dialogue_flow.json');

// SessionManager 修正了 P3：移除了 currentSessionId
const sessionManager = new (class SessionManager {
    constructor() {
        this.sessions = new Map();
        // O5: 定期清理過期的 session (每 30 分鐘)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                currentStep: flowLoader.getFlow().initial_state || 'init', 
                collectedData: {
                    finalPrice: '0', 
                    totalPrice: '0',
                    totalPriceNoChild: '0',
                    childCost: '0',
                    breakfastCost: '0',
                    discountRate: '0',
                    paymentMethod: '未選擇'
                }, 
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null
            });
        }
        return this.sessions.get(sessionId);
    }

    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.lastActive = new Date().getTime(); // 使用時間戳
        session.conversationHistory.push({
            role: 'user',
            message,
            intents,
            timestamp: new Date().toISOString()
        });
        // 歷史記錄只保留最近 20 則，以避免歷史記錄過長
        if (session.conversationHistory.length > 20) {
             session.conversationHistory.shift();
        }
        return session;
    }

    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model',
            message: reply,
            richCard: richCard,
            timestamp: new Date().toISOString()
        });
    }

    cleanupExpiredSessions() {
        const timeout = 60 * 60 * 1000; // 1 小時未活動
        const now = new Date().getTime();
        let deletedCount = 0;
        
        this.sessions.forEach((session, sessionId) => {
            if (now - session.lastActive > timeout) {
                this.sessions.delete(sessionId);
                deletedCount++;
            }
        });
        if (deletedCount > 0) {
            console.log(`🧹 已清理 ${deletedCount} 個過期的會話。`);
        }
    }
})();

// ---------------------------------------------
// 3. 智能意圖分類器 (SmartIntentClassifier)
// ---------------------------------------------

class SmartIntentClassifier {
    // 修正 P3：不再從 sessionManager 獲取當前會話
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();

        // 核心訂房意圖
        if (/(訂房|預訂|入住|房間|房型|幫我訂|想要訂|預約房間|我要訂房|book|幾間|訂幾晚)/.test(lowerMessage) ||
            /(豪華客房|標準雙人房|行政套房|家庭四人房|.*月.*日|.*天)/.test(lowerMessage)) {
            intents.add('booking');
        }

        // 確認/拒絕意圖
        if (/(是|對|好|確認|願意|繼續|訂|繼續訂房|yes)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|no)/.test(lowerMessage)) intents.add('deny');

        // 會員意圖
        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');

        // 資訊意圖
        if (/(價格|價錢|多少錢|房價|費用|收費|促銷|優惠)/.test(lowerMessage)) intents.add('pricing');

        // 非訂房意圖（會觸發流程暫停）
        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵|交通)/,
            'restaurant': /(餐廳|用餐|午餐|晚餐|美食|吃)/,
            'attractions': /(景點|逛街|導覽|玩|旅遊)/,
            'facilities': /(設施|泳池|健身房|spa|按摩)/,
            'weather': /(天氣|氣溫|下雨|溫度)/,
            'modification': /(修改|取消訂單|改期)/,
            'emergency': /(救命|火災|小偷|警察|緊急)/
        };

        for (const intent in nonBookingIntentsMap) {
            if (nonBookingIntentsMap[intent].test(lowerMessage)) {
                intents.add(intent);
            }
        }

        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }

    static containsDatePatterns(message) {
        // 簡化日期判斷，防止誤判
        const datePatterns = [
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    // 簡化並優化日期解析 (O1)
    static parseDate(text) {
        const now = dayjs().startOf('day');
        let targetDate = null;
        let nights = null;

        // 1. 處理相對日期
        if (text.includes('今天') || text.includes('今晚') || text.includes('今夜')) {
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        // 2. 處理絕對日期 (例如 12月25日)
        const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日?/);
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            let checkYear = now.year();

            // 跨年處理：如果月份在當前月份之前，則設為下一年
            if (month < now.month() + 1) {
                checkYear = now.year() + 1;
            } else if (month === now.month() + 1 && day < now.date()) {
                 // 當月但在今天之前，也設為下一年
                 checkYear = now.year() + 1;
            }

            targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
        }

        // 3. 解析住宿晚數
        const nightsMatch = text.match(/(\d+)[晚夜天]|住.*(\d+)[晚夜天]/);
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
        }

        // 預設住 1 晚
        if (targetDate && targetDate.isValid() && !nights) {
            nights = 1;
        }

        if (targetDate && targetDate.isValid() && targetDate.isSameOrAfter(now)) {
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

        // 1. 解析日期和晚數
        const dateInfo = this.parseDate(message);
        Object.assign(data, dateInfo);

        // 2. 房型
        if (/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/)[0];
        }

        // 3. 人數
        const adultMatch = lowerMessage.match(/(\d+)位大人|(\d+)大/);
        if (adultMatch) {
            data.adultCount = parseInt(adultMatch[1] || adultMatch[2], 10);
        }
        const childMatch = lowerMessage.match(/(\d+)位兒童|(\d+)小/);
        if (childMatch) {
            data.childCount = parseInt(childMatch[1] || childMatch[2], 10);
        }

        // 4. 聯絡方式 - NAME & EMAIL
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            let extractedName = nameMatch[1] || nameMatch[2];
            if (extractedName && extractedName.length >= 2 && !/(訂房|本人|我是)/.test(extractedName)) {
                data.name = extractedName.trim();
            }
        }
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
            data.email = emailMatch[0];
        }

        // 5. 會員帳號/手機號碼
        const memberMatch = message.match(/(\d{8,12})|([A-Za-z0-9]{5,10})/);
        if (memberMatch) {
            // 避免將電話號碼誤判為會員帳號，這裡只在明確要求輸入時使用
            data.memberAccount = memberMatch[0];
        }

        // 6. 房間間數
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) {
            data.roomCount = parseInt(roomCountMatch[1], 10);
        }

        // 預設值
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
}

// ---------------------------------------------
// 4. 訂房流程控制器 (BookingFlowController)
// ---------------------------------------------

class BookingFlowController {
    static getFlow() {
        return flowLoader.getFlow();
    }

    /**
     * 【動態價格計算和庫存檢查】
     * @param {object} data - 儲存收集到的數據和價格計算結果
     * @returns {{success: boolean, totalPrice: number | null, errorMessage: string | null, oos: boolean | undefined}}
     */
    static calculatePrice(data) {
        const { 
            roomType, 
            checkInDate, 
            nights = 1, 
            adultCount = 1, 
            childCount = 0, 
            roomCount = 1,
            memberAccount
        } = data;
        
        // --- 1. 數據完整性檢查 ---
        if (!roomType || !ROOM_RATES[roomType] || !checkInDate || nights <= 0 || roomCount <= 0 || adultCount <= 0) {
            return { success: false, errorMessage: "價格計算所需的數據不完整或無效 (請檢查房型、日期、晚數、房間數、大人數)。" };
        }
        
        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;
        
        // --- 2. 逐晚檢查庫存與動態計算房價 ---
        for (let i = 0; i < nights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD'); 
            const dayOfWeek = currentDate.day(); // 0 (Sun) - 6 (Sat)
            
            // a) 庫存檢查 (O2: 使用定義的預設庫存)
            const availableRooms = VIRTUAL_INVENTORY[dateKey] ? VIRTUAL_INVENTORY[dateKey][roomType] : DEFAULT_ROOM_INVENTORY; 
            
            if (roomCount > availableRooms) {
                // 庫存不足，回傳錯誤訊息和 OOS 標記
                return { 
                    success: false, 
                    errorMessage: `抱歉，您選擇的 **${roomType}** 在 **${currentDate.format('YYYY/MM/DD')}** 僅剩 **${availableRooms} 間**。`,
                    oos: true // Out Of Stock 標記
                };
            }

            // b) 動態價格計算
            let baseRate = ROOM_RATES[roomType];
            let priceMultiplier = 1;
            
            // 判斷是否為週末 (週五=5, 週六=6)
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                priceMultiplier = WEEKEND_MULTIPLIER;
            }

            const nightlyRoomPrice = baseRate * priceMultiplier;
            totalRoomPrice += nightlyRoomPrice * roomCount;

            // 移至下一晚
            currentDate = currentDate.add(1, 'day');
        }
        
        // --- 3. 計算附加費用 ---
        const totalChildFee = (childCount || 0) * CHILD_FEE_PER_NIGHT * nights;
        
        // 房費總價 (不含折扣，不含兒童加價)
        data.totalRoomPrice = Math.round(totalRoomPrice).toFixed(0);
        data.childCost = Math.round(totalChildFee).toFixed(0);

        // 原始總價 (房費 + 兒童加價)
        let total = totalRoomPrice + totalChildFee;
        data.totalPrice = Math.round(total).toFixed(0);

        // 4. 應用會員折扣
        let discountedPrice = total;
        let isMemberDiscount = !!VIRTUAL_MEMBERS[memberAccount];
        
        if (isMemberDiscount) {
            const memberInfo = VIRTUAL_MEMBERS[memberAccount];
            const discountRate = memberInfo.discount || 0.9; 
            discountedPrice *= discountRate;
            data.discountRate = ((1 - discountRate) * 100).toFixed(0);
            data.memberLevel = memberInfo.level;
            data.newTotalPrice = Math.round(discountedPrice).toFixed(0); 
        } else {
            data.discountRate = '0';
            data.memberLevel = '無';
            data.newTotalPrice = data.totalPrice; // 沒有折扣時，新總價等於原價
        }
        
        // 5. 最終價格 (Final Price)
        const finalPrice = Math.round(discountedPrice);
        data.finalPrice = finalPrice.toFixed(0); 

        return { success: true, totalPrice: finalPrice };
    }
}

// 替換 Prompt 中的變數
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        const value = data[key] === undefined || data[key] === null ? '' : data[key];
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}

// ---------------------------------------------
// 5. 規則引擎 (RuleEngine)
// ---------------------------------------------

class RuleEngine {
    /**
     * 主處理函數：接收用戶輸入並返回回應
     */
    static async processRules({ sessionId, userMessage }) {
        const session = sessionManager.getSession(sessionId);
        const intents = SmartIntentClassifier.classify(userMessage);
        
        // 將實體解析結果與 Session 數據合併
        const extractedEntities = SmartIntentClassifier.extractEntities(userMessage);
        Object.assign(session.collectedData, extractedEntities);
        
        // 更新 Session 中的用戶輸入和意圖
        sessionManager.updateSession(sessionId, userMessage, intents);
        
        // 執行規則
        const result = await RuleEngine.process(intents, session, userMessage);

        // 執行結果後處理
        if (result.shouldProcess) {
            // 更新 session 狀態
            if (result.nextStep) {
                session.currentStep = result.nextStep;
            }

            let geminiResponse = '';
            // 只有在流程中允許自由問答時才呼叫 Gemini (O4: 簡化邏輯)
            if (!result.skipGeminiCall) {
                geminiResponse = await ResponseGenerator.getGeminiResponse(session, userMessage);
            }

            // 合併流程回應和 Gemini 回應
            let finalResponse = result.response;
            if (geminiResponse) {
                if (session.currentStep === 'paused_waiting_for_resume') {
                    // 暫停模式下，將 Gemini 回覆插在流程引導訊息之前
                    finalResponse = `👉 **AI 助理回覆**：\n${geminiResponse}\n\n---\n**訂房流程引導**：\n${result.response}`;
                } else if (session.currentStep === 'handle_general_inquiry' || intents.includes('general_inquiry')) {
                    // 純閒聊
                    finalResponse = geminiResponse;
                }
            }

            // 記錄助手的最終回應
            sessionManager.addAssistantResponse(sessionId, finalResponse, result.richCard);

            return {
                reply: finalResponse,
                nextStateKey: session.currentStep,
                data: session.collectedData,
                richCard: result.richCard
            };
        }

        // Fallback
        return {
             reply: "抱歉，系統無法處理您的請求，請重新開始。",
             nextStateKey: 'init',
             data: session.collectedData
        };
    }

    // 執行規則集
    static async process(intents, session, message) {
        
        // 規則優先級：緊急 > 流程恢復 > 流程控制 > 閒聊
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule, // 這是主要的流程控制規則
            this.generalRule
        ];

        for (const rule of rules) {
            // 注意：這裡的 rule 可能是一個同步函數，所以用 await 確保
            const result = await rule.call(this, intents, session, message); 
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 1: 緊急事件處理 (最高優先級) */
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency')) {
            session.currentStep = 'end_conversation'; // 結束流程
            return { 
                shouldProcess: true, 
                priority: 100,
                response: `🚨 **緊急通知**：請立即撥打 119 或飯店櫃檯 (分機 9)。請提供您的房號及確切情況，我們將在最短時間內提供協助！`,
                nextStep: 'end_conversation',
                skipGeminiCall: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    /** 規則 2: 訂房流程規則 (核心邏輯) */
    static async bookingFlowRule(intents, session, message) {
        const flow = flowLoader.getFlow();
        const hasBookingIntent = intents.includes('booking');
        const isAffirm = intents.includes('affirm');
        const isDeny = intents.includes('deny');
        const data = session.collectedData;
        let currentStateKey = session.currentStep;

        // 非訂房意圖 (用於流程暫停)
        const nonBookingIntents = [
            'transfer', 'restaurant', 'attractions', 'shopping',
            'facilities', 'weather', 'modification'
        ];
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));

        // 1. 流程重置或初始狀態
        if (currentStateKey === 'booking_complete' || currentStateKey === 'end_conversation' || currentStateKey === 'init') {
            if (hasBookingIntent) {
                 // 如果用戶在結束後重新開始訂房
                session.currentStep = flow.initial_state || 'init';
                session.collectedData = {}; // 清空數據
            } else if (currentStateKey !== 'init') {
                return { shouldProcess: false, priority: 0 }; // 閒聊，交給 Gemini
            }
        }
        currentStateKey = session.currentStep;
        let currentState = flow.states[currentStateKey];

        // 2. 流程恢復處理 (用戶回復 "繼續" 或 "確認")
        if (currentStateKey === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                currentStateKey = session.pausedState; // 恢復到暫停前的狀態
                session.pausedState = null;
                session.currentStep = currentStateKey;
                console.log(`🔄 恢復流程到: ${currentStateKey}`);
                // 重新處理用戶的"繼續"或後續輸入
                currentState = flow.states[currentStateKey];
            } else {
                // 如果用戶在暫停狀態，讓它走 AI 自由問答
                return { shouldProcess: false, priority: 0 }; 
            }
        }

        // 3. 流程暫停邏輯 (非 init 狀態下切換主題)
        if (currentStateKey && 
            currentStateKey !== 'init' && 
            currentStateKey !== 'paused_waiting_for_resume' && 
            (isSwitchingTopic || intents.includes('general_inquiry'))) {

            console.log(`⚠️ 用戶在流程中 (State: ${currentStateKey}) 詢問了不相關的主題。暫停流程。`);
            session.pausedState = currentStateKey; // 儲存當前狀態
            
            return {
                shouldProcess: true,
                priority: 99,
                response: `好的，我暫時將訂房流程放在一邊。請告訴我您想知道的資訊。\n\n**當您準備好繼續時，請回覆『繼續』或點擊按鈕。**`,
                richCard: {
                    "type": "button_list",
                    "title": "要繼續訂房嗎？",
                    "buttons": [
                        { "text": "✅ 繼續訂房", "value": "繼續訂房" },
                        { "text": "❌ 取消流程", "value": "取消" }
                    ]
                },
                nextStep: 'paused_waiting_for_resume',
                skipGeminiCall: false // 允許交給 Gemini 進行問答，之後流程恢復
            };
        }

        // 4. 流程內部轉移與邏輯處理
        let nextStateKey = currentStateKey;

        // A. 意圖轉移檢查
        for (const intent of intents) {
            if (currentState.intents && currentState.intents[intent]) {
                nextStateKey = currentState.intents[intent];
                break;
            }
        }

        // B. 實體收集檢查
        let allEntitiesCollected = true;
        if (currentState.entities && currentState.next_state) {
            allEntitiesCollected = currentState.entities.every(
                entity => data[entity] !== undefined && data[entity] !== null
            );

            if (allEntitiesCollected) {
                // 如果實體收齊，即使沒有明確的意圖，也轉到 next_state
                nextStateKey = currentState.next_state;
            }
        }

        // C. 流程特殊邏輯處理 (在狀態轉移時觸發)
        if (nextStateKey === 'final_summary_and_payment') {
            // 進入最終總結狀態前，執行價格/庫存檢查
            const priceResult = BookingFlowController.calculatePrice(data);

            if (!priceResult.success) {
                // 庫存不足 (OOS) 或其他錯誤
                const errorPrompt = priceResult.oos 
                    ? priceResult.errorMessage + " 請修正人數、晚數或選擇其他日期/房型。"
                    : priceResult.errorMessage || "抱歉，計算價格或檢查庫存時發生錯誤。";
                
                // 庫存不足，回溯到收集房型日期的步驟
                nextStateKey = 'collect_room_and_dates'; 
                
                return {
                    shouldProcess: true,
                    priority: 97,
                    response: errorPrompt,
                    nextStep: nextStateKey, 
                    richCard: null,
                    skipGeminiCall: true
                };
            }
            
            // 價格計算成功，動態生成最終確認提示
            let confirmPrompt = `🎉 您的訂房資訊如下：\n`;
            confirmPrompt += `房型：**${data.roomType}** (${data.roomCount} 間) / 入住：**${data.checkInDate}** / 晚數：**${data.nights} 晚**\n`;
            confirmPrompt += `人數：**${data.adultCount} 大 ${data.childCount} 小**\n`;

            if (data.discountRate && data.discountRate !== '0') {
                 confirmPrompt += `會員折扣：**${data.memberLevel}** 享 **${data.discountRate}%** 折扣\n`;
                 confirmPrompt += `原總價：NT$ ${data.totalPrice} / 折扣後：NT$ ${data.newTotalPrice}\n`;
            } else {
                 confirmPrompt += `總價：NT$ ${data.finalPrice}\n`;
            }
            confirmPrompt += `\n**請問是否確認訂房？**`;
            
            // 更新狀態和回應
            flow.states['final_summary_and_payment'].prompt = confirmPrompt;
        }

        // 5. 輸出回應
        if (nextStateKey !== currentStateKey || (nextStateKey === currentStateKey && allEntitiesCollected === false)) {
            // 狀態發生轉移 或 實體未收齊且需要回應
            const nextState = flow.states[nextStateKey];
            
            // 如果是最終確認，prompt 已在 C 步驟被替換
            const responsePrompt = nextState.prompt ? interpolatePrompt(nextState.prompt, data) : nextState.fallback;

            return {
                shouldProcess: true,
                priority: 95,
                response: responsePrompt,
                nextStep: nextStateKey,
                richCard: nextState.richCard || null,
                // 如果轉移到 handle_general_inquiry，才允許呼叫 Gemini
                skipGeminiCall: nextStateKey !== 'handle_general_inquiry' && nextStateKey !== 'paused_waiting_for_resume' 
            };
        }

        // 流程結束後的閒聊處理
        if (currentState.end) {
             return { shouldProcess: false, priority: 0 };
        }

        // 流程內，但訊息無法驅動流程 (例如：重複回答)，進入閒聊或使用 fallback
        const responsePrompt = currentState.fallback ? interpolatePrompt(currentState.fallback, data) : currentState.prompt;
        
        return {
            shouldProcess: true,
            priority: 95,
            response: responsePrompt,
            nextStep: currentStateKey,
            richCard: currentState.richCard || null,
            skipGeminiCall: true
        };
    }
    
    /** 規則 3: 一般詢問與閒聊 (最低優先級) */
    static generalRule(intents, session, message) {
         // 如果沒有任何流程規則被觸發，則交給 Gemini 處理
        if (intents.includes('general_inquiry') || session.currentStep === 'handle_general_inquiry') {
            return { 
                shouldProcess: true, 
                priority: 1, 
                response: '我正在思考...', 
                nextStep: session.currentStep,
                skipGeminiCall: false // 呼叫 Gemini API
            };
        }
        return { shouldProcess: false, priority: 0 };
    }
}

// ---------------------------------------------
// 6. Gemini 回應生成器 (ResponseGenerator)
// ---------------------------------------------

class ResponseGenerator {
    /**
     * @param {object} session - 當前會話物件
     * @returns {string} - Gemini 的文字回應
     */
    static async getGeminiResponse(session, userMessage) {
        if (!apiUrl) return "Gemini API Key 未設定，無法提供 AI 自由問答。";

        // 建立給 Gemini 的對話歷史
        const contents = session.conversationHistory.map(item => ({
            role: item.role,
            parts: [{ text: item.message }]
        }));

        // 移除最後一筆 model 回應 (如果有的話)
        if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
             contents.pop();
        }

        // 設置系統指令 (System Instruction)
        const systemInstruction = CHAT_INSTRUCTIONS + (session.pausedState ? `\n當前訂房流程已暫停在步驟：**${session.pausedState}**。請提醒用戶，可以回復『繼續』來恢復流程。` : '');

        const payload = {
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.5,
                topP: 0.9,
            }
        };

        // 帶有重試機制 (Retry Mechanism) 的 API 呼叫
for (let i = 0; i < MAX_RETRIES; i++) { // <-- 補齊迴圈條件
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const json = await response.json();
            return json.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，AI 助理未能理解您的問題。";
        }

        // 處理 API 錯誤 (例如 429 Rate Limit)
        const errorText = await response.text();
        console.error(`❌ Gemini API 回應錯誤 (Status: ${response.status})：${errorText}`);

        if (response.status === 429 && i < MAX_RETRIES - 1) {
            // Rate Limit 或其他可重試錯誤，等待並重試
            const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, i);
            console.log(`等待 ${backoffTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
        }
        
        return `⚠️ 由於 API 錯誤 (${response.status})，無法提供 AI 自由問答。`;

    } catch (error) {
        console.error("❌ 呼叫 Gemini API 失敗:", error.message);
        if (i < MAX_RETRIES - 1) {
            const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, i);
            console.log(`等待 ${backoffTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
        }
        return "⚠️ 網路連線錯誤，無法提供 AI 自由問答。";
    }
}
return "⚠️ 由於多次嘗試失敗，AI 助理暫時無法回應。"; // 達到最大重試次數

// 結束 getGeminiResponse 函數
} 
} // 結束 ResponseGenerator 類別

// ---------------------------------------------
// 7. EXPRESS 路由 (API Endpoints)
// ---------------------------------------------

app.get('/api/health', (req, res) => {
    res.status(200).send({ status: 'ok', api: 'ai-hotel-assistant-builder' });
});

app.post('/api/chat', async (req, res) => {
    // 檢查是否有 session 和 user message (這是您 log 看到的錯誤訊息來源)
    const { sessionId, userMessage } = req.body; 

    if (!sessionId || !userMessage) {
        // 這是您在 Render Log 裡會看到的錯誤訊息
        console.warn('⚠️ Missing sessionId or userMessage in request body.');
        return res.status(400).json({ 
            error: 'Missing sessionId or userMessage. 請確認請求主體格式是否正確。' 
        });
    }

    try {
        const result = await RuleEngine.processRules({ sessionId, userMessage });

        // 成功的回應
        res.status(200).json({
            reply: result.reply,
            nextState: result.nextStateKey,
            data: result.data,
            richCard: result.richCard || null
        });

    } catch (error) {
        console.error("❌ 處理聊天請求時發生未預期的錯誤:", error);
        res.status(500).json({ 
            error: '發生未預期的伺服器錯誤，請稍後再試。' 
        });
    }
});


// ---------------------------------------------
// 8. 啟動伺服器
// ---------------------------------------------

app.listen(PORT, HOST, () => {
    console.log(`✅ 伺服器已啟動: http://${HOST}:${PORT}`);
    if (!apiKey) {
        console.warn("⚠️ GEMINI_API_KEY 未設定，將無法使用 AI 自由問答功能。");
    }
});

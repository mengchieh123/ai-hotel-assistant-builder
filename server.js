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
const apiUrl = `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// --- 虛擬資料庫 (優化項目 1, 2, 3 的數據準備) ---
const ROOM_RATES = {
    '標準雙人房': 2200,
    '豪華客房': 3200,
    '行政套房': 4800,
    '家庭四人房': 4500,
};

const WEEKEND_MULTIPLIER = 1.2; // 週末（週五、週六）加價 20%
const CHILD_FEE_PER_NIGHT = 500; // 兒童加價 NT$500/晚 (用於動態計算，覆蓋舊的 300)

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
    // ... 更多日期數據
};

// 虛擬會員數據
const VIRTUAL_MEMBERS = {
    '123456789': { isMember: true, level: 'Gold', discount: 0.8 }
};

// ---------------------------------------------
// 1. EXPRESS 中間件與靜態檔案
// ---------------------------------------------

// 處理跨域請求
app.use(cors());
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
                        "booking": "collect_room_and_dates",
                        "general_inquiry": "handle_general_inquiry"
                    },
                    "fallback": "抱歉，我沒聽懂您的意思，請告訴我是想預訂房間或查詢其他資訊？"
                },
                "collect_room_and_dates": {
                    "prompt": "好的，我們將開始預訂。請問您想預訂的【房型】、預計【入住日期】和【住宿晚數】？",
                    "entities": ["roomType", "checkInDate", "nights"],
                    "next_state": "ask_guest_count",
                    "fallback": "請提供房型、入住日期及住宿晚數，我會為您查詢空房與價格。"
                },
                "ask_guest_count": {
                    "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住呢？",
                    "entities": ["adultCount", "childCount"],
                    "next_state": "confirm_booking",
                    "fallback": "請提供大人及兒童的人數。"
                },
                "confirm_booking": {
                    "prompt": "【最終確認】總價：NT$ {finalPrice}。請問是否確認訂房？",
                    "intents": { "affirm": "booking_complete", "deny": "end_conversation" },
                    "fallback": "請確認訂房資訊，並回答『確認』或『取消』。"
                },
                "booking_complete": { "prompt": "🎉 訂房完成！", "end": true },
                "end_conversation": { "prompt": "感謝您的使用。", "end": true },
                "handle_general_inquiry": { "prompt": "請提供更多細節，我會盡力回答您。", "allow_gemini_call": true }
            }
        };
    }
}

const flowLoader = new FlowConfigLoader('dialogue_flow.json');
const sessionManager = new (class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                // 使用 flowLoader.DIALOGUE_FLOW.initial_state 或 'init' 作為初始狀態
                currentStep: flowLoader.DIALOGUE_FLOW.initial_state || 'init', 
                bookingState: null,
                collectedData: {
                    // 為了避免 interpolator 錯誤，初始化一些價格相關的變數
                    finalPrice: '0', 
                    newTotalPrice: '0',
                    totalPrice: '0',
                    totalPriceNoChild: '0',
                    childCost: '0',
                    paymentMethod: '未選擇'
                }, 
                userType: 'unknown',
                askedTopics: [],
                conversationHistory: [],
                lastActive: new Date().toISOString(),
                pausedState: null
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
        (intents || []).forEach(intent => {
            if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
        });
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
})();

// ---------------------------------------------
// 3. 智能意圖分類器 (SmartIntentClassifier)
// ---------------------------------------------

class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();

        // 核心訂房意圖
        if (/(訂房|預訂|入住|房間|房型|幫我訂|想要訂|預約房間|我要訂房|book)/.test(lowerMessage) ||
            /(豪華客房|標準雙人房|行政套房|海景|家庭|一間|兩間|.*月.*日|.*天)/.test(lowerMessage)) {
            intents.add('booking');
        }

        // 確認/拒絕意圖
        if (/(是|對|好|確認|願意|繼續|訂|要早餐|繼續訂房)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|不要早餐)/.test(lowerMessage)) intents.add('deny');

        // 按鈕值處理
        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');
        if (lowerMessage.includes('不是會員')) intents.add('deny'); // 這裡處理會員拒絕按鈕

        // 付款意圖
        if (lowerMessage.includes('線上付款')) intents.add('online_payment');
        if (lowerMessage.includes('現場結帳')) intents.add('onsite_payment');

        // 早餐意圖 (配合您的流程，需要區分是否為會員)
        const isMemberContext = sessionManager.getSession(sessionManager.currentSessionId)?.collectedData.memberAccount;
        if (/(要早餐|加購早餐)/.test(lowerMessage)) {
             intents.add(isMemberContext ? 'member_yes_meal_yes' : 'member_no_meal_yes');
        } else if (/(不要早餐|不加購早餐)/.test(lowerMessage)) {
            intents.add(isMemberContext ? 'member_yes_meal_no' : 'member_no_meal_no');
        }

        // 資訊意圖
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡)/.test(lowerMessage)) intents.add('ask_promotion');

        // 非訂房意圖（會觸發流程暫停）
        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵|交通)/,
            'restaurant': /(餐廳|用餐|午餐|晚餐|美食|吃)/,
            'attractions': /(景點|逛街|導覽|玩|旅遊)/,
            'shopping': /(購物|買東西|商店)/,
            'facilities': /(設施|泳池|健身房|spa|按摩)/,
            'weather': /(天氣|氣溫|下雨|溫度)/,
            'itinerary': /(行程|規劃|安排)/,
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
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /今晚|今天|明天|後天|週末|下週|月底|週[一二三四五六日]/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    static parseDate(text) {
        const now = dayjs().startOf('day');
        let targetDate = null;
        let nights = null;

        if (this.containsDatePatterns(text)) {
            const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}|(\d{1,2}月\d{1,2}日?)/);
            const dateStr = dateMatch ? dateMatch[0] : '';
            const year = now.year();

            if (dateStr.includes('月')) {
                const parts = dateStr.match(/(\d{1,2})月(\d{1,2})日?/);
                if (parts) {
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    let currentMonth = dayjs().month() + 1;
                    let checkYear = year;

                    if (month < currentMonth || (month === currentMonth && day < dayjs().date())) {
                        // 跨年處理
                        checkYear = year + 1;
                    }
                    targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
                }
            } else if (dateStr.match(/\d{4}/)) {
                targetDate = dayjs(dateStr, ['YYYY/MM/DD', 'YYYY-MM-DD']).startOf('day');
            } else {
                if (dateStr.match(/\d{1,2}[/\-]\d{1,2}/)) {
                    const parts = dateStr.split(/[\/\-]/).map(n => parseInt(n, 10));
                    const month = parts.length > 1 ? parts[0] : null;
                    const day = parts.length > 1 ? parts[1] : parts[0];

                    if (month && day) {
                        let currentMonth = dayjs().month() + 1;
                        let checkYear = year;
                        if (month < currentMonth || (month === currentMonth && day < dayjs().date())) {
                            checkYear = year + 1;
                        }
                        targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
                    }
                }
            }
        } else if (text.includes('今天') || text.includes('今晚') || text.includes('今夜')) {
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        // 解析住宿晚數
        const nightsMatch = text.match(/(\d+)[晚夜天]|住.*(\d+)[晚夜天]/);
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
        }

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

        // 1. 解析日期
        const dateInfo = this.parseDate(message);
        if (dateInfo.checkInDate) {
            data.checkInDate = dateInfo.checkInDate;
            data.nights = dateInfo.nights;
        }

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

        // 4. 聯絡方式 - NAME
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            let extractedName = nameMatch[1] || nameMatch[2];
            if (extractedName && extractedName.length >= 2 && !extractedName.includes('訂房') && !extractedName.includes('本人') && !extractedName.includes('我是')) {
                data.name = extractedName.trim();
            }
        }

        // 5. 聯絡方式 - EMAIL
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
            data.email = emailMatch[0];
        }

        // 6. 會員帳號/手機號碼 (用於 login_member_account 狀態)
        const memberMatch = message.match(/(\d{8,12})|([A-Za-z0-9]{5,10})/);
        if (memberMatch) {
            data.memberAccount = memberMatch[0];
        }

        // 7. 房間間數
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) {
            data.roomCount = parseInt(roomCountMatch[1], 10);
        }

        // 8. 促銷代碼 (雖然您的流程沒用，但保留解析能力)
        const promoCodeMatch = message.match(/\b([A-Z0-9]{4,10})\b/);
        if (promoCodeMatch) {
            if (!/^\d{4}$/.test(promoCodeMatch[1])) {
                data.promoCode = promoCodeMatch[1].toUpperCase();
            }
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
        return flowLoader.DIALOGUE_FLOW;
    }

    static getCurrentState(session) {
        const flow = this.getFlow();
        const stateKey = session.bookingState || 'init';

        if (stateKey === 'paused_waiting_for_resume' && session.pausedState) {
            return flow.states[session.pausedState];
        }
        return flow.states[stateKey];
    }

    /**
     * 【新的動態價格計算和庫存檢查】
     * @param {object} data - 儲存收集到的數據和價格計算結果
     * @param {boolean} isMemberDiscount - 是否應用會員折扣
     * @returns {{success: boolean, totalPrice: number | null, errorMessage: string | null, oos: boolean | undefined}}
     */
    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType, checkInDate, nights, adultCount, childCount, roomCount } = data;

        // --- 1. 數據完整性檢查 ---
        if (!roomType || !checkInDate || !nights || !roomCount || !adultCount) {
            return { success: false, errorMessage: "價格計算所需的數據不完整。" };
        }
        if (nights <= 0 || roomCount <= 0) {
             return { success: false, errorMessage: "晚數與房間數必須大於零。" };
        }
        
        let currentDate = dayjs(checkInDate, 'YYYY/MM/DD');
        let totalRoomPrice = 0;
        
        // --- 2. 逐晚檢查庫存與動態計算房價 (核心優化) ---
        for (let i = 0; i < nights; i++) {
            const dateKey = currentDate.format('YYYY-MM-DD'); 
            const dayOfWeek = currentDate.day(); // 0 (Sun) - 6 (Sat)
            
            // a) 庫存檢查
            // 假設未定義日期庫存為 10
            const availableRooms = VIRTUAL_INVENTORY[dateKey] ? VIRTUAL_INVENTORY[dateKey][roomType] : 10; 
            
            if (roomCount > availableRooms) {
                // 庫存不足，回傳錯誤訊息和 OOS 標記
                return { 
                    success: false, 
                    errorMessage: `抱歉，您選擇的 **${roomType}** 在 **${dateKey}** 僅剩 **${availableRooms} 間**。請減少房間數或選擇其他房型/日期。`,
                    oos: true // Out Of Stock 標記
                };
            }

            // b) 動態價格計算
            let baseRate = ROOM_RATES[roomType] || ROOM_RATES['豪華客房']; // 使用頂部定義的 ROOM_RATES
            let priceMultiplier = 1;
            
            // 判斷是否為週末 (週五=5, 週六=6)
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                priceMultiplier = WEEKEND_MULTIPLIER; // 使用頂部定義的 WEEKEND_MULTIPLIER
            }

            const nightlyRoomPrice = baseRate * priceMultiplier;
            
            // 計算該晚的總房價 (房間數 * 房價)
            totalRoomPrice += nightlyRoomPrice * roomCount;

            // 移至下一晚
            currentDate = currentDate.add(1, 'day');
        }
        
        // --- 3. 計算附加費用 ---
        const totalChildFee = (childCount || 0) * CHILD_FEE_PER_NIGHT * nights;
        
        // 房費總價 (不含折扣，不含早餐)
        data.totalPriceNoChild = Math.round(totalRoomPrice).toFixed(0);
        data.childCost = Math.round(totalChildFee).toFixed(0);

        // 原始總價 (房費 + 兒童加價)
        let total = totalRoomPrice + totalChildFee;
        data.totalPrice = Math.round(total).toFixed(0);

        // 4. 應用會員折扣
        let discountedPrice = total;
        if (isMemberDiscount) {
            const discountRate = VIRTUAL_MEMBERS[data.memberAccount]?.discount || 0.9; // 預設 9折
            discountedPrice *= discountRate;
            data.discountRate = (1 - discountRate) * 100;
            data.newTotalPrice = Math.round(discountedPrice).toFixed(0); 
        } else {
            data.newTotalPrice = data.totalPrice; // 沒有折扣時，新總價等於原價
        }
        
        // 5. 計算早餐費
        data.breakfastCost = 0;
        if (data.hasBreakfast) {
            const BREAKFAST_FEE = 150;
            const totalGuests = (adultCount || 0) + (childCount || 0);
            const breakfastCost = totalGuests * BREAKFAST_FEE * nights;
            data.breakfastCost = Math.round(breakfastCost).toFixed(0);
            
            discountedPrice += breakfastCost; 
        }

        // 6. 最終價格 (Final Price)
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
        // 使用 {key} 和 ${key} 兩種格式進行替換
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
    static process(intents, session, message) {
        // 將當前 sessionId 存儲在 sessionManager 中，供 SmartIntentClassifier 使用
        sessionManager.currentSessionId = session.sessionId; 
        
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule,
            this.generalRule
        ];

        for (const rule of rules) {
            const result = rule(intents, session, message);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name || 'Anonymous Rule'} (P: ${result.priority})`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // 訂房流程規則
    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW;
        const hasBookingIntent = intents.includes('booking');
        const isAffirm = intents.includes('affirm');
        
        // 非訂房意圖 (用於流程暫停)
        const nonBookingIntents = [
            'transfer', 'restaurant', 'attractions', 'shopping',
            'facilities', 'weather', 'itinerary', 'modification'
        ];
        
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));

        // 初始化或重置流程
        if (!session.bookingState || session.bookingState === 'welcome') {
             session.bookingState = flow.initial_state || 'init';
        }
        
        // 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
            if (hasBookingIntent) {
                session.bookingState = flow.initial_state || 'init';
                session.collectedData = {};
            } else {
                return { shouldProcess: false, priority: 0 }; // 閒聊，交給 Gemini
            }
        }
        
        // 流程恢復處理 (用戶回復 "繼續" 或 "確認")
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            if (isAffirm) {
                session.bookingState = session.pausedState;
                session.pausedState = null;
                console.log(`🔄 恢復流程到: ${session.bookingState}`);
            } else if (intents.includes('deny')) {
                session.bookingState = 'end_conversation';
                session.pausedState = null;
                return {
                    shouldProcess: true,
                    priority: 98,
                    response: flow.states['end_conversation'].prompt,
                    nextStep: 'end_conversation',
                    updateSession: true
                };
            } else {
                // 如果在暫停狀態，用戶問了問題，讓它走 AI 自由問答，但流程仍處於 paused
                return { shouldProcess: false, priority: 0 };
            }
        }
        
        // 流程暫停邏輯
        if (session.bookingState && 
            session.bookingState !== 'init' && 
            session.bookingState !== 'paused_waiting_for_resume' && 
            (isSwitchingTopic || intents.includes('general_inquiry'))) {

            // 流程暫停，切換到一般問答模式
            console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            
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
                updateSession: true,
                skipGeminiCall: false // 允許交給 Gemini 進行問答，之後流程恢復
            };
        }

        // --- 正常流程處理 ---
        if (session.bookingState) {
            let currentState = flow.states[session.bookingState];
            let nextStateKey = session.bookingState;
            const data = session.collectedData;

            // 提取實體並更新 session
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(data, extractedEntities);

            // 1. 意圖轉移檢查
            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            // 2. 實體收集檢查 (如果意圖轉移失敗，才檢查實體是否收齊)
            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {
                const allEntitiesCollected = currentState.entities.every(
                    entity => data[entity] !== undefined && data[entity] !== null
                );

                if (allEntitiesCollected) {
                    nextStateKey = currentState.next_state;
                } else {
                    // 實體未收集完，停留在當前狀態，並返回 prompt
                    return {
                        shouldProcess: true,
                        priority: 95,
                        response: interpolatePrompt(currentState.prompt, data),
                        nextStep: session.bookingState,
                        updateSession: true,
                        richCard: currentState.richCard || null
                    };
                }
            }
            
            // --- 狀態間的特殊邏輯處理 ---
            
            // A. check_availability_and_price 狀態：動態計算價格和庫存檢查 (優化項目 1, 2)
if (currentStateKey === 'ask_guest_count' && allEntitiesCollected) {
    // 進入 check_availability_and_price 狀態，先進行價格計算和庫存檢查
    const priceResult = BookingFlowController.calculatePrice(data, data.memberAccount ? true : false);
    
    if (!priceResult.success) {
        // 庫存不足 (OOS) 或其他錯誤
        const fallbackPrompt = priceResult.oos ? priceResult.errorMessage : currentState.fallback;

        return {
            shouldProcess: true,
            priority: 95,
            response: fallbackPrompt + " 請修正人數、晚數或選擇其他日期/房型。",
            nextStep: 'collect_room_and_dates', // 回到收集房型和日期的步驟
            updateSession: true,
            skipGeminiCall: true
        };
    }
    
    // 價格計算成功，轉到下一狀態 (check_availability_and_price)
    nextStateKey = currentState.next_state; 
}
            
            // B. login_member_account 狀態：檢查會員帳號是否收到
            if (session.bookingState === 'login_member_account' && nextStateKey === 'apply_member_discount') {
                if (!data.memberAccount) {
                    return {
                        shouldProcess: true,
                        priority: 95,
                        response: flow.states['login_member_account'].fallback,
                        nextStep: 'login_member_account',
                        updateSession: true
                    };
                }
            }
            
            // C. apply_member_discount 狀態：應用折扣並計算新總價
            if (nextStateKey === 'apply_member_discount') {
                // calculatePrice 會將 newTotalPrice 和 finalPrice 存入 data
                BookingFlowController.calculatePrice(data, true); 
            }
            
            // D. confirm_member_and_meal / apply_member_discount (到問付款方式前)
            if (session.bookingState === 'confirm_member_and_meal' || session.bookingState === 'apply_member_discount') {
                if (nextStateKey === 'ask_payment_method') {
                    const isMember = data.memberAccount ? true : false;
                    
                    // 確定是否加購早餐
                    data.hasBreakfast = intents.includes('member_yes_meal_yes') || intents.includes('member_no_meal_yes'); 
                    
                    // 重新計算最終價格 (包含折扣和早餐費)
                    BookingFlowController.calculatePrice(data, isMember); 
                }
            }
            
            // E. ask_payment_method 狀態：記錄付款方式
            if (session.bookingState === 'ask_payment_method' && nextStateKey === 'confirm_booking') {
                if (intents.includes('online_payment')) {
                    data.paymentMethod = '線上付款 (即時確認)';
                    data.paymentMessage = '您的訂單已付款並立即確認。';
                } else if (intents.includes('onsite_payment')) {
                    data.paymentMethod = '現場結帳 (保留至 24H)';
                    data.paymentMessage = '您的訂單將保留至入住當日 24 小時。';
                }
            }
            
            // F. booking_complete 狀態：生成訂單編號
            if (nextStateKey === 'booking_complete') {
                data.orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            }


            // 轉移狀態
            session.bookingState = nextStateKey;
            let nextState = flow.states[session.bookingState];

            // 格式化回覆
            let responseText = interpolatePrompt(nextState.prompt, data);
            let richCard = nextState.richCard || null;

            return {
                shouldProcess: true,
                priority: 95,
                response: responseText,
                richCard: richCard,
                nextStep: session.bookingState,
                updateSession: true,
                // 如果流程狀態允許，就跳過 GemniCall，否則交給 generalRule
                skipGeminiCall: !nextState.allow_gemini_call 
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 緊急規則
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency') || /(救命|火災|小偷|警察|救護車)/.test(message.toLowerCase())) {
            session.bookingState = null;
            session.pausedState = null;
            return {
                shouldProcess: true,
                priority: 100,
                response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：02-1199-1199\n• 聯絡前台：分機 0\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！",
                skipGeminiCall: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 一般規則 (如果沒有其他高優先級規則觸發，將執行 AI 自由問答)
    static generalRule(intents, session, message) {
         // 如果在暫停狀態，讓流程規則接管提示，這裡不返回歡迎詞
         if (session.bookingState === 'paused_waiting_for_resume') {
            return { shouldProcess: false, priority: 0 }; 
         }
         
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理，請問今天需要什麼協助呢？"
        };
    }
}

// ---------------------------------------------
// 6. API 通訊工具
// ---------------------------------------------

async function fetchWithRetry(url, options, attempt = 1) {
    // ... (fetchWithRetry 函式保持不變)
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            
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
// 7. 回應生成器 (ResponseGenerator)
// ---------------------------------------------

class ResponseGenerator {
    
    // 與 Gemini 進行實際通訊
    static async getGeminiResponse(session) {
        if (!apiKey) {
            return "錯誤：未配置 GEMINI_API_KEY。請檢查 .env 檔案。";
        }
        
        const history = session.conversationHistory;
        
        // 確保系統提示足夠強大，以便在非流程中提供準確資訊
        const systemInstruction = `您是海灣麗景酒店的 AI 客服助理 (Bayview Grand Hotel)。您的職責是：
1. **遵循流程控制**：如果用戶處於訂房流程，請勿干預或改變流程狀態。
2. **回答非流程問題**：如果用戶詢問關於酒店設施、交通、景點、天氣等問題，您必須提供簡潔、準確且有幫助的資訊。酒店資訊：
    - 名稱：海灣麗景酒店 (Bayview Grand Hotel)
    - 地理：位於台北市信義區，鄰近捷運站，交通方便。
    - 服務：提供機場接送服務（需預約）。
    - 設施：頂樓有海景無邊際泳池、24H 健身房、Spa 中心。
    - 餐廳：提供台式/西式自助餐，早餐費用為 NT$150/人/天。
    - 房型價格：標準雙人房 (NT$2,200)，豪華客房 (NT$3,200)，行政套房 (NT$4,800)，家庭四人房 (NT$4,500)。
3. **保持語氣**：專業、友善、樂於助人。
4. **輸出格式**：只輸出回覆內容，不要包含任何流程資訊或 JSON 格式。

【當前流程狀態】: ${session.bookingState || '不在流程中'}
【已收集資訊】: ${JSON.stringify(session.collectedData)}
`;

        const contents = [
            {
                role: "user",
                parts: [{ text: systemInstruction }]
            }
        ];
        
        // 只取最後 10 個對話作為歷史記錄
        const relevantHistory = history.slice(-10);
        
        relevantHistory.forEach(item => {
            if (item.role === 'user') {
                 contents.push({ role: "user", parts: [{ text: item.message }] });
            } else if (item.role === 'model') {
                 // 這裡我們只傳遞 AI 的文本回覆，忽略 RichCard
                 contents.push({ role: "model", parts: [{ text: item.message.replace(/\n\n\*\*提醒：訂房流程已暫停[^\*]*\*\*/, '') }] });
            }
        });
        
      const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                // VVV 修正：將 'config' 替換為 'generationConfig' VVV
                generationConfig: {
                    temperature: 0.2, 
                    maxOutputTokens: 1024
                }
                // ^^^ 修正結束 ^^^
            })
        };

        console.log(`📡 正在呼叫 Gemini API... (Session: ${session.sessionId})`);
        
        const response = await fetchWithRetry(apiUrl, options);
        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini Response Error:", data);
            return "抱歉，AI 助理目前無法回答這個問題。請稍後再試。";
        }
    }
}

// ---------------------------------------------
// 8. 聊天處理邏輯函數
// ---------------------------------------------

async function processChatMessage(sessionId, message) {
    // 獲取並更新 Session (記錄用戶訊息)
    const session = sessionManager.getSession(sessionId);
    const intents = SmartIntentClassifier.classify(message);
    sessionManager.updateSession(sessionId, message, intents); 

    // 處理緊急情況或流程
    const ruleResult = RuleEngine.process(intents, session, message);
    
    let reply = '';
    let richCard = null;
    let nextStep = session.bookingState;

    if (ruleResult.shouldProcess && ruleResult.priority >= 90) {
        // 流程或緊急規則處理 (優先級高於 90)
        reply = ruleResult.response;
        richCard = ruleResult.richCard || null;
        nextStep = ruleResult.nextStep || session.bookingState;
        
        // 如果規則結果沒有要求跳過，或者當前狀態允許 Gemini 自由問答 (如 handle_general_inquiry)
        if (!ruleResult.skipGeminiCall && flowLoader.DIALOGUE_FLOW.states[nextStep]?.allow_gemini_call) {
             try {
                // 將流程提示作為系統指令的一部分，讓 Gemini 進行問答
                reply = await ResponseGenerator.getGeminiResponse(session); 
            } catch (e) {
                console.error("Gemini Call Failed:", e);
                reply = "很抱歉，我們的 AI 服務目前無法連接。請檢查您的 API Key 或稍後再試。";
            }
        }
        
    } else {
        // 交給 Gemini 進行一般問答
        try {
            reply = await ResponseGenerator.getGeminiResponse(session); 
        } catch (e) {
            console.error("Gemini Call Failed:", e);
            reply = "很抱歉，我們的 AI 服務目前無法連接。請檢查您的 API Key 或稍後再試。";
        }
        
        // 如果處於暫停狀態，在 AI 回覆後，提醒用戶可以繼續訂房
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
             reply += "\n\n**提醒：訂房流程已暫停。您可以回覆『繼續』來恢復訂房，或點擊下方的按鈕。**";
             richCard = richCard || {
                "type": "button_list",
                "title": "要繼續訂房嗎？",
                "buttons": [
                    { "text": "✅ 繼續訂房", "value": "繼續訂房" },
                    { "text": "❌ 取消流程", "value": "取消" }
                ]
            };
        }
    }

    // 更新 Session (記錄助理回覆)
    sessionManager.addAssistantResponse(sessionId, reply, richCard);
    
    return {
        reply: reply,
        richCard: richCard,
        nextStep: nextStep,
        sessionId: sessionId,
        status: "Success"
    };
}


// ---------------------------------------------
// 9. EXPRESS API 路由
// ---------------------------------------------

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ status: "Error", message: "Missing sessionId or message" });
        }

        const response = await processChatMessage(sessionId, message);
        res.json(response);
        
    } catch (error) {
        console.error("❌ API Chat Error:", error.message);
        res.status(500).json({ status: "Error", message: "Internal server error: " + error.message });
    }
});

// Fallback 路由: 處理所有未匹配的 GET 請求
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------
// 10. 伺服器啟動 (Server Listen)
// ---------------------------------------------

// 檢查 API Key
if (!apiKey) {
    console.error("❌ 嚴重錯誤：GEMINI_API_KEY 未在 .env 檔案中配置。伺服器啟動失敗。");
} else {
    app.listen(PORT, HOST, () => {
        console.log(`🚀 伺服器已啟動於 http://${HOST}:${PORT}`);
        console.log(`💡 Chat API 位於 http://${HOST}:${PORT}/api/chat`);
    });
}

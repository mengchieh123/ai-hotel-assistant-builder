// server.js (AI 訂房助理 - 最終完整穩定版，含促銷碼邏輯)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// 使用內建的 global fetch，無需額外安裝 node-fetch
const fetch = global.fetch; 
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
const apiUrl = `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// API 重試機制配置
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// ---------------------------------------------
// 2. 中間件配置 (Middleware)
// ---------------------------------------------
// 處理跨域請求
app.use(cors());
// 解析 JSON 格式的請求主體
app.use(express.json());
// 服務靜態檔案
// app.use(express.static('public')); 

// ---------------------------------------------
// 3. DIALOGUE FLOW 配置加載器 (FlowConfigLoader) 與 SessionManager
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
            // 檢查檔案是否存在
            if (!fs.existsSync(this.filePath)) {
                 throw new Error(`檔案不存在`);
            }
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
const sessionManager = new (class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                currentStep: 'welcome',
                bookingState: null,
                collectedData: {},
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
        // 簡化 userType 偵測，讓 NLU 專注於分類，這裡只記錄
        // session.userType = SmartIntentClassifier.detectUserType(message); 
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
// 4. 核心工具類 (NLU, 狀態機, 規則引擎)
// ---------------------------------------------

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
        if (/(否|不|取消|不要|不願意|算了|不訂|不要早餐)/.test(lowerMessage)) intents.add('deny');

        // Rich Card 按鈕值
        if (lowerMessage === '💳 我要登入會員' || lowerMessage === '我要登入會員') intents.add('member_login');
        if (lowerMessage === '❌ 我不是會員 (或暫不登入)' || lowerMessage === '不是會員') intents.add('deny');

        // 付款意圖 (修正 Line 164 的 SyntaxError，並使用 else if 提升單一意圖的明確性)
        if (lowerMessage.includes('線上付款')) {
            intents.add('online_payment');
        } else if (lowerMessage.includes('現場結帳')) {
            // 原本的錯誤行 (Line 164) 修正
            intents.add('onsite_payment');
        }

        // 早餐意圖
        if (/(要早餐|加購早餐)/.test(lowerMessage)) intents.add('member_yes_meal_yes');
        if (/(不要早餐|不加購早餐)/.test(lowerMessage)) intents.add('member_yes_meal_no');

        // 流程相關的資訊意圖
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (this.containsDatePatterns(message)) intents.add('date_input');

        // 其他不相關的資訊意圖 (會觸發跳題) - 使用 Map 簡化邏輯
        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵)/,
            'restaurant': /(餐廳|用餐|午餐|晚餐)/,
            'attractions': /(景點|逛街|導覽|玩)/,
            'shopping': /(購物|買東西)/,
            'facilities': /(設施|泳池|健身房|spa|按摩)/,
            'weather': /(天氣|氣溫|下雨)/,
            'itinerary': /(行程)/,
            'modification': /(修改|取消訂單)/,
            'emergency': /(救命|火災|小偷|警察)/
        };

        for (const intent in nonBookingIntentsMap) {
            if (nonBookingIntentsMap[intent].test(lowerMessage)) {
                intents.add(intent);
            }
        }

        // 最終回退：如果沒有任何明確意圖，則設為 general_inquiry
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
        // ... (日期解析邏輯保持不變，因為邏輯已經很完整)
        const now = dayjs().startOf('day');
        let targetDate = null;
        let nights = null;

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

        const nightsMatch = text.match(/(\d+)晚|(\d+)天|住到週([一二三四五六日])/);
        if (nightsMatch) {
            if (nightsMatch[1] || nightsMatch[2]) {
                nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
            }
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
        // ... (實體提取邏輯保持不變，因為邏輯已經很完整)
        const data = {};
        const lowerMessage = message.toLowerCase();

        // 1. 處理日期和晚數
        const dateResult = this.parseDate(lowerMessage);
        if (dateResult.checkInDate) data.checkInDate = dateResult.checkInDate;
        if (dateResult.nights) data.nights = dateResult.nights;

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

        // 6. 會員帳號/手機號碼
        const memberMatch = message.match(/(\d{8,12})|([A-Za-z0-9]{5,10})/);
        if (memberMatch) {
            data.memberAccount = memberMatch[0];
        }

        // 7. 房間間數
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) {
            data.roomCount = parseInt(roomCountMatch[1], 10);
        }

        // 8. 促銷代碼
        const promoCodeMatch = message.match(/\b([A-Z0-9]{4,10})\b/);
        if (promoCodeMatch) {
            if (!/^\d{4}$/.test(promoCodeMatch[1])) {
                data.promoCode = promoCodeMatch[1].toUpperCase();
            }
        }

        // 9. 檢查用戶是否明確拒絕促銷代碼
        if (lowerMessage.includes('無') || lowerMessage === 'n' || lowerMessage === '否' || lowerMessage.includes('沒有代碼')) {
            data.promoCode = 'NO_CODE_PROVIDED';
        }


        // 預設值
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
}

/**
 * 狀態機控制器：負責管理和獲取對話流程的當前狀態。
 */
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

    // 獲取當前可預訂的房型列表 (模擬)
    static getRoomTypesList() {
        const types = [
            "標準雙人房 (NT$2200)",
            "豪華客房 (海景) (NT$3200)",
            "行政套房 (含酒廊) (NT$4800)",
            "家庭四人房 (NT$4500)"
        ];
        return types.join('、');
    }

    // 執行價格計算 (模擬) - 使用 Map 提升可讀性
    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType = '豪華客房', nights = 1, childCount = 0, adultCount = 1, hasBreakfast = false, roomCount = 1 } = data;

        // 基礎價格 Map
        const ROOM_PRICES = {
            '標準雙人房': 2200,
            '豪華客房': 3200,
            '行政套房': 4800,
            '家庭四人房': 4500,
            'default': 3200
        };

        // 1. 計算基礎房費
        let basePrice = ROOM_PRICES['default'];
        for (const key in ROOM_PRICES) {
            if (roomType.includes(key) && key !== 'default') {
                basePrice = ROOM_PRICES[key];
                break;
            }
        }

        const roomCountVal = roomCount || 1;
        const nightsVal = nights || 1;
        
        let total = basePrice * nightsVal * roomCountVal;

        // 2. 計算兒童加價
        const CHILD_DAILY_FEE = 300;
        const childCost = (childCount || 0) * CHILD_DAILY_FEE * nightsVal;
        total += childCost;

        // 3. 記錄中間值 (不影響最終計算，用於顯示)
        data.totalPriceNoChild = basePrice * nightsVal * roomCountVal;
        data.childCost = childCost;

        // 4. 應用促銷折扣 (如果已經在 ask_promo_code 階段應用過)
        if (data.currentPromoRate) {
            total *= data.currentPromoRate;
        }

        // 5. 應用會員折扣 (如果需要)
        if (isMemberDiscount) {
            total *= 0.8;
        }

        // 6. 計算早餐費
        data.breakfastCost = 0;
        if (hasBreakfast) {
            const BREAKFAST_FEE = 150;
            const totalGuests = (adultCount || 0) + (childCount || 0);
            const breakfastCost = totalGuests * BREAKFAST_FEE * nightsVal;
            total += breakfastCost;
            data.breakfastCost = breakfastCost;
        }

        return Math.round(total);
    }
}

/**
 * 替換 Prompt 中的變數 (優化：抽取成獨立函數)
 */
function interpolatePrompt(text, data) {
    if (!text) return '';
    let result = text;
    for (const key in data) {
        const value = data[key] === undefined || data[key] === null ? '' : data[key];
        // 替換 {key} 和 ${key} 兩種格式的變數
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return result;
}


/**
 * 規則引擎類別：負責根據意圖、會話狀態和配置來決定最終回應。
 */
class RuleEngine {
    static process(intents, session, message) {
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

    // 🏨 訂房流程規則 (核心狀態機邏輯)
    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW;
        const hasBookingIntent = intents.includes('booking');

        // 檢查是否為流程打斷意圖 (使用 SmartIntentClassifier 中定義的非訂房意圖)
        const nonBookingIntents = [
            'transfer', 'restaurant', 'attractions', 'shopping',
            'facilities', 'weather', 'itinerary', 'modification', 'emergency'
        ];
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));

        // 1. 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
            if (hasBookingIntent) {
                session.bookingState = 'init';
            } else {
                // 清理舊的會話狀態，但讓 LLM 有機會處理最後的問候
                setTimeout(() => { session.bookingState = null; session.collectedData = {}; }, 500);
                return { shouldProcess: false, priority: 0 };
            }
        }

        // 2. 🚦 流程恢復處理 (最高優先級檢查)
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            if (intents.includes('affirm')) {
                console.log(`✅ 檢測到 affirm。從暫停狀態 ${session.pausedState} 恢復流程。`);
                session.bookingState = session.pausedState;
                session.pausedState = null;
            } else if (intents.includes('deny')) {
                console.log(`❌ 檢測到 deny。結束訂房流程。`);
                session.bookingState = 'end_conversation';
                session.pausedState = null;
                return {
                    shouldProcess: true,
                    priority: 98, // 比一般流程高，確保結束
                    response: flow.states['end_conversation'].prompt,
                    nextStep: 'end_conversation',
                    updateSession: true
                };
            } else {
                // 停留在暫停狀態，等待用戶確認 (交給 LLM 或下一輪處理)
                return { shouldProcess: false, priority: 0 };
            }
        }

        // 2.5. 🚨 核心切換邏輯 (流程暫停) - 處理明確的流程打斷意圖
        if (session.bookingState && session.bookingState !== 'init' && isSwitchingTopic) {
            console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);

            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';

            // 讓請求繼續，進入 ResponseGenerator 讓 LLM 回答非訂房問題，並附加恢復提示
            return { shouldProcess: false, priority: 0 };
        }

        // 2.7. 🚫 處理流程中模糊的 general_inquiry
        if (session.bookingState && session.bookingState !== 'init' && intents.includes('general_inquiry')) {
            console.log(`⚠️ 流程中收到 general_inquiry。暫停流程，轉交給 LLM 處理模糊查詢。`);

            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            // 讓請求繼續，進入 ResponseGenerator 讓 LLM 回答模糊查詢，並附加恢復提示
            return { shouldProcess: false, priority: 0 };
        }


        // 3. 正常流程/初始化流程
        if (hasBookingIntent || session.bookingState) {

            if (!session.bookingState || session.bookingState === 'welcome') {
                session.bookingState = 'init';
            }

            let currentState = BookingFlowController.getCurrentState(session);
            let nextStateKey = session.bookingState;

            // 4. 提取實體並更新 session
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(session.collectedData, extractedEntities);

            // 5. 嘗試根據意圖轉移
            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            // 6. 檢查實體是否收集完畢以轉移到下一個狀態
            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {

                const requiredEntities = currentState.entities.filter(e => e !== 'email' && e !== 'memberAccount');

                const allEntitiesCollected = requiredEntities.every(
                    entity => session.collectedData[entity] !== undefined && session.collectedData[entity] !== null
                );

                if (allEntitiesCollected) {
                    nextStateKey = currentState.next_state;
                } else {
                    // 如果實體不完整，停留在當前狀態，回覆 prompt
                    return {
                        shouldProcess: true,
                        priority: 95,
                        response: interpolatePrompt(currentState.prompt, session.collectedData), // 使用優化後的函數
                        nextStep: session.bookingState,
                        updateSession: true,
                        richCard: currentState.richCard || null
                    };
                }
            }

            // 7. 處理特殊狀態的後端動作 (價格計算和折扣/早餐)

            // 7.1. 價格初始化 (在進入 ask_promo_code 或 check_membership 之前)
            if (nextStateKey === 'ask_promo_code' || nextStateKey === 'check_membership') {
                const data = session.collectedData;
                // 這裡計算基礎房價和兒童加價，還沒有早餐和任何折扣
                data.finalPrice = BookingFlowController.calculatePrice(data, false);
            }

            // 7.2. **處理促銷代碼狀態**
            if (session.bookingState === 'ask_promo_code') {
                const data = session.collectedData;
                const promoCode = data.promoCode;
                let discountRate = 1.0;
                let promoMessage = "（未應用促銷代碼）";

                // 如果用戶輸入 '無' 或 'N'，則直接跳轉
                if (promoCode === 'NO_CODE_PROVIDED' || intents.includes('deny')) {
                    data.promoMessage = "（未應用促銷代碼）";
                    data.currentPromoRate = 1.0;
                    nextStateKey = 'check_membership'; // 強制轉移到下一個狀態
                    data.promoCode = null; // 清除標記
                } else if (promoCode) {
                    // 🚨 模擬促銷代碼驗證和應用
                    if (promoCode === 'SPRING20') {
                        discountRate = 0.8; // 八折
                        promoMessage = "（已應用 **SPRING20**，享 8 折優惠！）";
                    } else if (promoCode === 'FRIEND10') {
                        discountRate = 0.9; // 九折
                        promoMessage = "（已應用 **FRIEND10**，享 9 折優惠！）";
                    } else {
                        // 如果代碼無效，則提示並重新停留在當前狀態
                        data.promoCode = null; // 清除無效代碼
                        return {
                            shouldProcess: true,
                            priority: 95,
                            response: `抱歉，您輸入的代碼 **${promoCode}** 無效或已過期。請重新輸入促銷代碼，或輸入『無』繼續。`,
                            nextStep: 'ask_promo_code',
                            updateSession: true
                        };
                    }

                    // 應用促銷折扣並轉移到下一狀態
                    data.finalPrice = Math.round(data.finalPrice * discountRate);
                    data.promoMessage = promoMessage;
                    data.currentPromoRate = discountRate;
                    nextStateKey = 'check_membership';
                }
            }
            // **促銷代碼處理結束**

            // 7.3. 應用會員折扣
            if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                data.finalPrice = BookingFlowController.calculatePrice(data, true);
            }

            // 7.4. 處理早餐選項
            if (nextStateKey === 'ask_payment_method') {
                const data = session.collectedData;
                // 判斷是否已經打過折扣 (會員或促銷)
                const isMemberDiscount = session.bookingState.includes('member_discount');

                const hasMealYes = intents.includes('member_yes_meal_yes') || intents.includes('member_no_meal_yes');

                // 記錄早餐選擇並重新計算價格 (最終價格)
                data.hasBreakfast = hasMealYes;
                data.finalPrice = BookingFlowController.calculatePrice(data, isMemberDiscount);
            }

            // 7.5. 記錄付款方式
            if (nextStateKey === 'confirm_booking') {
                const data = session.collectedData;
                if (intents.includes('online_payment')) {
                    data.paymentMethod = '線上付款 (信用卡/虛擬連結)';
                    data.paymentStatus = '已選線上付款';
                } else if (intents.includes('onsite_payment')) {
                    data.paymentMethod = '現場結帳 (保留 24 小時)';
                    data.paymentStatus = '已選現場結帳';
                }
            }

            // 7.6. 生成最終訂房訊息
            if (nextStateKey === 'booking_complete') {
                const data = session.collectedData;
                if (data.paymentStatus === '已選線上付款') {
                    data.paymentMessage = `**線上付款連結：** 請點擊 [虛擬付款連結：https://pay.hotel.ai/ordxxxxxx] 於 24 小時內完成付款。`;
                } else {
                    data.paymentMessage = `**現場結帳提醒：** 您的訂單將為您保留 24 小時。請在截止時間前聯繫我們或完成入住手續。`;
                }
            }


            // 8. 確保狀態轉移
            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            // 8.5. 處理 init 狀態的房型列表變數
            if (session.bookingState === 'init') {
                session.collectedData.roomTypesList = BookingFlowController.getRoomTypesList();
            }

            // 9. 格式化回覆 (變數替換)
            let responseText = nextState.prompt;
            responseText = interpolatePrompt(responseText, session.collectedData);


            // 10. Rich Card/按鈕列表 邏輯
            let richCard = nextState.richCard || null;

            return {
                shouldProcess: true,
                priority: 95,
                response: responseText,
                richCard: richCard,
                nextStep: session.bookingState,
                updateSession: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🚨 緊急規則 (最高優先級: 100)
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency') || /(救命|火災|小偷|警察|救護車)/.test(message.toLowerCase())) {
            return {
                shouldProcess: true,
                priority: 100,
                response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：02-1199-1199\n• 聯絡前台：分機 0\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！",
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 📞 一般規則 (最低優先級: 10)
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理小智\n\n我可以協助您：訂房、接送、餐廳推薦、價格查詢、景點導覽、天氣資訊等服務。\n\n請問今天需要什麼協助呢？"
        };
    }
}


// ---------------------------------------------
// 5. API 通訊工具 (重試機制)
// ---------------------------------------------
async function fetchWithRetry(url, options, attempt = 1) {
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
// 6. 回應生成與 LLM 邏輯 (ResponseGenerator)
// ---------------------------------------------
class ResponseGenerator {

    static async handleSpecialCommands(message, session) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            try {
                const prompt = `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"`;
                // 臨時將翻譯 prompt 加入 history，用於 API 呼叫
                session.conversationHistory.push({ role: 'user', message: prompt });
                const reply = await this.getGeminiResponse(session, true);
                // 呼叫結束後移除臨時 prompt
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

        // 如果規則引擎的優先級夠高，直接使用規則引擎的回覆
        if (ruleResult.shouldProcess && ruleResult.priority >= 90) {
            return { reply: finalReply, richCard: finalRichCard };
        }

        try {
            // 如果優先級低於 90，或 shouldProcess 為 false (如流程暫停狀態)，則呼叫 LLM
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
            // 獲取 LLM 回覆後的最新訊息 (可能包含 LLM 對用戶跳題的回應)
            const lastUserMessage = session.conversationHistory.length > 0 ? session.conversationHistory[session.conversationHistory.length - 1].message : "剛才的查詢";

            finalReply += `\n\n**[💡 流程恢復提示]**\n您剛才詢問了**${lastUserMessage.substring(0, 15).trim()}...**相關資訊。請問您是否需要**回到訂房流程**，繼續我們剛才的步驟呢？`;
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

    // 🟡 核心：與 Gemini API 通訊 (已補全邏輯)
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
            .slice(-historyLimit) // 只保留最新的部分
            .map(entry => ({
                role: entry.role,
                parts: [{ text: entry.message }]
            }));

        // 構建 API 請求主體
        const apiBody = {
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.1 // 降低溫度以確保穩定和流程遵循
            },
            contents: conversationParts
        };

        // 發送 API 請求
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiBody),
        };

        const response = await fetchWithRetry(apiUrl, options);
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            console.error("[Gemini API] No response candidate:", JSON.stringify(data));
            throw new Error("LLM 返回空回應。");
        }
    }
}

// ---------------------------------------------
// 7. Express 路由處理器 (聊天 API)
// ---------------------------------------------

app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Missing sessionId or message' });
    }

    try {
        // 1. 識別意圖
        const intents = SmartIntentClassifier.classify(message);

        // 2. 更新 Session (記錄用戶輸入)
        const session = sessionManager.updateSession(sessionId, message, intents);

        // 3. 生成回應 (RuleEngine + LLM)
        const { reply, richCard } = await ResponseGenerator.generateResponse(intents, session, message);

        // 4. 記錄助理回應
        sessionManager.addAssistantResponse(sessionId, reply, richCard);

        // 5. 返回結果
        return res.json({
            reply,
            richCard,
            currentStep: session.bookingState,
            collectedData: session.collectedData
        });

    } catch (error) {
        console.error("🚫 總處理錯誤:", error);
        // 如果是 LLM Key 錯誤，給予更明確的提示
        const errorMessage = error.message.includes('Key Missing') ? 
                             "服務器配置錯誤：缺少 Gemini API Key，請檢查環境變數。" : 
                             "服務器內部錯誤，請稍後再試。";
        res.status(500).json({
            error: errorMessage,
            details: error.message
        });
    }
});


// ---------------------------------------------
// 8. 服務器啟動
// ---------------------------------------------

// 確保配置檔案存在且 API Key 存在
if (!fs.existsSync(flowLoader.filePath)) {
    console.error(`🔴 嚴重錯誤：找不到配置檔案 ${flowLoader.filePath}，服務器無法正常運行。`);
    // 這裡仍然啟動服務器，但 FlowConfigLoader 會返回錯誤提示
} else if (!apiKey) {
    console.error(`🔴 嚴重錯誤：找不到 GEMINI_API_KEY，LLM 相關功能將無法使用。請檢查 .env 檔案。`);
}

app.listen(PORT, HOST, () => {
    console.log(`🚀 AI 助理服務器已啟動於 http://${HOST}:${PORT}`);
    console.log(`   模型名稱: ${MODEL_NAME}`);
    if (!apiKey) {
        console.log(`   ⚠️ LLM 功能已停用 (缺少 API Key)`);
    }
});

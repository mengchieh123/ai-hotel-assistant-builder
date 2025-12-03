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
// 如果您使用的是舊版 Node.js，可能需要 npm install node-fetch
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
            if (!fs.existsSync(this.filePath)) {
                console.warn(`⚠️ 配置檔案不存在，使用預設配置: ${this.filePath}`);
                return this.getDefaultConfig();
            }
            
            const data = fs.readFileSync(this.filePath, 'utf8');
            console.log(`🛠️ 成功載入配置：${this.filePath}`);
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ 載入配置失敗: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            "name": "海灣麗景酒店預訂流程",
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
                        "ask_promotion": "handle_promotion_query",
                        "general_inquiry": "handle_general_inquiry"
                    },
                    "fallback": "抱歉，我沒聽懂您的意思，請告訴我是想預訂房間或查詢其他資訊？"
                },
                "collect_room_and_dates": {
                    "prompt": "好的，我們將開始預訂。請問您想預訂的【房型】、預計【入住日期】和【住宿晚數】？\n\n可選房型：\n• 標準雙人房 (NT$2,200)\n• 豪華客房 (NT$3,200)\n• 行政套房 (NT$4,800)\n• 家庭四人房 (NT$4,500)",
                    "entities": ["roomType", "checkInDate", "nights"],
                    "next_state": "ask_guest_count",
                    "fallback": "請提供房型、入住日期及住宿晚數，我會為您查詢空房與價格。"
                },
                "ask_guest_count": {
                    "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住呢？\n\n註：2歲以上兒童需加收每晚 NT$300。",
                    "entities": ["adultCount", "childCount"],
                    "next_state": "ask_promo_code",
                    "fallback": "請提供大人及兒童的人數。"
                },
                "ask_promo_code": {
                    "prompt": "請問您是否有【促銷代碼】？如有請輸入，若無請輸入『無』。",
                    "entities": ["promoCode"],
                    "next_state": "check_membership",
                    "fallback": "請輸入促銷代碼或輸入『無』繼續。"
                },
                "check_membership": {
                    "prompt": "請問您是會員嗎？會員可享房價8折優惠。",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇：",
                        "buttons": [
                            { "text": "💳 我是會員", "value": "我是會員" },
                            { "text": "❌ 不是會員", "value": "不是會員" }
                        ]
                    },
                    "intents": {
                        "member_login": "apply_member_discount",
                        "deny": "ask_breakfast"
                    },
                    "fallback": "請告知是否為會員。"
                },
                "apply_member_discount": {
                    "prompt": "已為您套用會員優惠！請問您的【會員帳號】或【手機號碼】是？",
                    "entities": ["memberAccount"],
                    "next_state": "ask_breakfast"
                },
                "ask_breakfast": {
                    "prompt": "請問是否需要【加購早餐】？\n\n早餐費用：每人 NT$150/天",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇：",
                        "buttons": [
                            { "text": "✅ 要早餐", "value": "要早餐" },
                            { "text": "❌ 不要早餐", "value": "不要早餐" }
                        ]
                    },
                    "intents": {
                        "member_yes_meal_yes": "ask_payment_method",
                        "member_yes_meal_no": "ask_payment_method"
                    },
                    "fallback": "請告知是否需要加購早餐。"
                },
                "ask_payment_method": {
                    "prompt": "請選擇【付款方式】：",
                    "richCard": {
                        "type": "button_list",
                        "title": "付款方式",
                        "buttons": [
                            { "text": "💳 線上付款", "value": "線上付款" },
                            { "text": "🏨 現場結帳", "value": "現場結帳" }
                        ]
                    },
                    "intents": {
                        "online_payment": "confirm_booking",
                        "onsite_payment": "confirm_booking"
                    },
                    "fallback": "請選擇付款方式。"
                },
                "confirm_booking": {
                    "prompt": "【最終確認】\n\n房型：{roomType}\n入住：{checkInDate}，共{nights}晚\n人數：{adultCount}大{childCount}小\n總價：NT$ {finalPrice}\n付款：{paymentStatus}\n\n請問是否確認訂房？",
                    "richCard": {
                        "type": "button_list",
                        "title": "請確認：",
                        "buttons": [
                            { "text": "✅ 確認訂房", "value": "確認" },
                            { "text": "❌ 取消訂房", "value": "取消" }
                        ]
                    },
                    "intents": {
                        "affirm": "booking_complete",
                        "deny": "end_conversation"
                    },
                    "fallback": "請確認訂房資訊，並回答『確認』或『取消』。"
                },
                "booking_complete": {
                    "prompt": "🎉 訂房完成！\n\n訂單編號：{orderId}\n訂房人：{name}\nEmail：{email}\n\n確認信已發送至您的信箱，感謝您的預訂！",
                    "end": true
                },
                "end_conversation": {
                    "prompt": "感謝您的使用，期待您入住海灣麗景酒店！",
                    "end": true
                }
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
        if (/(是|對|好|確認|願意|繼續|訂|要早餐|我是會員|繼續訂房)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|不要早餐|不是會員)/.test(lowerMessage)) intents.add('deny');

        // 按鈕值處理
        if (lowerMessage === '💳 我是會員' || lowerMessage === '我是會員') intents.add('member_login');
        if (lowerMessage === '❌ 不是會員' || lowerMessage === '不是會員') intents.add('deny');

        // 付款意圖
        if (lowerMessage.includes('線上付款')) intents.add('online_payment');
        if (lowerMessage.includes('現場結帳')) intents.add('onsite_payment');

        // 早餐意圖
        if (/(要早餐|加購早餐)/.test(lowerMessage)) intents.add('member_yes_meal_yes');
        if (/(不要早餐|不加購早餐)/.test(lowerMessage)) intents.add('member_yes_meal_no');

        // 資訊意圖
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡)/.test(lowerMessage)) intents.add('member');
        if (this.containsDatePatterns(message)) intents.add('date_input');

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

    static getRoomTypesList() {
        const types = [
            "標準雙人房 (NT$2,200)",
            "豪華客房 (NT$3,200)",
            "行政套房 (NT$4,800)",
            "家庭四人房 (NT$4,500)"
        ];
        return types.join('\n• ');
    }

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

        // 兒童加價
        const CHILD_DAILY_FEE = 300;
        const childCost = (childCount || 0) * CHILD_DAILY_FEE * nightsVal;
        total += childCost;

        data.totalPriceNoChild = basePrice * nightsVal * roomCountVal;
        data.childCost = childCost;

        // 應用促銷折扣
        if (data.currentPromoRate) {
            total *= data.currentPromoRate;
        }

        // 應用會員折扣
        if (isMemberDiscount) {
            total *= 0.8;
        }

        // 計算早餐費
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

    // 訂房流程規則
    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW;
        const hasBookingIntent = intents.includes('booking');
        const isAffirm = intents.includes('affirm');

        // 非訂房意圖
        const nonBookingIntents = [
            'transfer', 'restaurant', 'attractions', 'shopping',
            'facilities', 'weather', 'itinerary', 'modification', 'emergency'
        ];
        
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));

        // 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
            if (hasBookingIntent) {
                session.bookingState = 'init';
                session.collectedData = {};
            } else {
                // 如果在流程結束後用戶只是閒聊，不處理流程邏輯
                setTimeout(() => { 
                    session.bookingState = null; 
                    session.collectedData = {}; 
                }, 500);
                return { shouldProcess: false, priority: 0 };
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
        if (session.bookingState && session.bookingState !== 'init' && session.bookingState !== 'paused_waiting_for_resume' && (isSwitchingTopic || intents.includes('general_inquiry'))) {
            // 排除問了價格但已收集到所有資訊的情況
            if (intents.includes('pricing') && session.bookingState === 'confirm_booking') {
                // 允許在確認步驟重新詢問價格
                return { shouldProcess: false, priority: 0 }; 
            }

            console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            
            // 返回一個提示讓 AI 自由問答後提示用戶
            return {
                shouldProcess: true,
                priority: 99,
                response: `好的，我暫時將訂房流程放在一邊。請告訴我您想知道的資訊。\n\n**當您準備好繼續時，請回覆『繼續』或『確認』。**`,
                richCard: {
                    "type": "button_list",
                    "title": "要繼續訂房嗎？",
                    "buttons": [
                        { "text": "✅ 繼續訂房", "value": "繼續訂房" },
                        { "text": "❌ 取消流程", "value": "取消" }
                    ]
                },
                nextStep: 'paused_waiting_for_resume',
                updateSession: true
            };
        }

        // 正常流程/初始化流程
        if (hasBookingIntent || session.bookingState) {
            if (!session.bookingState || session.bookingState === 'welcome') {
                session.bookingState = 'init';
            }

            let currentState = BookingFlowController.getCurrentState(session);
            let nextStateKey = session.bookingState;

            // 提取實體並更新 session
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(session.collectedData, extractedEntities);

            // 根據意圖轉移
            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            // 檢查實體是否收集完畢
            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {
                const requiredEntities = currentState.entities.filter(e => e !== 'email' && e !== 'memberAccount');
                const allEntitiesCollected = requiredEntities.every(
                    entity => session.collectedData[entity] !== undefined && session.collectedData[entity] !== null
                );

                if (allEntitiesCollected) {
                    nextStateKey = currentState.next_state;
                } else {
                    // 實體未收集完，停留在當前狀態，並返回 prompt
                    return {
                        shouldProcess: true,
                        priority: 95,
                        response: interpolatePrompt(currentState.prompt, session.collectedData),
                        nextStep: session.bookingState,
                        updateSession: true,
                        richCard: currentState.richCard || null
                    };
                }
            }

            // 價格計算處理
            const data = session.collectedData;
            const isMemberDiscount = nextStateKey === 'ask_breakfast';
            data.finalPrice = BookingFlowController.calculatePrice(data, isMemberDiscount);


            // 促銷代碼處理 (必須在 ask_promo_code 狀態下處理)
            if (session.bookingState === 'ask_promo_code' && data.promoCode) {
                const promoCode = data.promoCode;
                let discountRate = 1.0;
                let promoMessage = "";

                if (promoCode === 'NO_CODE_PROVIDED') {
                    discountRate = 1.0;
                    promoMessage = "（未使用促銷代碼）";
                } else {
                    if (promoCode === 'SUMMER2024') {
                        discountRate = 0.9;
                        promoMessage = "（已應用夏日9折優惠）";
                    } else if (promoCode === 'WELCOME10') {
                        discountRate = 0.9;
                        promoMessage = "（已應用新客9折優惠）";
                    } else if (promoCode === 'VIP20') {
                        discountRate = 0.8;
                        promoMessage = "（已應用VIP 8折優惠）";
                    } else {
                        data.promoCode = null;
                        data.currentPromoRate = 1.0;
                        
                        return {
                            shouldProcess: true,
                            priority: 95,
                            response: `抱歉，您輸入的代碼 **${promoCode}** 無效或已過期。請重新輸入促銷代碼，或輸入『無』繼續。`,
                            nextStep: 'ask_promo_code',
                            updateSession: true
                        };
                    }
                    data.currentPromoRate = discountRate;
                }
                
                data.promoMessage = promoMessage;
                data.finalPrice = BookingFlowController.calculatePrice(data, false); // 重新計算價格
            }

            // 處理會員折扣
            if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                data.finalPrice = BookingFlowController.calculatePrice(data, true);
            }

            // 處理早餐選項
            if (session.bookingState === 'ask_breakfast' && nextStateKey === 'ask_payment_method') {
                const data = session.collectedData;
                data.hasBreakfast = intents.includes('member_yes_meal_yes'); // 這裡簡化處理
                data.finalPrice = BookingFlowController.calculatePrice(data, intents.includes('member_login'));
            }

            // 記錄付款方式
            if (session.bookingState === 'ask_payment_method' && nextStateKey === 'confirm_booking') {
                const data = session.collectedData;
                if (intents.includes('online_payment')) {
                    data.paymentStatus = '線上付款';
                } else if (intents.includes('onsite_payment')) {
                    data.paymentStatus = '現場結帳';
                }
                data.finalPrice = BookingFlowController.calculatePrice(data, data.memberAccount ? true : false);
            }

            // 生成最終訂房訊息
            if (nextStateKey === 'booking_complete') {
                data.orderId = 'ORD-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            }

            // 確保狀態轉移
            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            // 格式化回覆
            let responseText = interpolatePrompt(nextState.prompt, session.collectedData);
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

    // 緊急規則
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency') || /(救命|火災|小偷|警察|救護車)/.test(message.toLowerCase())) {
            // 處理緊急情況，可能會覆蓋流程
            session.bookingState = null;
            session.pausedState = null;
            return {
                shouldProcess: true,
                priority: 100,
                response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：02-1199-1199\n• 聯絡前台：分機 0\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！",
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 一般規則 (如果沒有其他高優先級規則觸發，將執行 AI 自由問答)
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理\n\n我可以協助您：訂房、價格查詢、會員服務、設施介紹等。\n\n請問今天需要什麼協助呢？"
        };
    }
}

// ---------------------------------------------
// 6. API 通訊工具
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
// 7. 回應生成器 (ResponseGenerator)
// ---------------------------------------------

class ResponseGenerator {
    
    // 與 Gemini 進行實際通訊
    static async getGeminiResponse(session, isTranslation = false) {
        if (!apiKey) {
            return "錯誤：未配置 GEMINI_API_KEY。請檢查 .env 檔案。";
        }
        
        const history = session.conversationHistory;
        const systemInstruction = `您是海灣麗景酒店的 AI 客服助理。您的職責是：
1. **優先執行訂房流程**：如果用戶處於訂房流程 (BookingFlowController 正在處理)，您應保持專注，不進行閒聊。
2. **回答非流程問題**：如果用戶詢問關於酒店設施、交通、景點、天氣等問題，您必須提供簡潔、準確且有幫助的資訊。酒店資訊：
    - 名稱：海灣麗景酒店 (Bayview Grand Hotel)
    - 地理：位於台北市信義區，鄰近捷運站，交通方便。
    - 服務：提供機場接送服務（需預約）。
    - 設施：頂樓有海景無邊際泳池、24H 健身房、Spa 中心。
    - 餐廳：提供免費早餐（除非用戶選擇不加購），主營台式/西式自助餐。
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
        
        // 僅傳遞歷史訊息中的文字部分 (角色和內容)
        // 注意：為了避免 token 過長，這裡只取最後 10 個對話
        const relevantHistory = history.slice(-10);
        
        relevantHistory.forEach(item => {
            if (item.role === 'user') {
                 contents.push({ role: "user", parts: [{ text: item.message }] });
            } else if (item.role === 'model') {
                 contents.push({ role: "model", parts: [{ text: item.message }] });
            }
        });
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                config: {
                    // 確保 AI 專注於回答
                    temperature: 0.2, 
                    maxOutputTokens: 1024
                }
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

    static async handleSpecialCommands(message, session) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            try {
                // 暫時將翻譯請求加入歷史記錄
                session.conversationHistory.push({ role: 'user', message: `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"` });
                const reply = await this.getGeminiResponse(session, true);
                session.conversationHistory.pop(); // 移除臨時的翻譯 prompt
                return { reply: `🌐 **翻譯結果：**\n\n${reply}`, richCard: null };
            } catch (e) {
                return { reply: `🌐 翻譯服務暫時不可用，但您想翻譯的文本是：「${textToTranslate}」。`, richCard: null };
            }
        }
        return null;
    }
}

// ---------------------------------------------
// 8. 聊天處理邏輯函數
// ---------------------------------------------

async function processChatMessage(sessionId, message) {
    // 獲取並更新 Session (記錄用戶訊息)
    const session = sessionManager.getSession(sessionId);
    const intents = SmartIntentClassifier.classify(message);
    sessionManager.updateSession(sessionId, message, intents); // 這裡先記錄用戶輸入

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
        
    } else {
        // 詢問非流程問題或暫停流程問答 (優先級低於 90)
        
        // 處理特殊命令，例如翻譯
        const specialCommandResult = await ResponseGenerator.handleSpecialCommands(message, session);

        if (specialCommandResult) {
            reply = specialCommandResult.reply;
            richCard = specialCommandResult.richCard;
        } else {
            // 呼叫 Gemini 進行一般問答
            // 在呼叫 Gemini 前，如果處於暫停狀態，需要將恢復提示加入歷史記錄
            if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
                // 這裡無需再次發送恢復提示，讓 AI 直接回答用戶剛提出的問題
            }
            
            try {
                reply = await ResponseGenerator.getGeminiResponse(session); 
            } catch (e) {
                console.error("Gemini Call Failed:", e);
                reply = "很抱歉，我們的 AI 服務目前無法連接。請檢查您的 API Key 或稍後再試。";
            }
        }
        
        // 如果處於暫停狀態，在 AI 回覆後，提醒用戶可以繼續訂房
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
             reply += "\n\n**提醒：訂房流程已暫停。您可以回覆『繼續』來恢復訂房。**";
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
// 9. EXPRESS API 路由 (Chat API) <--- 【修復 SyntaxError 的關鍵】
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

// Fallback 路由: 處理所有未匹配的 GET 請求 (用於 SPA 路由)
app.get('*', (req, res) => {
    // 這裡確保只有在請求不是 API 路由時才發送 index.html
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
    // 不啟動伺服器或返回錯誤
} else {
    app.listen(PORT, HOST, () => {
        console.log(`🚀 伺服器已啟動於 http://${HOST}:${PORT}`);
        console.log(`💡 Chat API 位於 http://${HOST}:${PORT}/api/chat`);
    });
}

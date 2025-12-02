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

// 處理跨域請求
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------------
// 3. DIALOGUE FLOW 配置加載器 (FlowConfigLoader) 與 SessionManager
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
                    "prompt": "🎉 訂房完成！\n\n訂單編號：[ORD-{orderId}]\n訂房人：{name}\nEmail：{email}\n\n確認信已發送至您的信箱，感謝您的預訂！",
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
// 4. 智能意圖分類器 (SmartIntentClassifier)
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
        if (/(是|對|好|確認|願意|繼續|訂|要早餐|我是會員)/.test(lowerMessage)) intents.add('affirm');
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
// 5. 訂房流程控制器 (BookingFlowController)
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
// 6. 規則引擎 (RuleEngine)
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
                setTimeout(() => { 
                    session.bookingState = null; 
                    session.collectedData = {}; 
                }, 500);
                return { shouldProcess: false, priority: 0 };
            }
        }

        // 流程恢復處理
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            if (intents.includes('affirm')) {
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
                return { shouldProcess: false, priority: 0 };
            }
        }

        // 流程暫停邏輯
        if (session.bookingState && session.bookingState !== 'init' && isSwitchingTopic) {
            console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            return { shouldProcess: false, priority: 0 };
        }

        // 處理模糊查詢
        if (session.bookingState && session.bookingState !== 'init' && intents.includes('general_inquiry')) {
            console.log(`⚠️ 流程中收到 general_inquiry。暫停流程。`);
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            return { shouldProcess: false, priority: 0 };
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
            if (nextStateKey === 'ask_promo_code' || nextStateKey === 'check_membership') {
                const data = session.collectedData;
                data.finalPrice = BookingFlowController.calculatePrice(data, false);
            }

            // 促銷代碼處理
            if (session.bookingState === 'ask_promo_code') {
                const data = session.collectedData;
                const promoCode = data.promoCode;
                let discountRate = 1.0;
                let promoMessage = "（未應用促銷代碼）";

                if (promoCode === 'NO_CODE_PROVIDED') {
                    discountRate = 1.0;
                    promoMessage = "（未使用促銷代碼）";
                } else if (promoCode) {
                    // 簡單的促銷代碼驗證邏輯
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
            }

            // 應用會員折扣
            if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                data.finalPrice = BookingFlowController.calculatePrice(data, true);
            }

            // 處理早餐選項
            if (nextStateKey === 'ask_payment_method') {
                const data = session.collectedData;
                const isMemberDiscount = session.bookingState.includes('member_discount');
                const hasMealYes = intents.includes('member_yes_meal_yes') || intents.includes('member_no_meal_yes');

                data.hasBreakfast = hasMealYes;
                data.finalPrice = BookingFlowController.calculatePrice(data, isMemberDiscount);
            }

            // 記錄付款方式
            if (nextStateKey === 'confirm_booking') {
                const data = session.collectedData;
                if (intents.includes('online_payment')) {
                    data.paymentStatus = '線上付款';
                } else if (intents.includes('onsite_payment')) {
                    data.paymentStatus = '現場結帳';
                }
            }

            // 生成最終訂房訊息
            if (nextStateKey === 'booking_complete') {
                const data = session.collectedData;
                data.orderId = 'ORD-' + Math.random().toString(36).substr(2, 8).toUpperCase();
                data.finalPrice = data.finalPrice || BookingFlowController.calculatePrice(data, false);
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
            return {
                shouldProcess: true,
                priority: 100,
                response: "🚨 **緊急狀況處理**\n\n我們已收到您的緊急求助！請立即：\n\n• 撥打緊急專線：02-1199-1199\n• 聯絡前台：分機 0\n• 或直接前往一樓服務台\n\n我們的工作人員會立即為您提供協助！",
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 一般規則
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理\n\n我可以協助您：訂房、價格查詢、會員服務、設施介紹等。\n\n請問今天需要什麼協助呢？"
        };
    }
}

// API 通訊工具
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

        if (ruleResult.shouldProcess && ruleResult.priority >= 90) {
            return { reply: finalReply, richCard: finalRichCard };
        }

        try {
            const geminiReply = await this.getGeminiResponse(session, false);
            finalReply = geminiReply;
            finalRichCard = null;
        } catch (error) {
            console.error("🚫 LLM 服務失敗，強制回退:", error.message);
            finalReply = "👋 您好！目前 AI 服務暫時無法處理複雜查詢，但我可以協助您啟動訂房流程（說『我要訂房』）。";
            finalRichCard = null;
        }

        // 檢查並附加恢復提示
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            const lastUserMessage = session.conversationHistory.length > 0 ? 
                session.conversationHistory[session.conversationHistory.length - 1].message : "剛才的查詢";
            
            finalReply += `\n\n**[💡 流程恢復提示]**\n您剛才詢問了**${lastUserMessage.substring(0, 15).trim()}...**相關資訊。請問您是否需要**回到訂房流程**？`;
            finalRichCard = {
                "type": "button_list",
                "title": "請選擇：",
                "buttons": [
                    { "text": "🔄 回到訂房流程", "value": "回到訂房流程" },
                    { "text": "❌ 結束對話", "value": "結束對話" }
                ]
            };
        }

        return { reply: finalReply, richCard: finalRichCard };
    }

    static async getGeminiResponse(session, isSpecialCommand = false) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Cannot call LLM.");
            throw new Error("Gemini API Key Missing.");
        }

        // 構建系統提示
        let systemInstruction = "你是一個專業、親切的海灣麗景酒店AI助理。你的任務是解答用戶關於酒店、旅遊、生活等任何問題。如果用戶的請求未被高優先級規則處理，請使用你的專業知識回答。請使用繁體中文回應，保持專業且友善。";

        if (session.bookingState && session.bookingState !== 'paused_waiting_for_resume') {
            systemInstruction += `\n\n當前訂房流程狀態：${session.bookingState}`;
            systemInstruction += `\n已收集資訊：${JSON.stringify(session.collectedData)}`;
        }

        // 篩選對話歷史
        const historyLimit = isSpecialCommand ? 1 : 10;
        const conversationParts = session.conversationHistory
            .slice(-historyLimit)
            .map(entry => ({
                role: entry.role,
                parts: [{ text: entry.message }]
            }));

        // 構建 API 請求主體
        const apiBody = {
            contents: conversationParts,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

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
// 8. Express 路由處理器
// ---------------------------------------------

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>海灣麗景酒店 AI 助理</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h1 { color: #2c3e50; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                .endpoint { background: #e8f4fc; padding: 15px; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>🏨 海灣麗景酒店 AI 助理服務</h1>
            <p>版本: 2.0 (完整規則引擎版)</p>
            <div class="endpoint">
                <h3>📡 API 端點：</h3>
                <p><strong>POST</strong> <code>/api/chat</code> - 主要聊天接口</p>
                <p><strong>GET</strong> <code>/health</code> - 健康檢查</p>
            </div>
            <h3>🛠️ 功能特色：</h3>
            <ul>
                <li>完整訂房流程 (包含促銷代碼、會員折扣)</li>
                <li>智能意圖識別 (15+ 種意圖)</li>
                <li>流程暫停與恢復機制</li>
                <li>混合式回應 (規則引擎 + LLM)</li>
                <li>Rich Card 按鈕回應</li>
            </ul>
            <p><strong>狀態：</strong> ${apiKey ? '✅ API Key 已載入' : '⚠️ API Key 未設定'}</p>
            <p><strong>模型：</strong> ${MODEL_NAME}</p>
        </body>
        </html>
    `);
});

app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ 
            error: "Missing sessionId or message",
            reply: "請提供 sessionId 和 message 參數。"
        });
    }

    try {
        // 處理初始連線訊息
        if (message === 'initial_connection_message') {
            const session = sessionManager.getSession(sessionId);
            session.bookingState = 'init';
            const initialState = flowLoader.DIALOGUE_FLOW.states['init'];
            return res.json({ 
                reply: initialState.prompt, 
                richCard: initialState.richCard, 
                sessionId 
            });
        }

        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);

        const { reply, richCard } = await ResponseGenerator.generateResponse(intents, session, message);
        
        sessionManager.addAssistantResponse(sessionId, reply, richCard);
        
        return res.json({
            reply,
            richCard,
            sessionId,
            currentStep: session.bookingState,
            collectedData: session.collectedData,
            intents: intents
        });

    } catch (error) {
        console.error("🚫 總處理錯誤:", error);
        const errorMessage = error.message.includes('Key Missing') ? 
                             "服務器配置錯誤：缺少 Gemini API Key" : 
                             "服務器內部錯誤，請稍後再試。";
        res.status(500).json({
            error: errorMessage,
            reply: "抱歉，系統暫時出現問題，請稍後再試。",
            sessionId: sessionId || 'unknown'
        });
    }
});

app.get('/health', (req, res) => {
    const keyStatus = apiKey ? '已載入' : '遺失';
    const configName = flowLoader.DIALOGUE_FLOW.name || '預設配置';
    res.json({
        status: "OK",
        model: MODEL_NAME,
        apiKeyStatus: keyStatus,
        configLoaded: configName,
        timestamp: new Date().toISOString(),
        sessions: sessionManager.sessions.size
    });
});

// ---------------------------------------------
// 9. 服務器啟動
// ---------------------------------------------

if (!apiKey) {
    console.warn(`⚠️ GEMINI_API_KEY 未設定，LLM 功能將無法使用。`);
}

app.listen(PORT, HOST, () => {
    console.log(`🚀 服務已啟動: http://${HOST}:${PORT}`);
    console.log(`🔑 Gemini API Key: ${apiKey ? '✅ 已載入' : '❌ 未設定'}`);
    console.log(`🤖 模型: ${MODEL_NAME}`);
    console.log(`📊 對話流程: ${flowLoader.DIALOGUE_FLOW.name}`);
    console.log(`📡 API 端點: POST /api/chat`);
});

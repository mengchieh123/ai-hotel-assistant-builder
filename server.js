
// server.js (AI 訂房助理 - 優化版，CommonJS 風格，模組化結構)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // 保持兼容性
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";

const MODEL_NAME = "gemini-2.5-flash";
const API_VERSION = "v1";
const apiUrl = `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const SESSION_TIMEOUT_MS = 1000 * 60 * 30; // 30 分鐘超時
const tools = []; // 預留給 Function Calling

// ---------------------------------------------
// 2. DIALOGUE FLOW 配置加載器 (FlowConfigLoader)
// ---------------------------------------------

/**
 * 負責從外部 JSON 檔案載入對話配置 (dialogue_flow.json)。
 * (已移除 Hot Reload 邏輯，以提高生產環境的穩定性)
 */
class FlowConfigLoader {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        this.config = this.loadConfig();
        // 移除 fs.watch 監聽
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

    // Getter 確保每次調用都獲取最新的配置
    get DIALOGUE_FLOW() {
        return this.config;
    }
}

// 初始化配置加載器
const flowLoader = new FlowConfigLoader('dialogue_flow.json');

// ---------------------------------------------
// 3. 核心工具類 (NLU, 狀態機, 規則引擎)
// ---------------------------------------------

/**
 * 智能意圖分類器：負責從用戶訊息中識別意圖和實體。
 */
class SmartIntentClassifier {

    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();

        // 核心訂房意圖 (精煉正則表達式)
        if (/(訂房|預訂|入住|房間|房型|幫我訂|想要訂|預約房間|我要訂房|豪華客房|標準雙人房|行政套房|海景|家庭|一間|兩間|.*月.*日|.*天)/.test(lowerMessage)) {
            intents.add('booking');
        }

        // 關鍵流程意圖 (affirm/deny 等)
        if (/(是|對|好|確認|願意|繼續|訂|要早餐|沒問題)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不加購)/.test(lowerMessage)) intents.add('deny');

        // Rich Card 按鈕值
        if (lowerMessage.includes('登入會員')) intents.add('member_login');
        if (lowerMessage.includes('不是會員')) intents.add('deny');

        // 付款意圖
        if (lowerMessage.includes('線上付款')) intents.add('online_payment');
        if (lowerMessage.includes('現場結帳')) intents.add('onsite_payment');

        // 早餐意圖 (使用更精確的標籤)
        if (lowerMessage.includes('要早餐') || lowerMessage.includes('加購早餐')) intents.add('wants_breakfast');
        if (lowerMessage.includes('不要早餐') || lowerMessage.includes('不加購早餐')) intents.add('no_breakfast');

        // 流程相關的資訊意圖
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (this.containsDatePatterns(message)) intents.add('date_input');

        // 其他不相關的資訊意圖 (會觸發跳題/LLM接管)
        const nonBookingIntents = [
            { intent: 'transfer', pattern: /(接送|交通|機場|車站)/ },
            { intent: 'restaurant', pattern: /(餐廳|用餐|吃飯|早午餐)/ },
            { intent: 'attractions', pattern: /(景點|逛逛|附近哪裡好玩)/ },
            { intent: 'facilities', pattern: /(設施|泳池|健身房|spa|按摩)/ },
            { intent: 'weather', pattern: /(天氣|氣溫|下雨)/ },
            { intent: 'emergency', pattern: /(救命|火災|小偷|警察)/ },
            { intent: 'modification', pattern: /(修改|變更|取消訂單)/ }
        ];

        nonBookingIntents.forEach(item => {
            if (item.pattern.test(lowerMessage)) {
                intents.add(item.intent);
            }
        });

        // 最終回退：如果沒有任何明確意圖，則設為 general_inquiry
        if (intents.size === 0) intents.add('general_inquiry');
        return Array.from(intents);
    }

    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,4}[/\-]\d{1,2}[/\-]\d{1,2}/, // YYYY/MM/DD
            /\d{1,2}[/\-]\d{1,2}/, // MM/DD
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天|週末|下週|月底|週[一二三四五六日]/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    static parseDate(text) {
        const now = dayjs().startOf('day');
        let targetDate = null;
        let nights = null;

        // 1. 處理特定日期格式 (YYYY/MM/DD, MM/DD, X月X日)
        const dateMatch = text.match(/(\d{4}[/\-]\d{1,2}[/\-]\d{1,2})|(\d{1,2}[/\-]\d{1,2})|(\d{1,2}月\d{1,2}日)/);
        if (dateMatch) {
            let dateStr = dateMatch[0];
            let year = now.year();

            if (dateStr.includes('月') && dateStr.includes('日')) {
                 const parts = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
                 if (parts) {
                    const month = parseInt(parts[1], 10);
                    const day = parseInt(parts[2], 10);
                    // 聰明的跨年處理：如果月份早於當前月份，自動跳到下一年
                    let checkYear = (month < now.month() + 1 || (month === now.month() + 1 && day < now.date())) ? year + 1 : year;
                    targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
                 }
            } else if (dateStr.match(/\d{4}/)) {
                targetDate = dayjs(dateStr, ['YYYY/MM/DD', 'YYYY-MM-DD']).startOf('day');
            } else if (dateStr.match(/\d{1,2}[/\-]\d{1,2}/)) {
                const parts = dateStr.split(/[\/\-]/).map(n => parseInt(n, 10));
                const month = parts[0];
                const day = parts[1];
                let checkYear = (month < now.month() + 1 || (month === now.month() + 1 && day < now.date())) ? year + 1 : year;
                targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
            }
        }

        // 2. 處理相對時間
        if (text.includes('今天') || text.includes('今晚')) {
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        // 3. 處理星期
        const weekdayMatch = text.match(/(下週|這週)?週([一二三四五六日])/);
        if (weekdayMatch) {
            const weekdayMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            const targetDay = weekdayMap[weekdayMatch[2]];
            let date = now.weekday(targetDay);

            // 如果日期在今天之前或等於今天，則使用下週的日期 (除非明確指定這週)
            if (date.isSameOrBefore(now, 'day') && !text.includes('這週') || weekdayMatch[1] && weekdayMatch[1].includes('下週')) {
                date = date.add(7, 'day');
            }
            // 如果剛好是今天，且用戶只說了 '週X'，則跳到下週
            if (date.isSame(now, 'day') && !text.includes('今天')) {
                 date = date.add(7, 'day');
            }

            targetDate = date.startOf('day');
        }

        // 4. 提取晚數 (修正：更全面地匹配 N 晚/N 天)
        const nightsMatch = text.match(/(\d+)[個間]晚|(\d+)[個間]天|(\d+)晚|(\d+)天/);
        if (nightsMatch) {
             // 找到第一個非 null 的匹配
             const match = nightsMatch.slice(1).find(m => m !== undefined);
             if (match) {
                 nights = parseInt(match, 10);
             }
        }

        // 5. 提取住到星期X
        const endDayMatch = text.match(/住到週([一二三四五六日])/);
        if (endDayMatch && targetDate) {
             const weekdayMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
             const endDay = weekdayMap[endDayMatch[1]];
             let endDate = targetDate.weekday(endDay).startOf('day');

             // 確保退房日期在入住日期之後
             if (endDate.isSameOrBefore(targetDate, 'day')) {
                 endDate = endDate.add(7, 'day');
             }
             nights = endDate.diff(targetDate, 'day');
        }

        // 6. 預設 1 晚
        if (targetDate && targetDate.isValid() && !nights) {
             nights = 1;
        }

        // 7. 確保日期不早於今天
        if (targetDate && targetDate.isSameOrBefore(now, 'day') && !targetDate.isSame(now, 'day')) {
             // 如果解析到的日期是過去的日期，則視為無效或忽略，讓流程引導
             targetDate = null;
             nights = null;
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

        // 1. 日期和晚數
        const dateResult = this.parseDate(lowerMessage);
        Object.assign(data, dateResult);

        // 2. 房型 (使用更廣泛的匹配)
        const roomTypeMatch = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房|單人房|雙人房|套房)/);
        if (roomTypeMatch) {
            data.roomType = roomTypeMatch[0];
        }

        // 3. 人數 (優先匹配 N 位大人/N 位兒童，其次匹配 N 大/N 小)
        const adultMatch = lowerMessage.match(/(\d+)位大人|(\d+)大/);
        if (adultMatch) {
            data.adultCount = parseInt(adultMatch[1] || adultMatch[2], 10);
        }
        const childMatch = lowerMessage.match(/(\d+)位兒童|(\d+)小/);
        if (childMatch) {
            data.childCount = parseInt(childMatch[1] || childMatch[2], 10);
        }

        // 4. 聯絡方式
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人|聯絡人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
             let extractedName = nameMatch[1] || nameMatch[2];
             // 確保不是流程關鍵詞
             if (extractedName && extractedName.length >= 2 && !/(訂房|本人|想問|請問|好的|沒有|我要|入住|訂一間)/.test(extractedName)) {
                 data.name = extractedName.trim();
             }
        }

        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) data.email = emailMatch[0];

        const phoneMatch = message.match(/(\d{8,12})/); // 8-12 位數字視為電話或會員號
        if (phoneMatch) data.memberAccount = phoneMatch[0];

        // 5. 房間間數
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) {
            data.roomCount = parseInt(roomCountMatch[1], 10);
        }

        // 預設值 (確保數據完整性)
        data.adultCount = data.adultCount === undefined ? 1 : data.adultCount;
        data.childCount = data.childCount === undefined ? 0 : data.childCount;
        data.roomCount = data.roomCount === undefined ? 1 : data.roomCount;
        data.nights = data.nights === undefined ? 1 : data.nights;

        return data;
    }

    // 🏆 新增：用戶類型偵測 (用於 LLM 客製化)
    static detectUserType(message) {
         const data = this.extractEntities(message);
         if (data.memberAccount) return 'member';
         if (/(會員|積分|優惠|折扣)/.test(message.toLowerCase())) return 'interested_member';
         return 'individual';
    }
}

/**
 * 狀態機控制器：負責管理和獲取對話流程的當前狀態。
 */
class BookingFlowController {
    static getFlow() {
        return flowLoader.DIALOGUE_FLOW; // 獲取最新的動態配置
    }

    static getCurrentState(session) {
        const flow = this.getFlow();
        const stateKey = session.bookingState || 'init';
        // 處理暫停狀態的邏輯
        if (stateKey === 'paused_waiting_for_resume' && session.pausedState) {
            return flow.states[session.pausedState];
        }
        return flow.states[stateKey];
    }

    // 獲取房型列表
    static getRoomTypesList() {
        const types = [
            "標準雙人房 (NT$2200)",
            "豪華客房 (海景) (NT$3200)",
            "行政套房 (含酒廊) (NT$4800)",
            "家庭四人房 (NT$4500)"
        ];
        return types.join('、');
    }

    // 執行價格計算 (優化：使用物件結構傳參，防止全局數據污染)
    static calculatePrice({ roomType, nights, childCount, adultCount, hasBreakfast, roomCount }, isMemberDiscount = false) {
        // 預設值
        roomType = roomType || '豪華客房';
        nights = nights || 1;
        childCount = childCount || 0;
        adultCount = adultCount || 1;
        roomCount = roomCount || 1;

        // 1. 計算基礎房費
        let basePrice = 3200;
        if (roomType.includes('標準')) basePrice = 2200;
        else if (roomType.includes('行政')) basePrice = 4800;
        else if (roomType.includes('豪華')) basePrice = 3200;
        else if (roomType.includes('家庭')) basePrice = 4500;

        const baseTotal = basePrice * nights * roomCount; // 房費要乘以間數

        // 2. 計算兒童加價 (假設 $300/晚/間)
        const CHILD_DAILY_FEE = 300;
        const childCost = childCount * CHILD_DAILY_FEE * nights * roomCount;

        let total = baseTotal + childCost; // 未折扣房費總價

        // 3. 應用折扣
        if (isMemberDiscount) {
            total *= 0.8;
        }

        // 4. 計算早餐費 (假設 $150/人/晚)
        let breakfastCost = 0;
        if (hasBreakfast) {
            const BREAKFAST_FEE = 150;
            const totalGuestsPerRoom = adultCount + childCount;
            const totalGuests = totalGuestsPerRoom * roomCount; // 總人數
            breakfastCost = totalGuests * BREAKFAST_FEE * nights;
            total += breakfastCost;
        }

        // 返回包含中間值的計算結果，方便流程中記錄
        return {
             finalPrice: Math.round(total),
             baseTotal: Math.round(baseTotal),
             childCost: Math.round(childCost),
             breakfastCost: Math.round(breakfastCost)
        };
    }
}

/**
 * 規則引擎類別：負責根據意圖、會話狀態和配置來決定最終回應。
 */
class RuleEngine {
    static process(intents, session, message) {
        // 規則按優先級排序 (100 > 95 > 10)
        const rules = [
            this.emergencyRule, // 100
            this.bookingFlowRule, // 95
            this.generalRule // 10 (作為最低級別的默認回覆，將在 LLM 失敗時使用)
        ];

        for (const rule of rules) {
            const result = rule(intents, session, message);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name}, 優先級: ${result.priority}`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // 🚨 緊急規則 (最高優先級: 100)
    static emergencyRule(intents, session, message) {
        if (intents.includes('emergency') || /(救命|火災|小偷|警察|救護車)/.test(message.toLowerCase())) {
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

    // 🏨 訂房流程規則 (核心狀態機邏輯)
    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW;
        const hasBookingIntent = intents.includes('booking');
        const nonBookingIntents = ['transfer', 'restaurant', 'attractions', 'facilities', 'weather', 'modification'];
        const isSwitchingTopic = intents.some(intent => nonBookingIntents.includes(intent));
        const isInBookingFlow = session.bookingState && session.bookingState !== 'init' && session.bookingState !== 'booking_complete' && session.bookingState !== 'end_conversation';

        // 1. 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
             if (hasBookingIntent) {
                 session.bookingState = 'init';
                 session.collectedData = {};
             } else {
                 return { shouldProcess: false, priority: 0 };
             }
        }

        // 2. 🚦 流程恢復/打斷處理
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
                    shouldProcess: true, priority: 96,
                    response: flow.states['end_conversation'].prompt,
                    nextStep: 'end_conversation', updateSession: true
                };
            } else {
                // 讓 LLM 處理模糊回答
                return { shouldProcess: false, priority: 0 };
            }
        }

        // 2.5. 🚨 核心切換邏輯 (流程暫停) - 處理明確的流程打斷意圖
        if (isInBookingFlow && (isSwitchingTopic || intents.includes('general_inquiry'))) {
             console.log(`⚠️ 流程中收到流程外/模糊查詢。暫停流程 (從 ${session.bookingState} 轉到 paused_waiting_for_resume)。`);
             session.pausedState = session.bookingState;
             session.bookingState = 'paused_waiting_for_resume';
             return { shouldProcess: false, priority: 0 }; // 交給 LLM 回覆，並附加恢復提示
        }

        // 3. 正常流程/初始化流程
        if (hasBookingIntent || session.bookingState) {
            if (!session.bookingState) session.bookingState = 'init';

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
                    // 🎯 優化點：如果實體不完整，回覆當前狀態的 PROMPT 進行引導，而不是 fallback
                    return {
                        shouldProcess: true, priority: 95,
                        response: currentState.prompt, // 使用當前狀態的 PROMPT 再次引導
                        nextStep: session.bookingState, updateSession: true,
                        richCard: currentState.richCard || null
                    };
                }
            }

            // 7. 處理特殊狀態的後端動作 (價格計算/折扣/早餐)
            const data = session.collectedData;
            let isMember = false;

            if (nextStateKey === 'check_membership' || nextStateKey === 'confirm_member_and_meal') {
                 // 房價計算 (未折扣，未含餐)
                 const priceResult = BookingFlowController.calculatePrice(data, false);
                 data.totalPrice = priceResult.finalPrice; // 流程中的基礎總價 (含兒童費)
                 Object.assign(data, priceResult); // 記錄中間值
            }

            if (nextStateKey === 'apply_member_discount') {
                 // 打折後的房價計算 (未含餐)
                 const priceResult = BookingFlowController.calculatePrice(data, true);
                 data.newTotalPrice = priceResult.finalPrice;
                 data.finalPrice = data.newTotalPrice;
                 isMember = true;
            }

            if (nextStateKey === 'ask_payment_method') {
                 // 記錄早餐選擇並重新計算價格 (最終價格)
                 data.hasBreakfast = intents.includes('wants_breakfast') || session.bookingState === 'apply_member_discount' && intents.includes('affirm');
                 isMember = session.bookingState === 'apply_member_discount';
                 const finalPriceResult = BookingFlowController.calculatePrice(data, isMember);
                 data.finalPrice = finalPriceResult.finalPrice;
                 data.breakfastCost = finalPriceResult.breakfastCost;
            }

            if (nextStateKey === 'confirm_booking') {
                 // 記錄付款方式
                 if (intents.includes('online_payment')) {
                     data.paymentMethod = '線上付款 (信用卡/虛擬連結)';
                     data.paymentStatus = '已選線上付款';
                 } else if (intents.includes('onsite_payment')) {
                     data.paymentMethod = '現場結帳 (保留 24 小時)';
                     data.paymentStatus = '已選現場結帳';
                 }
            }

            if (nextStateKey === 'booking_complete') {
                 // 生成最終訂房訊息
                 data.paymentMessage = data.paymentStatus === '已選線上付款'
                      ? `**線上付款連結：** 請點擊 [虛擬付款連結：https://pay.hotel.ai/ordxxxxxx] 於 24 小時內完成付款。`
                      : `**現場結帳提醒：** 您的訂單將為您保留 24 小時。請在截止時間前聯繫我們或完成入住手續。`;
                 data.confirmationNumber = `ABC${Math.floor(Math.random() * 10000)}`;
            }


            // 8. 確保狀態轉移並格式化回覆
            session.bookingState = nextStateKey;
            let nextState = flow.states[nextStateKey];

            // 8.5. 注入變數 (如房型列表)
            if (session.bookingState === 'init') {
                data.roomTypesList = BookingFlowController.getRoomTypesList();
            }

            // 9. 格式化回覆 (變數替換)
            let responseText = nextState.prompt;
            for (const key in data) {
                 const value = data[key] || '';
                 responseText = responseText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                 responseText = responseText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }

            // 10. 回傳結果
            return {
                shouldProcess: true,
                priority: 95,
                response: responseText,
                richCard: nextState.richCard || null,
                nextStep: session.bookingState,
                updateSession: true
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


/**
 * 會話狀態管理器：負責存儲和管理每個用戶的會話數據。
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
        // 啟動會話清理機制
        setInterval(this.cleanupSessions.bind(this), 60000); // 每分鐘檢查一次
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, this.createInitialSession());
        }
        return this.sessions.get(sessionId);
    }

    createInitialSession() {
        return {
            id: null, // 將在 updateSession 中設置
            currentStep: 'welcome',
            bookingState: null,
            collectedData: {},
            userType: 'unknown',
            askedTopics: [],
            conversationHistory: [],
            lastActive: new Date().getTime(),
            pausedState: null
        };
    }

    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.id = sessionId; // 確保 ID 存在於 session 物件中
        session.lastActive = new Date().getTime();
        session.conversationHistory.push({
            role: 'user',
            message,
            intents,
            timestamp: new Date().toISOString()
        });
        // 🏆 修正：調用 SmartIntentClassifier 中已定義的方法
        session.userType = SmartIntentClassifier.detectUserType(message);
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

    // 🏆 新增：定期清理超時會話，釋放記憶體
    cleanupSessions() {
        const now = new Date().getTime();
        let cleanedCount = 0;
        this.sessions.forEach((session, sessionId) => {
            if (now - session.lastActive > SESSION_TIMEOUT_MS) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        });
        if (cleanedCount > 0) {
            console.log(`🧹 清理了 ${cleanedCount} 個超時會話。當前活躍會話: ${this.sessions.size}`);
        }
    }
}

const sessionManager = new SessionManager();

// ---------------------------------------------
// 4. API 通訊工具 (重試機制)
// ---------------------------------------------
async function fetchWithRetry(url, options, attempt = 1) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Gemini API] 錯誤響應 (Status: ${response.status}): ${errorText.substring(0, 100)}...`);

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

    // 特殊指令處理 (例如翻譯)
    static async handleSpecialCommands(message) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            console.log(`🟢 執行特殊指令：翻譯 "${textToTranslate}"`);
            try {
                const prompt = `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"`;
                // 專門為翻譯呼叫 API，跳過長歷史紀錄
                const reply = await this.callGeminiAPI([{ role: 'user', parts: [{ text: prompt }] }], true); 
                return { reply: `🌐 **翻譯結果：**\n\n${reply}`, richCard: null };
            } catch (e) {
                console.error("翻譯服務失敗:", e.message);
                return { reply: `🌐 翻譯服務暫時不可用，但您想翻譯的文本是：「${textToTranslate}」。`, richCard: null };
            }
        }
        return null;
    }

    static async generateResponse(intents, session, message) {

        const specialReplyResult = await this.handleSpecialCommands(message);
        if (specialReplyResult) {
            sessionManager.addAssistantResponse(session.id, specialReplyResult.reply, specialReplyResult.richCard);
            return specialReplyResult;
        }

        console.log(`🎯 意圖識別: ${intents.join(', ')}, 當前狀態: ${session.bookingState}`);

        // 1. 使用規則引擎處理所有意圖 (高優先級: 流程、緊急、通用回退)
        const ruleResult = RuleEngine.process(intents, session, message);

        let finalReply = ruleResult.response || null;
        let finalRichCard = ruleResult.richCard || null;

        // 如果規則引擎產生了流程回覆 (priority >= 95，即流程或緊急)
        if (ruleResult.shouldProcess && ruleResult.priority >= 95) {
            console.log("🟢 使用高優先級規則引擎回覆 (流程/緊急)。");
            sessionManager.addAssistantResponse(session.id, finalReply, finalRichCard);
            return {
                reply: finalReply,
                richCard: finalRichCard
            };
        }
        
        // 2. 複雜/一般問題使用 AI (LLM 優先級 ~50)
        // 僅在規則引擎未提供高優先級回覆時才呼叫 LLM
        if (ruleResult.priority < 95) {
            try {
                console.log("🤖 嘗試使用 Gemini AI 處理複雜問題 (LLM 優先級 ~50)。");
                const geminiReply = await this.getGeminiResponse(session);
                finalReply = geminiReply;
                finalRichCard = null; // LLM 不產生 Rich Card
            } catch (error) {
                // 🚨 關鍵錯誤隔離點：如果 LLM 失敗，強制回退到最安全的通用回覆 (Priority 10)
                console.error("🚫 LLM 服務失敗，回退到最低優先級通用問候。", error.message);
                finalReply = RuleEngine.generalRule().response;
                finalRichCard = null;
            }
        } else {
             // 如果 ruleResult.priority >= 95，但 shouldProcess: false，則 finalReply 應為 null，
             // 但我們已經在前面處理了 priority >= 95 的情況，這裡主要是處理 priority < 95 時的 LLM/通用回覆。
             // 如果 LLM 處理失敗，則會使用 RuleEngine.generalRule().response (Priority 10)
        }


        // 3. 檢查並附加恢復提示 (流程打斷與恢復的核心)
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            const lastUserMessage = message;
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

        // 4. 紀錄並回傳最終結果
        if (!finalReply) {
             // 雙重保險：如果 LLM 和規則都未提供回覆，則使用通用回覆
             finalReply = RuleEngine.generalRule().response;
        }

        console.log("🟡 使用 LLM/最低優先級通用回覆。");

        sessionManager.addAssistantResponse(session.id, finalReply, finalRichCard);
        return { reply: finalReply, richCard: finalRichCard };
    }

    // 🟡 核心：與 Gemini API 通訊
    static async getGeminiResponse(session, skipHistory = false) {
        if (!apiKey) throw new Error("Gemini API Key Missing.");

        // 1. 建立系統提示 (包含流程和數據上下文)
        const systemInstruction = `
            您是一個專業、友善且詳細的飯店 AI 助理「小智」，隸屬於海灣麗景酒店。
            請根據用戶的需求提供準確的資訊，並維持台灣繁體中文的專業語氣。
            
            **當前對話流程狀態 (僅供參考，請勿主動提及)：**
            - Booking State: ${session.bookingState || '未開始'}
            - Collected Data: ${JSON.stringify(session.collectedData, null, 2)}
            - User Type: ${session.userType}
            
            **回覆原則：**
            1. **主動訂房流程：** 如果 Rule Engine 決定暫停流程 (paused_waiting_for_resume)，請先專業地回答用戶的打斷問題，然後**絕對不要**主動添加恢復流程的提示（恢復提示會由後端自動添加 Rich Card）。
            2. **一般問題：** 根據 Collected Data 中的資訊（如 userType），客製化回答。對於飯店資訊查詢（如設施、天氣），請使用一般知識回答。
            3. **格式：** 使用 Markdown 語法（粗體、換行）美化排版。
        `.trim();

        // 2. 準備 Content
        const contents = [];
        // 設置系統提示
        contents.push({ role: 'system', parts: [{ text: systemInstruction }] });

        if (!skipHistory) {
             // 僅傳遞最近 10 輪的對話歷史 (共 20 個訊息)
             const historyForLLM = session.conversationHistory.slice(-20);
             for (const item of historyForLLM) {
                 if (item.role === 'user') {
                      contents.push({ role: 'user', parts: [{ text: item.message }] });
                 } else if (item.role === 'model') {
                      // 僅傳遞文字部分，忽略 Rich Card
                      contents.push({ role: 'model', parts: [{ text: item.message }] });
                 }
             }
        } else {
             // 特殊指令時，只傳遞單次指令
             const lastMessage = session.conversationHistory[session.conversationHistory.length - 1];
             if (lastMessage && lastMessage.role === 'user') {
                  contents.push({ role: 'user', parts: [{ text: lastMessage.message }] });
             }
        }
        
        // 3. 準備 Payload
        const payload = {
            contents: contents,
            config: {
                 // tools: tools, // 如果有 Function Calling，可以在這裡啟用
                 temperature: 0.5,
                 topK: 40
            }
        };

        // 4. 呼叫 API
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };

        const response = await fetchWithRetry(apiUrl, options);
        const json = await response.json();

        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) {
            return json.candidates[0].content.parts[0].text;
        } else if (json.error) {
             throw new Error(`Gemini API Error: ${json.error.message}`);
        } else {
             // 處理安全設定擋住的情況
             console.error("Gemini Response Blocked:", json.candidates[0].safetyRatings);
             throw new Error("Gemini 回覆被安全設定或內容篩選器阻擋。");
        }
    }
}


// ---------------------------------------------
// 6. Express 伺服器初始化與啟動
// ---------------------------------------------

// 1. 實例化 Express 應用程式 (修復 ReferenceError: app is not defined)
const app = express();

// 2. 中間件設定 (CORS 和 Body Parser)
app.use(cors());
app.use(express.json()); // 用來解析 POST 請求中的 JSON body

// 3. API 路由定義
app.post('/api/dialogue', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Missing sessionId or message.' });
    }

    try {
        // 1. 意圖分類並更新會話歷史
        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);

        // 2. 生成回應 (包含規則引擎和 LLM 邏輯)
        const { reply, richCard } = await ResponseGenerator.generateResponse(intents, session, message);

        // 3. 回覆用戶
        res.json({
            reply,
            richCard,
            session: {
                bookingState: session.bookingState,
                collectedData: session.collectedData,
                userType: session.userType // 傳回用戶類型供前端調試
            }
        });

    } catch (error) {
        console.error("處理對話請求時發生錯誤:", error);
        // 確保服務在錯誤時仍能回應
        res.status(500).json({
            error: "服務內部錯誤，請稍後再試。",
            detail: error.message
        });
    }
});

// 4. 服務健康檢查 (Health Check)
app.get('/', (req, res) => {
    res.send(`AI 訂房助理 (Gemini LLM) 服務運行中，端口: ${PORT}`);
});

// 5. 啟動伺服器
app.listen(PORT, HOST, () => {
    console.log(`🚀 服務已啟動: http://${HOST}:${PORT}`);
    console.log(`⏳ 會話超時設定: ${SESSION_TIMEOUT_MS / 60000} 分鐘`);
});

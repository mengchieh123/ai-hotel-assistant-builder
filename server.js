// server.js (Dialogue Flow 完整整合版 - 最終修正)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const path = require('path');
const app = express();
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat'); 
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";

const MODEL_NAME = "gemini-2.5-flash"; 
const API_VERSION = "v1";
const apiUrl = `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const tools = []; //禁用外部工具

// ---------------------------------------------
// 2. Dialogue Flow 配置
// ---------------------------------------------
const DIALOGUE_FLOW = {
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
            "prompt": "好的，我們將開始預訂。請問您想預訂的【房型】、預計【入住日期】和【住宿晚數】？ (例如：豪華客房，6月1日入住，共2晚 或 下週三入住三天)",
            "entities": ["roomType", "checkInDate", "nights"],
            "next_state": "ask_guest_count",
            "fallback": "請提供房型、入住日期及住宿晚數，我會為您查詢空房與價格。"
        },
        "ask_guest_count": {
            "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住呢？",
            "entities": ["adultCount", "childCount"],
            "next_state": "check_availability_and_price",
            "fallback": "請提供大人及兒童的人數。"
        },
        "check_availability_and_price": { 
            "prompt": "根據您的需求，我們已確認 {roomType} 房有空位。\n\n• 房費：${totalPriceNoChild} (不含兒童加價)\n• 兒童加價 ({childCount}位)：${childCost}\n• **總計：${totalPrice}**\n\n請問您是否確認【以總價 ${totalPrice} 繼續預訂】？",
            "intents": {
                "affirm": "ask_contact_info",
                "deny": "end_conversation"
            },
            "fallback": "請回答『確認』或『取消』。"
        },
        "ask_contact_info": {
            "prompt": "請提供您的【訂房姓名】和【聯絡Email】，以便我們為您完成預訂。",
            "entities": ["name", "email"],
            "next_state": "check_membership", 
            "fallback": "請提供您的姓名和 Email。"
        },
        "check_membership": { 
            "prompt": "感謝您！在確認價格前，您是否有本酒店的會員帳號呢？\n\n**溫馨提示：**登入會員可享 Gold 等級 8 折優惠！",
            "richCard": {
                "type": "button_list",
                "title": "會員登入：",
                "buttons": [
                    { "text": "💳 我要登入會員", "value": "我要登入會員" },
                    { "text": "❌ 我不是會員 (或暫不登入)", "value": "不是會員" }
                ]
            },
            "intents": {
                "member_login": "login_member_account",
                "deny": "confirm_member_and_meal"
            },
            "fallback": "請選擇是否登入會員，或告知『不是會員』。"
        },
        "login_member_account": { 
            "prompt": "請輸入您的【會員帳號】或【會員手機號碼】。",
            "entities": ["memberAccount"],
            "next_state": "apply_member_discount", 
            "fallback": "請輸入您的會員帳號或手機號碼，才能套用優惠喔！"
        },
        "confirm_member_and_meal": {
            "prompt": "您選擇不登入會員，將以原價 ${finalPrice} 計算。\n\n請問是否需要【加購早餐】？", 
            "richCard": {
                "type": "button_list",
                "title": "請選擇早餐需求：",
                "buttons": [
                    { "text": "🍽️ 加購早餐", "value": "要早餐" },
                    { "text": "❌ 不加購早餐", "value": "不要早餐" }
                ]
            },
            "intents": {
                "member_no_meal_yes": "confirm_booking", 
                "member_no_meal_no": "confirm_booking"
            },
            "fallback": "請告知是否加購早餐。"
        },
        "apply_member_discount": {
            "prompt": "✅ 會員登入成功！已為您套用 Gold 8折優惠，新的總價為 **${newTotalPrice}**。請問是否需要【加購早餐】？",
            "richCard": { 
                "type": "button_list",
                "title": "請選擇早餐需求：",
                "buttons": [
                    { "text": "🍽️ 加購早餐", "value": "要早餐" },
                    { "text": "❌ 不加購早餐", "value": "不要早餐" }
                ]
            },
            "intents": {
                "member_yes_meal_yes": "confirm_booking", 
                "member_yes_meal_no": "confirm_booking"
            },
            "next_state": "confirm_booking", 
            "fallback": "請告知是否加購早餐。"
        },
        "confirm_booking": {
            "prompt": "【最終確認】您訂購 {roomType} 房，入住 {checkInDate} ，共 {nights} 晚，訂房人 {name}，最終總價 **${finalPrice}**。您是否確認訂房？",
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
            "prompt": "感謝您，訂房完成！訂單編號 [ORD-xxxxxx] 已發送至 {email}。如有需要，可隨時查詢或取消訂單。",
            "end": true
        },
        "handle_promotion_query": {
            "prompt": "目前促銷資訊有 Gold 會員享8折優惠，還有免費早餐活動。請問您是否要開始【訂房流程】？",
            "next_state": "init"
        },
        "handle_general_inquiry": {
            "prompt": "請問您有什麼其他問題？",
            "next_state": "init"
        },
        "end_conversation": {
            "prompt": "感謝您的使用，祝您有美好的一天！",
            "end": true
        }
    }
};

// ---------------------------------------------
// 3. 核心工具類 (NLU, 狀態機, 規則引擎)
// ---------------------------------------------

// 智能意圖分類器
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // 核心訂房意圖
        if (/(訂房|預訂|入住|房間|住.*晚|房型|幫我訂|想要訂|預約房間|我要訂房)/.test(lowerMessage)) intents.add('booking');
        
        // 關鍵流程意圖 (affirm/deny 等)
        if (/(是|對|好|確認|願意|繼續|訂|要早餐)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不要早餐)/.test(lowerMessage)) intents.add('deny');
        
        // Rich Card 按鈕值
        if (lowerMessage === '💳 我要登入會員' || lowerMessage === '我要登入會員') intents.add('member_login');
        if (lowerMessage === '❌ 我不是會員 (或暫不登入)' || lowerMessage === '不是會員') intents.add('deny');

        // 早餐意圖 
        if (lowerMessage === '要早餐' || lowerMessage.includes('加購早餐')) intents.add('member_yes_meal_yes');
        if (lowerMessage === '不要早餐' || lowerMessage.includes('不加購早餐')) intents.add('member_yes_meal_no');

        // 流程相關的資訊意圖 
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (this.containsDatePatterns(message)) intents.add('date_input');
        
        // 其他不相關的資訊意圖 (會觸發跳題)
        const nonBookingIntents = [
            'transfer', 'restaurant', 'attractions', 'shopping', 
            'facilities', 'weather', 'itinerary', 'modification', 'emergency'
        ];
        
        // 意圖正規化判斷 (處理設施、天氣等)
        nonBookingIntents.forEach(intent => {
            if (
                (intent === 'facilities' && /(設施|泳池|健身房|spa|按摩)/.test(lowerMessage)) ||
                (intent === 'weather' && /(天氣|氣溫|下雨)/.test(lowerMessage)) ||
                (intent === 'emergency' && /(救命|火災|小偷)/.test(lowerMessage)) ||
                lowerMessage.includes(intent.replace(/_\w+/, ''))
            ) {
                intents.add(intent);
            }
        });
        
        // 最終回退：如果沒有任何明確意圖，則設為 general_inquiry
        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }
    
    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /今晚|今天|明天|後天|週末|下週|月底|週[一二三四五六日]/ // 修正：加入 '今晚'
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

    // 智慧時間處理邏輯 (修正「今晚」和晚數缺失問題)
    static parseDate(text) {
        const now = dayjs().startOf('day'); // 將當前日期時間歸零到當天 00:00:00
        let targetDate = null;
        let nights = null;

        // 1. 處理特定日期格式 (MM/DD, YYYY/MM/DD)
        const dateMatch = text.match(/(\d{1,4}[/\-]\d{1,2}[/\-]?\d{1,2})|(\d{1,2}[/\-]\d{1,2})/);
        if (dateMatch) {
            let dateStr = dateMatch[0];
            let year = now.year();
            if (dateStr.match(/\d{4}/)) { 
                targetDate = dayjs(dateStr, ['YYYY/MM/DD', 'YYYY-MM-DD']).startOf('day');
            } else { 
                if (dateStr.match(/\d{1,2}[/\-]\d{1,2}/)) {
                    const parts = dateStr.split(/[\/\-]/).map(n => parseInt(n, 10));
                    const month = parts.length > 1 ? parts[0] : null;
                    const day = parts.length > 1 ? parts[1] : parts[0];
                    
                    if (month && day) {
                         // 判斷月份是否已過，如果是則用下一年
                         let currentMonth = dayjs().month() + 1; // dayjs month is 0-indexed
                         let checkYear = year;
                         if (month < currentMonth) {
                             checkYear = year + 1;
                         } else if (month === currentMonth && day < dayjs().date()) {
                             // 如果是本月，但日期已過，也用下一年
                             checkYear = year + 1;
                         }

                         targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
                    }
                }
            }
        }

        // 2. 處理相對時間 (今天, 明天, 後天, 今晚)
        if (text.includes('今天') || text.includes('今晚') || text.includes('今夜')) { 
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        // 3. 處理星期 (下週三)
        const weekdayMatch = text.match(/(下週|這週)?週([一二三四五六日])/);
        if (weekdayMatch) {
            const weekdayMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            const targetDay = weekdayMap[weekdayMatch[2]];
            let date = now.weekday(targetDay);

            if (!weekdayMatch[1] || weekdayMatch[1].includes('這週')) {
                if (date.isSameOrAfter(now, 'day')) {
                    targetDate = date.startOf('day');
                } else {
                    targetDate = date.add(7, 'day').startOf('day');
                }
            } else if (weekdayMatch[1].includes('下週')) {
                // 強制定在下週
                if (date.isSameOrAfter(now, 'day')) {
                    targetDate = date.add(7, 'day').startOf('day');
                } else {
                    targetDate = date.add(7, 'day').startOf('day');
                }
            }
        }

        // 4. 提取晚數
        const nightsMatch = text.match(/(\d+)晚|(\d+)天|住到週([一二三四五六日])/);
        if (nightsMatch) {
            if (nightsMatch[1] || nightsMatch[2]) {
                nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
            } else if (nightsMatch[3] && targetDate) { 
                const weekdayMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
                const endDay = weekdayMap[nightsMatch[3]];
                let endDate = targetDate.weekday(endDay).startOf('day');
                
                if (endDate.isSameOrBefore(targetDate, 'day')) {
                    endDate = endDate.add(7, 'day');
                }
                nights = endDate.diff(targetDate, 'day');
            }
        }
        
        // 修正點：如果檢測到入住日期，但沒有明確的晚數，則預設為 1 晚
        if (targetDate && !nights) { 
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

        // 1. 處理日期和晚數 (使用新的智慧處理器)
        const dateResult = this.parseDate(lowerMessage);
        if (dateResult.checkInDate) data.checkInDate = dateResult.checkInDate;
        if (dateResult.nights) data.nights = dateResult.nights;

        // 2. 房型
        if (/(豪華客房|海景房|標準雙人房|行政套房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房)/)[0];
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
            if (extractedName && extractedName.length >= 2 && !extractedName.includes('訂房') && !extractedName.includes('本人')) {
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

        // 預設為 1 大人 0 兒童 (如果沒有提及人數)
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        
        return data;
    }
}

// 狀態機控制器
class BookingFlowController {
    static getFlow() {
        return DIALOGUE_FLOW;
    }

    static getCurrentState(session) {
        const stateKey = session.bookingState || 'init';
        // 處理暫停狀態
        if (stateKey === 'paused_waiting_for_resume' && session.pausedState) {
            return DIALOGUE_FLOW.states[session.pausedState];
        }
        return DIALOGUE_FLOW.states[stateKey];
    }
    
    // 執行價格計算 (模擬) - 包含兒童費用與會員折扣邏輯
    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType = '豪華客房', nights = 1, childCount = 0 } = data;
        let basePrice = 3200; 
        if (roomType.includes('標準')) basePrice = 2200;
        else if (roomType.includes('行政')) basePrice = 4800;

        const baseTotal = basePrice * nights;
        
        // 兒童加價：每位兒童每日 300 元
        const CHILD_DAILY_FEE = 300;
        const childCost = (childCount || 0) * CHILD_DAILY_FEE * nights; 
        
        let total = baseTotal + childCost;

        // 為了顯示，將不含兒童的總價也存起來
        data.totalPriceNoChild = baseTotal;
        data.childCost = childCost; 

        if (isMemberDiscount) {
            total *= 0.8; 
        }
        
        return Math.round(total);
    }
}


// 規則引擎類別
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
                console.log(`🎯 規則觸發: ${rule.name || rule.toString().substring(9, rule.toString().indexOf('('))}, 優先級: ${result.priority}`);
                return result;
            }
        }

        return { shouldProcess: false, priority: 0 };
    }

    // 🏨 訂房流程規則 
    static bookingFlowRule(intents, session, message) {
        const hasBookingIntent = intents.includes('booking');
        
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
                // 結束後給予短暫的緩衝時間，再清空狀態
                setTimeout(() => { session.bookingState = null; session.collectedData = {}; }, 500); 
                return { shouldProcess: false, priority: 0 }; 
            }
        }
        
        // 2. 🚦 流程恢復處理 (最高優先級檢查)
        if (session.bookingState === 'paused_waiting_for_resume' && session.pausedState) {
            if (intents.includes('affirm')) {
                // 恢復流程：將狀態切換回暫停前的狀態
                console.log(`✅ 檢測到 affirm。從暫停狀態 ${session.pausedState} 恢復流程。`);
                session.bookingState = session.pausedState;
                session.pausedState = null;
                // 繼續執行 3. 的正常流程
            } else if (intents.includes('deny')) {
                // 結束流程
                console.log(`❌ 檢測到 deny。結束訂房流程。`);
                session.bookingState = 'end_conversation';
                session.pausedState = null;
                return {
                    shouldProcess: true,
                    priority: 95,
                    response: DIALOGUE_FLOW.states['end_conversation'].prompt,
                    nextStep: 'end_conversation',
                    updateSession: true
                };
            } else {
                // 如果用戶沒有明確回覆「確認/取消」，讓 LLM 處理用戶的非流程回覆 (應在 ResponseGenerator 處理)
                return { shouldProcess: false, priority: 0 }; 
            }
        }


        // 2.5. 🚨 核心切換邏輯 (流程暫停) - 處理明確的流程打斷意圖
        if (session.bookingState && session.bookingState !== 'init' && isSwitchingTopic) {
             console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);
             
             session.pausedState = session.bookingState;
             session.bookingState = 'paused_waiting_for_resume';
             
             // 讓 LLM 處理用戶的非流程問題
             return { shouldProcess: false, priority: 0 }; 
        }
        
        // 2.7. 🚫 【修正點】若在流程中但收到最低級的 general_inquiry，讓 LLM 接管 (防止 Fallback 循環)
        if (session.bookingState && session.bookingState !== 'init' && intents.includes('general_inquiry')) {
            console.log(`⚠️ 流程中收到 general_inquiry。暫停流程，轉交給 LLM 處理模糊查詢。`);
            
            session.pausedState = session.bookingState;
            session.bookingState = 'paused_waiting_for_resume';
            return { shouldProcess: false, priority: 0 }; 
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
                // 排除 email 和 memberAccount 的必填性檢查
                const requiredEntities = currentState.entities.filter(e => e !== 'email' && e !== 'memberAccount');
                
                const allEntitiesCollected = requiredEntities.every(
                    entity => session.collectedData[entity] !== undefined && session.collectedData[entity] !== null
                );
                
                if (allEntitiesCollected) {
                    nextStateKey = currentState.next_state;
                } else {
                    // 如果實體不完整，停留在當前狀態，回覆 fallback
                    return {
                        shouldProcess: true,
                        priority: 95, 
                        response: currentState.fallback, 
                        nextStep: session.bookingState,
                        updateSession: true,
                        richCard: currentState.richCard || null
                    };
                }
            }

            // 7. 處理特殊狀態的後端動作 (價格計算和折扣)
            // 在這些狀態切換前，先計算價格，因為它們可能會被多個路徑調用
            if (nextStateKey === 'check_membership' || nextStateKey === 'confirm_member_and_meal') {
                 const data = session.collectedData;
                 // 計算一次無折扣的總價
                 data.totalPrice = BookingFlowController.calculatePrice(data, false);
                 data.finalPrice = data.totalPrice; // 作為非會員時的最終價格基礎
            }
            
            if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                // 登入成功，計算會員折扣價格
                data.newTotalPrice = BookingFlowController.calculatePrice(data, true);
                data.finalPrice = data.newTotalPrice; // 更新為會員最終價格
            }

            // 8. 確保狀態轉移
            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            // 9. 格式化回覆 (變數替換)
            let responseText = nextState.prompt;
            for (const key in session.collectedData) {
                const value = session.collectedData[key] || '';
                // 替換所有變量
                responseText = responseText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                responseText = responseText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }
            
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

    // 🚨 緊急規則 (保持不變)
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

    // 📞 一般規則 (保持不變)
    static generalRule(intents, session, message) {
        return {
            shouldProcess: true,
            priority: 10,
            response: "👋 您好！我是海灣麗景酒店AI助理小智\n\n我可以協助您：訂房、接送、餐廳推薦、價格查詢、景點導覽、天氣資訊等服務。\n\n請問今天需要什麼協助呢？"
        };
    }
}


// 會話狀態管理器 (保持不變)
class SessionManager {
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
}

const sessionManager = new SessionManager();

// ---------------------------------------------
// 4. API 通訊工具 (保持不變)
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
// 5. 回應生成與 LLM 邏輯 (保持不變)
// ---------------------------------------------
class ResponseGenerator {
    static async handleSpecialCommands(message, session) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            console.log(`🟢 執行特殊指令：翻譯 "${textToTranslate}"`);
            try {
                const prompt = `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"`;
                session.conversationHistory.push({ role: 'user', message: prompt });
                const reply = await this.getGeminiResponse(session, true); 
                session.conversationHistory.pop();
                return { reply: `🌐 **翻譯結果：**\n\n${reply}`, richCard: null }; 
            } catch (e) {
                console.error("翻譯服務失敗:", e

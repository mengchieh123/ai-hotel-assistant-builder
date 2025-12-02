// server.js (AI 訂房助理 - 完整版，含熱加載)

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); 
const path = require('path');
const fs = require('fs'); // 導入 fs 模組 (熱加載需要)
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
// 2. DIALOGUE FLOW 配置加載器 (FlowConfigLoader)
// ---------------------------------------------

/**
 * 負責從外部 JSON 檔案載入對話配置 (dialogue_flow.json)
 * 並監控檔案變動，實作熱加載 (Hot Reload)。
 */
class FlowConfigLoader {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        this.config = this.loadConfig();
        this.startWatcher();
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

    startWatcher() {
        // 監控檔案變動，但忽略連寫操作中的臨時文件
        fs.watch(this.filePath, { recursive: false }, (eventType, filename) => {
            if (eventType === 'change') {
                try {
                    // 重新讀取，避免讀取到未寫入完成的檔案
                    const newData = fs.readFileSync(this.filePath, 'utf8');
                    this.config = JSON.parse(newData);
                    console.log(`🔥 [Hot Reload] 成功更新配置！時間: ${new Date().toLocaleTimeString()}`);
                } catch (error) {
                    // 格式錯誤時，僅報錯並保持舊配置
                    console.error(`❌ [Hot Reload] 更新配置失敗，請檢查 JSON 格式: ${error.message}`);
                }
            }
        });
    }

    // Getter 確保每次調用都獲取最新的配置
    get DIALOGUE_FLOW() {
        return this.config;
    }
}

// 初始化配置加載器，在服務器啟動時就開始監控
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
                         let currentMonth = dayjs().month() + 1; 
                         let checkYear = year;
                         if (month < currentMonth) {
                             checkYear = year + 1;
                         } else if (month === currentMonth && day < dayjs().date()) {
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

        // 預設值
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        
        return data;
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
    
    // 執行價格計算 (模擬)
    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType = '豪華客房', nights = 1, childCount = 0 } = data;
        let basePrice = 3200; 
        if (roomType.includes('標準')) basePrice = 2200;
        else if (roomType.includes('行政')) baseOnlyPrice = 4800;
        else if (roomType.includes('豪華')) basePrice = 3200;

        const baseTotal = basePrice * nights;
        
        const CHILD_DAILY_FEE = 300;
        const childCost = (childCount || 0) * CHILD_DAILY_FEE * nights; 
        
        let total = baseTotal + childCost;

        data.totalPriceNoChild = baseTotal;
        data.childCost = childCost; 

        if (isMemberDiscount) {
            total *= 0.8; 
        }
        
        return Math.round(total);
    }
}

/**
 * 規則引擎類別：負責根據意圖、會話狀態和配置來決定最終回應。
 */
class RuleEngine {
    static process(intents, session, message) {
        const rules = [
            this.emergencyRule, // 最高優先級
            this.bookingFlowRule, // 次高優先級 (狀態機核心)
            this.generalRule // 最低優先級 (通用回覆)
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

    // 🏨 訂房流程規則 (核心狀態機邏輯)
    static bookingFlowRule(intents, session, message) {
        const flow = flowLoader.DIALOGUE_FLOW; // 獲取最新的動態配置
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
                // 短暫延遲後清除狀態，避免重複觸發
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
                    priority: 95,
                    response: flow.states['end_conversation'].prompt, 
                    nextStep: 'end_conversation',
                    updateSession: true
                };
            } else {
                // 讓 LLM 處理詢問恢復狀態時的追問
                return { shouldProcess: false, priority: 0 }; 
            }
        }

        // 2.5. 🚨 核心切換邏輯 (流程暫停) - 處理明確的流程打斷意圖
        if (session.bookingState && session.bookingState !== 'init' && isSwitchingTopic) {
             console.log(`⚠️ 用戶在流程中 (State: ${session.bookingState}) 詢問了不相關的主題。暫停流程。`);
             
             session.pausedState = session.bookingState;
             session.bookingState = 'paused_waiting_for_resume';
             
             // 讓 LLM 處理打斷問題，並在回覆後提示恢復 (由 ResponseGenerator 處理)
             return { shouldProcess: false, priority: 0 }; 
        }
        
        // 2.7. 🚫 修正點：若在流程中但收到最低級的 general_inquiry，讓 LLM 接管 (防止 Fallback 循環)
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
                
                // 暫時不要求 email 和 memberAccount
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

            // 8. 確保狀態轉移
            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            // 9. 格式化回覆 (變數替換)
            let responseText = nextState.prompt;
            for (const key in session.collectedData) {
                const value = session.collectedData[key] || '';
                // 替換 {key} 和 ${key} 兩種格式
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


/**
 * 會話狀態管理器：負責存儲和管理每個用戶的會話數據。
 */
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
    
    // 特殊指令處理 (例如翻譯)
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
                console.error("翻譯服務失敗:", e.message); // 修正語法錯誤
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

        console.log(`🎯 意圖識別: ${intents.join(', ')}, 用戶類型: ${session.userType}`);
        
        // 1. 使用規則引擎處理所有意圖 (高優先級)
        const ruleResult = RuleEngine.process(intents, session, message);
        
        let finalReply = ruleResult.response || null;
        let finalRichCard = ruleResult.richCard || null;
        
        // 如果規則引擎產生了高優先級回覆 (例如：流程或緊急)
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            console.log("🟢 使用高優先級規則引擎回覆。");
            return { 
                reply: finalReply, 
                richCard: finalRichCard
            };
        }

        // 2. 複雜/一般問題使用 AI (LLM 優先級 ~50)
        try {
            console.log("🤖 嘗試使用 Gemini AI 處理複雜問題 (LLM 優先級 ~50)");
            const geminiReply = await this.getGeminiResponse(session, false);
            finalReply = geminiReply; 
            finalRichCard = null; 
        } catch (error) {
            // 🚨 關鍵錯誤隔離點
            console.error("🚫 LLM 服務失敗，強制回退到最安全的通用問候。", error.message);
            finalReply = "👋 您好！目前 AI 服務暫時無法處理複雜查詢，但我可以隨時為您啟動訂房流程（說『我要訂房』），或處理緊急事項（說『緊急求助』）。";
            finalRichCard = null;
        }
        
        // 3. 檢查並附加恢復提示 (流程打斷與恢復的核心)
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

    // 🟡 核心：與 Gemini API 通訊
    static async getGeminiResponse(session, isSpecialCommand = false) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Cannot call LLM.");
            throw new Error("Gemini API Key Missing."); 
        }

        try {
            // 如果是特殊指令，只傳遞最新一條訊息，避免影響上下文
            const history = isSpecialCommand ? [session.conversationHistory.findLast(item => item.role === 'user')] : session.conversationHistory;

            const systemInstruction = `你是一個專業、親切的[海灣麗景酒店]AI助理。你的任務是解答用戶關於酒店、旅遊、生活等任何問題。如果用戶的請求未被高優先級規則（例如訂房、緊急）處理，請使用你的專業知識回答。請使用繁體中文回應。`;

            // 淨化歷史記錄
            const contents = [
                { role: 'user', parts: [{ text: systemInstruction }] },
                ...history
                    .filter(item => item && (item.role === 'user' || item.role === 'model')) 
                    .map(item => ({
                        role: item.role === 'user' ? 'user' : 'model',
                        parts: [{ text: item.message || '' }] 
                    }))
            ];

            const payload = {
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" }
                ],
            };
            
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (result.error) {
                console.error("[Gemini API] Error Response:", JSON.stringify(result.error, null, 2)); 
                throw new Error(`API Error: ${result.error.message}`);
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("[Gemini API] Empty response or content was blocked:", JSON.stringify(result, null, 2)); 
                throw new Error("No valid text in response or content was blocked.");
            }
        } catch (error) {
            console.error("Error communicating with Gemini API:", error.message); 
            throw error;
        }
    }
}

// ---------------------------------------------
// 6. Express 路由定義
// ---------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/healthz', (req, res) => {
    res.status(200).send({ status: 'ok', api_status: apiKey ? 'ready' : 'missing_key' });
});

app.post('/chat', async (req, res) => {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk.toString();
    });

    req.on('end', async () => {
        let payload;
        let sessionId = 'unknown'; 

        try {
            if (!rawBody) {
                throw new Error("Empty request body received.");
            }
            payload = JSON.parse(rawBody);
            
            sessionId = payload.sessionId;
            const message = payload.message;
            
            if (!sessionId || !message) {
                return res.status(400).json({ error: '缺少 sessionId 或 message 參數', reply: '缺少 sessionId 或 message 參數', sessionId: sessionId || 'unknown' });
            }
            
            // 特殊指令：初始化連接
            if (message === 'initial_connection_message') {
                 const session = sessionManager.getSession(sessionId);
                 session.bookingState = 'init';
                 
                 const initialState = flowLoader.DIALOGUE_FLOW.states['init']; 
                 const reply = initialState.prompt;
                 const richCard = initialState.richCard;
                 
                 return res.json({ reply, richCard, sessionId });
            }
            

            if (!apiKey) {
                const errorReply = "服務器錯誤：未配置 Gemini API Key。";
                console.error(errorReply);
                return res.status(503).json({ error: errorReply, reply: errorReply, sessionId });
            }

            const intents = SmartIntentClassifier.classify(message);
            const session = sessionManager.updateSession(sessionId, message, intents);

            const result = await ResponseGenerator.generateResponse(intents, session, message);
            
            const reply = result.reply;
            const richCard = result.richCard;

            sessionManager.addAssistantResponse(sessionId, reply, richCard);

            res.json({ 
                reply: reply, 
                richCard: richCard,
                sessionId 
            });

        } catch (error) {
            console.error("🚫 聊天路由發生錯誤:", error.message, error.stack);
            
            const errorReply = `抱歉，系統發生錯誤，無法處理您的請求。錯誤細節：${error.message.substring(0, 150)}...`;
            
            const statusCode = (error.message.includes('sessionId') || error.message.includes('message') || error.message.includes('Empty request body')) ? 400 : 500;

            res.status(statusCode).json({ 
                error: errorReply,
                reply: errorReply, 
                sessionId: sessionId || 'unknown'
            });
        }
    });

    req.on('error', (err) => {
        console.error('Request stream error:', err);
        if (!res.headersSent) {
            res.status(500).send({ error: "數據流錯誤" });
        }
    });
}); // 結束 app.post('/chat') 路由定義

// ---------------------------------------------
// 7. 伺服器啟動
// ---------------------------------------------
app.listen(PORT, HOST, () => {
    console.log(`✅ Server is running on http://${HOST}:${PORT}`);
    console.log(`🔑 Gemini API Key Status: ${apiKey ? 'Loaded' : 'MISSING!'}`);
    console.log(`📝 Dialogue Flow Status: Now using Hot Reloading from ${flowLoader.filePath}.`);
});

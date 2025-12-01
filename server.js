// server.js (Dialogue Flow 完整整合版 - 支援靜態網頁服務, 新增 Rich Card 支援)
// 海灣麗景酒店 AI 智能助理

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
// 使用您的模型名稱
const MODEL_NAME = "gemini-1.5-flash-latest";
const apiUrl = `${API_BASE}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const tools = []; // 徹底禁用外部工具以確保零費用

// ---------------------------------------------
// 2. Dialogue Flow 配置 (您的 JSON 流程)
// ---------------------------------------------
const DIALOGUE_FLOW = {
    "states": {
        "init": {
            "prompt": "您好，歡迎使用 AI 訂房助理！請問您是想【預訂房間】還是【查詢資訊】呢？",
            "intents": {
                "booking": "collect_room_and_dates", // 意圖名稱已修正為 'booking'
                "ask_promotion": "handle_promotion_query",
                "general_inquiry": "handle_general_inquiry"
            },
            "fallback": "抱歉，我沒聽懂您的意思，請告訴我是想預訂房間或查詢其他資訊？"
        },
        "collect_room_and_dates": {
            "prompt": "好的，我們將開始預訂。請問您想預訂的【房型】、預計【入住日期】和【住宿晚數】？ (例如：豪華客房，6月1日入住，共2晚)",
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
            "prompt": "根據您的需求，我們已確認 {roomType} 房有空位，總價為 ${totalPrice}。**請注意：**2歲以上兒童需加收費用。請問您是否確認【以總價 ${totalPrice} 繼續預訂】？",
            "intents": {
                "affirm": "ask_contact_info",
                "deny": "end_conversation"
            },
            "fallback": "請回答『確認』或『取消』。"
        },
        "ask_contact_info": {
            "prompt": "請提供您的【訂房姓名】和【聯絡Email】，以便我們為您完成預訂。",
            "entities": ["name", "email"],
            "next_state": "confirm_member_and_meal",
            "fallback": "請提供您的姓名和 Email。"
        },
        "confirm_member_and_meal": {
            "prompt": "請問您是會員嗎？(會員可享Gold等級8折優惠)。另外，請問是否需要【加購早餐】？",
            "intents": {
                "member_yes_meal_yes": "apply_member_discount",
                "member_yes_meal_no": "apply_member_discount",
                "member_no_meal_yes": "confirm_booking",
                "member_no_meal_no": "confirm_booking"
            },
            "fallback": "請告知是否為會員，以及是否加購早餐。"
        },
        "apply_member_discount": {
            "prompt": "已為您套用會員優惠，新的總價為 ${newTotalPrice}。即將進入最終確認。",
            "next_state": "confirm_booking"
        },
        "confirm_booking": {
            "prompt": "【最終確認】您訂購 {roomType} 房，入住 {checkInDate} ，共 {nights} 晚，訂房人 {name}，最終總價 ${finalPrice}。您是否確認訂房？",
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

// 智能意圖分類器 (包含實體提取輔助功能)
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // 確保所有訂房相關意圖統一為 'booking'
        if (/(訂房|預訂|入住|房間|住.*晚|房型|幫我訂|想要訂|預約房間)/.test(lowerMessage)) intents.add('booking');
        
        if (/(接送|機場|接機|送機|交通|距離|多遠|車程)/.test(lowerMessage)) intents.add('transfer');
        if (/(餐廳|推薦|美食|吃|海鮮|晚餐|早餐|午餐|訂位)/.test(lowerMessage)) intents.add('restaurant');
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (/(景點|觀光|好玩|旅遊|推薦.*地方|去哪玩)/.test(lowerMessage)) intents.add('attractions');
        if (/(購物|夜市|商店|超市|便利商店|買東西)/.test(lowerMessage)) intents.add('shopping');
        if (/(設施|泳池|健身房|spa|按摩|三溫暖)/.test(lowerMessage)) intents.add('facilities');
        if (/(天氣|氣象|溫度|下雨|颱風|氣溫)/.test(lowerMessage)) intents.add('weather');
        if (/(行程|規劃|安排|旅遊計畫|一日遊)/.test(lowerMessage)) intents.add('itinerary');
        if (this.containsDatePatterns(message)) intents.add('date_input');
        if (/(取消|退訂|改期|變更|修改)/.test(lowerMessage)) intents.add('modification');
        if (/(緊急|救命|幫忙|協助|問題|麻煩)/.test(lowerMessage)) intents.add('emergency');
        
        // 🚨 處理肯定/否定 (專用於 Dialogue Flow 內部的 Intention)
        if (/(是|對|好|確認|願意|繼續|訂)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了)/.test(lowerMessage)) intents.add('deny');
        
        // 🚨 處理會員與早餐複合意圖 (簡化邏輯)
        const isMember = /(會員|member)/.test(lowerMessage);
        const needsMeal = /(早餐|meal)/.test(lowerMessage);
        
        // 由於用戶的複合意圖判斷邏輯是精確匹配，我們遵循它，但注意其優先級可能覆蓋單獨的 affirm/deny
        if (isMember && needsMeal) {
            intents.add('member_yes_meal_yes');
        } else if (isMember && !needsMeal) {
            intents.add('member_yes_meal_no');
        } else if (!isMember && needsMeal) {
            intents.add('member_no_meal_yes');
        } else if (!isMember && !needsMeal) {
            intents.add('member_no_meal_no');
        }

        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }

    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2}/,
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /\d{1,2}月\d{1,2}號/,
            /明天|後天|週末|下週|月底|今天|今晚/
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

    // 輔助函式：用於臨時提取實體 (已根據上一個版本修正)
    static extractEntities(message) {
        const data = {};
        const lowerMessage = message.toLowerCase();

        // 房型
        if (/(豪華客房|海景房|標準雙人房|行政套房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房)/)[0];
        }
        
        // 日期
        const dateMatch = lowerMessage.match(/(\d{1,2}[\/\-]\d{1,2})|(\d{1,2}月\d{1,2}日)|(明天|後天)/);
        if (dateMatch) {
            data.checkInDate = dateMatch[0].trim().replace(/\s/g, ''); 
        }
        
        // 晚數
        const nightsMatch = lowerMessage.match(/(\d+)晚/);
        if (nightsMatch) {
            data.nights = parseInt(nightsMatch[1], 10);
        } else if (/(一|兩)晚/.test(lowerMessage)) { 
             data.nights = lowerMessage.includes('兩晚') ? 2 : 1;
        }


        // 人數
        const adultMatch = lowerMessage.match(/(\d+)位大人|(\d+)大/);
        if (adultMatch) {
            data.adultCount = parseInt(adultMatch[1] || adultMatch[2], 10);
        }
        const childMatch = lowerMessage.match(/(\d+)位兒童|(\d+)小/);
        if (childMatch) {
            data.childCount = parseInt(childMatch[1] || childMatch[2], 10);
        }

        // 聯絡方式 - NAME
        // 匹配所有可能的引導詞後面的 2-4 個中文字（修正舊版過於簡單的提取）
        const nameMatch = message.match(/(?:名字是|稱呼是|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);

        if (nameMatch) {
            let extractedName = nameMatch[1] || nameMatch[2]; 
            if (extractedName && extractedName.length >= 2) {
                data.name = extractedName.trim();
                if (data.name.includes('我的') || data.name.includes('名字') || data.name.includes('訂房') || data.name.includes('本人')) {
                    data.name = undefined;
                }
            }
        }
        
        // 聯絡方式 - EMAIL
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
            data.email = emailMatch[0];
        }

        // 確保 childCount 和 adultCount 至少是 0
        if (data.adultCount === undefined) data.adultCount = 0;
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
        return DIALOGUE_FLOW.states[stateKey];
    }
    
    // 執行價格計算 (模擬)
    static calculatePrice(data, isMemberDiscount = false) {
        const { roomType = '豪華客房', nights = 1, childCount = 0 } = data;
        let basePrice = 3200; // 豪華客房基礎價
        if (roomType.includes('標準')) basePrice = 2200;
        else if (roomType.includes('行政')) basePrice = 4800;

        let total = basePrice * nights;
        
        // 兒童加價 (簡化：假設每個兒童加 300)
        total += (childCount || 0) * 300; 

        // 會員折扣
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
            this.bookingFlowRule, // 🚨 訂房流程優先
            // ... [其他規則]
            this.generalRule
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

    // 🏨 訂房流程規則 (使用 JSON 狀態機重構)
    static bookingFlowRule(intents, session, message) {
        const hasBookingIntent = intents.includes('booking');
        
        // 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
            if (hasBookingIntent) {
                 session.bookingState = 'init'; // 如果結束後用戶又發起訂房，則重新開始
            } else {
                // 延遲重置，確保最後一個回應能儲存
                setTimeout(() => { session.bookingState = null; session.collectedData = {}; }, 500); 
                return { shouldProcess: false, priority: 0 }; 
            }
        }

        // 如果訊息包含 booking 意圖，或者 session 已經在流程中
        if (hasBookingIntent || session.bookingState) {
            
            // 確定當前狀態
            if (!session.bookingState) session.bookingState = 'init';
            
            let currentState = BookingFlowController.getCurrentState(session);
            let nextStateKey = session.bookingState;
            
            // 1. 提取實體並更新 session
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(session.collectedData, extractedEntities);

            // 2. 嘗試根據意圖轉移
            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            // 3. 檢查實體是否收集完畢以轉移到下一個狀態
            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {
                const allEntitiesCollected = currentState.entities.every(
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
                        updateSession: true
                    };
                }
            }

            // 4. 處理特殊狀態的後端動作 (價格計算和折扣)
            if (nextStateKey === 'check_availability_and_price') {
                const data = session.collectedData;
                data.totalPrice = BookingFlowController.calculatePrice(data, false);
                data.finalPrice = data.totalPrice; 
            } else if (nextStateKey === 'apply_member_discount') {
                const data = session.collectedData;
                data.newTotalPrice = BookingFlowController.calculatePrice(data, true);
                data.finalPrice = data.newTotalPrice; 
            }

            // 5. 確保狀態轉移
            session.bookingState = nextStateKey;
            let nextState = BookingFlowController.getCurrentState(session);

            // 6. 格式化回覆 (變數替換)
            let responseText = nextState.prompt;
            for (const key in session.collectedData) {
                const value = session.collectedData[key] || '';
                responseText = responseText.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                responseText = responseText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }
            
            // 7. 🚨 Rich Card/按鈕列表 邏輯 🚨
            let richCard = null;
            if (session.bookingState === 'confirm_member_and_meal') {
                richCard = {
                    type: 'button_list',
                    title: '請問您的會員身份與早餐需求：',
                    buttons: [
                        { text: '✅ 會員 + 加購早餐', value: '是會員且要早餐' },
                        { text: '🧑‍💼 會員 + 不加購早餐', value: '是會員但不加購早餐' },
                        { text: '🍽️ 不是會員 + 加購早餐', value: '不是會員但要早餐' },
                        { text: '❌ 不是會員 + 不加購早餐', value: '不是會員且不要早餐' }
                    ]
                };
            }
            
            // 流程結束後重置狀態 (已移至開頭，這裡只需更新 session.bookingState)

            return {
                shouldProcess: true,
                priority: 95, 
                response: responseText, 
                richCard: richCard, // 🚨 新增 Rich Card 輸出
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

    // [簡化：未使用的規則保持為 false]
    static transferRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static pricingRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static memberRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static attractionsRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static shoppingRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static itineraryRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static medicalRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static modificationRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static weatherRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static restaurantRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }
    static facilityRule(intents, session, message) { return { shouldProcess: false, priority: 0 }; }

    // 📞 一般規則 (作為最終回退)
    static generalRule(intents, session, message) {
        if (intents.includes('general_inquiry') || intents.length === 0) {
            return {
                shouldProcess: true,
                priority: 10,
                response: "👋 您好！我是海灣麗景酒店AI助理小智\n\n我可以協助您：訂房、接送、餐廳推薦、價格查詢、景點導覽、天氣資訊等服務。\n\n請問今天需要什麼協助呢？"
            };
        }
        return { shouldProcess: false, priority: 0 };
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
                bookingState: null, 
                collectedData: {}, 
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
        session.conversationHistory.push({
            role: 'user',
            message,
            intents,
            timestamp: new Date().toISOString()
        });
        session.userType = SmartIntentClassifier.detectUserType(message);
        // 確保 intents 是陣列
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
            richCard: richCard, // 🚨 儲存 richCard 在歷史紀錄中
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
            
            if (response.status === 400 || response.status === 404) {
                throw new Error(`API response error: ${response.status} ${response.statusText}`);
            }
            
            if (response.status === 429 && attempt < MAX_RETRIES) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                console.warn(`[Gemini API] Rate limit hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, attempt + 1);
            }
            
            throw new Error(`API response error: ${response.status} ${response.statusText}`);
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
        // [翻譯功能代碼保持不變]
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            const textToTranslate = translateMatch[1].trim();
            console.log(`🟢 執行特殊指令：翻譯 "${textToTranslate}"`);
            try {
                const prompt = `請將以下中文文本翻譯成流利的英文，只輸出翻譯結果，不要包含任何額外解釋或註釋："${textToTranslate}"`;
                session.conversationHistory.push({ role: 'user', message: prompt });
                const reply = await this.getGeminiResponse(session);
                session.conversationHistory.pop();
                return { reply: `🌐 **翻譯結果：**\n\n${reply}`, richCard: null }; // 返回結構化物件
            } catch (e) {
                console.error("翻譯服務失敗:", e.message);
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
        
        // 🚨 第一步：使用規則引擎處理所有意圖 (包括高優先級的訂房流程)
        const ruleResult = RuleEngine.process(intents, session, message);
        
        // 如果規則引擎產生了回應，並且優先級足夠高，則使用它
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            // 🚨 返回結構化結果
            return { 
                reply: ruleResult.response, 
                richCard: ruleResult.richCard || null // 傳遞 Rich Card
            };
        }

        // 🤖 第二步：複雜/一般問題使用 AI
        try {
            console.log("🤖 嘗試使用 Gemini AI 處理複雜問題 (已禁用外部工具)");
            const geminiReply = await this.getGeminiResponse(session);
            // 🚨 返回結構化結果
            return { reply: geminiReply, richCard: null };
        } catch (error) {
            console.error("AI 服務失敗，使用規則回覆:", error.message);
            // 優雅回退到規則引擎或預設回應
            return this.getEnhancedFallbackResponse(intents, session, message, ruleResult);
        }
    }

    static getEnhancedFallbackResponse(intents, session, message, ruleResult) {
        if (ruleResult.shouldProcess) {
            // 🚨 返回結構化結果
            return { 
                reply: ruleResult.response, 
                richCard: ruleResult.richCard || null 
            };
        }
        // 使用通用規則作為最終回退，🚨 返回結構化結果
        return { 
            reply: RuleEngine.generalRule(intents, session, message).response, 
            richCard: null 
        };
    }

    // 🟡 核心：與 Gemini API 通訊
    static async getGeminiResponse(session) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Using rule-based response.");
            return RuleEngine.generalRule([], session, "").response;
        }

        try {
            const contents = session.conversationHistory
                .filter(item => item.role === 'user' || item.role === 'model') // 過濾無效歷史
                .map(item => ({
                    role: item.role === 'user' ? 'user' : 'model',
                    parts: [{ text: item.message }]
                }));

            const payload = {
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ],
            };
            
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (result.error) {
                throw new Error(`API Error: ${result.error.message}`);
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("[Gemini API] Empty response or blocked:", JSON.stringify(result, null, 2));
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

// 靜態檔案服務設定
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// 處理 CORS 和 JSON/URL 編碼
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// 根路徑導向
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'working-chat.html')); 
});


// 健康檢查路徑
app.get('/healthz', (req, res) => {
    res.status(200).send({ status: 'ok', api_status: apiKey ? 'ready' : 'missing_key' });
});


// 聊天路由 (前端連線的唯一 API)
app.post('/chat', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: '缺少 sessionId 或 message 參數' });
    }
    
    // 檢查 API Key
    if (!apiKey) {
        return res.status(503).json({ 
            error: "服務器錯誤：未配置 Gemini API Key。",
            reply: RuleEngine.generalRule([], sessionManager.getSession(sessionId), "").response // 統一使用 reply 鍵
        });
    }

    try {
        // 1. 更新會話狀態並獲取意圖
        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);

        // 2. 🌟 生成回應 (RuleEngine 優先處理 Dialogue Flow，否則呼叫 AI)
        const result = await ResponseGenerator.generateResponse(intents, session, message);
        
        // 3. 儲存 AI 回應 (現在要儲存 reply 和 richCard)
        sessionManager.addAssistantResponse(sessionId, result.reply, result.richCard);

        // 🚨 4. 回傳結構化 JSON
        res.json({ 
            reply: result.reply, 
            richCard: result.richCard, // 將 richCard 傳回前端
            sessionId 
        });

    } catch (error) {
        console.error("主要聊天路由發生錯誤:", error);
        res.status(500).json({ 
            error: "服務器處理錯誤，請稍後再試。",
            reply: `抱歉，系統發生錯誤：${error.message}`,
            sessionId
        });
    }
});


// ---------------------------------------------
// 7. 伺服器啟動
// ---------------------------------------------

app.listen(PORT, HOST, () => {
    console.log(`✅ Server is running on http://${HOST}:${PORT}`);
    console.log(`🔑 Gemini API Key Status: ${apiKey ? 'Loaded' : 'MISSING!'}`);
    console.log(`🚫 Custom Search Tool: Disabled for zero-cost operation.`);
    console.log(`📝 Dialogue Flow Status: Fully Integrated.`);
    console.log(`🌐 Static files served from: ${PUBLIC_DIR}`);
});

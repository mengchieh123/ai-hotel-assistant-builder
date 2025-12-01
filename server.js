// server.js (Dialogue Flow 完整整合版 - 支援靜態網頁服務)
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

// 確保使用 Render 提供的 PORT，否則使用 10000
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";

// 模型名稱
const MODEL_NAME = "gemini-2.5-flash"; 

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
                "book_room": "collect_room_and_dates",
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
        
        // 確保所有訂房相關意圖統一為 'book_room'
        if (/(訂房|預訂|入住|房間|住.*晚|房型|幫我訂|想要訂|預約房間)/.test(lowerMessage)) intents.add('book_room');
        
        if (/(會員|積分|優惠|折扣|促銷|金卡)/.test(lowerMessage)) intents.add('member_query');
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing_query');
        
        if (/(是|對|好|確認|願意|繼續|訂)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了)/.test(lowerMessage)) intents.add('deny');
        
        // 複合意圖判斷 (用於 confirm_member_and_meal 狀態)
        const isMember = /(會員|member)/.test(lowerMessage);
        const needsMeal = /(早餐|meal)/.test(lowerMessage);

        if (isMember && needsMeal) {
            intents.add('member_yes_meal_yes');
        } else if (isMember && !needsMeal) {
            intents.add('member_yes_meal_no');
        } else if (!isMember && needsMeal) {
            intents.add('member_no_meal_yes');
        } else if (!isMember && !needsMeal) {
            intents.add('member_no_meal_no');
        }

        // 如果沒有偵測到特定意圖，預設為 general_inquiry
        if (intents.size === 0) {
            return ['general_inquiry'];
        }

        return Array.from(intents);
    }

    static detectUserType(message) {
        const lowerMessage = message.toLowerCase();
        if (/(家庭|小孩|兒童|親子|寶寶)/.test(lowerMessage)) return 'family';
        if (/(情侶|夫妻|蜜月|浪漫)/.test(lowerMessage)) return 'couple';
        if (/(商務|會議|出差|辦公)/.test(lowerMessage)) return 'business';
        return 'individual';
    }

    // 輔助函式：用於臨時提取實體
    static extractEntities(message) {
        const data = {};
        const lowerMessage = message.toLowerCase();

        // 房型
        if (/(豪華客房|海景房|標準雙人房|行政套房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房)/)[0];
        }
        
        // 日期
        const dateMatch = lowerMessage.match(/(\d{1,2}[\/\-]\d{1,2}(?:\/\d{1,2})?)|(\d{1,2}月\d{1,2}日)|(明天|後天)/);
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

        // 聯絡方式 - NAME 提取邏輯
        // 匹配所有可能的引導詞後面的 2-4 個中文字
        const nameMatch = message.match(/(?:名字是|稱呼是|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);

        if (nameMatch) {
            // 優先使用引導詞後面的名字 (nameMatch[1])
            let extractedName = nameMatch[1] || nameMatch[2]; 
            if (extractedName && extractedName.length >= 2) {
                data.name = extractedName.trim();
                // 額外檢查：如果名字太像關鍵詞，則跳過
                if (data.name.includes('我的') || data.name.includes('名字') || data.name.includes('訂房') || data.name.includes('本人')) {
                    data.name = undefined;
                }
            }
        }
        
        // 聯絡方式 - EMAIL 提取
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

// 狀態機控制器 (保持不變)
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
        let basePrice = 3200; 
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


// 規則引擎類別 (強化 session 處理)
class RuleEngine {
    static process(intents, session, message) {
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule, // 訂房流程優先
            this.transferRule,
            this.pricingRule,
            this.memberRule,
            this.attractionsRule,
            this.shoppingRule,
            this.itineraryRule,
            this.medicalRule,
            this.modificationRule,
            this.weatherRule,
            this.restaurantRule,
            this.facilityRule,
            this.generalRule
        ];

        for (const rule of rules) {
            const result = rule(intents, session, message);
            if (result.shouldProcess) {
                console.log(`🎯 規則觸發: ${rule.name}, 優先級: ${result.priority}`);
                return result;
            }
        }

        // 如果沒有任何規則處理，則呼叫 AI
        return { shouldProcess: false, priority: 0 };
    }

    // 🏨 訂房流程規則 
    static bookingFlowRule(intents, session, message) {
        const hasBookingIntent = intents.includes('book_room') || intents.includes('ask_promotion');
        
        // 處理流程結束和重置
        if (session.bookingState === 'booking_complete' || session.bookingState === 'end_conversation') {
             if (hasBookingIntent) {
                 session.bookingState = 'init'; // 如果結束後用戶又發起訂房，則重新開始
             } else {
                 return { shouldProcess: false, priority: 0 }; // 結束後沒有新意圖，讓 AI 處理
             }
        }

        // 如果訊息包含 booking 意圖，或者 session 已經在流程中
        if (hasBookingIntent || session.bookingState) {
            
            // 確定當前狀態
            if (!session.bookingState) session.bookingState = 'init';
            
            let nextStateKey = session.bookingState;
            let currentState = BookingFlowController.getCurrentState(session);

            // 1. 提取實體並更新 session (這必須是流程開始的第一件事)
            const extractedEntities = SmartIntentClassifier.extractEntities(message);
            Object.assign(session.collectedData, extractedEntities);
            // 輔助日誌：在關鍵步驟打印提取的實體，方便除錯
            if (session.bookingState === 'ask_contact_info') {
                 console.log(`DEBUG: Extracted entities in ask_contact_info: ${JSON.stringify(extractedEntities)}`);
            }


            // 🚨 優化後的 INIT 狀態處理邏輯
            if (session.bookingState === 'init') {
                // 如果用戶在 init 狀態下明確選擇了 'book_room' 意圖 
                if (intents.includes('book_room')) {
                    // 允許狀態轉移到第一個實體收集狀態
                    session.bookingState = DIALOGUE_FLOW.states['init'].intents['book_room']; // collect_room_and_dates
                    nextStateKey = session.bookingState;
                    currentState = BookingFlowController.getCurrentState(session); // 更新 currentState
                } else {
                    // 否則，停留在 init 狀態，回覆提示 (用於處理第一次進入 init 的情況)
                    return {
                         shouldProcess: true,
                         priority: 95, 
                         response: currentState.prompt, 
                         nextStep: 'init',
                         updateSession: true
                    };
                }
            }
            
            // 2. 嘗試根據意圖轉移 (處理 'check_availability_and_price' 狀態的是/否等意圖)
            for (const intent of intents) {
                if (currentState.intents && currentState.intents[intent]) {
                    nextStateKey = currentState.intents[intent];
                    break;
                }
            }

            // 3. 檢查實體是否收集完畢以轉移到下一個狀態 (只有實體收集狀態才會執行)
            if (nextStateKey === session.bookingState && currentState.entities && currentState.next_state) {
                const allEntitiesCollected = currentState.entities.every(
                    entity => session.collectedData[entity] !== undefined && session.collectedData[entity] !== null
                );
                
                // 🚨 偵錯專用邏輯：強制檢查 ask_contact_info 狀態
                if (session.bookingState === 'ask_contact_info') {
                    if (allEntitiesCollected) {
                         console.log("DEBUG: 實體收集成功！強制轉移到 confirm_member_and_meal");
                         nextStateKey = currentState.next_state;
                    } else {
                         console.log(`DEBUG: 實體不完整：name=${session.collectedData['name']}, email=${session.collectedData['email']}`);
                         // 如果偵錯失敗，強制給出一個明確的偵錯回覆，防止被 LLM 劫持
                         return {
                             shouldProcess: true,
                             priority: 95, 
                             response: `偵錯回覆：姓名/Email 未齊全。請重新提供。當前狀態: ${session.bookingState}`, 
                             nextStep: session.bookingState,
                             updateSession: true
                         };
                    }
                } 
                // 🚨 結束偵錯邏輯 🚨
                
                // 原始邏輯：應用於所有其他實體收集狀態
                else if (allEntitiesCollected) {
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
                // 由於前一個狀態收集了所有需要的實體，我們在這裡計算價格
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
            let response = nextState.prompt;
            for (const key in session.collectedData) {
                const value = session.collectedData[key] || ''; 
                // 替換 {key} 和 ${key} 格式的變數
                response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                response = response.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }
            
            // 最終檢查 response 
            if (!response || response.trim() === '') {
                 response = nextState.fallback || "抱歉，狀態轉移出錯，請重新開始。";
            }
            
            // 流程結束後重置狀態
            if (nextState.end) {
                session.bookingState = 'end_conversation'; 
                session.collectedData = {};
            }

            // 🚨 強制返回 shouldProcess: true，確保規則引擎的結果被使用，防止 LLM 劫持
            return {
                shouldProcess: true,
                priority: 95, 
                response: response,
                nextStep: session.bookingState,
                updateSession: true
            };
        } // if (hasBookingIntent || session.bookingState) 結束

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

    // [簡化：移除所有未使用的規則實現]
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
        // 🚨 降低 LLM 的回退權重，讓其只處理真正的一般查詢
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
        return session;
    }

    addAssistantResponse(sessionId, reply) {
        const session = this.getSession(sessionId);
        if (reply) { 
            session.conversationHistory.push({
                role: 'model',
                message: reply,
                timestamp: new Date().toISOString()
            });
        }
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
                throw new Error(`API response error: ${response.status} ${response.statusText} - Details: ${errorText}`);
            }
            
            if (response.status === 429 && attempt < MAX_RETRIES) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                console.warn(`[Gemini API] Rate limit hit. Retrying in ${Math.round(delay / 1000)}s... (Attempt ${attempt})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, attempt + 1);
            }
            
            throw new Error(`API response error: ${response.status} ${response.statusText} - Details: ${errorText}`);
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
// 5. 回應生成與 LLM 邏輯 (強化錯誤處理)
// ---------------------------------------------
class ResponseGenerator {
    static async handleSpecialCommands(message, session) {
        const translateMatch = message.match(/^\[translate:(.*?)\]$/i);
        if (translateMatch) {
            return `翻譯功能已禁用，請直接輸入中文。`; 
        }
        return null;
    }
    
    static async generateResponse(intents, session, message) {
        const specialReply = await this.handleSpecialCommands(message, session);
        if (specialReply) {
            return specialReply;
        }

        console.log(`🎯 意圖識別: ${intents.join(', ')}, 用戶類型: ${session.userType}, 狀態: ${session.bookingState}`);
        
        // 🚨 第一步：使用規則引擎處理所有意圖 (包括高優先級的訂房流程)
        const ruleResult = RuleEngine.process(intents, session, message);
        
        // 如果規則引擎產生了回應，並且優先級足夠高，則使用它
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            if (ruleResult.response) {
                 return ruleResult.response;
            }
        }
        
        // 🤖 第二步：複雜/一般問題使用 AI 服務
        try {
            console.log("🤖 嘗試使用 Gemini AI 處理複雜問題 (已禁用外部工具)");
            return await this.getGeminiResponse(session);
        } catch (error) {
            console.error("AI 服務失敗，回退到規則回覆:", error.message);
            // 優雅回退到規則引擎或預設回應
            return this.getEnhancedFallbackResponse(intents, session, message, ruleResult);
        }
    }

    static getEnhancedFallbackResponse(intents, session, message, ruleResult) {
        if (ruleResult.shouldProcess) {
            return ruleResult.response;
        }
        return RuleEngine.generalRule(intents, session, message).response;
    }

    // 🟡 核心：與 Gemini API 通訊
    static async getGeminiResponse(session) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Using rule-based response.");
            return RuleEngine.generalRule([], session, "").response;
        }

        try {
            if (!Array.isArray(session.conversationHistory) || session.conversationHistory.length === 0) {
                 throw new Error("Conversation history is empty or invalid for Gemini API call.");
            }

            const contents = session.conversationHistory.map(item => ({
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
            
            if (!result.candidates || result.candidates.length === 0) {
                console.error("[Gemini API] No candidates in response:", JSON.stringify(result, null, 2));
                throw new Error("Gemini API returned an empty or invalid candidate list.");
            }

            const text = result.candidates[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("[Gemini API] Empty text or blocked:", JSON.stringify(result, null, 2));
                if (result.candidates[0].finishReason === 'SAFETY') {
                    throw new Error("Content was blocked by safety settings.");
                }
                throw new Error("No valid text in response.");
            }
        } catch (error) {
            console.error("Error communicating with Gemini API:", error.message);
            throw error;
        }
    }
}

// ---------------------------------------------
// 6. Express 路由定義 (保持不變)
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
            hint: RuleEngine.generalRule([], sessionManager.getSession(sessionId), "").response
        });
    }

    try {
        // 1. 更新會話狀態並獲取意圖
        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);

        // 2. 🌟 生成回應 (RuleEngine 優先處理 Dialogue Flow，否則呼叫 AI)
        const reply = await ResponseGenerator.generateResponse(intents, session, message);
        
        // 3. 儲存 AI 回應
        sessionManager.addAssistantResponse(sessionId, reply);

        // 最終檢查：確保 reply 有值
        if (!reply) {
             throw new Error("Chat response was unexpectedly empty (Reply is null/undefined).");
        }

        res.json({ reply, sessionId });

    } catch (error) {
        console.error("主要聊天路由發生錯誤:", error);
        res.status(500).json({ 
            error: `服務器處理錯誤：${error.message}`, 
            details: error.message 
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

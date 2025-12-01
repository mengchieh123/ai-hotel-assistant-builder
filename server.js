// server.js (完整修正版 - 增強 AI 回退機制)
// 海灣麗景酒店 AI 智能助理

// ---------------------------------------------
// 1. 模組導入與基本設定
// ---------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// --- API Key 和配置 ---
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";

// 🚨 修正 API 端點：使用 v1beta 和最新模型
const MODEL_NAME = "gemini-1.5-flash-latest";
const apiUrl = `${API_BASE}/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

// --- 指數退避重試配置 ---
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// ---------------------------------------------
// 2. 核心工具類
// ---------------------------------------------

// 增強版智能意圖分類器
class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        if (/(訂房|預訂|入住|房間|住.*晚|房型|幫我訂|想要訂|預約房間)/.test(lowerMessage)) intents.add('booking');
        if (/(接送|機場|接機|送機|交通|距離|多遠|車程)/.test(lowerMessage)) intents.add('transfer');
        if (/(餐廳|推薦|美食|吃|海鮮|晚餐|早餐|午餐|訂位)/.test(lowerMessage)) intents.add('restaurant');
        if (/(價格|價錢|多少錢|房價|費用|收費)/.test(lowerMessage)) intents.add('pricing');
        if (/(會員|積分|優惠|折扣|促銷|金卡|宣傳語)/.test(lowerMessage)) intents.add('member');
        if (/(景點|觀光|好玩|旅遊|推薦.*地方|去哪玩)/.test(lowerMessage)) intents.add('attractions');
        if (/(購物|夜市|商店|超市|便利商店|買東西)/.test(lowerMessage)) intents.add('shopping');
        if (/(醫院|醫療|診所|醫生|藥局|不舒服)/.test(lowerMessage)) intents.add('medical');
        if (/(設施|泳池|健身房|spa|按摩|三溫暖)/.test(lowerMessage)) intents.add('facilities');
        if (/(天氣|氣象|溫度|下雨|颱風|氣溫)/.test(lowerMessage)) intents.add('weather');
        if (/(行程|規劃|安排|旅遊計畫|一日遊)/.test(lowerMessage)) intents.add('itinerary');
        if (this.containsDatePatterns(message)) intents.add('date_input');
        if (/(取消|退訂|改期|變更|修改)/.test(lowerMessage)) intents.add('modification');
        if (/(緊急|救命|幫忙|協助|問題|麻煩)/.test(lowerMessage)) intents.add('emergency');
        
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
        if (/(團體|大型|多人|公司|企業)/.test(lowerMessage)) return 'group';
        if (/(商務|會議|出差|辦公)/.test(lowerMessage)) return 'business';
        if (/(情侶|夫妻|蜜月|浪漫)/.test(lowerMessage)) return 'couple';
        if (/(個人|單人|自己)/.test(lowerMessage)) return 'solo';
        return 'individual';
    }
}

// 規則引擎類別
class RuleEngine {
    static process(intents, session, message) {
        const rules = [
            this.emergencyRule,
            this.bookingFlowRule,
            this.transferRule,
            this.pricingRule,
            this.memberRule,
            this.attractionsRule,
            this.shoppingRule,      // 🆕 新增購物規則
            this.itineraryRule,     // 🆕 新增行程規則
            this.medicalRule,       // 🆕 新增醫療規則
            this.modificationRule,  // 🆕 新增變更規則
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

        return { shouldProcess: false, priority: 0 };
    }

    // 🚨 緊急規則
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

    // 🏨 訂房流程規則
    static bookingFlowRule(intents, session, message) {
        const hasBookingIntent = intents.includes('booking');
        const hasDateIntent = intents.includes('date_input');
        const isInBookingFlow = session.conversationHistory.some(msg => 
            msg.intents?.includes('booking') || msg.message?.includes('訂房')
        );

        if (hasBookingIntent || isInBookingFlow) {
            let response = "";
            let nextStep = "";
            
            if (!hasDateIntent && !session.askedTopics.includes('date')) {
                response = "🏨 **訂房服務**\n\n請告訴我您的入住日期和退房日期？\n例如：12/25-12/28 或 明天入住，住2晚";
                nextStep = "ask_date";
            } else if (hasDateIntent && !session.askedTopics.includes('room_type')) {
                response = "📅 收到日期資訊！請問需要什麼房型？\n\n可選房型：\n• 標準雙人房 (2,200 TWD/晚)\n• 豪華海景房 (3,200 TWD/晚)\n• 家庭套房 (3,800 TWD/晚)\n• 行政套房 (4,800 TWD/晚)";
                nextStep = "ask_room_type";
            } else if (session.askedTopics.includes('room_type') && !session.askedTopics.includes('guests')) {
                response = "🛏️ 收到房型選擇！請問有幾位入住？";
                nextStep = "ask_guests";
            } else {
                response = "✅ 已收到您的訂房資訊！\n\n請確認您的選擇，確認無誤請回覆「確認訂房」。";
                nextStep = "confirm_booking";
            }

            return {
                shouldProcess: true,
                priority: 90,
                response: response,
                nextStep: nextStep,
                updateSession: true
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🚗 接送服務規則
    static transferRule(intents, session, message) {
        if (intents.includes('transfer') || /接機|接送/.test(message.toLowerCase())) {
            return {
                shouldProcess: true,
                priority: 85,
                response: "🚗 **機場接送服務**\n\n我們提供24小時機場接送服務！\n\n• 桃園機場：600 TWD/單程\n• 松山機場：400 TWD/單程\n• 高雄機場：500 TWD/單程\n\n請提供：\n1. 航班號碼和到達時間\n2. 乘客人數和行李數量\n3. 接送地點\n\n立即為您安排接送服務！"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 💰 價格查詢規則
    static pricingRule(intents, session, message) {
        if (intents.includes('pricing')) {
            return {
                shouldProcess: true,
                priority: 80,
                response: "💰 **房價資訊**\n\n• 標準雙人房：2,200 TWD/晚\n• 豪華海景房：3,200 TWD/晚\n• 家庭套房：3,800 TWD/晚\n• 行政套房：4,800 TWD/晚\n\n**優惠方案：**\n• 連續住宿3晚以上享9折\n• 會員享額外95折\n• 提前14天預訂享早鳥優惠\n\n需要為您推薦適合的房型嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🎯 會員規則
    static memberRule(intents, session, message) {
        if (intents.includes('member')) {
            const responses = [
                "🌟 **金卡會員尊榮禮遇** 🌟\n\n• 住宿享95折優惠\n• 免費房型升等機會\n• 專屬會員積分兌換\n• 提早入住/延遲退房\n• 生日當天神秘禮物\n\n立即加入，尊享特权！",
                "💎 **金卡會員專屬優惠** 💎\n\n尊貴的金卡會員您好！感謝您的長期支持！\n\n✨ 專屬福利：\n• 房費95折優惠\n• 雙倍積分累計\n• 優先預訂權益\n• 會員專線服務\n\n讓您的每次住宿都成為難忘體驗！",
                "🎯 **會員宣傳語** 🎯\n\n「海灣麗景金卡會員 - 不只是住宿，更是尊榮體驗！」\n\n加入金卡會員，享受：\n✓ 專屬折扣優惠\n✓ 積分兌換好禮  \n✓ 優先服務權益\n✓ 會員獨家活動\n\n開啟您的奢華旅程！"
            ];
            
            return {
                shouldProcess: true,
                priority: 75,
                response: responses[Math.floor(Math.random() * responses.length)]
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🗺️ 景點規則
    static attractionsRule(intents, session, message) {
        if (intents.includes('attractions')) {
            const mentionedCity = message.includes('台北') ? '台北' : 
                                 message.includes('台中') ? '台中' :
                                 message.includes('高雄') ? '高雄' : '附近';
            
            const responses = {
                '台北': `🗺️ **台北熱門景點推薦** 🗺️\n\n✨ **必訪景點：**\n• 台北101觀景台 - 城市地標，夜景絕美\n• 故宮博物院 - 中華文化寶庫\n• 西門町 - 購物美食天堂\n• 士林夜市 - 台灣小吃聚集地\n• 北投溫泉 - 放鬆身心好去處\n\n🚗 **交通建議：**\n• 捷運+公車最方便\n• 建議安排2-3天深度遊\n\n需要為您規劃具體行程嗎？`,
                '台中': `🗺️ **台中熱門景點推薦** 🗺️\n\n✨ **必訪景點：**\n• 彩虹眷村 - 色彩繽紛的藝術村\n• 高美濕地 - 絕美夕陽觀賞地\n• 逢甲夜市 - 台灣最大夜市\n• 宮原眼科 - 特色冰淇淋店\n• 審計新村 - 文創聚落\n\n🚗 **交通建議：**\n• 建議租車或包車遊覽\n• 景點較分散，安排2天較合適`,
                '高雄': `🗺️ **高雄熱門景點推薦** 🗺️\n\n✨ **必訪景點：**\n• 駁二藝術特區 - 文創藝術基地\n• 西子灣 - 浪漫夕陽海景\n• 旗津島 - 海鮮美食天堂\n• 愛河 - 浪漫夜景遊船\n• 瑞豐夜市 - 在地人最愛夜市\n\n🚗 **交通建議：**\n• 捷運+渡輪很方便\n• 建議安排2天遊玩`,
                '附近': `🗺️ **飯店周邊景點推薦** 🗺️\n\n✨ **步行可達：**\n• 海灣公園 - 5分鐘，晨跑散步好去處\n• 藝術文化中心 - 10分鐘，展覽表演\n• 購物商圈 - 8分鐘，精品商店聚集\n\n✨ **車程15分鐘內：**\n• 海濱步道 - 絕美海景，適合拍照\n• 傳統市場 - 體驗當地生活\n• 歷史古蹟 - 文化探索\n\n需要為您推薦特定類型的景點嗎？`
            };
            
            return {
                shouldProcess: true,
                priority: 70,
                response: responses[mentionedCity]
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🛍️ 購物規則 (新增)
    static shoppingRule(intents, session, message) {
        if (intents.includes('shopping')) {
            return {
                shouldProcess: true,
                priority: 65,
                response: "🛍️ **購物推薦**\n\n✨ **推薦購物地點：**\n• 海灣精品商城（步行8分鐘）- 國際品牌\n• 星光百貨（車程10分鐘）- 綜合購物\n• 傳統文化市場（車程15分鐘）- 特色紀念品\n• 免稅商店（車程20分鐘）- 化妝品、菸酒\n\n🕒 **營業時間：**\n• 百貨公司：11:00-21:30\n• 傳統市場：06:00-14:00\n• 免稅店：09:00-20:00\n\n需要安排購物接送服務嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 📅 行程規則 (新增)
    static itineraryRule(intents, session, message) {
        if (intents.includes('itinerary')) {
            const userType = session.userType;
            const itineraries = {
                'family': "👨‍👩‍👧‍👦 **家庭行程推薦**\n\n📅 **三日遊建議：**\n\n**第一天：城市探索**\n• 上午：兒童博物館 + 公園野餐\n• 下午：動物園親子活動\n• 晚上：家庭餐廳晚餐\n\n**第二天：自然體驗**\n• 上午：海邊玩沙踏浪\n• 下午：生態農場體驗\n• 晚上：觀星活動\n\n**第三天：文化之旅**\n• 上午：歷史文化村參觀\n• 下午：DIY手工藝體驗\n• 晚上：特色夜市美食\n\n需要為您預訂任何活動嗎？",
                'couple': "💑 **情侶浪漫行程**\n\n📅 **浪漫三日遊：**\n\n**第一天：浪漫啟程**\n• 上午：精品咖啡館早餐\n• 下午：藝術特區拍照打卡\n• 晚上：景觀餐廳燭光晚餐\n\n**第二天：自然約會**\n• 上午：山間步道漫步\n• 下午：溫泉SPA放鬆\n• 晚上：海邊夕陽觀賞\n\n**第三天：城市記憶**\n• 上午：特色小店探索\n• 下午：DIY情侶手作\n• 晚上：高空酒吧夜景\n\n需要安排浪漫驚喜嗎？",
                'business': "💼 **商務行程安排**\n\n📅 **商務三日規劃：**\n\n**第一天：商務會議**\n• 上午：客戶會議安排\n• 下午：商務午餐洽談\n• 晚上：商務交流晚宴\n\n**第二天：企業參訪**\n• 上午：合作企業參觀\n• 下午：產業園區考察\n• 晚上：商務聯誼活動\n\n**第三天：城市考察**\n• 上午：市場調研分析\n• 下午：投資環境了解\n• 晚上：總結會議安排\n\n需要預訂會議室或安排交通嗎？"
            };
            
            return {
                shouldProcess: true,
                priority: 70,
                response: itineraries[userType] || "📅 **行程規劃服務**\n\n我們可以為您規劃個性化的旅遊行程！\n\n請告訴我：\n• 旅遊天數\n• 興趣偏好（自然、文化、美食等）\n• 預算範圍\n• 特殊需求\n\n我將為您量身定制完美行程！"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🏥 醫療規則 (新增)
    static medicalRule(intents, session, message) {
        if (intents.includes('medical')) {
            return {
                shouldProcess: true,
                priority: 95,
                response: "🏥 **醫療協助**\n\n您的健康是我們最重視的！\n\n**緊急醫療：**\n• 緊急專線：02-1199-1199\n• 前台協助：分機 0\n\n**附近醫療資源：**\n• 海灣綜合醫院（車程10分鐘）- 24小時急診\n• 安康診所（步行5分鐘）- 一般門診\n• 仁愛藥局（步行3分鐘）- 藥品購買\n\n需要為您安排就醫協助嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🔄 變更規則 (新增)
    static modificationRule(intents, session, message) {
        if (intents.includes('modification')) {
            return {
                shouldProcess: true,
                priority: 75,
                response: "🔄 **服務變更**\n\n我們可以協助您處理以下變更：\n\n📞 **聯繫方式：**\n• 前台服務：分機 0\n• 訂房部門：分機 1\n• 客服專線：02-2888-8888\n\n⏰ **服務時間：**\n• 平日：09:00-18:00\n• 假日：10:00-17:00\n• 緊急狀況：24小時\n\n請提供您的訂單編號，我們將盡快為您處理！"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🌤️ 天氣查詢規則
    static weatherRule(intents, session, message) {
        if (intents.includes('weather')) {
            const cities = ['台北', '台中', '高雄', '花蓮', '台南'];
            const mentionedCity = cities.find(city => message.includes(city)) || '台北';
            
            const weatherData = {
                '台北': { temp: 22, condition: '多雲', humidity: 65 },
                '台中': { temp: 24, condition: '晴朗', humidity: 60 },
                '高雄': { temp: 28, condition: '晴朗', humidity: 70 },
                '花蓮': { temp: 23, condition: '陰天', humidity: 75 },
                '台南': { temp: 26, condition: '多雲', humidity: 68 }
            };
            
            const weather = weatherData[mentionedCity] || { temp: 25, condition: '晴朗', humidity: 65 };
            
            const response = `🌤️ **${mentionedCity}天氣資訊**\n\n` +
                `• 溫度：${weather.temp}°C\n` +
                `• 天氣：${weather.condition}\n` +
                `• 濕度：${weather.humidity}%\n\n` +
                `**旅遊建議：**\n` +
                `• 適合外出活動，建議攜帶${weather.temp < 25 ? '薄外套' : '防曬用品'}\n` +
                `• ${weather.condition === '晴朗' ? '紫外線較強，請注意防曬' : '天氣舒適，適合觀光'}`;

            return {
                shouldProcess: true,
                priority: 75,
                response: response
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🍽️ 餐廳規則
    static restaurantRule(intents, session, message) {
        if (intents.includes('restaurant')) {
            return {
                shouldProcess: true,
                priority: 70,
                response: "🍽️ **餐廳推薦**\n\n• **龍鳳廳**：粵式料理 ⭐⭐⭐ | 11:30-14:30, 18:00-22:00\n• **星空牛排館**：頂級牛排 | 浪漫氛圍 | 17:30-22:30\n• **櫻花日本料理**：懷石料理 | 12:00-14:30, 18:00-21:30\n• **海灣咖啡廳**：國際自助餐 | 06:30-10:00, 11:30-14:00, 17:30-21:00\n\n需要為您預訂位子嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 🏊 設施規則
    static facilityRule(intents, session, message) {
        if (intents.includes('facilities')) {
            return {
                shouldProcess: true,
                priority: 65,
                response: "🏊 **飯店設施**\n\n• **泳池**：無邊際泳池 | 06:00-22:00 | 頂樓\n• **健身房**：24小時開放 | 最新器材\n• **SPA**：需預約 | 10:00-21:00 | 專業按摩師\n• **WiFi**：全館免費 | 高速網路\n• **商務中心**：24小時 | 電腦/印表機\n\n需要預約任何設施嗎？"
            };
        }
        return { shouldProcess: false, priority: 0 };
    }

    // 📞 一般規則
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
        intents.forEach(intent => {
            if (!session.askedTopics.includes(intent)) session.askedTopics.push(intent);
        });
        return session;
    }

    addAssistantResponse(sessionId, reply) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model',
            message: reply,
            timestamp: new Date().toISOString()
        });
    }
}

const sessionManager = new SessionManager();

// ---------------------------------------------
// 3. API 通訊工具
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
// 4. 回應生成與 LLM 邏輯 (增強 AI 回退機制)
// ---------------------------------------------
class ResponseGenerator {
    static isInBookingFlow(session) {
        const lastMessages = session.conversationHistory.slice(-3);
        return lastMessages.some(msg =>
            msg.intents?.includes('booking') ||
            msg.message?.includes('訂房') ||
            msg.message?.includes('日期') ||
            msg.message?.includes('入住')
        );
    }

    static handleBookingDate(dateMessage, session) {
        let response = "📅 ";
        const rangeMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/);
        if (rangeMatch) {
            const [_, startMonth, startDay, endMonth, endDay] = rangeMatch;
            const nights = (parseInt(endDay) > parseInt(startDay)) ? (parseInt(endDay) - parseInt(startDay)) : 1; 
            response += `好的！${startMonth}/${startDay} 到 ${endMonth}/${endDay}，共 ${nights} 晚住宿。\n\n`;
        } else if (/\d{1,2}\/\d{1,2}/.test(dateMessage)) {
            const dateMatch = dateMessage.match(/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
                response += `收到入住日期 ${dateMatch[0]}！請問住幾晚？\n\n`;
            }
        } else {
            response += `收到您的日期資訊！\n\n`;
        }

        response += "請問需要什麼房型？幾位入住？";
        return response;
    }

    static async generateResponse(intents, session, message) {
        console.log(`🎯 意圖識別: ${intents.join(', ')}, 用戶類型: ${session.userType}`);
        
        // 🚨 第一步：使用規則引擎處理高優先級意圖
        const ruleResult = RuleEngine.process(intents, session, message);
        if (ruleResult.shouldProcess && ruleResult.priority >= 50) {
            if (ruleResult.updateSession && ruleResult.nextStep) {
                session.askedTopics.push(ruleResult.nextStep);
            }
            return ruleResult.response;
        }

        // 📅 處理日期輸入
        if (intents.includes('date_input') && this.isInBookingFlow(session)) {
            return this.handleBookingDate(message, session);
        }

        // 🤖 複雜問題使用 AI - 擴大意圖範圍和觸發條件
        const complexIntents = ['attractions', 'itinerary', 'shopping', 'general_inquiry', 'medical', 'modification'];
        const shouldUseAI = intents.some(intent => complexIntents.includes(intent)) || 
                            intents.length > 1 ||
                            !ruleResult.shouldProcess ||  // 🆕 規則引擎無法處理時
                            intents.includes('general_inquiry'); // 🆕 一般查詢時

        if (shouldUseAI) {
            try {
                console.log("🤖 使用 Gemini AI 處理複雜問題");
                return await this.getGeminiResponse(session);
            } catch (error) {
                console.error("AI 服務失敗，使用規則回覆:", error.message);
                // 優雅回退到規則引擎
                return this.getEnhancedFallbackResponse(intents, session, message, ruleResult);
            }
        }

        // 🎯 檢查是否有規則結果可以使用
        if (ruleResult.shouldProcess) {
            return ruleResult.response;
        }

        // 🔄 最終回退：使用 AI 或通用回應
        return await this.finalFallback(session, message, intents);
    }

    // 增強的回退回應
    static getEnhancedFallbackResponse(intents, session, message, ruleResult) {
        // 如果有規則結果，優先使用
        if (ruleResult.shouldProcess) {
            return ruleResult.response;
        }
        
        // 根據意圖提供特定的回退回應
        const fallbackResponses = {
            'attractions': "🗺️ **景點推薦**\n\n抱歉，目前景點推薦服務暫時無法提供詳細資訊。\n\n建議您：\n• 詢問飯店櫃檯獲取當地旅遊地圖\n• 下載旅遊APP查詢最新景點\n• 我們可以為您安排交通接送服務\n\n需要其他協助嗎？",
            'itinerary': "📅 **行程規劃**\n\n行程規劃服務暫時無法使用。\n\n我們的服務人員可以：\n• 推薦適合的遊玩路線\n• 安排專業導遊服務\n• 預訂當地特色活動\n\n請聯繫櫃檯獲得個性化建議！",
            'shopping': "🛍️ **購物推薦**\n\n購物資訊服務暫時無法提供。\n\n飯店周邊有：\n• 精品購物中心（步行10分鐘）\n• 傳統市場（車程15分鐘）\n• 免稅商店（車程20分鐘）\n\n需要安排購物接送服務嗎？",
            'medical': "🏥 **醫療協助**\n\n醫療服務資訊暫時無法查詢。\n\n如有緊急醫療需求：\n• 請立即撥打緊急專線：02-1199-1199\n• 聯絡前台安排就醫協助\n• 飯店備有基本急救設備\n\n您的健康是我們最重視的！",
            'modification': "🔄 **變更服務**\n\n變更服務暫時無法處理。\n\n請直接聯繫：\n• 前台服務：分機 0\n• 訂房部門：分機 1\n• 客服專線：02-2888-8888\n\n我們將盡快為您處理！",
            'general_inquiry': "🤔 **問題處理**\n\n抱歉，我不太理解您的具體需求。\n\n我可以協助您：\n🏨 訂房服務與價格查詢\n🍽️ 餐廳推薦與訂位\n🚗 交通接送安排\n🗺️ 當地資訊諮詢\n\n請告訴我您需要哪方面的協助？"
        };
        
        // 找到最相關的意圖
        const relevantIntent = intents.find(intent => fallbackResponses[intent]) || 'general_inquiry';
        return fallbackResponses[relevantIntent];
    }

    // 最終回退機制
    static async finalFallback(session, message, intents) {
        // 最後嘗試使用 AI
        try {
            console.log("🔄 最終回退：嘗試使用 AI");
            return await this.getGeminiResponse(session);
        } catch (error) {
            console.error("最終回退也失敗:", error.message);
            // 使用通用規則
            const ruleResult = RuleEngine.process(intents, session, message);
            if (ruleResult.shouldProcess) {
                return ruleResult.response;
            }
            return RuleEngine.generalRule(intents, session, message).response;
        }
    }

    static async getGeminiResponse(session) {
        if (!apiKey) {
            console.warn("[Gemini API] API Key is empty. Using rule-based response.");
            return RuleEngine.generalRule([], session, "").response;
        }

        try {
            const contents = session.conversationHistory.map(item => ({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.message }]
            }));

            console.log("[Gemini API] Sending request to:", apiUrl);

            const payload = {
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH", 
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // 詳細錯誤處理
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Gemini API] HTTP ${response.status}:`, errorBody);
                
                if (response.status === 404) {
                    throw new Error(`API endpoint not found. Please check model name and API version.`);
                } else if (response.status === 403) {
                    throw new Error(`API key invalid or insufficient permissions.`);
                }
                throw new Error(`HTTP ${response.status}: ${errorBody}`);
            }

            const result = await response.json();
            
            if (result.error) {
                console.error("[Gemini API] Error:", result.error);
                throw new Error(`API Error: ${result.error.message}`);
            }
            
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("[Gemini API] Empty response:", JSON.stringify(result, null, 2));
                throw new Error("No valid text in response");
            }
        } catch (error) {
            console.error("Error communicating with Gemini API:", error.message);
            throw error;
        }
    }
}

// ---------------------------------------------
// 5. Express 中介軟體與設定
// ---------------------------------------------
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('.'));

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// ---------------------------------------------
// 6. 路由定義
// ---------------------------------------------

// 根路徑
app.get('/', (req, res) => {
    res.json({
        service: '🏨 海灣麗景酒店 AI 助理',
        status: '運行中',
        version: '7.0.0', // 版本更新
        endpoints: {
            health: '/health',
            chat: '/chat',
            api_health: '/api/health',
            api_chat: '/api/chat',
            frontend: '/working-chat.html'
        },
        timestamp: new Date().toISOString()
    });
});

// 健康檢查
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        server: "Bayview Grand Hotel Assistant API",
        model: MODEL_NAME,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        server: "Bayview Grand Hotel Assistant API",
        model: MODEL_NAME,
        timestamp: new Date().toISOString()
    });
});

// 前端頁面路由
app.get('/working-chat.html', (req, res) => {
    res.sendFile(__dirname + '/working-chat.html');
});

// 主要聊天路由
app.post('/chat', async (req, res) => {
    await handleChatRequest(req, res);
});

app.post('/api/chat', async (req, res) => {
    await handleChatRequest(req, res);
});

// 聊天請求處理函數
async function handleChatRequest(req, res) {
    const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            reply: "請輸入訊息內容",
            sessionId,
            errorCode: "EMPTY_MESSAGE"
        });
    }

    try {
        console.log("💬 收到請求:", { sessionId, message });
        const intents = SmartIntentClassifier.classify(message);
        const session = sessionManager.updateSession(sessionId, message, intents);
        const reply = await ResponseGenerator.generateResponse(intents, session, message);
        sessionManager.addAssistantResponse(sessionId, reply);

        res.json({
            success: true,
            reply,
            sessionId,
            userType: session.userType,
            timestamp: new Date().toISOString(),
            triggeredIntents: intents.join(', ')
        });
    } catch (e) {
        console.error("主處理錯誤:", e);
        res.status(500).json({
            success: false,
            reply: "系統處理錯誤，請稍後再試。",
            sessionId,
            timestamp: new Date().toISOString()
        });
    }
}

// 訂房 API
app.post('/api/booking', (req, res) => {
    res.json({
        success: true,
        message: "✅ 您的訂房請求已收到，正在處理中。"
    });
});

// 處理所有未定義的路由
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `找不到此路由：${req.url}。`,
        suggestion: "請使用 /health, /chat, /api/health, /api/chat",
        errorCode: "ROUTE_NOT_FOUND"
    });
});

// ---------------------------------------------
// 7. 啟動伺服器
// ---------------------------------------------
const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器成功啟動！`);
    console.log(`🌐 監聽端口: ${PORT}`);
    console.log(`❤️  健康檢查: http://localhost:${PORT}/health`);
    console.log(`💬 聊天端點: http://localhost:${PORT}/chat`);
    console.log(`📱 前端頁面: http://localhost:${PORT}/working-chat.html`);
    console.log(`🔑 Gemini API: ${apiKey ? '已配置' : '未配置'}`);
    console.log(`🤖 規則引擎: 已啟用`);
    console.log(`🔄 AI 回退機制: 已啟用`);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信號，開始優雅關閉...');
    server.close(() => {
        console.log('伺服器已關閉');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信號，關閉伺服器...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
});

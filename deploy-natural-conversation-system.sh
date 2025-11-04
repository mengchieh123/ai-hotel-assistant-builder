#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 部署自然對話系統 v3.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 創建完整的自然對話系統
cat > services/mock-ai-service.js << 'EOFAI'
let hotelData, bookingCalculator;

try {
    hotelData = require('./hotel-data');
    bookingCalculator = require('./booking-calculator');
    console.log('✅ 模塊已加載');
} catch (e) {
    console.error('❌ 模塊加載失敗:', e.message);
}

class NaturalConversationAI {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        this.analytics = {
            totalChats: 0,
            intentCounts: {},
            errorCount: 0
        };
        console.log('🤖 自然對話系統 v3.0 已初始化');
    }

    isAvailable() {
        return this.available;
    }

    // 獲取會話狀態
    getConversation(sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                stage: 'greeting', // greeting, collecting_info, confirming, completed
                lastIntent: null,
                turnCount: 0,
                collectedInfo: {
                    roomType: null,
                    nights: null,
                    adults: null,
                    children: 0,
                    childrenAges: [],
                    includeBreakfast: false,
                    checkInDate: null
                },
                missingFields: [],
                history: [],
                context: {},
                lastResponse: null
            });
        }
        return this.conversations.get(sessionId);
    }

    // 高級意圖識別（含容錯）
    detectIntent(message) {
        const msg = message.toLowerCase().trim();
        
        // 問候類（多種變體）
        if (/^(你好|您好|hi|hello|哈囉|嗨|早安|午安|晚安|hey|嘿|在嗎|有人嗎)/.test(msg)) {
            return { intent: 'greeting', confidence: 0.95 };
        }
        
        // 房型查詢（容錯處理）
        if (/(有|提供|什麼|哪些|介紹|看看|想看).*(房型|房間|客房|套房|房|room)/.test(msg) ||
            /(房型|房間|客房).*(有|提供|什麼|哪些|介紹)/.test(msg) ||
            /^(房型|房間|客房)$/.test(msg)) {
            return { intent: 'room_inquiry', confidence: 0.9 };
        }
        
        // 價格查詢（多種表達）
        if (/(多少錢|價格|費用|收費|房價|要多少|花多少|價錢|價位|pricing|price)/.test(msg)) {
            return { intent: 'price_inquiry', confidence: 0.9 };
        }
        
        // 訂房意圖（各種表達）
        if (/(我想|我要|想要|想訂|想預訂|要訂|要預訂|幫我|可以|能夠).*(訂|預訂|預定|book|reserve)/.test(msg) ||
            /(訂|預訂|預定).*(房|客房|房間)/.test(msg)) {
            return { intent: 'booking_intent', confidence: 0.95 };
        }
        
        // 計算請求（明確和隱含）
        if (/(計算|算|總共|總價|一共|合計|多少|加起來|告訴我|幫我算)/.test(msg) ||
            /\d+(晚|天).*\d+(大人|成人|位)/.test(msg)) {
            return { intent: 'calculate', confidence: 0.9 };
        }
        
        // 設施查詢
        if (/(設施|服務|有什麼|提供|游泳池|健身房|餐廳|停車|facilities|amenities)/.test(msg)) {
            return { intent: 'facilities', confidence: 0.85 };
        }
        
        // 早餐查詢
        if (/(早餐|breakfast|早飯|早點|morning)/.test(msg)) {
            return { intent: 'breakfast', confidence: 0.9 };
        }
        
        // 位置交通
        if (/(位置|地址|在哪|怎麼去|如何到|交通|路線|機場|捷運|location|address)/.test(msg)) {
            return { intent: 'location', confidence: 0.85 };
        }
        
        // 確認意圖（肯定）
        if (/^(好|可以|行|沒問題|對|是|確認|確定|yes|ok|sure|yep|yeah)$/.test(msg)) {
            return { intent: 'confirm_yes', confidence: 0.95 };
        }
        
        // 否定意圖
        if (/^(不|不要|不用|沒有|不行|取消|no|nope|cancel)/.test(msg)) {
            return { intent: 'confirm_no', confidence: 0.95 };
        }
        
        // 修改意圖
        if (/(改|更改|換|修改|調整|change|modify)/.test(msg)) {
            return { intent: 'modify', confidence: 0.8 };
        }
        
        // 包含實體信息的陳述
        if (/\d+(晚|天|大人|成人|小孩|兒童|歲)/.test(msg) ||
            /(豪華|行政|套房|總統)/.test(msg)) {
            return { intent: 'provide_info', confidence: 0.7 };
        }
        
        return { intent: 'unknown', confidence: 0.0 };
    }

    // 智能實體提取（容錯和多變體）
    extractEntities(message, conversation) {
        const msg = message.toLowerCase();
        const info = conversation.collectedInfo;
        let extracted = [];

        // 房型提取（容錯）
        const roomPatterns = [
            { patterns: [/豪華/, /deluxe/, /標準/], type: 'deluxe', name: '豪華客房' },
            { patterns: [/行政/, /executive/, /商務/], type: 'executive', name: '行政客房' },
            { patterns: [/套房(?!總統)/, /suite/], type: 'suite', name: '套房' },
            { patterns: [/總統.*套房|總統/, /presidential/], type: 'presidential', name: '總統套房' }
        ];
        
        for (const room of roomPatterns) {
            if (room.patterns.some(p => p.test(msg))) {
                info.roomType = room.type;
                extracted.push({ field: 'roomType', value: room.name });
                break;
            }
        }

        // 天數提取（多種表達）
        const nightsPatterns = [
            /(\d+)\s*(晚|夜|night)/,
            /住\s*(\d+)\s*(天|晚)/,
            /(\d+)\s*天/,
            /入住\s*(\d+)/
        ];
        
        for (const pattern of nightsPatterns) {
            const match = msg.match(pattern);
            if (match) {
                info.nights = parseInt(match[1]);
                extracted.push({ field: 'nights', value: match[1] + '晚' });
                break;
            }
        }

        // 成人數提取（容錯）
        const adultsPatterns = [
            /(\d+)\s*(個|位)?\s*(大人|成人|位成人|adults?)/,
            /成人\s*(\d+)/,
            /(\d+)\s*人(?!小)/
        ];
        
        for (const pattern of adultsPatterns) {
            const match = msg.match(pattern);
            if (match) {
                info.adults = parseInt(match[1]);
                extracted.push({ field: 'adults', value: match[1] + '位成人' });
                break;
            }
        }

        // 兒童數和年齡
        const childMatch = msg.match(/(\d+)\s*(個|位)?\s*(小孩|兒童|孩子|child)/);
        if (childMatch) {
            info.children = parseInt(childMatch[1]);
            extracted.push({ field: 'children', value: childMatch[1] + '位兒童' });
        }

        const ageMatches = msg.match(/(\d+)\s*歲/g);
        if (ageMatches) {
            info.childrenAges = ageMatches.map(m => parseInt(m));
            extracted.push({ field: 'childrenAges', value: info.childrenAges.join('、') + '歲' });
        }

        // 早餐意圖（多種表達）
        if (/(含早|包早|要早|加早|with.*breakfast|include.*breakfast|需要早餐)/.test(msg)) {
            info.includeBreakfast = true;
            extracted.push({ field: 'includeBreakfast', value: '含早餐' });
        } else if (/(不.*早|沒.*早|without.*breakfast|no.*breakfast)/.test(msg)) {
            info.includeBreakfast = false;
        }

        return extracted;
    }

    // 檢查缺失字段
    checkMissingFields(conversation) {
        const info = conversation.collectedInfo;
        const missing = [];

        if (!info.roomType) missing.push({ field: 'roomType', label: '房型', prompt: '想要哪種房型呢？（豪華/行政/套房）' });
        if (!info.nights) missing.push({ field: 'nights', label: '入住天數', prompt: '打算住幾晚？' });
        if (!info.adults) missing.push({ field: 'adults', label: '成人人數', prompt: '幾位成人入住？' });

        conversation.missingFields = missing;
        return missing;
    }

    // 生成自然回覆
    async generateResponse(message, sessionId) {
        const conversation = this.getConversation(sessionId);
        conversation.turnCount++;
        
        const detection = this.detectIntent(message);
        const extracted = this.extractEntities(message, conversation);
        
        conversation.lastIntent = detection.intent;
        conversation.history.push({
            role: 'user',
            message: message,
            intent: detection.intent,
            extracted: extracted,
            timestamp: new Date()
        });

        this.analytics.totalChats++;
        this.analytics.intentCounts[detection.intent] = (this.analytics.intentCounts[detection.intent] || 0) + 1;

        let response = '';

        try {
            // 根據對話階段和意圖生成回覆
            if (detection.intent === 'greeting') {
                response = this.handleGreeting(conversation);
                conversation.stage = 'greeting';
                
            } else if (detection.intent === 'room_inquiry') {
                response = this.handleRoomInquiry(conversation);
                
            } else if (detection.intent === 'price_inquiry') {
                response = this.handlePriceInquiry(conversation);
                
            } else if (detection.intent === 'booking_intent' || detection.intent === 'calculate') {
                response = await this.handleBookingFlow(conversation);
                
            } else if (detection.intent === 'provide_info') {
                response = await this.handleInfoProvided(conversation, extracted);
                
            } else if (detection.intent === 'confirm_yes') {
                response = await this.handleConfirmation(conversation, true);
                
            } else if (detection.intent === 'confirm_no') {
                response = await this.handleConfirmation(conversation, false);
                
            } else if (detection.intent === 'modify') {
                response = this.handleModification(conversation);
                
            } else if (detection.intent === 'facilities') {
                response = this.handleFacilities();
                
            } else if (detection.intent === 'breakfast') {
                response = this.handleBreakfast();
                
            } else if (detection.intent === 'location') {
                response = this.handleLocation();
                
            } else {
                response = this.handleUnknown(conversation, message);
            }

        } catch (error) {
            console.error('生成回覆錯誤:', error);
            this.analytics.errorCount++;
            response = '抱歉，我遇到了一點問題 😅\n\n讓我們重新開始吧！請告訴我您想了解什麼？';
        }

        conversation.lastResponse = response;
        conversation.history.push({
            role: 'assistant',
            message: response,
            timestamp: new Date()
        });

        return response;
    }

    // 處理問候
    handleGreeting(conversation) {
        const greetings = [
            '您好！👋 很高興見到您！\n\n我是台北晶華酒店的智能助手，隨時為您服務。\n\n💡 我可以幫您：\n• 查看房型和價格\n• 計算訂房費用\n• 介紹飯店設施\n• 提供交通資訊\n\n請問今天想了解什麼呢？',
            
            '歡迎光臨台北晶華酒店！😊\n\n我是您的專屬訂房顧問，很樂意協助您找到完美的住宿方案。\n\n✨ 不論是：\n• 商務出差\n• 家庭旅遊\n• 情侶度假\n\n我都能為您提供最適合的建議！\n\n要從哪裡開始呢？',
            
            '您好呀！🌟\n\n感謝您選擇台北晶華酒店！\n\n作為您的訂房助手，我會：\n• 耐心回答您的問題\n• 提供詳細的房型資訊\n• 幫您計算最優惠的價格\n\n請隨時告訴我您的需求！'
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // 處理房型查詢
    handleRoomInquiry(conversation) {
        if (!hotelData) return '資料載入中，請稍候...';
        
        let response = '🏨 **台北晶華酒店 - 精選房型**\n\n';
        
        hotelData.roomTypes.forEach((room, i) => {
            response += `**${i+1}. ${room.name}**\n`;
            response += `💰 NT$ ${room.basePrice.toLocaleString()}/晚\n`;
            response += `📐 ${room.size} | 👥 ${room.capacity.adults}位成人\n`;
            response += `🍳 ${room.breakfastIncluded ? '含豐盛早餐' : '可加購早餐 NT$650/人'}\n`;
            
            // 添加特色描述
            if (room.id === 'deluxe') {
                response += `✨ 舒適優雅，商務出差首選\n`;
            } else if (room.id === 'executive') {
                response += `✨ 行政樓層，免費使用貴賓廳\n`;
            } else if (room.id === 'suite') {
                response += `✨ 獨立客廳，家庭旅遊最佳選擇\n`;
            } else if (room.id === 'presidential') {
                response += `✨ 頂級奢華，360度城市景觀\n`;
            }
            
            response += '\n';
        });
        
        response += '💎 **長住優惠**：\n';
        response += '• 住3晚 → 享95折\n';
        response += '• 住5晚 → 享9折\n';
        response += '• 住7晚以上 → 享85折\n\n';
        response += '想了解哪個房型的詳細資訊？或是告訴我您的需求，我來推薦適合的房型！';
        
        return response;
    }

    // 處理價格查詢  
    handlePriceInquiry(conversation) {
        const info = conversation.collectedInfo;
        
        if (info.roomType && hotelData) {
            const room = hotelData.roomTypes.find(r => r.id === info.roomType);
            
            let response = `📊 **${room.name} - 價格詳情**\n\n`;
            response += `💰 **基本房價**：NT$ ${room.basePrice.toLocaleString()}/晚\n\n`;
            
            response += `🎁 **優惠方案**：\n`;
            response += `• 3-4晚：原價95折 → 每晚省NT$ ${Math.round(room.basePrice * 0.05).toLocaleString()}\n`;
            response += `• 5-6晚：原價9折 → 每晚省NT$ ${Math.round(room.basePrice * 0.1).toLocaleString()}\n`;
            response += `• 7晚以上：原價85折 → 每晚省NT$ ${Math.round(room.basePrice * 0.15).toLocaleString()}\n\n`;
            
            if (!room.breakfastIncluded) {
                response += `🍳 **早餐加購**：NT$ 650/人/天\n`;
                response += `（國際自助餐，中西式豐富選擇）\n\n`;
            } else {
                response += `�� **免費早餐**：已包含豪華自助早餐\n\n`;
            }
            
            response += `💡 想知道具體總價嗎？\n`;
            response += `告訴我入住天數和人數，我立刻幫您計算！`;
            
            return response;
        }
        
        return '💰 **房價查詢**\n\n請先告訴我您想了解哪個房型的價格：\n\n' +
               '🏨 豪華客房 - NT$ 8,800/晚起\n' +
               '🏨 行政客房 - NT$ 12,800/晚起\n' +
               '🏨 套房 - NT$ 18,800/晚起\n' +
               '🏨 總統套房 - NT$ 38,800/晚起\n\n' +
               '或是直接告訴我您的需求，我來推薦最適合的方案！';
    }

    // 處理訂房流程（核心多輪對話）
    async handleBookingFlow(conversation) {
        const missing = this.checkMissingFields(conversation);
        
        if (missing.length === 0) {
            // 所有資訊完整，計算總價
            return await this.calculateAndConfirm(conversation);
        } else {
            // 缺少資訊，智能詢問
            conversation.stage = 'collecting_info';
            return this.askForMissingInfo(conversation, missing);
        }
    }

    // 智能詢問缺失資訊
    askForMissingInfo(conversation, missing) {
        const info = conversation.collectedInfo;
        let response = '';
        
        // 根據已有資訊調整語氣
        if (conversation.turnCount <= 2) {
            response = '好的！讓我幫您安排訂房 ✨\n\n';
        } else {
            response = '收到！';
        }
        
        // 顯示已收集的資訊
        const collected = [];
        if (info.roomType) {
            const room = hotelData.roomTypes.find(r => r.id === info.roomType);
            collected.push(`房型：${room.name} ✓`);
        }
        if (info.nights) collected.push(`天數：${info.nights}晚 ✓`);
        if (info.adults) collected.push(`人數：${info.adults}位成人 ✓`);
        
        if (collected.length > 0) {
            response += '\n\n📝 **已確認**：\n' + collected.map(c => '• ' + c).join('\n') + '\n';
        }
        
        // 詢問第一個缺失項
        const firstMissing = missing[0];
        response += '\n\n';
        
        if (firstMissing.field === 'roomType') {
            response += '🏨 **請選擇房型**：\n\n';
            response += '1️⃣ 豪華客房 (NT$ 8,800/晚) - 舒適實惠\n';
            response += '2️⃣ 行政客房 (NT$ 12,800/晚) - 含早餐+貴賓廳\n';
            response += '3️⃣ 套房 (NT$ 18,800/晚) - 寬敞獨立客廳\n';
            response += '4️⃣ 總統套房 (NT$ 38,800/晚) - 頂級奢華\n\n';
            response += '💡 您可以直接回覆房型名稱或編號！';
            
        } else if (firstMissing.field === 'nights') {
            response += '📅 **預計住幾晚呢**？\n\n';
            response += '💡 提示：\n';
            response += '• 住3晚以上享95折\n';
            response += '• 住5晚以上享9折\n';
            response += '• 住7晚以上享85折';
            
        } else if (firstMissing.field === 'adults') {
            response += '👥 **請問幾位成人入住**？\n\n';
            response += '💡 如有兒童同行，也請告訴我人數和年齡哦！';
        }
        
        return response;
    }

    // 處理資訊提供
    async handleInfoProvided(conversation, extracted) {
        if (extracted.length === 0) {
            return '好的！還有其他需要補充的嗎？';
        }
        
        let response = '收到！';
        
        // 確認提取到的資訊
        if (extracted.length > 0) {
            response += '我已記下：\n';
            extracted.forEach(e => {
                response += `✓ ${e.field === 'roomType' ? '房型' : 
                                 e.field === 'nights' ? '天數' : 
                                 e.field === 'adults' ? '人數' : e.field}：${e.value}\n`;
            });
        }
        
        // 檢查是否還缺資訊
        const missing = this.checkMissingFields(conversation);
        
        if (missing.length === 0) {
            response += '\n所有資訊都齊全了！讓我幫您計算...\n\n';
            return await this.calculateAndConfirm(conversation);
        } else {
            response += '\n' + this.askForMissingInfo(conversation, missing);
        }
        
        return response;
    }

    // 計算並確認
    async calculateAndConfirm(conversation) {
        if (!bookingCalculator) return '計算服務載入中...';
        
        try {
            const breakdown = bookingCalculator.calculateTotal(conversation.collectedInfo);
            
            let response = bookingCalculator.formatBreakdown(breakdown);
            
            response += '\n\n';
            response += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
            response += '✨ **訂房流程**：\n';
            response += '1️⃣ 致電訂房專線：📞 +886-2-2523-8000\n';
            response += '2️⃣ 線上預訂：🌐 www.grandformosa.com.tw\n';
            response += '3️⃣ 現場訂房：歡迎親臨櫃台\n\n';
            response += '💡 **付款方式**：現金、信用卡、匯款\n';
            response += '🎁 **取消政策**：入住前3天免費取消\n\n';
            response += '還有其他問題嗎？或是想調整訂房內容？';
            
            conversation.stage = 'confirming';
            
            return response;
            
        } catch (error) {
            console.error('計算錯誤:', error);
            return '計算時發生錯誤，請確認資訊是否完整？';
        }
    }

    // 處理設施
    handleFacilities() {
        return '🏨 **台北晶華酒店 - 頂級設施**\n\n' +
               '🏊 **休閒娛樂**\n' +
               '• 室內溫水游泳池 (06:00-22:00)\n' +
               '• 24小時健身中心\n' +
               '• 芬蘭桑拿 & 蒸氣室\n' +
               '• 戶外花園\n\n' +
               '🍽️ **餐飲服務**\n' +
               '• 晶華軒 - 米其林推薦粵菜\n' +
               '• 栢麗廳 - 國際自助餐\n' +
               '• Robin\'s 鐵板燒\n' +
               '• Lobby Lounge - 精緻下午茶\n' +
               '• 24小時客房餐飲服務\n\n' +
               '💼 **商務設施**\n' +
               '• 商務中心 (24小時)\n' +
               '• 會議室 & 宴會廳\n' +
               '• 高速 WiFi (全館免費)\n\n' +
               '🚗 **其他服務**\n' +
               '• 免費停車場\n' +
               '• 機場接送服務\n' +
               '• 禮賓服務\n' +
               '• 洗衣服務\n\n' +
               '想了解更多細節嗎？';
    }

    // 處理早餐
    handleBreakfast() {
        return '🍳 **早餐資訊**\n\n' +
               '📍 **供應地點**：栢麗廳 2樓\n' +
               '⏰ **供應時間**：06:30 - 10:30（週末至11:00）\n' +
               '💰 **價格**：NT$ 650/人\n\n' +
               '�� **餐點特色**：\n' +
               '• 🌏 國際自助餐\n' +
               '• 🍜 台式粥品與小菜\n' +
               '• 🥞 現做蛋料理（歐姆蛋、班尼迪克蛋等）\n' +
               '• 🥖 每日新鮮烘焙麵包\n' +
               '• 🥗 有機沙拉吧\n' +
               '• 🧃 現榨果汁 & 咖啡吧\n\n' +
               '⭐ **好消息**：\n' +
               '行政客房、套房、總統套房\n' +
               '房客可免費享用早餐！\n\n' +
               '需要為您安排早餐嗎？';
    }

    // 處理位置
    handleLocation() {
        return '📍 **台北晶華酒店位置**\n\n' +
               '🏢 **地址**：\n' +
               '台北市中山區中山北路二段41號\n\n' +
               '🚇 **捷運交通**：\n' +
               '• 捷運中山站（淡水信義線）\n' +
               '  → 步行僅需3分鐘\n' +
               '• 捷運松江南京站\n' +
               '  → 步行8分鐘\n\n' +
               '✈️ **機場交通**：\n' +
               '• 松山機場：車程15分鐘\n' +
               '• 桃園機場：車程50分鐘\n\n' +
               '🚗 **機場接送服務**：\n' +
               '• 單程：NT$ 1,500\n' +
               '• 來回：NT$ 2,800\n' +
               '• 需提前24小時預約\n\n' +
               '🅿️ **停車資訊**：\n' +
               '• 飯店專屬地下停車場\n' +
               '• 房客免費停車\n\n' +
               '📱 **聯絡方式**：\n' +
               '電話：+886-2-2523-8000\n' +
               '官網：www.grandformosa.com.tw\n\n' +
               '需要預約接送服務嗎？';
    }

    // 處理未知意圖
    handleUnknown(conversation, message) {
        const suggestions = [
            '🤔 我可能沒有完全理解您的意思...\n\n讓我換個方式幫您：\n\n💡 **您是否想要**：\n• 查看房型和價格？\n• 計算訂房費用？\n• 了解飯店設施？\n• 詢問交通資訊？',
            
            '抱歉，我不太確定您的意思 😅\n\n不過我可以幫您：\n\n✨ 推薦適合的房型\n✨ 計算優惠價格\n✨ 介紹飯店特色\n✨ 解答任何疑問\n\n請告訴我，您最想了解什麼？'
        ];
        
        return suggestions[Math.floor(Math.random() * suggestions.length)];
    }

    // 處理確認
    async handleConfirmation(conversation, confirmed) {
        if (confirmed) {
            return '太好了！✨\n\n請透過以下方式完成預訂：\n\n' +
                   '📞 電話：+886-2-2523-8000\n' +
                   '🌐 官網：www.grandformosa.com.tw\n\n' +
                   '期待您的光臨！還有其他問題嗎？';
        } else {
            return '沒問題！需要調整哪些內容呢？\n或是想重新查詢其他資訊？';
        }
    }

    // 處理修改
    handleModification(conversation) {
        conversation.stage = 'collecting_info';
        return '好的！請告訴我需要修改哪些內容：\n\n' +
               '• 房型\n' +
               '• 入住天數\n' +
               '• 人數\n' +
               '• 其他需求\n\n' +
               '我會重新為您計算！';
    }

    async chat(message, sessionId = 'default') {
        try {
            const response = await this.generateResponse(message, sessionId);
            return {
                success: true,
                message: response,
                reply: response,
                sessionId: sessionId,
                analytics: {
                    totalChats: this.analytics.totalChats,
                    errorRate: (this.analytics.errorCount / this.analytics.totalChats * 100).toFixed(2) + '%'
                }
            };
        } catch (error) {
            console.error('對話錯誤:', error);
            this.analytics.errorCount++;
            return {
                success: false,
                message: '抱歉，系統遇到問題。請重新開始對話。',
                error: error.message
            };
        }
    }
}

module.exports = new NaturalConversationAI();
EOFAI

echo "✅ 自然對話系統已創建"

# 提交
git add services/mock-ai-service.js
git commit -m "feat: deploy natural conversation system v3.0

Revolutionary improvements:
✅ Multi-turn conversation management with stages
✅ Advanced intent detection with error tolerance
✅ Smart entity extraction with variations
✅ Context-aware responses
✅ Missing info detection and smart prompting
✅ Rich, natural language responses
✅ Built-in analytics tracking
✅ Graceful error handling
✅ Professional tone with emojis

This creates truly natural hotel booking conversations."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 已推送到 GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待部署（60秒）..."
sleep 60

echo ""
echo "🧪 測試自然對話系統..."
echo ""

# 測試多輪對話
echo "【場景1：逐步收集資訊】"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👤 用戶：我想訂房"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我想訂房", "sessionId": "test1"}' | jq -r '.message'

echo ""
echo "👤 用戶：豪華客房"
sleep 2
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房", "sessionId": "test1"}' | jq -r '.message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "【場景2：一次提供完整資訊】"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房住5晚，2個大人1個8歲小孩，要早餐，幫我算總價", "sessionId": "test2"}' | jq -r '.message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 自然對話系統部署完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 新增功能："
echo "   ✅ 多輪對話管理"
echo "   ✅ 智能詢問缺失資訊"
echo "   ✅ 上下文記憶"
echo "   ✅ 錯誤容錯"
echo "   ✅ 自然語言回覆"
echo "   ✅ 數據追蹤"
echo ""
echo "🔗 立即測試："
echo "   https://ai-hotel-assistant-builder-production.up.railway.app/ai-chat-demo.html"
echo ""


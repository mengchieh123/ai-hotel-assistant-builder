const hotelData = require('./hotel-data');
const bookingCalculator = require('./booking-calculator');

class EnhancedMockAI {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        console.log('🤖 增強版 AI 服務已初始化 v2.1');
    }

    isAvailable() {
        return this.available;
    }

    getConversation(sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                history: [],
                bookingInfo: {
                    roomType: null,
                    nights: null,
                    adults: null,
                    children: 0,
                    childrenAges: [],
                    includeBreakfast: false
                }
            });
        }
        return this.conversations.get(sessionId);
    }

    detectIntent(message) {
        const msg = message.toLowerCase();
        
        if (/^(你好|hi|hello|哈囉|嗨|您好)/.test(msg)) {
            return 'greeting';
        }
        if (/(有|提供|什麼|哪些).*(房型|房間|客房)/.test(msg)) {
            return 'room_inquiry';
        }
        if (/(多少錢|價格|費用|房價)/.test(msg)) {
            return 'price_inquiry';
        }
        if (/(計算|總共|總價|加起來)/.test(msg)) {
            return 'calculate';
        }
        if (/(設施|服務|游泳池|健身房)/.test(msg)) {
            return 'facilities';
        }
        if (/(早餐|breakfast)/.test(msg)) {
            return 'breakfast';
        }
        if (/(怎麼去|交通|位置|地址|在哪)/.test(msg)) {
            return 'location';
        }
        
        return 'unknown';
    }

    extractEntities(message, conversation) {
        const msg = message.toLowerCase();
        const info = conversation.bookingInfo;
        
        // 房型
        if (/豪華/.test(msg)) info.roomType = 'deluxe';
        else if (/行政/.test(msg)) info.roomType = 'executive';
        else if (/套房/.test(msg)) info.roomType = 'suite';
        
        // 天數
        const nightsMatch = msg.match(/(\d+)(晚|天)/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1]);
        
        // 成人
        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);
        
        // 兒童
        const childMatch = msg.match(/(\d+)(小孩|兒童)/);
        if (childMatch) info.children = parseInt(childMatch[1]);
        
        // 年齡
        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) {
            info.childrenAges = ageMatches.map(m => parseInt(m));
        }
        
        // 早餐
        if (/(含早|要早|加早)/.test(msg)) {
            info.includeBreakfast = true;
        }
    }

    async generateResponse(message, sessionId) {
        const conversation = this.getConversation(sessionId);
        const intent = this.detectIntent(message);
        
        this.extractEntities(message, conversation);
        
        conversation.history.push({ role: 'user', message: message });
        
        let response = '';

        switch (intent) {
            case 'greeting':
                response = '您好！👋 歡迎來到台北晶華酒店\n\n' +
                          '我是您的智能訂房助手，可以協助您：\n' +
                          '✨ 查看各式房型和價格\n' +
                          '✨ 即時計算訂房費用\n' +
                          '✨ 介紹飯店設施服務\n' +
                          '✨ 提供交通和位置資訊\n\n' +
                          '請告訴我您的需求，我很樂意為您服務！😊';
                break;
                
            case 'room_inquiry':
                response = '🏨 **台北晶華酒店房型介紹**\n\n';
                
                hotelData.roomTypes.forEach((room, i) => {
                    response += `**${i+1}. ${room.name}**\n`;
                    response += `💰 每晚 NT$ ${room.basePrice.toLocaleString()}\n`;
                    response += `📐 ${room.size}\n`;
                    response += `👥 最多 ${room.capacity.adults} 位成人\n`;
                    response += `🍳 ${room.breakfastIncluded ? '含' : '不含'}早餐\n\n`;
                });
                
                response += '💡 **優惠資訊**：\n';
                response += '• 住3晚以上享95折\n';
                response += '• 住5晚以上享9折\n';
                response += '• 住7晚以上享85折\n\n';
                response += '想了解哪個房型？或直接告訴我您的需求！';
                break;
                
            case 'price_inquiry':
                const { bookingInfo } = conversation;
                
                if (bookingInfo.roomType) {
                    const room = hotelData.roomTypes.find(r => r.id === bookingInfo.roomType);
                    response = `📊 **${room.name}價格資訊**\n\n`;
                    response += `💰 基本房價：NT$ ${room.basePrice.toLocaleString()}/晚\n\n`;
                    response += `🎁 **長住優惠**：\n`;
                    response += `• 3-4晚：享95折\n`;
                    response += `• 5-6晚：享90折\n`;
                    response += `• 7晚以上：享85折\n\n`;
                    
                    if (!room.breakfastIncluded) {
                        response += `🍳 **早餐加購**：NT$ 650/人/天\n\n`;
                    }
                    
                    response += `想知道具體總價？\n請告訴我：入住天數、成人和兒童人數`;
                } else {
                    response = '💰 **房價查詢**\n\n';
                    response += '請告訴我您想了解哪個房型：\n';
                    response += '• 豪華客房 (NT$ 8,800/晚)\n';
                    response += '• 行政客房 (NT$ 12,800/晚)\n';
                    response += '• 套房 (NT$ 18,800/晚)\n\n';
                    response += '我會為您提供詳細的價格資訊！';
                }
                break;
                
            case 'calculate':
                try {
                    const { roomType, nights, adults } = conversation.bookingInfo;
                    
                    if (roomType && nights && adults) {
                        const breakdown = bookingCalculator.calculateTotal(conversation.bookingInfo);
                        response = bookingCalculator.formatBreakdown(breakdown);
                        response += '\n\n📞 **立即預訂**\n';
                        response += '電話：+886-2-2523-8000\n';
                        response += '線上：www.grandformosa.com.tw\n\n';
                        response += '需要調整或有其他問題嗎？';
                    } else {
                        const missing = [];
                        if (!roomType) missing.push('房型');
                        if (!nights) missing.push('天數');
                        if (!adults) missing.push('成人人數');
                        
                        response = '📝 **需要完整資訊才能計算喔！**\n\n';
                        response += `還缺少：${missing.join('、')}\n\n`;
                        response += '範例：「豪華客房，住3晚，2大人1小孩8歲，含早餐」';
                    }
                } catch (error) {
                    console.error('計算錯誤:', error);
                    response = '抱歉，計算時發生錯誤。\n請確認資訊是否完整？';
                }
                break;
                
            case 'facilities':
                response = '🏨 **台北晶華酒店設施**\n\n';
                response += '🏊 **休閒設施**\n';
                response += '• 室內溫水游泳池 (6:00-22:00)\n';
                response += '• 24小時健身中心\n';
                response += '• 芬蘭桑拿浴室\n';
                response += '• 蒸氣室\n\n';
                response += '🍽️ **餐飲服務**\n';
                response += '• 晶華軒 - 頂級粵菜\n';
                response += '• 栢麗廳 - 國際自助餐\n';
                response += '• Robin\'s 鐵板燒\n';
                response += '• Lobby Lounge - 下午茶\n\n';
                response += '🚗 **其他服務**\n';
                response += '• 免費停車場\n';
                response += '• 機場接送服務\n';
                response += '• 24小時商務中心\n';
                response += '• 禮賓服務\n\n';
                response += '想了解更多細節嗎？';
                break;
                
            case 'breakfast':
                response = '�� **早餐資訊**\n\n';
                response += '📍 **供應地點**：栢麗廳\n';
                response += '⏰ **供應時間**：06:30 - 10:30\n';
                response += '💰 **價格**：NT$ 650/人\n\n';
                response += '🥐 **餐點內容**：\n';
                response += '• 中西式自助早餐\n';
                response += '• 現做蛋料理（歐姆蛋、班尼迪克蛋等）\n';
                response += '• 新鮮麵包和糕點\n';
                response += '• 現榨果汁、咖啡和茶\n';
                response += '• 台式粥品和配菜\n\n';
                response += '💎 行政客房和套房房客免費享用！';
                break;
                
            case 'location':
                response = '📍 **台北晶華酒店位置**\n\n';
                response += '🏢 **地址**：\n';
                response += '台北市中山區中山北路二段41號\n\n';
                response += '🚇 **大眾運輸**：\n';
                response += '• 捷運中山站步行3分鐘（淡水信義線）\n';
                response += '• 捷運松江南京站步行8分鐘\n\n';
                response += '✈️ **機場交通**：\n';
                response += '• 松山機場：車程15分鐘\n';
                response += '• 桃園機場：車程50分鐘\n\n';
                response += '🚗 **機場接送服務**：\n';
                response += '• 單程 NT$ 1,500\n';
                response += '• 需提前24小時預約\n\n';
                response += '需要預約接送服務嗎？';
                break;
                
            default:
                response = '我理解您的問題。讓我幫您整理一下：\n\n';
                response += '我可以協助您：\n';
                response += '🏨 查詢房型和價格\n';
                response += '💰 計算訂房費用\n';
                response += '🏊 了解設施服務\n';
                response += '📍 交通和位置資訊\n\n';
                response += '請告訴我您最想了解什麼？';
        }

        conversation.history.push({ role: 'assistant', message: response });
        
        return response;
    }

    async chat(message, sessionId = 'default') {
        try {
            const response = await this.generateResponse(message, sessionId);
            return {
                success: true,
                message: response,
                reply: response,
                sessionId: sessionId
            };
        } catch (error) {
            console.error('對話錯誤:', error);
            return {
                success: false,
                message: '抱歉，處理時發生錯誤。請稍後再試。',
                error: error.message
            };
        }
    }
}

module.exports = new EnhancedMockAI();

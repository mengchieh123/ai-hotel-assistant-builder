let hotelData, bookingCalculator;

try {
    hotelData = require('./hotel-data');
    console.log('✅ hotel-data 已加載');
} catch (e) {
    console.error('❌ hotel-data 加載失敗:', e.message);
}

try {
    bookingCalculator = require('./booking-calculator');
    console.log('✅ booking-calculator 已加載');
} catch (e) {
    console.error('❌ booking-calculator 加載失敗:', e.message);
}

class EnhancedMockAI {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        console.log('🤖 增強版 AI v2.2 已初始化');
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
        
        if (/^(你好|hi|hello|哈囉|嗨|您好)/.test(msg)) return 'greeting';
        if (/(有|提供|什麼|哪些).*(房型|房間|客房)/.test(msg)) return 'room_inquiry';
        if (/(多少錢|價格|費用|房價)/.test(msg)) return 'price_inquiry';
        if (/(計算|總共|總價|加起來)/.test(msg)) return 'calculate';
        if (/(設施|服務|游泳池|健身房)/.test(msg)) return 'facilities';
        if (/(早餐|breakfast)/.test(msg)) return 'breakfast';
        if (/(怎麼去|交通|位置|地址|在哪)/.test(msg)) return 'location';
        
        return 'unknown';
    }

    extractEntities(message, conversation) {
        const msg = message.toLowerCase();
        const info = conversation.bookingInfo;
        
        if (/豪華/.test(msg)) info.roomType = 'deluxe';
        else if (/行政/.test(msg)) info.roomType = 'executive';
        else if (/套房/.test(msg)) info.roomType = 'suite';
        
        const nightsMatch = msg.match(/(\d+)(晚|天)/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1]);
        
        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);
        
        const childMatch = msg.match(/(\d+)(小孩|兒童)/);
        if (childMatch) info.children = parseInt(childMatch[1]);
        
        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) info.childrenAges = ageMatches.map(m => parseInt(m));
        
        if (/(含早|要早|加早)/.test(msg)) info.includeBreakfast = true;
    }

    async generateResponse(message, sessionId) {
        const conversation = this.getConversation(sessionId);
        const intent = this.detectIntent(message);
        
        this.extractEntities(message, conversation);
        
        let response = '';

        try {
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
                    if (!hotelData) throw new Error('資料載入中');
                    
                    response = '🏨 **台北晶華酒店房型介紹**\n\n';
                    hotelData.roomTypes.forEach((room, i) => {
                        response += `**${i+1}. ${room.name}**\n`;
                        response += `💰 每晚 NT$ ${room.basePrice.toLocaleString()}\n`;
                        response += `📐 ${room.size}\n`;
                        response += `👥 最多 ${room.capacity.adults} 位成人\n`;
                        response += `🍳 ${room.breakfastIncluded ? '含' : '不含'}早餐\n\n`;
                    });
                    response += '💡 長住優惠：3晚95折、5晚9折、7晚85折\n\n';
                    response += '想了解哪個房型？';
                    break;
                    
                case 'price_inquiry':
                    if (!hotelData) throw new Error('資料載入中');
                    
                    const { bookingInfo } = conversation;
                    if (bookingInfo.roomType) {
                        const room = hotelData.roomTypes.find(r => r.id === bookingInfo.roomType);
                        response = `📊 **${room.name}價格資訊**\n\n`;
                        response += `💰 基本房價：NT$ ${room.basePrice.toLocaleString()}/晚\n\n`;
                        response += `🎁 長住優惠：\n• 3-4晚：95折\n• 5-6晚：90折\n• 7晚以上：85折\n\n`;
                        if (!room.breakfastIncluded) {
                            response += `🍳 早餐加購：NT$ 650/人/天\n\n`;
                        }
                        response += `想計算具體總價？請告訴我天數和人數！`;
                    } else {
                        response = '💰 請選擇房型：\n• 豪華客房 NT$ 8,800/晚\n• 行政客房 NT$ 12,800/晚\n• 套房 NT$ 18,800/晚';
                    }
                    break;
                    
                case 'calculate':
                    if (!bookingCalculator) throw new Error('計算服務載入中');
                    
                    const { roomType, nights, adults } = conversation.bookingInfo;
                    if (roomType && nights && adults) {
                        const breakdown = bookingCalculator.calculateTotal(conversation.bookingInfo);
                        response = bookingCalculator.formatBreakdown(breakdown);
                        response += '\n\n📞 立即預訂：+886-2-2523-8000';
                    } else {
                        response = '請提供完整資訊：房型、天數、人數\n範例：「豪華客房，住3晚，2大人」';
                    }
                    break;
                    
                case 'facilities':
                    response = '🏨 **設施服務**\n\n🏊 游泳池 | 💪 健身房 | 🍽️ 餐廳\n🅿️ 停車場 | ✈️ 機場接送';
                    break;
                    
                case 'breakfast':
                    response = '🍳 **早餐資訊**\n\n📍 栢麗廳\n⏰ 06:30-10:30\n💰 NT$ 650/人';
                    break;
                    
                case 'location':
                    response = '📍 **位置**\n\n台北市中山區中山北路二段41號\n🚇 捷運中山站步行3分鐘';
                    break;
                    
                default:
                    response = '我可以協助您：\n🏨 房型查詢\n💰 價格計算\n🏊 設施資訊';
            }
        } catch (error) {
            console.error('生成回覆錯誤:', error);
            response = '抱歉，處理時發生錯誤。請稍後再試。\n錯誤：' + error.message;
        }

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
                message: '系統錯誤: ' + error.message
            };
        }
    }
}

module.exports = new EnhancedMockAI();

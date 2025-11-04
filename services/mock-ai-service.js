const hotelData = require('./hotel-data');
const bookingCalculator = require('./booking-calculator');

class MockAIService {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        console.log('🤖 智能模擬 AI 服務已初始化（含計算引擎）');
    }

    isAvailable() {
        return this.available;
    }

    extractBookingInfo(message, sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                roomType: null,
                nights: null,
                adults: null,
                children: null,
                childrenAges: [],
                seniors: 0,
                checkInDate: null,
                includeBreakfast: false,
                addons: []
            });
        }

        const state = this.conversations.get(sessionId);
        const msg = message.toLowerCase();

        // 提取天數
        const nightsMatch = msg.match(/(\d+)晚|住(\d+)天|(\d+)天/);
        if (nightsMatch) {
            state.nights = parseInt(nightsMatch[1] || nightsMatch[2] || nightsMatch[3]);
        }

        // 提取成人數
        const adultsMatch = msg.match(/(\d+)個?(大人|成人)|(\d+)位成人/);
        if (adultsMatch) {
            state.adults = parseInt(adultsMatch[1] || adultsMatch[3]);
        }

        // 提取兒童數
        const childrenMatch = msg.match(/(\d+)個?(小孩|兒童|孩子)/);
        if (childrenMatch) {
            state.children = parseInt(childrenMatch[1]);
        }

        // 提取兒童年齡
        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches && state.children > 0) {
            state.childrenAges = ageMatches.map(m => parseInt(m));
        }

        // 提取房型
        if (msg.includes('豪華')) state.roomType = 'deluxe';
        else if (msg.includes('行政')) state.roomType = 'executive';
        else if (msg.includes('套房')) state.roomType = 'suite';
        else if (msg.includes('總統')) state.roomType = 'presidential';

        // 早餐
        if (msg.includes('含早') || msg.includes('加早餐') || msg.includes('要早餐')) {
            state.includeBreakfast = true;
        }

        return state;
    }

    async chat(message, sessionId = 'default') {
        await new Promise(resolve => setTimeout(resolve, 200));

        const msg = message.toLowerCase();
        let response = '';

        // 🎯 智能訂房計算 - 使用計算引擎
        if (msg.includes('計算') || msg.includes('總價') || msg.includes('多少錢')) {
            const bookingInfo = this.extractBookingInfo(message, sessionId);
            
            console.log('📊 提取到的訂房資訊:', bookingInfo);
            
            if (bookingInfo.roomType && bookingInfo.nights && bookingInfo.adults) {
                try {
                    console.log('💰 開始計算價格...');
                    const breakdown = bookingCalculator.calculateTotal(bookingInfo);
                    response = bookingCalculator.formatBreakdown(breakdown);
                    response += '\n如需預訂，請致電：📞 +886-2-2523-8000';
                    console.log('✅ 價格計算完成');
                } catch (error) {
                    console.error('❌ 計算錯誤:', error);
                    response = '計算時發生錯誤：' + error.message + '\n\n';
                    response += '請提供完整資訊：\n';
                    response += '• 房型（豪華/行政/套房）\n';
                    response += '• 入住天數\n';
                    response += '• 成人人數\n';
                    response += '• 兒童人數和年齡（如有）';
                }
            } else {
                response = '請提供完整訂房資訊以計算總價：\n\n';
                response += '📝 需要的資訊：\n';
                response += '• 房型（豪華/行政/套房/總統）\n';
                response += '• 入住天數\n';
                response += '• 成人人數\n';
                response += '• 兒童人數和年齡（如有）\n\n';
                response += '💡 範例：「豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價」';
            }
        }
        // 促銷活動
        else if (msg.includes('促銷') || msg.includes('活動') || msg.includes('優惠') || msg.includes('專案')) {
            response = '🎉 目前熱門促銷活動\n\n';
            hotelData.promotions.forEach((promo, index) => {
                response += (index + 1) + '. ' + promo.name + '\n';
                response += '   ' + promo.description + '\n';
                if (promo.discount) response += '   💰 優惠：' + promo.discount + '% OFF\n';
                response += '\n';
            });
        }
        // 問候
        else if (msg.includes('你好') || msg.includes('hi') || msg.includes('哈囉')) {
            response = '您好！歡迎光臨台北晶華酒店 🏨\n\n';
            response += '我是您的專屬客服助手，很高興為您服務！\n\n';
            response += '我可以協助您：\n';
            response += '✨ 查詢房型與價格\n';
            response += '✨ 計算訂房費用\n';
            response += '✨ 推薦合適方案\n\n';
            response += '請問有什麼我可以幫您的嗎？';
        }
        // 房型查詢
        else if (msg.includes('房型') || msg.includes('房間')) {
            response = '我們提供以下精緻房型：\n\n';
            hotelData.roomTypes.forEach(room => {
                response += '🏨 ' + room.name + '\n';
                response += '   💰 NT$ ' + room.basePrice.toLocaleString() + ' / 晚\n';
                response += '   📐 ' + room.size + ' | 👥 可容納 ' + room.capacity.adults + '人\n';
                response += '   🍳 早餐：' + (room.breakfastIncluded ? '含' : '不含') + '\n\n';
            });
            response += '想了解哪個房型的詳細資訊或計算價格嗎？';
        }
        // 默認回覆
        else {
            response = '感謝您的詢問！🤖\n\n';
            response += '您可以問我：\n';
            response += '• 房型和價格\n';
            response += '• 訂房計算（提供完整資訊可立即計算）\n';
            response += '• 促銷活動\n\n';
            response += '或直接致電訂房專線：📞 +886-2-2523-8000';
        }

        return {
            success: true,
            message: response,
            sessionId: sessionId
        };
    }

    async recommendRoom(preferences) {
        return { success: true, recommendation: '推薦內容' };
    }
}

module.exports = new MockAIService();

class MockAIService {
    constructor() {
        this.available = true;
        console.log('🤖 Mock AI 服務已初始化（穩定版）');
        
        // 延遲加載依賴
        this.hotelData = null;
        this.calculator = null;
        
        try {
            this.hotelData = require('./hotel-data');
            console.log('✅ hotel-data 已加載');
        } catch (e) {
            console.error('⚠️  hotel-data 加載失敗:', e.message);
        }
        
        try {
            this.calculator = require('./booking-calculator');
            console.log('✅ booking-calculator 已加載');
        } catch (e) {
            console.error('⚠️  calculator 加載失敗:', e.message);
        }
    }

    isAvailable() {
        return this.available;
    }

    async chat(message, sessionId = 'default') {
        const msg = message.toLowerCase();
        let response = '';

        try {
            // 智能計算
            if ((msg.includes('計算') || msg.includes('總價')) && this.calculator) {
                const bookingInfo = this.extractBookingInfo(message);
                
                if (bookingInfo.roomType && bookingInfo.nights && bookingInfo.adults) {
                    const breakdown = this.calculator.calculateTotal(bookingInfo);
                    response = this.calculator.formatBreakdown(breakdown);
                    response += '\n\n如需預訂，請致電：📞 +886-2-2523-8000';
                } else {
                    response = '請提供完整資訊：房型、天數、人數\n範例：「豪華客房，住3晚，2大人」';
                }
            }
            // 問候
            else if (msg.includes('你好') || msg.includes('hi')) {
                response = '您好！歡迎光臨台北晶華酒店🏨\n\n我可以幫您：\n✨ 查詢房型\n✨ 計算價格\n\n請問需要什麼協助？';
            }
            // 房型
            else if (msg.includes('房型')) {
                response = '我們提供：\n🏨 豪華客房 NT$8,800/晚\n🏨 行政客房 NT$12,800/晚\n🏨 套房 NT$18,800/晚';
            }
            // 默認
            else {
                response = '您好！我可以幫您查詢房型或計算價格。\n請問需要什麼協助？';
            }
        } catch (error) {
            console.error('對話錯誤:', error);
            response = '抱歉，處理時發生錯誤。請稍後再試。';
        }

        return {
            success: true,
            message: response,
            sessionId: sessionId
        };
    }

    extractBookingInfo(message) {
        const info = {
            roomType: null,
            nights: null,
            adults: null,
            children: 0,
            childrenAges: [],
            includeBreakfast: false
        };

        const msg = message.toLowerCase();

        if (msg.includes('豪華')) info.roomType = 'deluxe';
        else if (msg.includes('行政')) info.roomType = 'executive';
        else if (msg.includes('套房')) info.roomType = 'suite';

        const nightsMatch = msg.match(/(\d+)晚|住(\d+)天/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1] || nightsMatch[2]);

        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);

        const childMatch = msg.match(/(\d+)(小孩|兒童)/);
        if (childMatch) info.children = parseInt(childMatch[1]);

        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) {
            info.childrenAges = ageMatches.map(m => parseInt(m));
        }

        if (msg.includes('含早') || msg.includes('早餐')) {
            info.includeBreakfast = true;
        }

        return info;
    }
}

module.exports = new MockAIService();

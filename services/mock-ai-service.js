let hotelData, bookingCalculator;

try {
    hotelData = require('./hotel-data');
    bookingCalculator = require('./booking-calculator');
} catch (e) {
    console.error('模塊加載失敗:', e.message);
}

class MinimalStableAI {
    constructor() {
        this.available = true;
        this.sessions = new Map();
        console.log('🤖 極簡穩定版 AI v3.2 初始化');
    }

    isAvailable() { return this.available; }

    getSession(id) {
        if (!this.sessions.has(id)) {
            this.sessions.set(id, { 
                roomType: null, nights: null, adults: null, 
                children: 0, includeBreakfast: false 
            });
        }
        return this.sessions.get(id);
    }

    async chat(message, sessionId = 'default') {
        try {
            const msg = message.toLowerCase().trim();
            const session = this.getSession(sessionId);
            let response = '';

            // 精確匹配優先
            if (msg === '你好' || msg === 'hi' || msg === 'hello') {
                response = '您好！👋 我是台北晶華酒店智能助手\n\n我可以協助您：\n🏨 查看房型\n💰 計算價格\n🎉 查詢優惠\n💎 會員權益\n\n請問想了解什麼？';
            }
            else if (msg === '房型' || msg === '房型介紹' || msg === '房間' || /房型.*介紹|介紹.*房型/.test(msg)) {
                if (!hotelData) {
                    response = '資料載入中...';
                } else {
                    response = '🏨 **房型介紹**\n\n';
                    hotelData.roomTypes.forEach((room, i) => {
                        response += `${i+1}. **${room.name}** - NT$ ${room.basePrice.toLocaleString()}/晚\n`;
                        response += `   📐 ${room.size} | 🍳 ${room.breakfastIncluded ? '含' : '不含'}早餐\n\n`;
                    });
                    response += '💎 長住優惠：3晚95折、5晚9折、7晚85折';
                }
            }
            else if (msg === '早餐' || msg === '加購早餐' || /早餐.*加購|加購.*早餐/.test(msg)) {
                response = '🍳 **早餐資訊**\n\n✅ 含早餐：行政客房、套房、總統套房\n❌ 需加購：豪華客房（NT$ 650/人/天）\n\n🕐 06:30-10:30\n📍 栢麗廳';
            }
            else if (msg === '優惠' || msg === '優惠專案' || msg === '折扣' || msg === '促銷' || msg === '活動') {
                response = '🎉 **優惠活動**\n\n🐦 早鳥：30天前8折\n🏠 連住：3晚95折、5晚9折、7晚85折\n🎓 學生：85折\n👴 銀髮：65歲以上85折\n⏰ 最後優惠：當日訂7折';
            }
            else if (/小孩|兒童/.test(msg) && /費用|收費|價格/.test(msg)) {
                response = '👶 **兒童收費**\n\n0-6歲：免費\n7-12歲：NT$ 800/晚\n13歲以上：NT$ 1,200/晚';
            }
            else if (/取消|退訂/.test(msg)) {
                response = '📋 **取消政策**\n\n✅ 24小時前：免費\n⚠️ 12小時前：退50%\n❌ 12小時內：不退款\n\n📞 +886-2-2523-8000';
            }
            else if (/會員/.test(msg)) {
                response = '💎 **會員制度**\n\n銀卡：10晚或NT$15,000 → 5%折\n金卡：30晚或NT$45,000 → 8%折\n白金：60晚或NT$90,000 → 12%折';
            }
            else if (/積分|點數/.test(msg)) {
                response = '🎁 **積分制度**\n\n💰 每NT$100=1點\n\n兌換：\n500點→早餐券\n1000點→升等\n2000點→免費住1晚';
            }
            else if (/設施|服務|游泳池/.test(msg)) {
                response = '🏨 **設施**\n\n🏊 游泳池\n💪 健身房\n🍽️ 餐廳\n🅿️ 停車\n✈️ 機場接送';
            }
            else if (/位置|地址|交通/.test(msg)) {
                response = '📍 台北市中山區中山北路二段41號\n🚇 捷運中山站3分鐘\n✈️ 松山機場15分鐘';
            }
            else if (/付款|支付|刷卡/.test(msg)) {
                response = '💳 信用卡、LINE Pay、匯款、現金\n🧾 可開發票';
            }
            else if (/入住|退房/.test(msg) && /時間|幾點/.test(msg)) {
                response = '⏰ 入住：15:00起\n⏰ 退房：11:00前\n\n💎 金卡以上：12:00入住、13:00退房';
            }
            // 提取實體
            else if (/豪華/.test(msg)) { session.roomType = 'deluxe'; response = '已記下：豪華客房 ✓\n\n請問住幾晚？'; }
            else if (/行政/.test(msg)) { session.roomType = 'executive'; response = '已記下：行政客房 ✓\n\n請問住幾晚？'; }
            else if (/套房/.test(msg) && !/總統/.test(msg)) { session.roomType = 'suite'; response = '已記下：套房 ✓\n\n請問住幾晚？'; }
            else if (/總統/.test(msg)) { session.roomType = 'presidential'; response = '已記下：總統套房 ✓\n\n請問住幾晚？'; }
            // 計算
            else if (/\d+(晚|天)/.test(msg) || /計算|總價/.test(msg)) {
                const nightsMatch = msg.match(/(\d+)(晚|天)/);
                if (nightsMatch) session.nights = parseInt(nightsMatch[1]);
                
                const adultsMatch = msg.match(/(\d+)(大人|成人|個|位)/);
                if (adultsMatch) session.adults = parseInt(adultsMatch[1]);
                
                if (session.roomType && session.nights && session.adults && bookingCalculator) {
                    try {
                        const breakdown = bookingCalculator.calculateTotal(session);
                        response = bookingCalculator.formatBreakdown(breakdown) + '\n\n📞 +886-2-2523-8000';
                    } catch (e) {
                        response = '計算錯誤，請提供：房型、天數、人數';
                    }
                } else {
                    response = '請提供：房型、天數、人數\n\n範例：「豪華客房3晚2大人」';
                }
            }
            else if (/訂房|預訂/.test(msg)) {
                response = '好的！請告訴我：\n\n🏨 房型（豪華/行政/套房）\n📅 天數\n👥 人數';
            }
            else {
                response = '我可以幫您：\n\n🏨 房型介紹\n💰 價格查詢\n🎉 優惠活動\n💎 會員權益\n📋 訂房政策\n\n請問想了解什麼？';
            }

            return { success: true, message: response, reply: response, sessionId };
        } catch (error) {
            console.error('對話錯誤:', error);
            return { success: false, message: '系統錯誤，請重試' };
        }
    }
}

module.exports = new MinimalStableAI();

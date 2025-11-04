const hotelData = require('./hotel-data');

class MockAIService {
    constructor() {
        this.available = true;
        console.log('🤖 模擬 AI 服務已初始化');
    }

    isAvailable() {
        return this.available;
    }

    async chat(message, sessionId = 'default') {
        // 模擬思考延遲
        await new Promise(resolve => setTimeout(resolve, 200));

        const msg = message.toLowerCase();
        let response = '';

        // 關鍵字匹配回覆
        if (msg.includes('你好') || msg.includes('hi') || msg.includes('哈囉')) {
            response = `您好！歡迎光臨台北晶華酒店 🏨

我是您的專屬客服助手，很高興為您服務！

我可以協助您：
✨ 查詢房型與價格
✨ 了解飯店設施
✨ 提供訂房建議
✨ 回答入住相關問題

請問有什麼我可以幫您的嗎？`;

        } else if (msg.includes('房型') || msg.includes('房間')) {
            response = `我們提供以下精緻房型：\n\n`;
            hotelData.roomTypes.forEach(room => {
                response += `🏨 ${room.name}\n`;
                response += `   💰 NT$ ${room.price.toLocaleString()} / 晚\n`;
                response += `   📐 ${room.size} | 👥 可容納 ${room.capacity}人\n`;
                response += `   ✨ ${room.features.slice(0, 3).join('、')}\n\n`;
            });
            response += `想了解更詳細的資訊嗎？`;

        } else if (msg.includes('價格') || msg.includes('多少')) {
            response = `我們的房型價格如下：\n\n`;
            hotelData.roomTypes.forEach(room => {
                response += `💎 ${room.name}：NT$ ${room.price.toLocaleString()} / 晚\n`;
            });
            response += `\n💡 提示：提前預訂享有優惠！需要推薦合適的房型嗎？`;

        } else if (msg.includes('訂房') || msg.includes('預訂') || msg.includes('預約')) {
            response = `很高興協助您訂房！📝

請提供以下資訊：
📅 入住日期：
📅 退房日期：
👥 入住人數：
💰 預算範圍：（選填）

您也可以直接致電訂房專線：
📞 +886-2-2523-8000

我們的訂房團隊隨時為您服務！`;

        } else if (msg.includes('設施') || msg.includes('服務')) {
            response = `台北晶華酒店提供完善的設施與服務：\n\n`;
            hotelData.facilities.forEach(f => {
                response += `🎯 ${f.category}\n`;
                f.items.forEach(item => {
                    response += `   • ${item}\n`;
                });
                response += `\n`;
            });
            response += `需要了解特定設施的詳情嗎？`;

        } else if (msg.includes('兩人') || msg.includes('2人')) {
            response = `為兩位客人推薦以下房型：

🌟 豪華客房（熱門推薦）
   💰 NT$ 8,800 / 晚
   ✨ 35m²，舒適寬敞
   🛏️ 可選特大床或雙床配置
   
💼 行政客房
   💰 NT$ 12,800 / 晚
   ✨ 42m²，含行政酒廊權益
   🍳 免費早餐與晚間雞尾酒
   
您有預算考量或其他偏好嗎？`;

        } else if (msg.includes('推薦')) {
            response = `很樂意為您推薦！為了提供最適合的建議，請告訴我：

👥 入住人數：
💰 預算範圍：
🎯 特殊需求：（如景觀、樓層、設施等）

這樣我可以為您量身推薦最合適的房型！`;

        } else {
            response = `感謝您的詢問！🤖

您可以問我：
• 房型和價格
• 飯店設施與服務
• 訂房流程
• 入住相關問題

或直接致電訂房專線：📞 +886-2-2523-8000`;
        }

        return {
            success: true,
            message: response,
            sessionId: sessionId
        };
    }

    async recommendRoom(preferences) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { guests, budget } = preferences;
        let recommendation = '根據您的需求，我推薦：\n\n';

        if (budget && budget < 10000) {
            recommendation += '🏨 豪華客房\n💰 NT$ 8,800 / 晚\n✨ 性價比最高，設施完善';
        } else if (budget && budget < 15000) {
            recommendation += '💼 行政客房\n💰 NT$ 12,800 / 晚\n✨ 含行政酒廊，更多禮遇';
        } else {
            recommendation += '🌟 套房\n💰 NT$ 18,800 / 晚\n✨ 獨立客廳，奢華體驗';
        }

        return {
            success: true,
            recommendation: recommendation
        };
    }
}

module.exports = new MockAIService();

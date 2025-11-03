const hotelData = require('./hotel-data');

class MockAIService {
    constructor() {
        this.available = true;
        console.log('✅ 模擬 AI 服務已啟動（用於測試）');
    }

    isAvailable() {
        return this.available;
    }

    async chat(message, sessionId = 'default') {
        // 模擬思考延遲
        await new Promise(resolve => setTimeout(resolve, 500));

        const msg = message.toLowerCase();
        let response = '';

        // 簡單的關鍵字匹配
        if (msg.includes('你好') || msg.includes('哈囉') || msg.includes('hi')) {
            response = `您好！歡迎光臨台北晶華酒店 🏨

我是您的專屬客服助手，很高興為您服務！

我可以協助您：
✨ 查詢房型與價格
✨ 了解飯店設施
✨ 提供訂房建議
✨ 回答入住相關問題

請問有什麼我可以幫您的嗎？`;

        } else if (msg.includes('房型') || msg.includes('房間')) {
            const rooms = hotelData.roomTypes;
            response = `我們提供以下精緻房型：\n\n`;
            rooms.forEach(room => {
                response += `🏨 ${room.name}\n`;
                response += `   💰 NT$ ${room.price.toLocaleString()} / 晚\n`;
                response += `   📐 ${room.size} | 👥 ${room.capacity}人\n`;
                response += `   ✨ ${room.features.slice(0, 3).join('、')}\n\n`;
            });
            response += `想了解更詳細的資訊或預訂房間嗎？`;

        } else if (msg.includes('價格') || msg.includes('多少錢') || msg.includes('多少')) {
            response = `我們的房型價格如下：\n\n`;
            hotelData.roomTypes.forEach(room => {
                response += `💎 ${room.name}：NT$ ${room.price.toLocaleString()} / 晚\n`;
            });
            response += `\n💡 提示：提前預訂可享優惠！\n需要根據您的預算推薦合適房型嗎？`;

        } else if (msg.includes('訂房') || msg.includes('預訂') || msg.includes('預約') || msg.includes('訂') || msg.includes('11月5')) {
            response = `很高興協助您訂房！ 📝

請您提供以下資訊：
📅 入住日期：
📅 退房日期：
�� 入住人數：
💰 預算範圍：（如有）

或您也可以直接致電我們的訂房專線：
📞 +886-2-2523-8000

我們的訂房人員會立即為您服務！`;

        } else if (msg.includes('設施') || msg.includes('服務')) {
            response = `台北晶華酒店提供完善的設施與服務：\n\n`;
            hotelData.facilities.forEach(f => {
                response += `🎯 ${f.category}\n${f.items.map(i => `   • ${i}`).join('\n')}\n\n`;
            });
            response += `需要了解特定設施的詳情嗎？`;

        } else if (msg.includes('兩人') || msg.includes('2人') || msg.includes('兩個人')) {
            response = `為兩位客人推薦以下房型：

🌟 豪華客房（推薦）
   💰 NT$ 8,800 / 晚
   ✨ 35m²，舒適寬敞
   🛏️ 可選特大床或雙床
   
💼 行政客房
   💰 NT$ 12,800 / 晚
   ✨ 42m²，含行政酒廊
   🍳 免費早餐與晚間雞尾酒
   
您有預算考量或特殊偏好嗎？`;

        } else if (msg.includes('推薦')) {
            response = `很樂意為您推薦！為了提供最適合的建議，請告訴我：

👥 入住人數：
💰 預算範圍：
🎯 特殊需求：（如景觀、樓層、設施等）

這樣我可以為您推薦最合適的房型！`;

        } else {
            response = `感謝您的詢問！我目前還在學習中 🤖

您可以問我：
• 房型和價格
• 飯店設施
• 訂房流程
• 入住相關問題

或直接致電訂房專線：📞 +886-2-2523-8000`;
        }

        return {
            success: true,
            message: response,
            sessionId: sessionId,
            mode: 'mock'
        };
    }

    async recommendRoom(preferences) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { guests, budget } = preferences;
        let recommendation = '根據您的需求，我推薦：\n\n';

        if (budget && budget < 10000) {
            recommendation += '🏨 豪華客房\n';
            recommendation += '💰 NT$ 8,800 / 晚\n';
            recommendation += '✨ 性價比最高，設施完善\n';
        } else if (budget && budget >= 10000 && budget < 15000) {
            recommendation += '💼 行政客房\n';
            recommendation += '💰 NT$ 12,800 / 晚\n';
            recommendation += '✨ 含行政酒廊，更多尊榮禮遇\n';
        } else {
            recommendation += '🌟 套房\n';
            recommendation += '💰 NT$ 18,800 / 晚\n';
            recommendation += '✨ 獨立客廳，奢華享受\n';
        }

        return {
            success: true,
            recommendation: recommendation
        };
    }

    async translate(text, targetLanguage) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return {
            success: true,
            translatedText: `[模擬翻譯至 ${targetLanguage}] ${text}`,
            originalText: text,
            targetLanguage: targetLanguage
        };
    }
}

module.exports = new MockAIService();

// 導入 Day.js 及其插件
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

class SmartIntentClassifier {
    static classify(message) {
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // --- I. 核心意圖和狀態檢查 ---
        
        // 核心訂房意圖 (Booking)
        if (/(訂房|預訂|入住|幫我訂|想要訂|預約房間|我要訂房|book|訂幾晚)/.test(lowerMessage)) { 
            intents.add('booking');
        }
        // 日期如果包含在內，也視為強烈訂房意圖
        if (this.containsDatePatterns(lowerMessage)) { 
             intents.add('booking');
        }

        // 確認/拒絕意圖
        if (/(是|對|好|確認|願意|繼續|訂|繼續訂房|yes)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|no)/.test(lowerMessage)) intents.add('deny');

        // 會員意圖
        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');

        // ⭐️ 新增：加購/附加項目意圖 (addon_selection)
        // 此意圖主要用於處理 Rich Card 按鈕點擊的回饋
        if (lowerMessage.includes('加購') || lowerMessage.includes('票券') || lowerMessage.includes('下午茶') || lowerMessage.includes('早餐')) {
            intents.add('addon_selection');
        }

        // ⭐️ 查詢/介紹意圖 (Inquiry)
        if (/(介紹|說明|什麼樣|怎麼樣|細節|環境|特色|如何|查詢|是什麼)/.test(lowerMessage)) {
             intents.add('inquiry');
        }
        
        // 房型關鍵字
        if (/(豪華客房|標準雙人房|行政套房|家庭四人房)/.test(lowerMessage)) {
            intents.add('roomType_keyword'); // 作為標記，用於 P:98 規則
        }
        
        // 資訊意圖 (Pricing)
        if (/(價格|價錢|多少錢|房價|費用|收費|促銷|優惠)/.test(lowerMessage)) intents.add('pricing');

        // 非訂房意圖（會觸發流程暫停/轉向 AI 處理）
        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵|交通)/,
            'restaurant': /(餐廳|用餐|午餐|晚餐|美食|吃)/,
            'attractions': /(景點|逛街|導覽|玩|旅遊)/,
            'facilities': /(設施|泳池|健身房|spa|按摩)/,
            'weather': /(天氣|氣溫|下雨|溫度)/,
            'modification': /(修改|取消訂單|改期)/,
            'emergency': /(救命|火災|小偷|警察|緊急)/
        };

        for (const intent in nonBookingIntentsMap) {
            if (nonBookingIntentsMap[intent].test(lowerMessage)) {
                intents.add(intent);
            }
        }

        return intents.size > 0 ? Array.from(intents) : ['general_inquiry'];
    }

    static containsDatePatterns(message) {
        // 簡化日期判斷，防止誤判
        const datePatterns = [
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    // 簡化並優化日期解析 (O1)
    static parseDate(text) {
        const now = dayjs().startOf('day');
        let targetDate = null;
        let nights = null;

        // 1. 處理相對日期
        if (text.includes('今天') || text.includes('今晚') || text.includes('今夜')) {
            targetDate = now;
        } else if (text.includes('明天')) {
            targetDate = now.add(1, 'day');
        } else if (text.includes('後天')) {
            targetDate = now.add(2, 'day');
        }

        // 2. 處理絕對日期 (例如 12月25日)
        const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日?/);
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            let checkYear = now.year();

            // 跨年處理：如果月份在當前月份之前，則設為下一年 (例如 12月，但現在是 1月，則視為當年 12 月)
            if (month < now.month() + 1) {
                checkYear = now.year() + 1;
            } else if (month === now.month() + 1 && day < now.date()) {
                 // 當月但在今天之前，也設為下一年
                 checkYear = now.year() + 1;
            }

            targetDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
        }

        // 3. 解析住宿晚數
        const nightsMatch = text.match(/(\d+)[晚夜天]|住.*(\d+)[晚夜天]/);
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
        }

        // 預設住 1 晚
        if (targetDate && targetDate.isValid() && !nights) {
            nights = 1;
        }

        // 確保日期有效且在今天或之後
        if (targetDate && targetDate.isValid() && targetDate.isSameOrAfter(now)) {
            return {
                checkInDate: targetDate.format('YYYY/MM/DD'),
                nights: nights
            };
        }
        return {};
    }

    static extractEntities(message) {
        const data = {};
        const lowerMessage = message.toLowerCase();

        // 1. 解析日期和晚數
        const dateInfo = this.parseDate(message);
        Object.assign(data, dateInfo);

        // 2. 房型
        if (/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/)[0];
        }

        // 3. 人數
        const adultMatch = lowerMessage.match(/(\d+)位大人|(\d+)大/);
        if (adultMatch) {
            data.adultCount = parseInt(adultMatch[1] || adultMatch[2], 10);
        }
        const childMatch = lowerMessage.match(/(\d+)位兒童|(\d+)小/);
        if (childMatch) {
            data.childCount = parseInt(childMatch[1] || childMatch[2], 10);
        }

        // 4. 聯絡方式 - NAME & EMAIL
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            let extractedName = nameMatch[1] || nameMatch[2];
            if (extractedName && extractedName.length >= 2 && !/(訂房|本人|我是|查詢|價格|預訂|訂房助理)/.test(extractedName)) {
                data.name = extractedName.trim();
            }
        }
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
            data.email = emailMatch[0];
        }

        // 5. 會員帳號/手機號碼
        const memberMatch = message.match(/(\d{8,12})|([A-Za-z0-9]{5,10})/);
        if (memberMatch) {
            data.memberAccount = memberMatch[0];
        }

        // 6. 房間間數
        const roomCountMatch = lowerMessage.match(/(\d+)[間個]/);
        if (roomCountMatch) {
            data.roomCount = parseInt(roomCountMatch[1], 10);
        }

        // 7. ⭐️ 關鍵新增：加購實體解析 (從 Rich Card 按鈕數據中提取)
        try {
            // 嘗試將整個訊息解析為 JSON。
            // 這是處理 Rich Card 按鈕點擊的標準方法，因為按鈕通常會傳送一個 JSON 字串。
            const buttonData = JSON.parse(message);
            
            // 檢查是否包含我們在 BookingController 中定義的加購實體
            if (buttonData.addonId) {
                data.addonId = buttonData.addonId;
            }
            if (buttonData.addonAction) {
                data.addonAction = buttonData.addonAction;
            }
        } catch (e) {
            // 如果解析失敗，說明這是一條普通文字訊息，無需動作
        }

        // 預設值
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
}

module.exports = SmartIntentClassifier;

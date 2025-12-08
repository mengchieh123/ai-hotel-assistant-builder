// SmartIntentClassifier.js (V3.3 - 修正版)

// 導入 Day.js 及其插件
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

class SmartIntentClassifier {
    
    /**
     * 核心意圖分類**與實體提取**函式
     * 🚨 修正：現在返回 { intents, entities } 物件。
     */
    static classify(message) { 
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // --- I. 意圖分類邏輯 ---
        
        // 核心訂房意圖 (Booking)
        if (/(訂房|預訂|入住|幫我訂|想要訂|預約房間|我要訂房|book|訂幾晚|住一晚|預定|房間|要住|訂一個|我想訂)/.test(lowerMessage)) { 
            intents.add('booking');
        }
        if (this.containsDatePatterns(lowerMessage)) { 
             intents.add('booking');
        }

        // 確認/拒絕意圖 (Affirm/Deny)
        if (/(是|對|好|確認|願意|繼續|可以|沒問題|yes|行)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|no)/.test(lowerMessage)) intents.add('deny');

        // 會員意圖
        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');

        // 加購/附加項目意圖 (addon_selection)
        if (lowerMessage.includes('加購') || lowerMessage.includes('票券') || lowerMessage.includes('下午茶') || lowerMessage.includes('早餐')) {
            intents.add('addon_selection');
        }

        // 查詢/介紹意圖 (Inquiry)
        if (/(介紹|說明|什麼樣|怎麼樣|細節|環境|特色|如何|查詢|是什麼|看一下)/.test(lowerMessage)) {
             intents.add('inquiry');
        }
        
        // 房型關鍵字
        if (/(豪華客房|標準雙人房|行政套房|家庭四人房|海景房)/.test(lowerMessage)) {
            intents.add('roomType_keyword'); 
        }
        
        // 資訊意圖 (Pricing)
        if (/(價格|價錢|多少錢|房價|費用|收費|促銷|優惠)/.test(lowerMessage)) intents.add('pricing');

        // 非訂房意圖（會觸發流程暫停/轉向 AI 處理）
        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵|交通|怎麼去)/,
            'restaurant': /(餐廳|用餐|午餐|晚餐|美食|吃|下午茶)/,
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
        
        // --- II. 實體提取 ---
        const extractedEntities = this.extractEntities(message);
        
        // --- III. 整合並返回結果 ---
        const finalIntents = intents.size > 0 ? Array.from(intents) : ['general_inquiry'];

        return {
            intents: finalIntents,
            entities: extractedEntities
        };
    }

    /**
     * 輔助函式：檢查訊息是否包含日期模式
     */
    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    /**
     * 實體提取函式
     */
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
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})/);
        const pureNameMatch = !nameMatch && message.match(/^[\u4e00-\u9fa5]{2,4}$/); // 只有當訊息是純粹的 2-4 個中文字時才提取

        if (nameMatch || pureNameMatch) {
            let extractedName = nameMatch ? nameMatch[1] : pureNameMatch[0];
            // 避免提取到流程或房型關鍵字
            if (extractedName && !/(訂房|本人|我是|查詢|價格|預訂|行政套房|豪華客房|標準雙人房|繼續|確認)/.test(extractedName)) {
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

        // 7. 加購實體解析 (來自 Rich Card JSON)
        try {
            const buttonData = JSON.parse(message);
            if (buttonData.addonId) {
                data.addonId = buttonData.addonId;
            }
            if (buttonData.addonAction) {
                data.addonAction = buttonData.addonAction;
            }
        } catch (e) {
            // 如果解析失敗，說明這是一條普通文字訊息
        }

        // 預設值 (確保只有當實體不存在時才給預設值)
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
    
    /**
     * 輔助函式：解析日期和晚數
     */
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

        // 2. 處理絕對日期 (例如 12月25日 / 12/25)
        const dateMatch = text.match(/(\d{1,2})[月\/](\d{1,2})[日]?/); 
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            let checkYear = now.year();

            // 跨年處理邏輯：如果月份在當前月份之前，則設為下一年
            if (month < now.month() + 1) {
                checkYear = now.year() + 1;
            } else if (month === now.month() + 1 && day < now.date()) {
                 checkYear = now.year() + 1;
            }

            const potentialDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
            if (potentialDate.isValid()) {
                targetDate = potentialDate;
            }
        }

        // 3. 解析住宿晚數
        const nightsMatch = text.match(/(\d+)[晚夜天]|住.*(\d+)[晚夜天]/);
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1] || nightsMatch[2], 10);
        }

        if (targetDate && targetDate.isValid() && !nights) {
            nights = 1;
        }

        if (targetDate && targetDate.isValid() && targetDate.isSameOrAfter(now)) {
            return {
                checkInDate: targetDate.format('YYYY/MM/DD'),
                nights: nights
            };
        }
        return {};
    }
}

module.exports = SmartIntentClassifier;

// SmartIntentClassifier.js (V3.6 - 最終優化版)

const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

class SmartIntentClassifier {
    
    /**
     * 核心意圖分類與實體提取函式
     */
    static classify(message) { 
        const lowerMessage = message.toLowerCase();
        const intents = new Set();
        
        // --- I. 意圖分類邏輯 (無變動) ---
        
        if (/(訂房|預訂|入住|幫我訂|想要訂|預約房間|我要訂房|book|訂幾晚|住一晚|預定|房間|要住|訂一個|我想訂)/.test(lowerMessage)) { 
            intents.add('booking');
        }
        if (this.containsDatePatterns(lowerMessage)) { 
             intents.add('booking');
        }

        if (/(是|對|好|確認|願意|繼續|可以|沒問題|yes|行)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|no)/.test(lowerMessage)) intents.add('deny');

        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');

        if (lowerMessage.includes('加購') || lowerMessage.includes('票券') || lowerMessage.includes('下午茶') || lowerMessage.includes('早餐')) {
            intents.add('addon_selection');
        }

        if (/(介紹|說明|什麼樣|怎麼樣|細節|環境|特色|如何|查詢|是什麼|看一下)/.test(lowerMessage)) {
             intents.add('inquiry');
        }
        
        if (/(豪華客房|標準雙人房|行政套房|家庭四人房|海景房)/.test(lowerMessage)) {
            intents.add('roomType_keyword'); 
        }
        
        if (/(價格|價錢|多少錢|房價|費用|收費|促銷|優惠)/.test(lowerMessage)) intents.add('pricing');

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

    /** 輔助函式：檢查訊息是否包含日期模式 */
    static containsDatePatterns(message) {
        // (無變動)
        const datePatterns = [
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    /** 輔助函式：將全形數字轉換為半形 */
    static toHalfWidth(str) {
        // (無變動)
        if (!str) return '';
        return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    }
    
    /**
     * 實體提取函式
     */
    static extractEntities(message) {
        const data = {};
        const lowerMessage = message.toLowerCase();

        // 1. 解析日期和晚數 (無變動)
        const dateInfo = this.parseDate(message);
        Object.assign(data, dateInfo);

        // 2. 房型 (無變動)
        if (/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/.test(lowerMessage)) {
            data.roomType = lowerMessage.match(/(豪華客房|海景房|標準雙人房|行政套房|家庭四人房)/)[0];
        }

        // 3. 人數 (無變動)
        const adultMatch = lowerMessage.match(/([\d０-９]+)(位)?(大人|大)/);
        if (adultMatch) {
            const countStr = this.toHalfWidth(adultMatch[1]);
            data.adultCount = parseInt(countStr, 10);
        }
        const childMatch = lowerMessage.match(/([\d０-９]+)(位)?(兒童|小孩|小)/);
        if (childMatch) {
            const countStr = this.toHalfWidth(childMatch[1]);
            data.childCount = parseInt(countStr, 10);
        }

        // 4. 聯絡方式 (優化：提高姓名提取的精準度)
        const nameMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})/);
        // 修正：當訊息只有 2-4 個漢字時才判斷為純姓名，避免誤判。
        const pureNameMatch = !nameMatch && message.match(/^[\u4e00-\u9fa5]{2,4}$/) && message.length <= 4; 
        if (nameMatch || pureNameMatch) {
            let extractedName = nameMatch ? nameMatch[1] : pureNameMatch[0];
            // 修正：將 roomType 關鍵字從排除列表移除，避免訂房時提供姓名但同時提到房型被誤判。
            if (extractedName && !/(訂房|本人|我是|查詢|價格|預訂|繼續|確認)/.test(extractedName)) {
                data.contactName = extractedName.trim(); // 修正為 RuleEngine 期望的 contactName
            }
        }
        
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) data.contactEmail = emailMatch[0]; // 修正為 RuleEngine 期望的 contactEmail
        // 🚨 缺少電話號碼 (contactPhone) 的提取邏輯，建議新增：
        const phoneMatch = message.match(/(?:(?:09)\d{8}|(?:0\d{1,3}[-\s]?\d{6,8}))/); // 台灣手機號碼或市話格式
        if (phoneMatch) data.contactPhone = phoneMatch[0].replace(/[-\s]/g, '');

        // 5. 房間間數 (無變動)
        const roomCountMatch = lowerMessage.match(/([\d０-９]+)[間個]/);
        if (roomCountMatch) {
            const countStr = this.toHalfWidth(roomCountMatch[1]);
            data.roomCount = parseInt(countStr, 10);
        }

        // 6. 加購實體解析 (優化：先檢查是否為 JSON 格式，減少錯誤拋出)
        // 這是為了應對用戶點擊 Rich Card Button 傳送 JSON 訊息時，能正確解析。
        if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
            try {
                const buttonData = JSON.parse(message);
                // 這裡保留原有的 addonId 和 addonAction，以利 RuleEngine 判斷
                if (buttonData.addonId) data.addonId = buttonData.addonId;
                if (buttonData.addonAction) data.addonAction = buttonData.addonAction;
            } catch (e) {
                // 忽略，可能是格式不正確的 JSON 或只是用戶輸入了 {}
            }
        }

        // 預設值 (無變動)
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
    
    /** 輔助函式：解析日期和晚數 */
    static parseDate(text) {
        // (無變動)
        // ... (省略與 V3.5 相同的 parseDate 邏輯)
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

        // 2. 處理絕對日期
        const dateMatch = text.match(/(\d{1,2})[月\/](\d{1,2})[日]?/); 
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            let checkYear = now.year();

            if (month < now.month() + 1 || (month === now.month() + 1 && day < now.date())) {
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

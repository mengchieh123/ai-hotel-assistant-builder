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
        
        // --- I. 意圖分類邏輯 (V3.8 Optimized) ---
        if (/(訂房|預訂|入住|幫我訂|想要訂|預約房間|我要訂房|book|訂幾晚|住一晚|預定|房間|要住|訂一個|我想訂)/.test(lowerMessage) || this.containsDatePatterns(lowerMessage)) { 
            intents.add('booking');
        }

        if (/(是|對|好|確認|願意|繼續|可以|沒問題|yes|行)/.test(lowerMessage)) intents.add('affirm');
        if (/(否|不|取消|不要|不願意|算了|不訂|no)/.test(lowerMessage)) intents.add('deny');

        if (lowerMessage.includes('我要登入會員')) intents.add('member_login');

        if (lowerMessage.includes('加購') || lowerMessage.includes('票券') || lowerMessage.includes('下午茶') || lowerMessage.includes('早餐')) {
            intents.add('addon_selection');
        }
        
        if (/(修改|更正)/.test(lowerMessage)) intents.add('correction'); // 增加修正意圖
        
        // 確保 roomType_keyword 意圖能被分類
        if (/(豪華客房|標準雙人房|行政套房|家庭四人房|海景房)/.test(lowerMessage)) {
            intents.add('roomType_keyword'); 
        }

        // 避免將 'inquiry' 和 'pricing' 標記為 'general_inquiry'
        if (/(介紹|說明|什麼樣|怎麼樣|細節|環境|特色|如何|查詢|是什麼|看一下)/.test(lowerMessage)) {
            intents.add('inquiry');
        }
        if (/(價格|價錢|多少錢|房價|費用|收費|促銷|優惠)/.test(lowerMessage)) intents.add('pricing');


        const nonBookingIntentsMap = {
            'transfer': /(接送|機場|高鐵|交通|怎麼去)/,
            // ... (其他非訂房意圖保持不變)
            'restaurant': /(餐廳|用餐|午餐|晚餐|美食|吃|下午茶)/,
            'attractions': /(景點|逛街|導覽|玩|旅遊)/,
            'facilities': /(設施|泳池|健身房|spa|按摩)/,
            'weather': /(天氣|氣溫|下雨|溫度)/,
            'modification': /(取消訂單|改期)/,
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
        // 如果沒有提取到任何特定意圖，則判斷為 'general_inquiry'
        const specificIntents = Array.from(intents).filter(i => i !== 'booking' && i !== 'affirm' && i !== 'deny');
        const finalIntents = intents.size > 0 || specificIntents.length > 0 ? Array.from(intents) : ['general_inquiry'];

        return {
            intents: finalIntents,
            entities: extractedEntities 
        };
    }

    /** 輔助函式：檢查訊息是否包含日期模式 */
    static containsDatePatterns(message) {
        const datePatterns = [
            /\d{1,2}\/\d{1,2}/,
            /\d{1,2}月\d{1,2}日/,
            /今晚|今天|明天|後天/
        ];
        return datePatterns.some(pattern => pattern.test(message));
    }

    /** 輔助函式：將全形數字轉換為半形 */
    static toHalfWidth(str) {
        if (!str) return '';
        return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
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

        // 3. 人數 (優先匹配，較為精確)
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

        // 4. 房間間數
        const roomCountMatch = lowerMessage.match(/([\d０-９]+)[間個]/);
        if (roomCountMatch) {
            const countStr = this.toHalfWidth(roomCountMatch[1]);
            data.roomCount = parseInt(countStr, 10);
        }

        // 5. 聯絡方式 (修正提取邏輯，提高寬鬆度)
        let name = null;
        // A. 關鍵字 + 姓名 (優先匹配)
        const nameKeywordMatch = message.match(/(?:訂房姓名|姓名|本人是|我的名字是|訂房人)\s*([\u4e00-\u9fa5]{2,4})/);
        if (nameKeywordMatch) {
            name = nameKeywordMatch[1];
        } else {
            // B. 寬鬆匹配：匹配 2-4 個連續中文字，但排除常用動詞/名詞，避免誤將房型或日期當作姓名
            const simpleNameMatch = message.match(/([\u4e00-\u9fa5]{2,4})/g);
            if (simpleNameMatch) {
                // 檢查匹配到的中文字串是否為流程關鍵字
                const excludeWords = ['豪華客房', '標準雙人房', '行政套房', '家庭四人房', '查詢', '價格', '預訂', '繼續', '確認', '加購', '房費'];
                const potentialNames = simpleNameMatch.filter(n => n.length >= 2 && !excludeWords.includes(n));
                if (potentialNames.length > 0) {
                    name = potentialNames[0]; // 取第一個最像名字的
                }
            }
        }
        
        if (name && !/(訂房|本人|我是|查詢|價格|預訂|繼續|確認)/.test(name)) {
            data.contactName = name.trim(); 
        }

        // 提取 Email
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) data.contactEmail = emailMatch[0];
        
        // 提取電話號碼
        const phoneMatch = message.match(/(?:(?:09)\d{8}|(?:0\d{1,3}[-\s]?\d{6,8}))/); 
        if (phoneMatch) data.contactPhone = phoneMatch[0].replace(/[-\s]/g, '');

        // 6. 密碼提取 (新增: 支援會員流程中一次輸入帳號+密碼)
        const passwordMatch = message.match(/(?:密碼|pass|password)\s*[:：\s]*([\w\d!@#$%^&*()]{4,})/i);
        if (passwordMatch && passwordMatch[1].length >= 4) {
            data.memberPassword = passwordMatch[1];
        }


        // 7. 加購實體解析
        if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
            try {
                const buttonData = JSON.parse(message);
                if (buttonData.addonId) data.addonId = buttonData.addonId;
                if (buttonData.addonAction) data.addonAction = buttonData.addonAction;
            } catch (e) {
                // Ignore
            }
        }

        // 預設值 (確保核心實體不會是 undefined)
        if (data.adultCount === undefined) data.adultCount = 1;
        if (data.childCount === undefined) data.childCount = 0;
        if (data.roomCount === undefined) data.roomCount = 1;

        return data;
    }
    
    /** 輔助函式：解析日期和晚數 */
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

        // 2. 處理絕對日期
        const dateMatch = text.match(/(\d{1,2})[月\/](\d{1,2})[日]?/); 
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);
            let checkYear = now.year();

            // 處理跨年問題：如果月份在當月之前，預設為下一年
            if (month < now.month() + 1 || (month === now.month() + 1 && day < now.date())) {
                checkYear = now.year() + 1;
            }

            const potentialDate = dayjs(`${checkYear}-${month}-${day}`, 'YYYY-M-D').startOf('day');
            if (potentialDate.isValid()) {
                targetDate = potentialDate;
            }
        }

        // 3. 解析住宿晚數
        // 修正：使用更明確的 nightsMatch，確保晚數提取正確
        const nightsMatch = text.match(/(\d+)\s*(?:晚|夜|天)/); 
        if (nightsMatch) {
            nights = parseInt(nightsMatch[1], 10);
        }

        if (targetDate && targetDate.isValid()) {
            // 如果只有日期但沒有晚數，預設為 1 晚
            if (!nights) {
                nights = 1;
            }

            // 確保日期不早於今天
            if (targetDate.isSameOrAfter(now)) {
                return {
                    checkInDate: targetDate.format('YYYY/MM/DD'),
                    nights: nights
                };
            }
        }
        return {};
    }
}

module.exports = SmartIntentClassifier;

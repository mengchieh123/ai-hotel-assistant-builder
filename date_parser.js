// date_parser.js (日期解析器 - 僅處理中文和相對日期)

/**
 * 簡易日期解析器
 * 用於將相對時間詞彙（今天、明天、下週一等）轉換為 ISO 格式日期 (YYYY-MM-DD)。
 * 這是一個簡化的實作，旨在滿足 RuleEngine V2.2 的基本需求。
 */
export class DateParser {

    /**
     * 獲取當前或指定日期的 YYYY-MM-DD 格式字串
     * @param {number} offset - 距離今天的天數偏移量 (0=今天, 1=明天, -1=昨天)
     * @returns {string} ISO 格式日期字串 (YYYY-MM-DD)
     */
    static getIsoDate(offset = 0) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date.toISOString().split('T')[0];
    }

    /**
     * 解析使用者訊息中的日期資訊
     * @param {string} message - 使用者輸入訊息
     * @returns {object} 包含 date (Date物件)、isoDate (YYYY-MM-DD) 和 matchText 的物件
     */
    static parseDate(message) {
        const lowerMsg = message.toLowerCase();
        let dateResult = { date: null, isoDate: null, matchText: null };
        const now = new Date();

        // 1. 絕對日期匹配 (MM月DD日 或 YYYY年MM月DD日)
        // 匹配：12月25日, 2025年1月1日
        const absoluteMatch = lowerMsg.match(/(\d{4}年)?(\d{1,2})月(\d{1,2})日/);
        if (absoluteMatch) {
            const year = absoluteMatch[1] ? parseInt(absoluteMatch[1].replace('年', '')) : now.getFullYear();
            const month = parseInt(absoluteMatch[2]);
            const day = parseInt(absoluteMatch[3]);
            
            // 簡易驗證日期是否有效
            const parsedDate = new Date(year, month - 1, day);
            if (parsedDate.getDate() === day && parsedDate.getMonth() === month - 1) {
                dateResult.date = parsedDate;
                dateResult.isoDate = this.getIsoDate(Math.ceil((parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                dateResult.matchText = absoluteMatch[0];
                return dateResult;
            }
        }

        // 2. 相對日期匹配 (今天, 明天, 後天)
        if (lowerMsg.includes('今天') || lowerMsg.includes('今日')) {
            dateResult.isoDate = this.getIsoDate(0);
            dateResult.matchText = '今天';
        } else if (lowerMsg.includes('明天') || lowerMsg.includes('明日')) {
            dateResult.isoDate = this.getIsoDate(1);
            dateResult.matchText = '明天';
        } else if (lowerMsg.includes('後天')) {
            dateResult.isoDate = this.getIsoDate(2);
            dateResult.matchText = '後天';
        }
        
        // 3. 週幾匹配 (例如：下週三、週五)
        // 假設今天是週四 (Date().getDay() == 4)
        const dayOfWeekMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const weekMatch = lowerMsg.match(/(下週|這週)?週([日一二三四五六])/);
        
        if (weekMatch) {
            const isNextWeek = weekMatch[1] === '下週';
            const targetDay = dayOfWeekMap[weekMatch[2]]; // 目標星期幾 (0-6)
            const todayDay = now.getDay(); // 今天是星期幾
            
            let offset = targetDay - todayDay;
            
            if (isNextWeek || offset <= 0) {
                 // 如果是下週或目標日已經過去 (<=0)，則加一週
                offset += 7;
            }
            
            dateResult.isoDate = this.getIsoDate(offset);
            dateResult.matchText = weekMatch[0];
        }

        return dateResult;
    }
}

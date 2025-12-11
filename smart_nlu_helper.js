// smart_nlu_helper.js (獨立的智慧 NLU 模組)

/**
 * 🎯 智慧分析輔助函數 (NLU Layer)
 * 專門處理基於關鍵詞和正則表達式的意圖和實體提取。
 */
export class SmartNLUHelper { // 🏆 確保使用 export class/const 進行具名導出

    /**
     * 智慧意圖增強分析
     */
    static analyzeMessage(message, session) {
        const lowerMsg = message.toLowerCase().trim();
        const analysis = {
            detectedIntents: [],
            extractedEntities: {},
            confidence: 0,
            module: 'GENERAL',
            suggestions: []
        };

        // 🎯 智慧意圖檢測模式
        const intentPatterns = {
            booking: ['訂房', '預約', '訂一間', '想訂', 'book', '預訂', '我要訂', '想預約'],
            date_selection: ['今天', '明天', '後天', '週一', '週二', '週三', '週四', '週五', '週六', '週日', '聖誕節', '跨年', '春節'],
            room_selection: ['標準', '豪華', '行政', '家庭', '套房', '雙人房', '四人房'],
            people_count: ['位', '人', '大', '大人', '小孩', '兒童', '幾位', '幾人', '幾大幾小'],
            modification: ['修改', '更改', '重選', '換', '改一下', '調整'],
            inquiry: ['價格', '房價', '費用', '多少錢', '貴不貴', '價位'],
            member: ['會員', '登入', '帳號', '積分', '點數', '優惠', '登入會員'],
            cancel: ['取消', '退訂', '退款', '不要了', '中止', '停止'],
            contact: ['聯絡', '電話', 'email', '郵件', '客服', 'help', '姓名', '手機', '號碼'],
            addons: ['加購', '附加', '服務', '接送', '早餐', '晚餐', 'spa'],
            payment: ['付款', '支付', '信用卡', '現金', '轉帳', 'line pay']
        };

        // 檢測意圖
        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            if (keywords.some(keyword => lowerMsg.includes(keyword))) {
                analysis.detectedIntents.push(intent);
            }
        }

        // 🎯 智慧實體提取 (使用 RegEx)
        // 日期提取
        const dateMatch = message.match(/(\d{1,2})[月\/\-](\d{1,2})[日號]?/);
        if (dateMatch) {
            analysis.extractedEntities.dateRaw = dateMatch[0];
        }

        // 人數提取
        const peopleMatch = message.match(/(\d+)\s*(位|人|大|大人)/);
        if (peopleMatch) {
            analysis.extractedEntities.peopleCount = parseInt(peopleMatch[1]);
        }

        // 房間數提取
        const roomMatch = message.match(/(\d+)\s*(間|個|room)/i);
        if (roomMatch) {
            analysis.extractedEntities.roomCount = parseInt(roomMatch[1]);
        }

        // 電話提取
        const phoneMatch = message.match(/(\d{8,11})/);
        if (phoneMatch) {
            analysis.extractedEntities.phone = phoneMatch[1];
        }

        // 郵件提取
        const emailMatch = message.match(/([\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            analysis.extractedEntities.email = emailMatch[1];
        }

        // 姓名提取
        const nameMatch = message.match(/(?:姓名|名字|我叫|我是)[:：]?\s*([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            analysis.extractedEntities.name = nameMatch[1];
        } else if (message.match(/^[\u4e00-\u9fa5]{2,4}$/)) {
            analysis.extractedEntities.name = message;
        }

        // 🎯 根據當前狀態和內容判斷模組
        const currentState = session?.currentStep || 'init';

        if (analysis.detectedIntents.includes('booking')) {
            analysis.module = 'BOOKING';
            analysis.confidence = 85;
            analysis.suggestions = ['請提供入住日期', '選擇房型', '確認人數'];
        } else if (analysis.detectedIntents.includes('date_selection')) {
            analysis.module = 'DATE_SELECTION';
            analysis.confidence = 80;
            analysis.suggestions = ['確認日期是否正確', '詢問住宿晚數'];
        } else if (currentState.includes('contact') || analysis.extractedEntities.name || analysis.extractedEntities.phone) {
            analysis.module = 'CONTACT_INFO';
            analysis.confidence = 75;
            analysis.suggestions = ['確認聯繫資訊', '詢問是否完整'];
        } else if (analysis.detectedIntents.includes('member')) {
            analysis.module = 'MEMBER_SERVICE';
            analysis.confidence = 90;
            analysis.suggestions = ['詢問會員帳號', '驗證身份', '提供專屬優惠'];
        } else if (analysis.detectedIntents.includes('cancel')) {
            analysis.module = 'CANCELLATION';
            analysis.confidence = 95;
            analysis.suggestions = ['確認取消意圖', '說明取消政策'];
        } else if (analysis.detectedIntents.includes('inquiry')) {
            analysis.module = 'INQUIRY';
            analysis.confidence = 70;
            analysis.suggestions = ['提供價格資訊', '詢問是否預訂'];
        } else {
            analysis.module = 'GENERAL';
            analysis.confidence = 50;
            analysis.suggestions = ['理解需求', '提供協助'];
        }

        // 🎯 計算信心度 (實體越多，信心度越高)
        const entityCount = Object.keys(analysis.extractedEntities).length;
        analysis.confidence = Math.min(100, analysis.confidence + (entityCount * 5));

        return analysis;
    }

    /**
     * 產生分析摘要
     */
    static generateAnalysisSummary(analysis) {
        return {
            module: analysis.module,
            primaryIntents: analysis.detectedIntents.slice(0, 3),
            confidence: analysis.confidence,
            entitiesFound: Object.keys(analysis.extractedEntities),
            suggestions: analysis.suggestions,
            timestamp: new Date().toISOString()
        };
    }
}

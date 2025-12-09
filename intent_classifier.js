// intent_classifier.js

const dayjs = require('dayjs');
// 引入 dayjs 插件，以便解析部分非標準的日期格式，例如 "12月24日" (儘管目前正則已處理大部分)
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat); 

// 假設流程配置檔存在。如果上一個錯誤是 JSON 語法錯誤，請確保此檔案存在且正確。
const flowConfig = require('./dialogue_flow.json'); 

/**
 * 意圖分類與實體抽取的核心類別。
 */
class SmartIntentClassifier {

    /**
     * 靜態方法：執行意圖分類和實體抽取。
     * @param {string} message - 使用者的原始輸入訊息。
     * @param {object} flowConfig - 整個對話流程的配置。
     * @returns {{intents: string[], entities: object}}
     */
    static classify(message, flowConfig) {
        const normalizedMessage = message.toLowerCase().trim();
        const extractedEntities = {};
        const intents = [];
        
        // ----------------------------------------------------
        // I. 意圖識別 (優先級高到低)
        // ----------------------------------------------------

        // 1. 緊急控制意圖 (P:110)
        if (normalizedMessage.includes('取消') || normalizedMessage.includes('停止') || normalizedMessage.includes('中止') || normalizedMessage.includes('放棄')) {
            intents.push('emergency_exit');
        }
        
        // 2. 流程控制意圖 (P:106, P:98/99)
        if (normalizedMessage.includes('重來') || normalizedMessage.includes('重新開始') || normalizedMessage.includes('reset')) {
            intents.push('reset');
            intents.push('booking_start'); 
        }
        if (normalizedMessage.includes('訂房') || normalizedMessage.includes('預約') || normalizedMessage.includes('我要訂')) {
             if (!intents.includes('reset')) {
                 intents.push('booking_start');
             }
        }
        if (normalizedMessage.includes('繼續') || normalizedMessage.includes('恢復')) {
            intents.push('affirm'); // 'continue' 屬於肯定意圖的一種，直接推入 'affirm'
        }
        
        // 3. 肯定/否定意圖 (避免與高優先級的 '繼續' 衝突)
        if (normalizedMessage.match(/^(是|好|可以|ok|確認|對|要)$/) && !intents.includes('affirm')) {
            intents.push('affirm');
        } else if (normalizedMessage.match(/^(否|不要|不對|取消)$/) && !intents.includes('deny')) {
            intents.push('deny');
        }

        // 4. 登入意圖 (P:100)
        if (normalizedMessage.includes('登入') || normalizedMessage.includes('會員')) {
            intents.push('login');
        }
        
        // 5. 修改意圖 (P:102)
        if (normalizedMessage.includes('修改') || normalizedMessage.includes('重選')) {
            intents.push('correction');
        }

        // 6. 通用查詢意圖 (P:104)
        // 使用更寬鬆的匹配，避免與訂房流程中的單一回答衝突
        if (normalizedMessage.includes('什麼是') || normalizedMessage.includes('在哪') || normalizedMessage.includes('電話') || normalizedMessage.includes('飯店資訊')) {
            intents.push('general_inquiry');
        }
        
        // 7. 其他常用意圖
        if (normalizedMessage.includes('跳過') || normalizedMessage.includes('下次') || normalizedMessage.includes('不用了')) {
            intents.push('skip');
        }

        // ----------------------------------------------------
        // II. 實體抽取 (Entity Extraction)
        // ----------------------------------------------------
        
        // 1. 日期和晚數 (nights, checkInDate)
        this.extractDateEntities(normalizedMessage, extractedEntities);

        // 2. 房型 (roomType)
        this.extractRoomType(normalizedMessage, extractedEntities);
        
        // 3. 數量實體 (Count: adultCount, childCount, roomCount)
        this.extractCountEntities(normalizedMessage, extractedEntities);
        
        // 4. 聯絡資訊 (contactName, contactPhone, contactEmail)
        this.extractContactInfo(normalizedMessage, extractedEntities);
        
        // 5. 會員資訊 (memberAccount, memberPassword)
        this.extractMemberInfo(normalizedMessage, extractedEntities);
        
        // 6. 加購服務 (addons) - 簡單通過關鍵字匹配
        this.extractAddons(normalizedMessage, extractedEntities);

        // ----------------------------------------------------
        // III. 意圖後處理 (Final Intent Assignment)
        // ----------------------------------------------------
        
        // 如果沒有偵測到任何流程控制意圖，並且提取到實體，則視為廣義的 'booking' 意圖
        const flowIntents = intents.filter(i => ['emergency_exit', 'reset', 'booking_start', 'affirm', 'deny', 'login', 'skip', 'correction', 'general_inquiry'].includes(i));
        
        if (flowIntents.length === 0) {
            if (Object.keys(extractedEntities).length > 0) {
                 intents.push('booking'); 
            } else {
                 // 最終 fallback：什麼都沒偵測到
                 intents.push('unrecognized');
            }
        }
        
        console.log(`[INTENT DEBUG] 分類結果: ${intents.join(', ')} | 實體: ${JSON.stringify(extractedEntities)}`);

        return {
            intents: intents,
            entities: extractedEntities
        };
    }
    
    // ----------------------------------------------------
    // 實體抽取輔助函數
    // ----------------------------------------------------

    /** 抽取日期和晚數 */
    static extractDateEntities(message, entities) {
        // 1. 抽取晚數 (n nights/天)
        const nightsMatch = message.match(/(\d+)(晚|天|night|days?)/);
        if (nightsMatch && parseInt(nightsMatch[1]) > 0) {
            entities.nights = parseInt(nightsMatch[1]);
        }
        
        // 2. 抽取入住日期 (今天/明天/YYYY/MM/DD)
        let checkInDate = null;
        
        // 處理相對日期
        if (message.includes('今天') || message.includes('today')) {
            checkInDate = dayjs().format('YYYY-MM-DD');
        } else if (message.includes('明天') || message.includes('tomorrow')) {
            checkInDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        } else {
            // 💡 優化日期抽取：兼容 YYYY/M/D, YYYY-M-D, M/D, M-D, X月X日 等格式
            // (\d{4}[/-]\d{1,2}[/-]\d{1,2}) 捕獲 YYYY/MM/DD
            // (\d{1,2}[/-]\d{1,2}) 捕獲 MM/DD
            // (\d{1,2}月\d{1,2}日) 捕獲 M月D日
            const dateRegex = /(\d{4}[/-]\d{1,2}[/-]\d{1,2})|(\d{1,2}[/-]\d{1,2})|(\d{1,2}月\d{1,2}日)/;
            const dateMatch = message.match(dateRegex);
            
            if (dateMatch) {
                let dateStr = dateMatch[1] || dateMatch[2] || dateMatch[3];

                if (dateMatch[1]) { // 匹配到 YYYY-MM-DD
                    dateStr = dateStr.replace(/[\/]/g, '-');
                    checkInDate = dayjs(dateStr).format('YYYY-MM-DD');
                } else if (dateMatch[2]) { // 匹配到 MM-DD (補上當前年份)
                    dateStr = dateStr.replace(/[\/]/g, '-');
                    const year = dayjs().year();
                    const parsedDate = dayjs(`${year}-${dateStr}`, 'YYYY-M-D'); // 使用 M-D 格式解析
                    if (parsedDate.isValid()) {
                        checkInDate = parsedDate.format('YYYY-MM-DD');
                    }
                } else if (dateMatch[3]) { // 匹配到 M月D日 (補上當前年份)
                    const year = dayjs().year();
                    // dayjs 需依賴 customParseFormat 插件處理中文格式
                    const parsedDate = dayjs(`${year}年${dateStr}`, 'YYYY年M月D日');
                    if (parsedDate.isValid()) {
                        checkInDate = parsedDate.format('YYYY-MM-DD');
                    }
                }
            }
        }
        
        if (checkInDate && dayjs(checkInDate).isValid()) {
             // 確保入住日期在今天或未來
           if (dayjs(checkInDate).isAfter(dayjs().subtract(1, 'day'), 'day')) {
                entities.checkInDate = checkInDate;
            } else {
                // 如果日期是過去的，嘗試將年份推到下一年
                const nextYearDate = dayjs(checkInDate).add(1, 'year').format('YYYY-MM-DD');
                 if (dayjs(nextYearDate).isAfter(dayjs().subtract(1, 'day'), 'day')) {
                     entities.checkInDate = nextYearDate; // 假設用戶指的是下一年
                 } else {
                     console.log("⚠️ [ENTITY WARNING] 偵測到過去的日期，已忽略。");
                 }
            }
        }
    }
    
    /** 抽取房型 */
    static extractRoomType(message, entities) {
        // 由於 flowConfig.states['show_room_types'] 在 JSON 中沒有 'options' 屬性
        // 我們直接硬編碼房型名稱進行匹配 (或使用 richCard.buttons 的 value)
        const roomTypes = ["標準雙人房", "豪華客房", "行政套房", "家庭四人房"]; 

        // 使用房型名稱進行匹配 (忽略大小寫和空白)
        const matchedRoom = roomTypes.find(type => message.includes(type.toLowerCase().replace(/\s/g, '')));
        
        if (matchedRoom) {
            entities.roomType = matchedRoom;
        }
    }
    
    /** 抽取數量實體 (成人數、兒童數、房間數) */
    static extractCountEntities(message, entities) {
        // 房間數 (roomCount) - 優先匹配 'N間房'
        const roomCountMatch = message.match(/(\d+)(間房|間|rooms?)/);
        if (roomCountMatch) {
            entities.roomCount = parseInt(roomCountMatch[1]);
        } else if (message.includes('一間') || message.includes('一個')) {
             entities.roomCount = 1; 
        }

        // 兒童數 (childCount) - 優先匹配 'N個兒童'
        const childCountMatch = message.match(/(\d+)(個?兒童|小孩|kids?|children)/);
        if (childCountMatch) {
            entities.childCount = parseInt(childCountMatch[1]);
        } else if (message.includes('沒有小孩') || message.includes('無小孩')) {
             entities.childCount = 0;
        }

        // 成人數 (adultCount) - 優先匹配 'N個成人'
        const adultCountMatch = message.match(/(\d+)(個?成人|大人|adults?)/);
        if (adultCountMatch) {
            entities.adultCount = parseInt(adultCountMatch[1]);
        } 
        
        // 嘗試匹配 'X位' (總數)，並作為成人數，前提是沒有明確的成人數且沒有兒童數
        const totalMatch = message.match(/(\d+)位/);
        if (totalMatch && parseInt(totalMatch[1]) > 0 && !entities.childCount && !entities.adultCount) {
             entities.adultCount = parseInt(totalMatch[1]);
        }

        // ⚠️ 最終數據保護：確保數量實體有效
        for (const key of ['roomCount', 'adultCount', 'childCount']) {
            if (entities[key] !== undefined && (isNaN(entities[key]) || entities[key] < 0)) {
                delete entities[key];
            }
        }
        
        // 補充預設值：如果沒有提到成人數，但有其他重要資訊，預設 1 個成人 (最小啟動值)
        if (!entities.adultCount && (entities.checkInDate || entities.roomType)) {
             entities.adultCount = 1;
        }
    }

    /** 抽取聯絡資訊 */
    static extractContactInfo(message, entities) {
        // Email: 匹配基本 email 格式
        const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
            entities.contactEmail = emailMatch[1];
        }

        // Phone: 匹配 8-10 位數字（忽略格式，去除所有非數字字符）
        const phoneMatch = message.match(/(\d{8,10})/);
        if (phoneMatch) {
            entities.contactPhone = phoneMatch[1];
        }
        
        // Name: 簡化：在特定提示詞後抽取 (匹配 2-10 個中文字或英文字母)
        const nameMatch = message.match(/(?:我的名字是|聯絡人是|我叫|我是)\s*([\u4e00-\u9fa5a-z\s]{2,10})/);
        if (nameMatch) {
            entities.contactName = nameMatch[1].trim();
        } 
    }

    /** 抽取會員資訊 */
    static extractMemberInfo(message, entities) {
        // 簡化：假設帳號和密碼是連續輸入的兩組詞，並且在包含關鍵字時
        if (message.includes('登入') || message.includes('會員') || message.includes('帳號')) {
            // 嘗試從 '帳號 密碼' 格式中提取
            // 匹配 (非空白字符組 A) 後接 (非空白字符組 B)
            const credentialsMatch = message.match(/(?:\w+)\s*(\S+)\s*(?:\w+)?\s*(\S+)/); 
            
            if (credentialsMatch && credentialsMatch[1] && credentialsMatch[2]) {
                // 檢查是否是有效的帳號/密碼格式 (非單純的單個字母)
                if (credentialsMatch[1].length >= 3) {
                     entities.memberAccount = credentialsMatch[1];
                }
                if (credentialsMatch[2].length >= 3) {
                     entities.memberPassword = credentialsMatch[2];
                }
            } 
        }
        // 如果是在問帳號 (例如 ask_member_account 狀態)，直接將整個訊息視為帳號
        // ⚠️ 注意：這裡需要 State Context 才能判斷。目前我們只做簡單提取。
    }
    
    /** 抽取加購服務 */
    static extractAddons(message, entities) {
        const matchedAddons = [];
        // 假設 flowConfig.states['ask_addons']?.options 是 { "id": "name" } 結構
        // 但由於 JSON 中沒有 'options'，我們使用硬編碼的服務名稱進行演示：
        const mockAddonsMap = {
            "A1": "機場接送",
            "A2": "SPA服務",
            "A3": "自助晚餐"
        };
        
        const addonsMap = flowConfig.states['ask_addons']?.options || mockAddonsMap; // 如果配置中沒有，使用模擬的

        for (const [id, name] of Object.entries(addonsMap)) {
            // 匹配 ID 或 服務名稱 (使用 includes)
            if (message.includes(name.toLowerCase().replace(/\s/g, '')) || message.includes(id.toLowerCase())) {
                matchedAddons.push(id);
            }
        }

        if (matchedAddons.length > 0) {
            // 使用 Set 確保不重複
            entities.addons = [...new Set(matchedAddons)];
        }
    }
}

module.exports = SmartIntentClassifier;

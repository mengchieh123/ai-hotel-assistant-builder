// intent_classifier.js

const dayjs = require('dayjs');
const flowConfig = require('./dialogue_flow.json'); // 假設流程配置檔存在

/**
 * 意圖分類與實體抽取的核心類別。
 * 實際應用中，這個類別會與 NLU 服務（如 Google Dialogflow/Gemini API/自建模型）連接。
 */
class SmartIntentClassifier {

    /**
     * 靜態方法：執行意圖分類和實體抽取。
     * * @param {string} message - 使用者的原始輸入訊息。
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
        if (normalizedMessage.includes('取消') || normalizedMessage.includes('停止') || normalizedMessage.includes('中止')) {
            intents.push('emergency_exit');
        }
        
        // 2. 流程控制意圖 (P:106, P:98/99)
        if (normalizedMessage.includes('重來') || normalizedMessage.includes('重新開始') || normalizedMessage.includes('reset')) {
            intents.push('reset');
            intents.push('booking_start'); // 重設同時視為啟動
        }
        if (normalizedMessage.includes('訂房') || normalizedMessage.includes('預約') || normalizedMessage.includes('我要訂')) {
             // 只有在沒有更強烈意圖時才分類為 booking_start
             if (!intents.includes('reset')) {
                 intents.push('booking_start');
             }
        }
        if (normalizedMessage.includes('繼續') || normalizedMessage.includes('恢復')) {
            intents.push('continue');
        }
        
        // 3. 肯定/否定意圖
        if (normalizedMessage.match(/^(是|好|可以|ok|確認|對|要)$/)) {
            intents.push('affirm');
        } else if (normalizedMessage.match(/^(否|不要|不對|取消)$/)) {
            intents.push('deny');
        }

        // 4. 登入意圖 (P:100)
        if (normalizedMessage.includes('登入') || normalizedMessage.includes('會員')) {
            intents.push('login');
        }
        
        // 5. 通用查詢意圖 (P:104)
        if (normalizedMessage.includes('什麼是') || normalizedMessage.includes('在哪') || normalizedMessage.includes('電話')) {
            intents.push('general_inquiry');
        }
        
        // 6. 其他常用意圖
        if (normalizedMessage.includes('跳過') || normalizedMessage.includes('下次')) {
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
        
        // 如果沒有偵測到任何意圖，將實體映射為意圖，例如偵測到日期 -> booking 
        if (intents.length === 0) {
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
        
        if (message.includes('今天') || message.includes('today')) {
            checkInDate = dayjs().format('YYYY-MM-DD');
        } else if (message.includes('明天') || message.includes('tomorrow')) {
            checkInDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        } else {
            // 簡化日期抽取：嘗試匹配 YYYY/MM/DD 或 MM/DD
            const dateRegex = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})|(\d{1,2})[/-](\d{1,2})/;
            const dateMatch = message.match(dateRegex);
            
            if (dateMatch) {
                if (dateMatch[1]) { // 匹配到 YYYY/MM/DD
                    checkInDate = dayjs(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).format('YYYY-MM-DD');
                } else if (dateMatch[4]) { // 匹配到 MM/DD
                    const year = dayjs().year();
                    checkInDate = dayjs(`${year}-${dateMatch[4]}-${dateMatch[5]}`).format('YYYY-MM-DD');
                }
            }
        }
        
        if (checkInDate && dayjs(checkInDate).isValid()) {
             // 確保入住日期在未來 (簡化處理)
            if (dayjs(checkInDate).isAfter(dayjs().subtract(1, 'day'), 'day')) {
                entities.checkInDate = checkInDate;
            } else {
                console.log("⚠️ [ENTITY WARNING] 偵測到過去的日期，已忽略。");
            }
        }
    }
    
    /** 抽取房型 */
    static extractRoomType(message, entities) {
        const roomTypes = Object.keys(flowConfig.states['show_room_types'].options || {});
        
        // 使用配置檔中的房型名稱進行匹配
        const matchedRoom = roomTypes.find(type => message.includes(type.toLowerCase()));
        
        if (matchedRoom) {
            entities.roomType = matchedRoom;
        }
    }
    
    /** 抽取數量實體 (成人數、兒童數、房間數) */
    static extractCountEntities(message, entities) {
        // 簡化邏輯：嘗試匹配 "X個成人" 或 "X間房"
        
        // 房間數 (roomCount)
        const roomCountMatch = message.match(/(\d+)(間房|間|rooms?)/);
        if (roomCountMatch) {
            entities.roomCount = parseInt(roomCountMatch[1]);
        } else if (message.includes('一間') || message.includes('一個')) {
             entities.roomCount = 1; // 簡化處理 "一間"
        }

        // 成人數 (adultCount)
        const adultCountMatch = message.match(/(\d+)(個?成人|大人|adults?)/);
        if (adultCountMatch) {
            entities.adultCount = parseInt(adultCountMatch[1]);
        } else if (message.includes('兩位') || message.includes('2位')) {
             // 如果只說 "兩位"，通常預設是成人
             const totalMatch = message.match(/(\d+)位/);
             if (totalMatch && parseInt(totalMatch[1]) > 0 && !entities.adultCount) {
                 entities.adultCount = parseInt(totalMatch[1]);
             }
        } else if (entities.roomCount === 1 && !entities.adultCount) {
             // 假設如果只提到房間數，且沒有人數，預設 2 個成人 (標準房型假設)
             // ⚠️ 此處邏輯具爭議，通常讓流程詢問更安全
             // entities.adultCount = 2; 
        }

        // 兒童數 (childCount)
        const childCountMatch = message.match(/(\d+)(個?兒童|小孩|kids?|children)/);
        if (childCountMatch) {
            entities.childCount = parseInt(childCountMatch[1]);
        } else if (message.includes('沒有小孩')) {
             entities.childCount = 0;
        }
        
        // ⚠️ 最終數據保護：確保數量實體有效
        for (const key of ['roomCount', 'adultCount', 'childCount']) {
            if (entities[key] !== undefined && (isNaN(entities[key]) || entities[key] < 0)) {
                delete entities[key];
            }
        }
        
        // 補充預設值：如果沒有提到人數，預設 1 個成人 (用於最小化訂房啟動)
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

        // Phone: 匹配 8-10 位數字（忽略格式，例如 09XX-XXX-XXX）
        const phoneMatch = message.match(/(\d{8,10})/);
        if (phoneMatch) {
            entities.contactPhone = phoneMatch[1];
        }
        
        // Name: 簡化處理，找尋在 email/phone 之前的一個短語作為名字
        // 由於名字抽取複雜且容易出錯，此處簡化為只找一個可能的名字作為 Placeholder
        if (message.includes('我的名字是')) {
             entities.contactName = message.split('我的名字是')[1].trim().split(/\s+/)[0];
        }
    }

    /** 抽取會員資訊 */
    static extractMemberInfo(message, entities) {
        // 簡化：假設帳號和密碼通常是連續輸入的兩組詞
        const parts = message.split(/\s+/).filter(p => p.length > 0);
        
        if (parts.length >= 2 && (message.includes('帳號') || message.includes('會員'))) {
            // 假設第一個詞是帳號，第二個詞是密碼
            entities.memberAccount = parts[0];
            entities.memberPassword = parts[1];
        }
    }
    
    /** 抽取加購服務 */
    static extractAddons(message, entities) {
        const matchedAddons = [];
        const addonsMap = flowConfig.states['ask_addons']?.options || {};
        
        for (const [id, name] of Object.entries(addonsMap)) {
            if (message.includes(name.toLowerCase()) || message.includes(id.toLowerCase())) {
                matchedAddons.push(id);
            }
        }

        if (matchedAddons.length > 0) {
            entities.addons = matchedAddons;
        }
    }
}

// 導出 SmartIntentClassifier 類別，Rule Engine 將使用 SmartIntentClassifier.classify() 調用靜態方法
module.exports = SmartIntentClassifier;

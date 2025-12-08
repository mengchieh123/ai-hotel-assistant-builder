// intent_classifier.js

const dayjs = require('dayjs');
// 確保 dayjs 支持解析非標準日期格式，雖然這裡主要依賴正則
// const customParseFormat = require('dayjs/plugin/customParseFormat');
// dayjs.extend(customParseFormat); 

const flowConfig = require('./dialogue_flow.json'); // 假設流程配置檔存在

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
        if (normalizedMessage.includes('取消') || normalizedMessage.includes('停止') || normalizedMessage.includes('中止')) {
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
        
        // 處理相對日期
        if (message.includes('今天') || message.includes('today')) {
            checkInDate = dayjs().format('YYYY-MM-DD');
        } else if (message.includes('明天') || message.includes('tomorrow')) {
            checkInDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        } else {
            // 💡 優化日期抽取：兼容 YYYY/M/D, YYYY-M-D, M/D, M-D 等格式
            // (\d{4}[/-]\d{1,2}[/-]\d{1,2}) 捕獲 YYYY/MM/DD
            // (\d{1,2}[/-]\d{1,2}) 捕獲 MM/DD
            const dateRegex = /(\d{4}[/-]\d{1,2}[/-]\d{1,2})|(\d{1,2}[/-]\d{1,2})/;
            const dateMatch = message.match(dateRegex);
            
            if (dateMatch) {
                let dateStr = dateMatch[1] || dateMatch[2];
                // 將所有分隔符轉換為標準的橫線，以便 dayjs 穩定解析
                dateStr = dateStr.replace(/[\/]/g, '-');

                if (dateMatch[1]) { // 匹配到 YYYY-MM-DD
                    checkInDate = dayjs(dateStr).format('YYYY-MM-DD');
                } else if (dateMatch[2]) { // 匹配到 MM-DD (補上當前年份)
                    const year = dayjs().year();
                    // 確保日期是有效的，並且如果月份/日期是單數，dayjs 仍能處理
                    const parsedDate = dayjs(`${year}-${dateStr}`);
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
                console.log("⚠️ [ENTITY WARNING] 偵測到過去的日期，已忽略。");
            }
        }
    }
    
    /** 抽取房型 */
    static extractRoomType(message, entities) {
        // 這裡需要確保 flowConfig 存在且結構正確
        const roomOptions = flowConfig.states['show_room_types']?.options;
        if (!roomOptions) return; // 保護，如果配置檔未載入或狀態不存在

        const roomTypes = Object.keys(roomOptions);
        
        // 使用配置檔中的房型名稱進行匹配 (忽略大小寫)
        const matchedRoom = roomTypes.find(type => message.includes(type.toLowerCase()));
        
        if (matchedRoom) {
            entities.roomType = matchedRoom;
        }
    }
    
    /** 抽取數量實體 (成人數、兒童數、房間數) */
    static extractCountEntities(message, entities) {
        // 房間數 (roomCount)
        const roomCountMatch = message.match(/(\d+)(間房|間|rooms?)/);
        if (roomCountMatch) {
            entities.roomCount = parseInt(roomCountMatch[1]);
        } else if (message.includes('一間') || message.includes('一個')) {
             entities.roomCount = 1; 
        }

        // 成人數 (adultCount)
        const adultCountMatch = message.match(/(\d+)(個?成人|大人|adults?)/);
        if (adultCountMatch) {
            entities.adultCount = parseInt(adultCountMatch[1]);
        } else {
             // 嘗試匹配 'X位' 並作為成人數，前提是沒有偵測到兒童數
             const totalMatch = message.match(/(\d+)位/);
             if (totalMatch && parseInt(totalMatch[1]) > 0 && !entities.childCount && !entities.adultCount) {
                 entities.adultCount = parseInt(totalMatch[1]);
             }
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
        
        // 補充預設值：如果沒有提到成人數，但有其他資訊，預設 1 個成人 (最小啟動值)
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

        // Phone: 匹配 8-10 位數字（忽略格式）
        const phoneMatch = message.match(/(\d{8,10})/);
        if (phoneMatch) {
            entities.contactPhone = phoneMatch[1];
        }
        
        // Name: 簡化：在特定提示詞後抽取
        const nameMatch = message.match(/(我的名字是|聯絡人是)\s*([\u4e00-\u9fa5a-z\s]{2,10})/);
        if (nameMatch) {
            entities.contactName = nameMatch[2].trim();
        } else if (message.match(/^(?:我叫|我的名字|我是)\s*([\u4e00-\u9fa5a-z\s]{2,10})/)) {
            // 嘗試匹配開頭的簡單名字
             entities.contactName = message.match(/^(?:我叫|我的名字|我是)\s*([\u4e00-\u9fa5a-z\s]{2,10})/)[1].trim();
        }
    }

    /** 抽取會員資訊 */
    static extractMemberInfo(message, entities) {
        // 簡化：假設帳號和密碼通常是連續輸入的兩組詞，並且在包含關鍵字時
        if (message.includes('登入') || message.includes('會員') || message.includes('帳號')) {
            const parts = message.split(/\s+/).filter(p => p.length > 0);
            
            // 嘗試從 '帳號 密碼' 格式中提取
            const credentialsMatch = message.match(/(?:帳號|會員)\s*(\w+)\s*(?:密碼)?\s*(\w+)/);
            
            if (credentialsMatch) {
                entities.memberAccount = credentialsMatch[1];
                entities.memberPassword = credentialsMatch[2];
            } else if (parts.length >= 2) {
                 // Fallback: 假設前兩個詞是帳號密碼
                 entities.memberAccount = parts[0];
                 entities.memberPassword = parts[1];
            }
        }
    }
    
    /** 抽取加購服務 */
    static extractAddons(message, entities) {
        const matchedAddons = [];
        // 保護：使用可選鏈 ?. 避免 flowConfig 不存在時崩潰
        const addonsMap = flowConfig.states['ask_addons']?.options || {};
        
        for (const [id, name] of Object.entries(addonsMap)) {
            // 匹配 ID 或 服務名稱 (使用 includes)
            if (message.includes(name.toLowerCase()) || message.includes(id.toLowerCase())) {
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

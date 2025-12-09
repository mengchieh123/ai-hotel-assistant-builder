// intent_classifier.js (V5.9 - 整合修正版)

// 🏆 修正 1: 確保所有 dayjs 插件導入完整，且路徑正確 (.js)
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import timezone from 'dayjs/plugin/timezone.js'; // 💡 確保處理時區
import utc from 'dayjs/plugin/utc.js';         // 💡 確保處理 UTC

// 初始化 dayjs 插件
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(timezone);
dayjs.extend(utc);

// 🚨 修正 2: 移除重複的 flowConfig 導入 (由 RuleEngine 傳入)
// import flowConfig from './dialogue_flow.json'; 


/**
 * 意圖分類與實體抽取的核心類別。
 */
class SmartIntentClassifier {
    
    // --- 實體抽取輔助函數 (為確保簡潔，保留了核心邏輯，完整方法放在下方) ---
    
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
        // ⚠️ 修正：調整 Affirm/Deny 順序，避免覆蓋更明確的意圖。
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
            // 只有在不是重設時才推入 booking_start，避免重複
            if (!intents.includes('reset')) {
                intents.push('booking_start');
            }
        }

        // 3. 登入意圖 (P:100)
        if (normalizedMessage.includes('登入') || normalizedMessage.includes('會員')) {
            intents.push('login');
        }
        
        // 4. 修改意圖 (P:102)
        if (normalizedMessage.includes('修改') || normalizedMessage.includes('重選')) {
            intents.push('correction');
        }

        // 5. 通用查詢意圖 (P:104)
        if (normalizedMessage.includes('什麼是') || normalizedMessage.includes('在哪') || normalizedMessage.includes('電話') || normalizedMessage.includes('飯店資訊')) {
            intents.push('general_inquiry');
        }
        
        // 6. 其他常用意圖 (Skip/Affirm/Deny)
        if (normalizedMessage.includes('跳過') || normalizedMessage.includes('下次') || normalizedMessage.includes('不用了')) {
            intents.push('skip');
        }
        
        // 7. 肯定/否定意圖 (現在順序較晚，避免與更明確的意圖衝突)
        if (normalizedMessage.includes('繼續') || normalizedMessage.includes('恢復') || normalizedMessage.match(/^(是|好|可以|ok|確認|對|要)$/)) {
            intents.push('affirm');
        } else if (normalizedMessage.match(/^(否|不要|不對|取消)$/)) {
            intents.push('deny');
        }

        // ----------------------------------------------------
        // II. 實體抽取 (Entity Extraction)
        // ----------------------------------------------------
        
        this.extractDateEntities(normalizedMessage, extractedEntities);
        this.extractRoomType(normalizedMessage, extractedEntities, flowConfig); 
        this.extractCountEntities(normalizedMessage, extractedEntities);
        this.extractContactInfo(normalizedMessage, extractedEntities); // 🏆 修正：強化 Name/Phone Regex
        this.extractMemberInfo(normalizedMessage, extractedEntities);
        this.extractAddons(normalizedMessage, extractedEntities, flowConfig); // 🏆 修正：同時擷取 addonAction 和 addonId

        // ----------------------------------------------------
        // III. 意圖後處理 (Final Intent Assignment)
        // ----------------------------------------------------
        
        const flowIntents = intents.filter(i => ['emergency_exit', 'reset', 'booking_start', 'affirm', 'deny', 'login', 'skip', 'correction', 'general_inquiry'].includes(i));
        
        if (flowIntents.length === 0) {
            if (Object.keys(extractedEntities).length > 0) {
                // 如果沒有流程意圖但有實體，視為 'booking'
                intents.push('booking'); 
            } else {
                // 最終 fallback
                intents.push('unrecognized');
            }
        }
        
        console.log(`[INTENT DEBUG] 分類結果: ${intents.join(', ')} | 實體: ${JSON.stringify(extractedEntities)}`);

        return {
            intents: intents,
            entities: extractedEntities
        };
    }
    
    // --- 實體抽取輔助函數 (整合修正後的版本) ---

    static extractDateEntities(message, entities) {
        // [您的 extractDateEntities 函數代碼]
        const nightsMatch = message.match(/(\d+)(晚|天|night|days?)/);
        if (nightsMatch && parseInt(nightsMatch[1]) > 0) {
            entities.nights = parseInt(nightsMatch[1]);
        }
        
        let checkInDate = null;
        const today = dayjs(); 
        
        if (message.includes('今天') || message.includes('today')) {
            checkInDate = today.format('YYYY-MM-DD');
        } else if (message.includes('明天') || message.includes('tomorrow')) {
            checkInDate = today.add(1, 'day').format('YYYY-MM-DD');
        } else {
            const dateRegex = /(\d{4}[/-]\d{1,2}[/-]\d{1,2})|(\d{1,2}[/-]\d{1,2})|(\d{1,2}月\d{1,2}日)/;
            const dateMatch = message.match(dateRegex);
            
            if (dateMatch) {
                let dateStr = dateMatch[1] || dateMatch[2] || dateMatch[3];

                if (dateMatch[1]) {
                    dateStr = dateStr.replace(/[\/]/g, '-');
                    checkInDate = dayjs(dateStr).format('YYYY-MM-DD');
                } else if (dateMatch[2]) {
                    dateStr = dateStr.replace(/[\/]/g, '-');
                    const year = today.year();
                    const parsedDate = dayjs(`${year}-${dateStr}`, 'YYYY-M-D');
                    if (parsedDate.isValid()) {
                         // 如果日期在過去，嘗試推到下一年
                        checkInDate = parsedDate.isAfter(today.subtract(1, 'day'), 'day') 
                            ? parsedDate.format('YYYY-MM-DD') 
                            : parsedDate.add(1, 'year').format('YYYY-MM-DD');
                    }
                } else if (dateMatch[3]) {
                    const year = today.year();
                    const parsedDate = dayjs(`${year}年${dateStr}`, 'YYYY年M月D日');
                    if (parsedDate.isValid()) {
                        // 如果日期在過去，嘗試推到下一年
                        checkInDate = parsedDate.isAfter(today.subtract(1, 'day'), 'day') 
                            ? parsedDate.format('YYYY-MM-DD') 
                            : parsedDate.add(1, 'year').format('YYYY-MM-DD');
                    }
                }
            }
        }
        
        if (checkInDate && dayjs(checkInDate).isValid()) {
           if (dayjs(checkInDate).isAfter(dayjs().subtract(1, 'day'), 'day')) {
                entities.checkInDate = checkInDate;
            } else {
                // 這裡的邏輯與 RuleEngine.js 中的 sanitizeEntities/bookingFlowRule 耦合，
                // 應保持 RuleEngine 中的保護邏輯優先。此處僅記錄警告。
                console.log("⚠️ [ENTITY WARNING] 偵測到過去的日期，已忽略或已自動調整到下一年。");
            }
        }
    }
    
    static extractRoomType(message, entities) {
        // [您的 extractRoomType 函數代碼]
        const roomTypes = ["標準雙人房", "豪華客房", "行政套房", "家庭四人房"]; 
        const normalizedMessage = message.replace(/\s/g, ''); // 移除空格再匹配

        const matchedRoom = roomTypes.find(type => normalizedMessage.includes(type.toLowerCase().replace(/\s/g, '')));
        
        if (matchedRoom) {
            entities.roomType = matchedRoom;
        }
    }
    
    static extractCountEntities(message, entities) {
        // [您的 extractCountEntities 函數代碼]
        const roomCountMatch = message.match(/(\d+)(間房|間|rooms?)/);
        if (roomCountMatch) {
            entities.roomCount = parseInt(roomCountMatch[1]);
        } else if (message.includes('一間') || message.includes('一個')) {
            entities.roomCount = 1; 
        }

        const childCountMatch = message.match(/(\d+)(個?兒童|小孩|kids?|children)/);
        if (childCountMatch) {
            entities.childCount = parseInt(childCountMatch[1]);
        } else if (message.includes('沒有小孩') || message.includes('無小孩')) {
            entities.childCount = 0;
        }

        const adultCountMatch = message.match(/(\d+)(個?成人|大人|adults?)/);
        if (adultCountMatch) {
            entities.adultCount = parseInt(adultCountMatch[1]);
        } 
        
        const totalMatch = message.match(/(\d+)位/);
        if (totalMatch && parseInt(totalMatch[1]) > 0 && !entities.childCount && !entities.adultCount) {
            entities.adultCount = parseInt(totalMatch[1]);
        }

        for (const key of ['roomCount', 'adultCount', 'childCount']) {
            if (entities[key] !== undefined && (isNaN(entities[key]) || entities[key] < 0)) {
                delete entities[key];
            }
        }
        
        // 補充預設值
        if (!entities.adultCount && (entities.checkInDate || entities.roomType || entities.roomCount)) {
            entities.adultCount = 1;
        }
    }

    static extractContactInfo(message, entities) {
        // 🏆 修正：強化 Name/Phone Regex，提高辨識率
        const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
            entities.contactEmail = emailMatch[1];
        }

        // 優化 Phone 號碼匹配：增加國家/區號彈性 (可選)，並確保位數正確
        // 匹配格式：(02)-12345678, 0987-654321, 0987654321 等
        const phoneMatch = message.match(/(\d{2,4}[-.\s]?)?(\d{7,10})/);
        if (phoneMatch) {
            // 提取號碼部分並移除分隔符
            const rawPhone = (phoneMatch[0] || '').replace(/[-.\s]/g, '');
            // 確保號碼是合理的長度 (例如 8-11 位)
            if (rawPhone.length >= 8 && rawPhone.length <= 11) {
                entities.contactPhone = rawPhone;
            }
        }
        
        // 強化 Name 匹配: 
        // 匹配句式或直接匹配 (2-4 中文) / (2-15 英文/空格)
        const nameRegex = /(?:我的名字是|聯絡人是|我叫|我是|姓名[:：]?)\s*([\u4e00-\u9fa5]{2,4}|[a-zA-Z\s]{2,15})|([\u4e00-\u9fa5]{2,4}|[a-zA-Z\s]{2,15})(?:\s|[,.]|$)/;
        const nameMatch = message.match(nameRegex);
        
        if (nameMatch) {
            // 取第一個非空的匹配組
            const name = (nameMatch[1] || nameMatch[2] || '').trim();
            // 排除只包含單字、數字或太長的名稱
            if (name && name.length >= 2 && !/\d/.test(name) && name.length <= 15) {
                entities.contactName = name;
            }
        } 
    }

    static extractMemberInfo(message, entities) {
        // [您的 extractMemberInfo 函數代碼]
        if (message.includes('登入') || message.includes('會員') || message.includes('帳號')) {
            const credentialsMatch = message.match(/(?:\w+)\s*(\S+)\s*(?:\w+)?\s*(\S+)/); 
            
            if (credentialsMatch && credentialsMatch[1] && credentialsMatch[2]) {
                if (credentialsMatch[1].length >= 3) {
                    entities.memberAccount = credentialsMatch[1];
                }
                if (credentialsMatch[2].length >= 3) {
                    entities.memberPassword = credentialsMatch[2];
                }
            } 
        }
    }
    
    static extractAddons(message, entities, flowConfig) {
        // 🏆 修正：同時擷取 addonAction 和 addonId 以配合 Handler 邏輯
        const normalizedMessage = message.toLowerCase().replace(/\s/g, '');
        
        // 1. 識別 Addon 動作 (addonAction)
        if (normalizedMessage.includes('加購') || normalizedMessage.includes('增加') || normalizedMessage.includes('選')) {
            entities.addonAction = '加購';
        } else if (normalizedMessage.includes('移除') || normalizedMessage.includes('不要')) {
            entities.addonAction = '移除';
        } else if (normalizedMessage.includes('要') || normalizedMessage.includes('選購')) {
            // 預設為 '加購'
            entities.addonAction = '加購';
        }

        // 2. 識別 Addon ID (addonId)
        const mockAddonsMap = {
            "A1": "機場接送",
            "A2": "SPA服務",
            "A3": "自助晚餐"
        };
        // 使用傳入的 flowConfig 中的 options，否則使用 Mock
        const addonsMap = flowConfig.states['ask_addons']?.options || mockAddonsMap; 
        const addonIdList = [];

        for (const [id, name] of Object.entries(addonsMap)) {
            const normalizedName = name.toLowerCase().replace(/\s/g, '');
            
            if (normalizedMessage.includes(normalizedName) || normalizedMessage.includes(id.toLowerCase())) {
                addonIdList.push(id);
            }
        }

        if (addonIdList.length > 0) {
            // 提取第一個 ID 作為 addonId (供 Handler 判斷用)
            entities.addonId = addonIdList[0]; 
            
            // 提取所有匹配到的 ID 列表 (供 Rule Engine 合併到 collectedData.addons 列表)
            entities.rawAddonMatches = [...new Set(addonIdList)];
        }
    }
}

// 🏆 修正 3: 使用命名匯出，與 RuleEngine 的命名導入相匹配
export { SmartIntentClassifier };

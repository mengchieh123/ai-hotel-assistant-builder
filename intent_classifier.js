// intent_classifier.js (V6.1 - 強化中文數字和晚數解析, 修正 flowConfig 安全檢查)

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

// 初始化 dayjs 插件
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(timezone);
dayjs.extend(utc);


// ----------------------------------------------------
// ✨ NEW: 中文數字解析輔助變數和函數
// ----------------------------------------------------

// 輔助映射：中文數字轉阿拉伯數字
const CHINESE_NUM_MAP = {
    '一': 1, '兩': 2, '二': 2, '三': 3, '四': 4, 
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, 
    '十': 10
};

// 正則表達式輔助：匹配數字或中文數字 (一到十)
const NUM_OR_CHINESE_REGEX = `(\\d|[${Object.keys(CHINESE_NUM_MAP).join('')}])`;

/**
 * 將匹配到的數字（可能是中文數字）轉換為數字
 * @param {string} match - 匹配到的字串
 * @returns {number|null}
 */
function parseNumber(match) {
    if (!match) return null;
    // 檢查是否為中文數字
    if (CHINESE_NUM_MAP[match]) {
        return CHINESE_NUM_MAP[match];
    }
    // 檢查是否為阿拉伯數字
    const number = parseInt(match, 10);
    return isNaN(number) ? null : number;
}
// ----------------------------------------------------


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
        // 🚨 修正：統一用 toLowerCase()，但保留原始訊息用於 Log 輸出
        const normalizedMessage = message.toLowerCase().trim();
        const extractedEntities = {};
        const intents = [];

        // ----------------------------------------------------
        // I. 意圖識別 
        // ----------------------------------------------------

        // 1. 緊急控制意圖 (P:110)
        if (normalizedMessage.includes('取消') || normalizedMessage.includes('停止') || normalizedMessage.includes('中止') || normalizedMessage.includes('放棄')) {
            intents.push('emergency_exit');
        }

        // 2. 流程控制意圖 (Reset/Booking Start)
        if (normalizedMessage.includes('重來') || normalizedMessage.includes('重新開始') || normalizedMessage.includes('reset')) {
            intents.push('reset');
            intents.push('booking_start');
        }
        if (normalizedMessage.includes('訂房') || normalizedMessage.includes('預約') || normalizedMessage.includes('我要訂')) {
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

        // 7. 肯定/否定意圖
        if (normalizedMessage.includes('繼續') || normalizedMessage.includes('恢復') || normalizedMessage.match(/^(是|好|可以|ok|確認|對|要)$/)) {
            intents.push('affirm');
        } else if (normalizedMessage.match(/^(否|不要|不對|不)$/)) {
            // 🚨 修正：移除 '取消'，讓它被高優先級的 emergency_exit 處理
            intents.push('deny');
        }


        // ----------------------------------------------------
        // II. 實體抽取 (Entity Extraction)
        // ----------------------------------------------------

        this.extractDateEntities(normalizedMessage, extractedEntities);
        this.extractRoomType(normalizedMessage, extractedEntities, flowConfig);
        this.extractCountEntities(normalizedMessage, extractedEntities);
        this.extractContactInfo(normalizedMessage, extractedEntities);
        this.extractMemberInfo(normalizedMessage, extractedEntities);
        this.extractAddons(normalizedMessage, extractedEntities, flowConfig); // 呼叫修正後的函數

        // ----------------------------------------------------
        // III. 意圖後處理 (Final Intent Assignment)
        // ----------------------------------------------------

        const flowIntents = intents.filter(i => ['emergency_exit', 'reset', 'booking_start', 'affirm', 'deny', 'login', 'skip', 'correction', 'general_inquiry'].includes(i));
        const contactEntitiesOnly = Object.keys(extractedEntities).every(key => ['contactName', 'contactPhone', 'contactEmail', 'memberAccount', 'memberPassword'].includes(key));
        const hasCoreEntities = extractedEntities.checkInDate || extractedEntities.nights || extractedEntities.roomType || extractedEntities.adultCount || extractedEntities.roomCount;

        if (flowIntents.length === 0) {
            if (hasCoreEntities) {
                // 有核心實體，視為 'booking'
                intents.push('booking');
            } else if (Object.keys(extractedEntities).length > 0 && contactEntitiesOnly) {
                // 只有聯絡人或會員資訊，視為 'contact_info_update'
                intents.push('contact_info_update');
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

    // --- 實體抽取輔助函數 ---

    static extractDateEntities(message, entities) {
        // 🏆 修正: 強化晚數 (Nights) 解析：支持阿拉伯數字和中文數字
        const nightsRegex = new RegExp(`${NUM_OR_CHINESE_REGEX}(晚|天|夜|night|days?)`);
        const nightsMatch = message.match(nightsRegex);

        if (nightsMatch) {
            // 使用新的 parseNumber 函數解析數字或中文數字
            const number = parseNumber(nightsMatch[1]);
            if (number !== null && number > 0) {
                entities.nights = number;
            }
        }


        let checkInDate = null;
        const today = dayjs();

        if (message.includes('今天') || message.includes('today')) {
            checkInDate = today.format('YYYY-MM-DD');
        } else if (message.includes('明天') || message.includes('tomorrow')) {
            checkInDate = today.add(1, 'day').format('YYYY-MM-DD');
        } else {
            // 保持原有的日期匹配規則 (已包含 '12月20日' 格式)
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
                console.log("⚠️ [ENTITY WARNING] 偵測到過去的日期，已忽略或已自動調整到下一年。");
            }
        }
    }

    static extractRoomType(message, entities) {
        const roomTypes = ["標準雙人房", "豪華客房", "行政套房", "家庭四人房"];
        const normalizedMessage = message.replace(/\s/g, ''); // 移除空格再匹配

        const matchedRoom = roomTypes.find(type => normalizedMessage.includes(type.toLowerCase().replace(/\s/g, '')));

        if (matchedRoom) {
            entities.roomType = matchedRoom;
        }
    }

    static extractCountEntities(message, entities) {
        // 🚨 修正：強化「無/零」的映射
        if (message.includes('沒有兒童') || message.includes('無兒童') || message.includes('零兒童') || message.match(/0個?小孩|0個?兒童/)) {
            entities.childCount = 0;
        }

        // 🏆 修正: 房間數匹配，支持中文數字
        const roomCountRegex = new RegExp(`${NUM_OR_CHINESE_REGEX}(間房|間|rooms?)`);
        const roomCountMatch = message.match(roomCountRegex);
        if (roomCountMatch) {
            entities.roomCount = parseNumber(roomCountMatch[1]);
        } else if (message.includes('一間') || message.includes('一個')) {
            entities.roomCount = 1;
        }

        // 🏆 修正: 兒童數匹配，支持中文數字
        const childCountRegex = new RegExp(`${NUM_OR_CHINESE_REGEX}(個?兒童|小孩|kids?|children)`);
        const childCountMatch = message.match(childCountRegex);
        if (childCountMatch) {
            entities.childCount = parseNumber(childCountMatch[1]);
        }

        // 🏆 修正: 成人數匹配，支持中文數字
        const adultCountRegex = new RegExp(`${NUM_OR_CHINESE_REGEX}(個?成人|大人|adults?)`);
        const adultCountMatch = message.match(adultCountRegex);
        if (adultCountMatch) {
            entities.adultCount = parseNumber(adultCountMatch[1]);
        }

        // 🚨 修正：僅當沒有明確的 adult/child/room count 實體時，才使用「N位」
        const totalRegex = new RegExp(`${NUM_OR_CHINESE_REGEX}位`);
        const totalMatch = message.match(totalRegex);
        if (totalMatch) {
            const number = parseNumber(totalMatch[1]);
            if (number > 0 && !entities.adultCount && !entities.childCount) {
                entities.adultCount = number;
            }
        }

        // 🚨 優化：提取純數字，交給 Rule Engine 判斷用途 (rawNumber)
        const pureNumberMatch = message.match(/^(\d+)$/);
        if (pureNumberMatch && !entities.roomCount && !entities.adultCount && !entities.childCount) {
            entities.rawNumber = parseInt(pureNumberMatch[1]);
        }


        for (const key of ['roomCount', 'adultCount', 'childCount', 'rawNumber']) {
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
        const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
            entities.contactEmail = emailMatch[1];
        }

        // 優化 Phone 號碼匹配：增加對台灣手機號碼 (09開頭10碼) 的匹配
        const phoneMatch = message.match(/(?:\d{2,4}[-.\s]?)?\d{7,10}/);
        if (phoneMatch) {
            const rawPhone = (phoneMatch[0] || '').replace(/[-.\s]/g, '');
            if (rawPhone.length >= 8 && rawPhone.length <= 11) {
                entities.contactPhone = rawPhone;
            }
        }

        // 🚨 修正：強化 Name 匹配，只在有引導詞或匹配條件更嚴格時才提取
        const nameRegex = /(?:我的名字是|聯絡人是|我叫|我是|姓名[:：]?)\s*([\u4e00-\u9fa5]{2,4}|[a-zA-Z\s]{2,15})/;
        const nameMatch = message.match(nameRegex);

        if (nameMatch) {
            // 優先取匹配組 [1] (引導詞後方的姓名)
            const name = (nameMatch[1] || '').trim();
            if (name && name.length >= 2 && !/\d/.test(name) && name.length <= 15) {
                entities.contactName = name;
            }
        }
    }

    static extractMemberInfo(message, entities) {
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

    /**
     * 從訊息中提取加購服務 (Add-ons) 資訊。
     * @param {string} message - 經過標準化的使用者訊息。
     * @param {object} entities - 實體儲存物件。
     * @param {object} flowConfig - 整個流程的配置 (用於動態獲取 Add-ons 列表)。
     */
    static extractAddons(message, entities, flowConfig) {
        const normalizedMessage = message.toLowerCase().replace(/\s/g, '');

        if (normalizedMessage.includes('加購') || normalizedMessage.includes('增加') || normalizedMessage.includes('選')) {
            entities.addonAction = '加購';
        } else if (normalizedMessage.includes('移除') || normalizedMessage.includes('不要')) {
            entities.addonAction = '移除';
        } else if (normalizedMessage.includes('要') || normalizedMessage.includes('選購')) {
            entities.addonAction = '加購';
        }

        const mockAddonsMap = {
            "A1": "機場接送",
            "A2": "SPA服務",
            "A3": "自助晚餐"
        };
        
        // 🏆 修正: 強化 flowConfig 存取安全檢查 (解決 TypeError)
        // 使用可選串連確保 flowConfig, states, ask_addons 都存在
        const addonsMap = flowConfig?.states?.ask_addons?.options || mockAddonsMap; 
        
        const addonIdList = [];

        for (const [id, name] of Object.entries(addonsMap)) {
            const normalizedName = name.toLowerCase().replace(/\s/g, '');

            if (normalizedMessage.includes(normalizedName) || normalizedMessage.includes(id.toLowerCase())) {
                addonIdList.push(id);
            }
        }

        if (addonIdList.length > 0) {
            entities.addonId = addonIdList[0];
            entities.rawAddonMatches = [...new Set(addonIdList)];
        }
    }
}

// 使用命名匯出，與 RuleEngine 的命名導入相匹配
export { SmartIntentClassifier };

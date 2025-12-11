// intent_classifier.js (V7.0 - 徹底重構，智慧型解析)
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
// ✨ 智慧解析核心類別
// ----------------------------------------------------

class SmartIntentClassifier {
    
    /**
     * 主分類方法 - 一次解析所有資訊
     * @param {string} message - 使用者原始訊息
     * @param {object} flowConfig - 流程配置
     * @param {object} sessionData - 現有會話數據
     * @returns {{intents: string[], entities: object}}
     */
    static classify(message, flowConfig, sessionData = {}) {
        console.log(`[INTENT RAW] 原始訊息: "${message}"`);
        
        // 保留原始訊息用於實體提取（不轉小寫）
        const extractedEntities = {};
        const intents = [];
        
        // 🎯 第一步：分析上下文，決定解析策略
        const context = this._analyzeContext(sessionData);
        
        // 🎯 第二步：智慧型多重實體提取
        this._extractSmartEntities(message, extractedEntities, flowConfig, context);
        
        // 🎯 第三步：基於上下文和實體的意圖判斷
        this._determineSmartIntents(message, extractedEntities, intents, context);
        
        console.log(`[INTENT RESULT] 意圖: ${intents.join(', ')} | 實體: ${JSON.stringify(extractedEntities)}`);
        
        return {
            intents: intents,
            entities: extractedEntities
        };
    }
    
    // ----------------------------------------------------
    // 🔍 上下文分析
    // ----------------------------------------------------
    
    static _analyzeContext(sessionData) {
        const currentState = sessionData.currentState || 'init';
        const missingFields = this._getMissingFields(sessionData);
        
        return {
            currentState,
            missingFields,
            hasDate: !!sessionData.checkInDate,
            hasRoomType: !!sessionData.roomType,
            hasPeopleInfo: !!(sessionData.adultCount || sessionData.childCount),
            isCollectingContact: currentState.includes('contact'),
            isCollectingMember: currentState.includes('login') || currentState.includes('member')
        };
    }
    
    static _getMissingFields(sessionData) {
        const missing = [];
        const state = sessionData.currentState || 'init';
        
        // 根據狀態判斷需要什麼資訊
        if (state === 'ask_dates_and_nights') {
            if (!sessionData.checkInDate) missing.push('checkInDate');
            if (!sessionData.nights) missing.push('nights');
        }
        else if (state === 'ask_room_type') {
            if (!sessionData.roomType) missing.push('roomType');
        }
        else if (state === 'ask_room_count') {
            if (!sessionData.roomCount) missing.push('roomCount');
        }
        else if (state === 'ask_people_count') {
            if (!sessionData.adultCount) missing.push('adultCount');
            if (sessionData.childCount === undefined) missing.push('childCount');
        }
        else if (state.includes('contact')) {
            if (!sessionData.contactName) missing.push('contactName');
            if (!sessionData.contactPhone) missing.push('contactPhone');
            if (!sessionData.contactEmail) missing.push('contactEmail');
        }
        
        return missing;
    }
    
    // ----------------------------------------------------
    // 🧠 智慧實體提取
    // ----------------------------------------------------
    
    static _extractSmartEntities(message, entities, flowConfig, context) {
        // 解析日期和晚數（智慧組合）
        this._extractDateAndNights(message, entities, context);
        
        // 解析人數（大人小孩一起處理）
        this._extractPeopleInfo(message, entities, context);
        
        // 解析房型和數量
        this._extractRoomInfo(message, entities, context);
        
        // 解析聯繫資訊（姓名、電話、郵件）
        this._extractContactInfo(message, entities, context);
        
        // 解析加購服務
        this._extractAddons(message, entities, flowConfig);
        
        // 解析會員資訊
        this._extractMemberInfo(message, entities, context);
        
        // 特殊情況處理
        this._handleSpecialCases(message, entities, context);
    }
    
    // ----------------------------------------------------
    // 📅 日期和晚數解析
    // ----------------------------------------------------
    
    static _extractDateAndNights(message, entities, context) {
        const lowerMsg = message.toLowerCase();
        
        // 🎯 支援的所有日期格式
        const datePatterns = [
            // 格式1: "12/25 2晚" 或 "12-25 2晚"
            () => {
                const match = message.match(/(\d{1,2})[\/\-月]\s*(\d{1,2})[日號]?\s*,?\s*(\d+|一|二|兩|三|四|五|六|七|八|九|十)(?:\s*[-~]\s*(\d+))?\s*(晚|天|夜|nights?|days?)/i);
                if (match) {
                    const month = parseInt(match[1]);
                    const day = parseInt(match[2]);
                    const nights = this._parseChineseNumber(match[3]) || parseInt(match[3]);
                    
                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && nights) {
                        const year = new Date().getFullYear();
                        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        
                        // 檢查日期是否有效
                        const checkDate = dayjs(date);
                        if (checkDate.isValid()) {
                            entities.checkInDate = date;
                            entities.nights = nights;
                            return true;
                        }
                    }
                }
                return false;
            },
            
            // 格式2: "2025/12/25 住3天"
            () => {
                const match = message.match(/(\d{4})[\/\-]\s*(\d{1,2})[\/\-]\s*(\d{1,2})\s*(?:住|住宿|for)?\s*(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(天|晚|夜|nights?|days?)/i);
                if (match) {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]);
                    const day = parseInt(match[3]);
                    const nights = this._parseChineseNumber(match[4]) || parseInt(match[4]);
                    
                    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && nights) {
                        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                        
                        const checkDate = dayjs(date);
                        if (checkDate.isValid()) {
                            entities.checkInDate = date;
                            entities.nights = nights;
                            return true;
                        }
                    }
                }
                return false;
            },
            
            // 格式3: "聖誕節住兩晚"
            () => {
                const holidayMap = {
                    '聖誕節': '12-25',
                    '聖誕': '12-25',
                    '跨年': '12-31',
                    '元旦': '01-01',
                    '除夕': this._getLunarDate('除夕'),
                    '春節': this._getLunarDate('春節'),
                    '清明': this._getQingmingDate(),
                    '端午': this._getDragonBoatDate(),
                    '中秋': this._getMidAutumnDate(),
                    '雙十': '10-10'
                };
                
                for (const [key, dateStr] of Object.entries(holidayMap)) {
                    if (lowerMsg.includes(key.toLowerCase())) {
                        const year = new Date().getFullYear();
                        const date = `${year}-${dateStr}`;
                        
                        // 解析晚數
                        const nightsMatch = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(晚|天|夜)/);
                        const nights = nightsMatch ? 
                            (this._parseChineseNumber(nightsMatch[1]) || parseInt(nightsMatch[1])) : 1;
                        
                        const checkDate = dayjs(date);
                        if (checkDate.isValid()) {
                            entities.checkInDate = date;
                            entities.nights = nights;
                            return true;
                        }
                    }
                }
                return false;
            },
            
            // 格式4: "明天 2晚"、"下週五 3晚"
            () => {
                const relativeMap = {
                    '今天': 0, '今晚': 0,
                    '明天': 1, '明晚': 1,
                    '後天': 2,
                    '大後天': 3,
                    '週一': this._getDaysToWeekday(1),
                    '週二': this._getDaysToWeekday(2),
                    '週三': this._getDaysToWeekday(3),
                    '週四': this._getDaysToWeekday(4),
                    '週五': this._getDaysToWeekday(5),
                    '週六': this._getDaysToWeekday(6),
                    '週日': this._getDaysToWeekday(0),
                    '星期日': this._getDaysToWeekday(0),
                    '禮拜一': this._getDaysToWeekday(1),
                    '禮拜二': this._getDaysToWeekday(2),
                    '禮拜三': this._getDaysToWeekday(3),
                    '禮拜四': this._getDaysToWeekday(4),
                    '禮拜五': this._getDaysToWeekday(5),
                    '禮拜六': this._getDaysToWeekday(6),
                    '禮拜日': this._getDaysToWeekday(0),
                    '下週一': this._getDaysToWeekday(1) + 7,
                    '下週二': this._getDaysToWeekday(2) + 7,
                    '下週三': this._getDaysToWeekday(3) + 7,
                    '下週四': this._getDaysToWeekday(4) + 7,
                    '下週五': this._getDaysToWeekday(5) + 7,
                    '下週六': this._getDaysToWeekday(6) + 7,
                    '下週日': this._getDaysToWeekday(0) + 7,
                    '這個週末': this._getDaysToWeekend(),
                    '下個週末': this._getDaysToWeekend() + 7,
                    '月底': this._getDaysToMonthEnd(),
                    '月初': this._getDaysToMonthStart()
                };
                
                for (const [key, days] of Object.entries(relativeMap)) {
                    if (lowerMsg.includes(key.toLowerCase())) {
                        const date = dayjs().add(days, 'day');
                        
                        // 解析晚數
                        const nightsMatch = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(晚|天|夜)/);
                        const nights = nightsMatch ? 
                            (this._parseChineseNumber(nightsMatch[1]) || parseInt(nightsMatch[1])) : 1;
                        
                        entities.checkInDate = date.format('YYYY-MM-DD');
                        entities.nights = nights;
                        return true;
                    }
                }
                return false;
            },
            
            // 格式5: 只有晚數，沒有日期
            () => {
                if (context.hasDate && !entities.nights) {
                    const nightsMatch = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(晚|天|夜|nights?|days?)/i);
                    if (nightsMatch) {
                        const nights = this._parseChineseNumber(nightsMatch[1]) || parseInt(nightsMatch[1]);
                        if (nights > 0) {
                            entities.nights = nights;
                            return true;
                        }
                    }
                }
                return false;
            },
            
            // 格式6: 只有日期，沒有晚數
            () => {
                if (!context.hasDate && !entities.checkInDate) {
                    // 嘗試解析純數字日期
                    const pureDateMatch = message.match(/(\d{1,2})\/(\d{1,2})|(\d{1,2})月(\d{1,2})日/);
                    if (pureDateMatch) {
                        const month = parseInt(pureDateMatch[1] || pureDateMatch[3]);
                        const day = parseInt(pureDateMatch[2] || pureDateMatch[4]);
                        
                        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                            const year = new Date().getFullYear();
                            const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                            
                            const checkDate = dayjs(date);
                            if (checkDate.isValid()) {
                                entities.checkInDate = date;
                                return true;
                            }
                        }
                    }
                }
                return false;
            }
        ];
        
        // 嘗試所有模式
        for (const pattern of datePatterns) {
            try {
                if (pattern()) break;
            } catch (error) {
                console.warn(`[DATE PARSE ERROR] 模式執行失敗:`, error);
            }
        }
    }
    
    // ----------------------------------------------------
    // 👨‍👩‍👧‍👦 人數解析
    // ----------------------------------------------------
    
    static _extractPeopleInfo(message, entities, context) {
        const lowerMsg = message.toLowerCase();
        
        // 🎯 模式1: "2大1小"
        const pattern1 = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(?:大|大人|成人|adults?)\s*(\d+|一|二|兩|三|四|五|六|七|八|九|十)?\s*(?:小|小孩|兒童|child|children|kids?)?/i);
        if (pattern1) {
            const adults = this._parseChineseNumber(pattern1[1]) || parseInt(pattern1[1]);
            entities.adultCount = adults;
            
            if (pattern1[2]) {
                const children = this._parseChineseNumber(pattern1[2]) || parseInt(pattern1[2]);
                entities.childCount = children;
                
                // 嘗試提取小孩年齡
                const ageMatch = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*歲/);
                if (ageMatch) {
                    const age = this._parseChineseNumber(ageMatch[1]) || parseInt(ageMatch[1]);
                    entities.childAges = [age];
                }
            }
            return;
        }
        
        // 🎯 模式2: "我們兩人"、"一家三口"
        const pattern2 = message.match(/(我們|一家|全家|一共|總共)\s*(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(人|位)/);
        if (pattern2) {
            const total = this._parseChineseNumber(pattern2[2]) || parseInt(pattern2[2]);
            // 預設都是大人，除非特別說明
            entities.adultCount = total;
            return;
        }
        
        // 🎯 模式3: "我自己"、"一個人"
        if (lowerMsg.includes('我自己') || lowerMsg.includes('一個人') || lowerMsg.includes('單人')) {
            entities.adultCount = 1;
            entities.childCount = 0;
            return;
        }
        
        // 🎯 模式4: "有小孩"、"帶孩子"
        if (lowerMsg.includes('小孩') || lowerMsg.includes('兒童') || lowerMsg.includes('孩子') || lowerMsg.includes('嬰兒')) {
            entities.childCount = entities.childCount || 1;
            
            // 提取小孩年齡
            const ageMatch = message.match(/(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(歲|個月|月大)/);
            if (ageMatch) {
                const age = this._parseChineseNumber(ageMatch[1]) || parseInt(ageMatch[1]);
                entities.childAges = [age];
            }
        }
        
        // 🎯 模式5: 單獨的數字（根據上下文判斷）
        if (!entities.adultCount && !entities.childCount) {
            const numberMatch = message.match(/^(\d+|一|二|兩|三|四|五|六|七|八|九|十)$/);
            if (numberMatch) {
                const num = this._parseChineseNumber(numberMatch[1]) || parseInt(numberMatch[1]);
                
                if (context.missingFields.includes('adultCount')) {
                    entities.adultCount = num;
                } else if (context.missingFields.includes('childCount')) {
                    entities.childCount = num;
                } else if (context.missingFields.includes('roomCount')) {
                    entities.roomCount = num;
                } else {
                    entities.rawNumber = num;
                }
            }
        }
        
        // 設定預設值（如果都沒有的話）
        if (!entities.adultCount && (entities.checkInDate || entities.roomType)) {
            entities.adultCount = 2; // 預設2大人
        }
        if (entities.childCount === undefined) {
            entities.childCount = 0; // 預設沒有小孩
        }
    }
    
    // ----------------------------------------------------
    // 🏨 房型解析
    // ----------------------------------------------------
    
    static _extractRoomInfo(message, entities, context) {
        const roomTypeMap = {
            '標準': '標準雙人房',
            '雙人房': '標準雙人房',
            '經濟房': '標準雙人房',
            '豪華': '豪華客房',
            '豪華房': '豪華客房',
            '行政': '行政套房',
            '套房': '行政套房',
            '家庭': '家庭四人房',
            '四人房': '家庭四人房',
            '親子': '家庭四人房'
        };
        
        // 🎯 解析房型
        for (const [key, value] of Object.entries(roomTypeMap)) {
            if (message.includes(key)) {
                entities.roomType = value;
                break;
            }
        }
        
        // 🎯 解析房間數量
        const roomCountPatterns = [
            /(\d+|一|二|兩|三|四|五|六|七|八|九|十)\s*(間房|間|rooms?)/i,
            /^(\d+|一|二|兩|三|四|五|六|七|八|九|十)$/ // 純數字
        ];
        
        for (const pattern of roomCountPatterns) {
            const match = message.match(pattern);
            if (match && (context.missingFields.includes('roomCount') || !entities.roomCount)) {
                const count = this._parseChineseNumber(match[1]) || parseInt(match[1]);
                if (count > 0) {
                    entities.roomCount = count;
                    break;
                }
            }
        }
        
        // 如果選擇了家庭房但只訂一間，建議確認
        if (entities.roomType === '家庭四人房' && entities.roomCount === 1) {
            entities.needConfirmation = '您選擇了家庭四人房但只訂一間，確認嗎？';
        }
    }
    
    // ----------------------------------------------------
    // 📞 聯繫資訊解析
    // ----------------------------------------------------
    
    static _extractContactInfo(message, entities, context) {
        // 🎯 解析姓名（多種格式）
        const namePatterns = [
            /(?:姓名|名字|聯絡人)[:：]?\s*([\u4e00-\u9fa5]{2,4})/,
            /^([\u4e00-\u9fa5]{2,4})$/,
            /(?:我是|我叫)\s*([\u4e00-\u9fa5]{2,4})/,
            /([\u4e00-\u9fa5]{2,4})\s*,\s*[\d@]/ // 姓名在開頭
        ];
        
        for (const pattern of namePatterns) {
            const match = message.match(pattern);
            if (match && match[1] && match[1].length >= 2) {
                entities.contactName = match[1].trim();
                break;
            }
        }
        
        // 🎯 解析電話（支援所有格式）
        const phonePatterns = [
            /(?:電話|手機|聯絡電話)[:：]?\s*(\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})/,
            /(09\d{2}[-.\s]?\d{3}[-.\s]?\d{3})/,
            /(\d{4}[-.\s]?\d{3}[-.\s]?\d{3})/,
            /^(\d{10})$/,
            /(\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{4}[-.\s]?\d{4})/
        ];
        
        for (const pattern of phonePatterns) {
            const match = message.match(pattern);
            if (match) {
                const phone = match[1].replace(/[-\s]/g, '');
                if (phone.length >= 8 && phone.length <= 15) {
                    entities.contactPhone = phone;
                    break;
                }
            }
        }
        
        // 🎯 解析電子郵件
        const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            entities.contactEmail = emailMatch[1];
        }
        
        // 🎯 組合解析：一次性提供所有資訊
        const combinedPattern = /([\u4e00-\u9fa5]{2,4})\s*[,，]\s*([\d+\s\-]+)\s*[,，]\s*([\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/;
        const combinedMatch = message.match(combinedPattern);
        if (combinedMatch) {
            entities.contactName = combinedMatch[1].trim();
            entities.contactPhone = combinedMatch[2].replace(/[-\s]/g, '').trim();
            entities.contactEmail = combinedMatch[3].trim();
            entities.combinedContact = true;
        }
        
        // 🎯 漸進式收集：根據上下文判斷使用者正在提供什麼
        if (context.isCollectingContact) {
            if (!entities.contactName && message.match(/^[\u4e00-\u9fa5]{2,4}$/)) {
                entities.contactName = message;
            }
            else if (!entities.contactPhone && message.match(/^\d{8,11}$/)) {
                entities.contactPhone = message;
            }
            else if (!entities.contactEmail && message.includes('@')) {
                entities.contactEmail = message.split(/\s+/).find(part => part.includes('@'));
            }
        }
    }
    
    // ----------------------------------------------------
    // 🎁 加購服務解析
    // ----------------------------------------------------
    
    static _extractAddons(message, entities, flowConfig) {
        const lowerMsg = message.toLowerCase();
        
        // 判斷動作
        if (lowerMsg.includes('加購') || lowerMsg.includes('增加') || lowerMsg.includes('要') || lowerMsg.includes('選購')) {
            entities.addonAction = '加購';
        } else if (lowerMsg.includes('移除') || lowerMsg.includes('不要') || lowerMsg.includes('取消')) {
            entities.addonAction = '移除';
        }
        
        // 安全獲取加購選項
        const addonsMap = flowConfig?.states?.ask_addons?.options || {
            'ADD001': '機場接送',
            'ADD002': '晚餐券',
            'ADD003': '迎賓香檳',
            'ADD004': 'SPA療程'
        };
        
        // 識別具體的加購項目
        const matchedAddons = [];
        for (const [id, name] of Object.entries(addonsMap)) {
            const normalizedName = name.toLowerCase();
            if (lowerMsg.includes(normalizedName) || lowerMsg.includes(id.toLowerCase())) {
                matchedAddons.push(id);
            }
        }
        
        if (matchedAddons.length > 0) {
            entities.addonIds = matchedAddons;
            if (!entities.addonAction) {
                entities.addonAction = '加購'; // 預設為加購
            }
        }
    }
    
    // ----------------------------------------------------
    // 👤 會員資訊解析
    // ----------------------------------------------------
    
    static _extractMemberInfo(message, entities, context) {
        const lowerMsg = message.toLowerCase();
        
        // 🎯 登入相關
        if (lowerMsg.includes('登入') || lowerMsg.includes('login') || 
            (lowerMsg.includes('會員') && !lowerMsg.includes('註冊'))) {
            
            // 嘗試提取帳號密碼
            const credentialsMatch = message.match(/(?:帳號|賬號|account)[:：]?\s*(\S+)\s*(?:密碼|password)[:：]?\s*(\S+)/i);
            if (credentialsMatch) {
                entities.memberAccount = credentialsMatch[1];
                entities.memberPassword = credentialsMatch[2];
            }
            // 嘗試提取電話或郵件作為帳號
            else if (message.match(/\d{8,11}/)) {
                entities.memberAccount = message.match(/\d{8,11}/)[0];
            }
            else if (message.includes('@')) {
                entities.memberAccount = message.split(/\s+/).find(part => part.includes('@'));
            }
        }
    }
    
    // ----------------------------------------------------
    // 🎯 意圖判斷
    // ----------------------------------------------------
    
    static _determineSmartIntents(message, entities, intents, context) {
        const lowerMsg = message.toLowerCase();
        
        // 1. 緊急控制意圖（最高優先級）
        if (lowerMsg.includes('取消') && lowerMsg.includes('訂房')) {
            intents.push('emergency_cancel');
            return;
        }
        if (lowerMsg.includes('停止') || lowerMsg.includes('中止') || lowerMsg.includes('結束')) {
            intents.push('emergency_exit');
            return;
        }
        
        // 2. 重設/重新開始
        if (lowerMsg.includes('重來') || lowerMsg.includes('重新開始') || lowerMsg.includes('reset')) {
            intents.push('reset');
            return;
        }
        
        // 3. 基於實體判斷意圖
        const hasBookingEntities = entities.checkInDate || entities.roomType || 
                                  entities.roomCount || entities.adultCount;
        
        const hasContactEntities = entities.contactName || entities.contactPhone || 
                                  entities.contactEmail;
        
        const hasMemberEntities = entities.memberAccount || entities.memberPassword;
        
        // 如果正在收集某類資訊，優先判斷對應意圖
        if (context.isCollectingContact && hasContactEntities) {
            intents.push('contact_info_update');
            if (entities.combinedContact) {
                intents.push('contact_complete');
            }
        }
        else if (context.isCollectingMember && hasMemberEntities) {
            intents.push('login');
            if (entities.memberAccount && entities.memberPassword) {
                intents.push('login_complete');
            }
        }
        else if (hasBookingEntities) {
            intents.push('booking');
            
            // 檢查是否提供了足夠的預訂資訊
            const essentialFields = [entities.checkInDate, entities.nights, 
                                   entities.roomType, entities.roomCount, entities.adultCount];
            const filledFields = essentialFields.filter(f => f !== undefined && f !== null);
            
            if (filledFields.length >= 3) {
                intents.push('booking_progress');
            }
        }
        // 4. 特定關鍵字意圖
        else if (lowerMsg.includes('訂房') || lowerMsg.includes('預約') || 
                lowerMsg.includes('我要訂') || lowerMsg.includes('想訂')) {
            intents.push('booking_start');
        }
        else if (lowerMsg.includes('登入') || lowerMsg.includes('會員登入')) {
            intents.push('login');
        }
        else if (lowerMsg.includes('跳過') || lowerMsg.includes('略過')) {
            intents.push('skip');
        }
        else if (lowerMsg.includes('修改') || lowerMsg.includes('重選') || 
                lowerMsg.includes('改一下')) {
            intents.push('correction');
        }
        else if (lowerMsg.match(/^(是|好|可以|ok|確認|對|要|沒錯)$/)) {
            intents.push('affirm');
        }
        else if (lowerMsg.match(/^(否|不要|不對|不|不用|錯)$/)) {
            intents.push('deny');
        }
        // 5. 查詢類意圖
        else if (lowerMsg.includes('什麼') || lowerMsg.includes('哪裡') || 
                lowerMsg.includes('如何') || lowerMsg.includes('怎麼')) {
            intents.push('general_inquiry');
        }
        // 6. 默認意圖
        else {
            intents.push('unrecognized');
        }
    }
    
    // ----------------------------------------------------
    // 🛠️ 工具函數
    // ----------------------------------------------------
    
    static _parseChineseNumber(text) {
        if (!text) return null;
        
        const chineseMap = {
            '零': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4,
            '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        };
        
        // 如果是中文數字
        if (chineseMap[text] !== undefined) {
            return chineseMap[text];
        }
        
        // 嘗試解析阿拉伯數字
        const num = parseInt(text, 10);
        return isNaN(num) ? null : num;
    }
    
    static _getDaysToWeekday(targetWeekday) {
        const today = dayjs();
        const currentWeekday = today.day();
        let daysToAdd = targetWeekday - currentWeekday;
        
        if (daysToAdd <= 0) {
            daysToAdd += 7;
        }
        
        return daysToAdd;
    }
    
    static _getDaysToWeekend() {
        const today = dayjs();
        const currentWeekday = today.day();
        
        // 如果已經是週末（週六=6，週日=0）
        if (currentWeekday === 6 || currentWeekday === 0) {
            return 0;
        }
        
        // 距離週六還有幾天
        return 6 - currentWeekday;
    }
    
    static _getDaysToMonthEnd() {
        const today = dayjs();
        const daysInMonth = today.daysInMonth();
        return daysInMonth - today.date();
    }
    
    static _getDaysToMonthStart() {
        const today = dayjs();
        return 1 - today.date(); // 負數表示已經過了月初
    }
    
    static _getLunarDate(festival) {
        // 簡化版本，實際應使用農曆計算庫
        const festivalDates = {
            '除夕': '01-24', // 2025年除夕
            '春節': '01-25'  // 2025年春節
        };
        return festivalDates[festival] || '01-01';
    }
    
    static _getQingmingDate() {
        // 清明節通常在4月4日或5日
        return '04-04';
    }
    
    static _getDragonBoatDate() {
        // 端午節在農曆5月5日，簡化為6月
        return '06-10';
    }
    
    static _getMidAutumnDate() {
        // 中秋節在農曆8月15日，簡化為9月
        return '09-15';
    }
    
    static _handleSpecialCases(message, entities, context) {
        const lowerMsg = message.toLowerCase();
        
        // 處理"沒有小孩"的情況
        if (lowerMsg.includes('沒有小孩') || lowerMsg.includes('無兒童') || 
            lowerMsg.includes('零兒童') || lowerMsg.match(/0個?小孩/)) {
            entities.childCount = 0;
        }
        
        // 處理"不需要加購"
        if (lowerMsg.includes('不需要') && (lowerMsg.includes('加購') || lowerMsg.includes('服務'))) {
            entities.addonAction = '跳過';
            entities.skipAddons = true;
        }
        
        // 處理"我自己"
        if (lowerMsg === '我自己' || lowerMsg === '我一人') {
            entities.adultCount = 1;
            entities.childCount = 0;
        }
        
        // 處理"一間就好"
        if (lowerMsg.includes('一間') && lowerMsg.includes('就好')) {
            entities.roomCount = 1;
            entities.confirmRoomCount = true;
        }
    }
}

export { SmartIntentClassifier };

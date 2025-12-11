// modular_intent_classifier.js (ESM - 完整優化版 V1.1)

/**
 * 模組化意圖分類器
 * 採用多模組加權匹配、上下文加成和智慧實體提取
 */
export class ModularIntentClassifier {
    
    // --- 靜態配置與工具 ---
    
    /** 💡 優化 1: 提取中文數字對應表 */
    static CHINESE_NUMBER_MAP = { 
        '一': 1, '兩': 2, '二': 2, '三': 3, '四': 4, '五': 5, 
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 
    };

    /**
     * @returns {number} 將中文數字字串轉換為數字
     */
    static _parseChineseNumber(str) {
        if (!str) return null;
        return this.CHINESE_NUMBER_MAP[str] || parseInt(str);
    }

    /**
     * 模組定義（根據飯店業務）
     */
    static MODULES = {
        BOOKING: {
            name: '訂房模組',
            keywords: ['訂房', '預約', '房間', '入住', 'check in', '預訂', '訂購', '訂一間', '想訂', 'book', 'booking'],
            primaryIntent: 'booking_start',
            color: '🔵',
            priority: 100 // 標準流程啟動
        },
        DATE_SELECTION: {
            name: '日期選擇模組',
            keywords: ['今天', '明天', '後天', '週一', '週二', '週三', '週四', '週五', '週六', '週日', '聖誕節', '跨年', '春節', '端午', '中秋'],
            primaryIntent: 'booking',
            color: '📅',
            priority: 90 // 重要的數據收集環節
        },
        ROOM_SELECTION: {
            name: '房型選擇模組',
            keywords: ['標準', '豪華', '行政', '家庭', '套房', '雙人房', '四人房', '親子房', '海景房'],
            primaryIntent: 'booking',
            color: '🏨',
            priority: 80
        },
        PEOPLE_COUNT: {
            name: '人數選擇模組',
            keywords: ['位', '人', '大', '大人', '小孩', '兒童', '嬰兒', '幾位', '幾人', '幾大幾小'],
            primaryIntent: 'booking',
            color: '👥',
            priority: 70
        },
        MODIFICATION: {
            name: '修改模組',
            keywords: ['修改', '更改', '重選', '換', '改一下', '調整', '重新選', '換一間'],
            primaryIntent: 'correction',
            color: '🟡',
            priority: 95 // 高於一般步驟
        },
        INQUIRY: {
            name: '查詢模組',
            keywords: ['價格', '房價', '費用', '多少錢', '貴不貴', '價位', '有房', '有空房', '查詢', '查看', '問一下'],
            primaryIntent: 'general_inquiry',
            color: '🟢',
            priority: 60
        },
        MEMBER: {
            name: '會員模組',
            keywords: ['會員', '登入', '帳號', '積分', '點數', '優惠', '登入會員', '會員登入', 'login', 'member'],
            primaryIntent: 'login',
            color: '🟣',
            priority: 85
        },
        CANCEL: {
            name: '取消模組',
            keywords: ['取消', '退訂', '退款', '不要了', '中止', '停止', '取消訂房', '不訂了'],
            primaryIntent: 'emergency_exit',
            color: '🔴',
            priority: 110 // 最高優先級：中斷流程
        },
        CONTACT: {
            name: '聯繫模組',
            keywords: ['聯絡', '電話', 'email', '郵件', '客服', 'help', '協助', '姓名', '手機', '號碼'],
            primaryIntent: 'contact_info_update',
            color: '🟠',
            priority: 75
        },
        ADDONS: {
            name: '加購模組',
            keywords: ['加購', '附加', '服務', '接送', '早餐', '晚餐', 'spa', '按摩', '香檳', '花束'],
            primaryIntent: 'addon_selection',
            color: '🎁',
            priority: 65
        },
        PAYMENT: {
            name: '付款模組',
            keywords: ['付款', '支付', '信用卡', '現金', '轉帳', 'line pay', 'apple pay', '結帳'],
            primaryIntent: 'payment',
            color: '💳',
            priority: 88
        }
    };
    
    // ------------------------------------

    /**
     * 模組化意圖分類 - 增強現有 SmartIntentClassifier
     * @param {string} message - 使用者訊息
     * @param {object} traditionalResult - 傳統分類結果
     * @param {object} session - 當前會話數據
     * @returns {object} 增強的分類結果
     */
    static classify(message, traditionalResult = {}, session = {}) {
        const lowerMsg = message.toLowerCase().trim();
        const modules = JSON.parse(JSON.stringify(this.MODULES)); // 深度複製模組以避免靜態數據汙染
        
        let totalConfidence = 0;
        let totalWeightedConfidence = 0;

        // 計算每個模組的信心分數
        for (const [key, module] of Object.entries(modules)) {
            module.confidence = 0; // 初始化
            
            // 1. 關鍵字匹配
            module.keywords.forEach(keyword => {
                if (lowerMsg.includes(keyword)) {
                    module.confidence += 2;
                }
            });
            
            // 2. 傳統意圖匹配加成
            if (traditionalResult.intents?.includes(module.primaryIntent)) {
                module.confidence += 3;
            }
            
            // 3. 上下文加成
            const sessionState = session.currentStep || session.currentState || '';
            // 檢查當前狀態是否包含模組名稱
            if (sessionState.toLowerCase().includes(key.toLowerCase().replace('_', ''))) {
                module.confidence += 1.5;
            }
            
            // 4. 訊息長度優化 (短句提高關鍵字權重)
            if (message.length < 10) {
                module.confidence *= 1.5;
            }
            
            totalConfidence += module.confidence;
            
            // 💡 優化 4: 計算並儲存加權分數，用於最終決策
            const weightedConfidence = module.confidence * (module.priority / 100);
            module.weightedConfidence = weightedConfidence;
            totalWeightedConfidence += weightedConfidence;
        }
        
        // 選擇信心最高的模組（基於加權分數）
        let selectedModule = 'GENERAL';
        let maxWeightedConfidence = 0;
        let moduleDetails = null;
        
        for (const [key, module] of Object.entries(modules)) {
            if (module.weightedConfidence > maxWeightedConfidence && module.confidence > 0) {
                maxWeightedConfidence = module.weightedConfidence;
                selectedModule = key;
                moduleDetails = module;
            }
        }
        
        // 計算信心百分比
        const confidencePercentage = totalWeightedConfidence > 0 
            ? Math.min(100, Math.round((maxWeightedConfidence / totalWeightedConfidence) * 100)) 
            : 0;
        
        // 提取智慧數據（增強傳統實體提取）
        const enhancedData = this.extractEnhancedData(message, selectedModule, traditionalResult.entities || {}, session);
        
        // 根據模組建議下一步
        const suggestedSteps = this.getSuggestedSteps(selectedModule, session, traditionalResult);
        
        // 判斷是否需要覆蓋傳統意圖
        const shouldOverrideTraditional = confidencePercentage > 70 && 
            moduleDetails && 
            moduleDetails.primaryIntent !== traditionalResult.intents?.[0];
            
        // 確定最終意圖：優先使用模組的 primaryIntent
        const finalIntent = moduleDetails?.primaryIntent || traditionalResult.intents?.[0] || 'unrecognized';

        return {
            topModule: selectedModule, // 為了與 RuleEngine 的 topModule 命名一致
            moduleName: moduleDetails?.name || '一般模組',
            moduleColor: moduleDetails?.color || '⚪',
            topIntent: finalIntent, // 為了與 RuleEngine 的 finalIntent 命名一致
            confidence: confidencePercentage,
            confidenceScore: maxWeightedConfidence,
            suggestedSteps,
            enhancedData,
            shouldOverride: shouldOverrideTraditional,
            traditionalResult: {
                intents: traditionalResult.intents || [],
                entities: traditionalResult.entities || {}
            },
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 提取增強數據
     */
    static extractEnhancedData(message, module, traditionalEntities, session) {
        const enhancedData = { ...traditionalEntities };
        const lowerMsg = message.toLowerCase();
        
        switch(module) {
            case 'BOOKING':
            case 'DATE_SELECTION':
                // 智慧日期解析
                if (!enhancedData.checkInDate) {
                    const datePatterns = [
                        /(\d{1,2})[月\/\-](\d{1,2})[日號]?/, // 12/25, 12月25日
                        /(今天|明天|後天|大後天)/,
                        /(週[一二三四五六日]|星期[一二三四五六日])/,
                        /(聖誕節|跨年|春節|清明|端午|中秋|雙十)/
                    ];
                    
                    for (const pattern of datePatterns) {
                        const match = message.match(pattern);
                        if (match) {
                            enhancedData.dateMatch = match[0];
                            break;
                        }
                    }
                }
                
                // 智慧晚數解析 (應用 _parseChineseNumber)
                if (!enhancedData.nights) {
                    const nightsMatch = message.match(/(\d+|一|兩|二|三|四|五|六|七|八|九|十)\s*(晚|天|夜|nights?|days?)/i);
                    if (nightsMatch) {
                        const num = nightsMatch[1];
                        enhancedData.nights = this._parseChineseNumber(num);
                    }
                }
                break;
                
            case 'ROOM_SELECTION':
                // 智慧房型解析
                if (!enhancedData.roomType) {
                    const roomMap = {
                        '標準': '標準雙人房', '雙人房': '標準雙人房', '豪華': '豪華客房',
                        '行政': '行政套房', '套房': '行政套房', '家庭': '家庭四人房',
                        '四人房': '家庭四人房', '親子': '家庭四人房'
                    };
                    
                    for (const [key, value] of Object.entries(roomMap)) {
                        if (message.includes(key)) {
                            enhancedData.roomType = value;
                            enhancedData.roomTypeMatched = true;
                            break;
                        }
                    }
                }
                
                // 房間數量 (應用 _parseChineseNumber)
                if (!enhancedData.roomCount) {
                    const countMatch = message.match(/(\d+|一|兩|二|三|四|五|六|七|八|九|十)\s*(間|個|room)/i);
                    if (countMatch) {
                        const num = countMatch[1];
                        enhancedData.roomCount = this._parseChineseNumber(num);
                    } else if (message.includes('一間') || message.includes('一個')) {
                        enhancedData.roomCount = 1;
                    }
                }
                break;
                
            case 'PEOPLE_COUNT':
                // 智慧人數解析 (應用 _parseChineseNumber)
                if (!enhancedData.adultCount && !enhancedData.childCount) {
                    // 格式: "2大1小"
                    const pattern1 = message.match(/(\d+|一|兩|二|三|四|五|六|七|八|九|十)\s*(大|大人|成人)\s*(\d+|一|兩|二|三|四|五|六|七|八|九|十)?\s*(小|小孩|兒童)?/i);
                    if (pattern1) {
                        const adults = pattern1[1];
                        enhancedData.adultCount = this._parseChineseNumber(adults);
                        
                        if (pattern1[3]) {
                            const children = pattern1[3];
                            enhancedData.childCount = this._parseChineseNumber(children);
                        }
                    }
                    
                    // 格式: "我們兩人"
                    const pattern2 = message.match(/(我們|一家|全家|一共)\s*(\d+|一|兩|二|三|四|五|六|七|八|九|十)\s*(人|位)/);
                    if (pattern2) {
                        const total = pattern2[2];
                        enhancedData.adultCount = this._parseChineseNumber(total);
                    }
                    
                    // 特殊情況
                    if (lowerMsg.includes('我自己') || lowerMsg.includes('一個人')) {
                        enhancedData.adultCount = 1;
                        enhancedData.childCount = 0;
                    }
                }
                break;
                
            case 'CONTACT':
                // 智慧聯繫資訊解析 (簡化，主要依靠 Regex)
                // 姓名
                const nameMatch = message.match(/(?:姓名|名字|我叫|我是|聯絡人)[:：]?\s*([\u4e00-\u9fa5]{2,4})/);
                if (nameMatch) enhancedData.contactName = nameMatch[1];
                
                // 電話
                const phoneMatch = message.match(/(?:電話|手機|號碼)[:：]?\s*(\d{8,11})|\b(\d{8,11})\b/);
                if (phoneMatch) enhancedData.contactPhone = phoneMatch[1] || phoneMatch[2];
                
                // Email
                const emailMatch = message.match(/([\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) enhancedData.contactEmail = emailMatch[1];
                
                // 組合格式: "王大明, 0912345678, wang@example.com"
                const combinedMatch = message.match(/([\u4e00-\u9fa5]{2,4})\s*[,，]\s*(\d{8,11})\s*[,，]\s*([\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/);
                if (combinedMatch) {
                    enhancedData.contactName = combinedMatch[1];
                    enhancedData.contactPhone = combinedMatch[2];
                    enhancedData.contactEmail = combinedMatch[3];
                    enhancedData.combinedContact = true;
                }
                break;
                
            case 'MEMBER':
                // 會員資訊解析
                if (!enhancedData.memberAccount) {
                    const accountMatch = message.match(/(?:帳號|賬號|account)[:：]?\s*(\S+)/i);
                    if (accountMatch) enhancedData.memberAccount = accountMatch[1];
                    else if (message.match(/\d{8,11}/)) enhancedData.memberAccount = message.match(/\d{8,11}/)[0];
                    else if (message.includes('@')) enhancedData.memberAccount = message.split(/\s+/).find(part => part.includes('@'));
                }
                break;
        }
        
        return enhancedData;
    }
    
    /**
     * 獲取建議步驟
     */
    static getSuggestedSteps(module, session, traditionalResult) {
        const currentState = session.currentStep || session.currentState || 'init';
        const steps = [];
        
        // 根據模組和當前狀態提供下一步建議
        // 這些建議主要是給 RuleEngine 作為決策參考的註記
        switch(module) {
            case 'BOOKING':
                if (currentState === 'init') {
                    steps.push('詢問入住日期');
                    steps.push('確認住宿晚數');
                } else if (currentState.includes('date')) {
                    steps.push('確認日期是否正確');
                    steps.push('詢問住宿晚數');
                } 
                break;
                
            case 'DATE_SELECTION':
                steps.push('確認入住日期');
                steps.push('詢問住宿晚數');
                steps.push('提供可訂房日期建議');
                break;
                
            case 'CONTACT':
                if (!session.collectedData?.contactName) {
                    steps.push('請提供聯絡人姓名');
                } else if (!session.collectedData?.contactPhone) {
                    steps.push('請提供手機號碼');
                }
                break;
                
            case 'MEMBER':
                steps.push('詢問會員帳號');
                steps.push('驗證會員身份');
                break;
                
            default:
                steps.push('理解使用者需求');
        }
        
        return steps;
    }
    
    /**
     * 產生模組化建議回應 (主要作為備用，實際回應由 RuleEngine 的 Flow Config 控制)
     */
    static generateModuleResponse(moduleResult, session) {
        const responses = {
            BOOKING: {
                init: "歡迎使用！請問您想預訂哪一天的房間？",
                date_selected: "好的，請問您要住宿幾晚呢？",
            },
            DATE_SELECTION: {
                general: "請告訴我您的入住日期（例如：12月25日、明天）",
            },
            CONTACT: {
                missing_name: "請問聯絡人姓名是？",
                missing_phone: "請提供聯絡電話",
            }
        };
        
        const module = moduleResult.topModule;
        const currentState = session.currentStep || 'init';
        
        if (responses[module] && responses[module][currentState]) {
            return responses[module][currentState];
        }
        
        return `正在處理您的${moduleResult.moduleName}需求...`;
    }
}

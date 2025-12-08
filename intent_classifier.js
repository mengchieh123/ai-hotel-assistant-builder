// SmartIntentClassifier.js - V3.9 修正版 (核心：調降通用查詢優先級)

/**
 * 意圖分類器 (SmartIntentClassifier.js)
 * 負責根據用戶輸入和當前狀態，判斷最高優先級的下一步 Step/Intent。
 * * 修正歷史：
 * V3.9: 修正 handle_general_inquiry (通用查詢/閒聊) 的優先級，從 104 降至 90，
 * 確保流程推進 (P:97) 或邏輯回退 (P:98/95) 不會被通用查詢打斷。
 */

// 假設這是一個模擬的實體解析器，用於從輸入中提取關鍵資訊
const entityRecognizer = require('./entity_recognizer'); 

// --- 輔助函數：意圖條件檢查 ---

/**
 * 檢查輸入中是否明確包含否定意圖 (例如: "不要", "取消", "不用了")
 */
function isExplicitlyNegative(input) {
    if (!input) return false;
    const negationKeywords = ['不要', '取消', '不用', '算了', '不訂了'];
    return negationKeywords.some(keyword => input.includes(keyword));
}

/**
 * 檢查輸入中是否明確包含肯定意圖 (例如: "好", "要", "確認", "繼續")
 */
function isExplicitlyAffirmative(input) {
    if (!input) return false;
    const affirmationKeywords = ['好', '要', '確認', '繼續', '是的', '訂', '付款'];
    return affirmationKeywords.some(keyword => input.includes(affirmationKeywords));
}

// --- 意圖規則定義 ---

// 規則結構:
// {
//     priority: number, 
//     step: string, 
//     condition: (session, input) => boolean,
//     entities: string[] (可選，指示需要解析的實體)
// }

const intentRules = [
    // --- 核心流程控制 (最高優先級) ---
    
    // 1. 強制重置流程 (最高優先級：防止卡死)
    {
        priority: 120,
        step: 'init',
        condition: (session, input) => input && (input.includes('重設') || input.includes('重新開始') || input.includes('init'))
    },

    // 2. 訂房修改/更正意圖 (流程中斷，但次於重置)
    {
        priority: 110,
        step: 'handle_correction',
        condition: (session, input) => input && (input.includes('修改') || input.includes('更正') || input.includes('不對'))
    },
    
    // 3. 通用肯定意圖 (例如：在確認訂單摘要時輸入"確認" 或 "是")
    {
        priority: 100,
        step: 'affirm',
        condition: (session, input) => isExplicitlyAffirmative(input) && (session.currentStep === 'confirm_summary' || session.currentStep === 'ask_member_login')
    },
    
    // 4. 通用否定意圖 (例如：在詢問是否登入時輸入"否")
    {
        priority: 100,
        step: 'negate',
        condition: (session, input) => isExplicitlyNegative(input) && (session.currentStep === 'confirm_summary' || session.currentStep === 'ask_member_login' || session.currentStep === 'ask_addons')
    },
    
    // --- 流程特定意圖 (通常在 P:95-98 之間，由 Rule Engine 控制推進) ---
    
    // 5. 聯絡資訊收集
    {
        priority: 98,
        step: 'ask_contact_info',
        condition: (session, input, entities) => session.currentStep === 'ask_contact_info' && entities.contactName && entities.contactPhone
    },
    
    // 6. 會員登入
    {
        priority: 98,
        step: 'login_member_account',
        condition: (session, input, entities) => session.currentStep === 'login_member_account' && entities.memberAccount && entities.memberPassword
    },
    
    // 7. 處理加購服務選擇
    {
        priority: 98,
        step: 'execute_addons_selection',
        condition: (session, input, entities) => session.currentStep === 'ask_addons' && entities.addonSelection,
        entities: ['addonSelection'] // 假設 addonSelection 是一個從 RichCard 回傳的特殊實體
    },
    
    // 8. 收集日期/晚數 (如果只輸入日期或晚數)
    {
        priority: 97,
        step: 'handle_date_not_found',
        condition: (session, input, entities) => (session.currentStep === 'ask_nights_and_dates' || session.currentStep === 'handle_date_not_found') && (entities.checkInDate || entities.nights)
    },
    
    // 9. 房型選擇
    {
        priority: 97,
        step: 'show_room_types',
        condition: (session, input, entities) => session.currentStep === 'show_room_types' && entities.roomType,
        entities: ['roomType']
    },

    // 10. 房數輸入 (確保是數字)
    {
        priority: 97,
        step: 'ask_room_count',
        condition: (session, input, entities) => session.currentStep === 'ask_room_count' && entities.roomCount && !isNaN(parseInt(entities.roomCount))
    },

    // 11. 人數輸入 (確保是數字)
    {
        priority: 97,
        step: 'ask_guest_count',
        condition: (session, input, entities) => session.currentStep === 'ask_guest_count' && entities.adultCount && !isNaN(parseInt(entities.adultCount))
    },

    // --- 通用查詢 (Fallback) ---
    
    /**
     * !!! V3.9 關鍵修正 !!!
     * 12. handle_general_inquiry (通用查詢/閒聊)
     * 優先級從 P:104 降至 P:90，確保在關鍵流程狀態下不會截斷流程。
     */
    {
        priority: 90, 
        step: 'handle_general_inquiry',
        condition: (session, input) => input && input.trim().length > 0
    }
];

// --- 核心分類邏輯 ---

/**
 * 根據當前狀態和用戶輸入，找出最高優先級的意圖。
 * @param {object} session - 當前 session 數據。
 * @param {string} input - 用戶的原始輸入。
 * @returns {object} 包含最高優先級意圖的 Step 和 Priority。
 */
function classifyIntent(session, input) {
    if (!input || input.trim() === '') {
        return { step: null, priority: 0 };
    }
    
    // 模擬實體解析 (假設 entityRecognizer.extract(input) 返回一個實體物件)
    const entities = entityRecognizer.extract(input) || {};

    let highestPriority = 0;
    let bestMatch = null;

    for (const rule of intentRules) {
        try {
            // 檢查規則條件是否滿足
            if (rule.condition(session, input, entities)) {
                if (rule.priority > highestPriority) {
                    highestPriority = rule.priority;
                    bestMatch = rule;
                }
            }
        } catch (e) {
            console.error(`Error processing rule ${rule.step}: ${e.message}`);
        }
    }

    if (bestMatch) {
        return {
            step: bestMatch.step,
            priority: bestMatch.priority,
            // 選擇性地將解析到的實體包含在回傳中，供 RuleEngine 使用
            entities: entities
        };
    }

    // 如果沒有任何規則匹配，則返回空
    return { step: null, priority: 0, entities: entities };
}

module.exports = {
    classifyIntent
};

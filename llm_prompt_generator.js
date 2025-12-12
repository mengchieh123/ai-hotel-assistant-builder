// llm_prompt_generator.js (V3.0 - 強化通用性與穩定性)

import { LLMManager } from './llm_manager.js'; // 依賴 LLMManager 提供的 API 接口

const CONVERSATIONAL_TONE = "親切、專業、帶有台灣服務業特有的熱情與禮貌，語氣中性但積極。";
const LLM_DEFAULT_CHAR_LIMIT = "30~50 字內"; // 讓 LLM 盡量簡潔

// 輔助函數：硬編碼提示的插值
function interpolatePrompt(promptTemplate, data) {
    if (!promptTemplate || typeof promptTemplate !== 'string') return promptTemplate;
    return promptTemplate.replace(/\{(\w+)\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

// 🎯 輔助函數：生成情境描述
function generateContextDescription(targetStateKey, sessionData) {
    const data = sessionData;
    let description = `用戶當前位於訂房流程的 ${targetStateKey} 步驟。`;

    if (targetStateKey === 'ask_contact_info') {
        const roomInfo = `${data.roomType || '房型'} x ${data.roomCount || 1} 間`;
        description = `這是訂房流程的最後一步：收集聯絡資訊。用戶已選擇 ${roomInfo}，總價約為 ${data.finalPrice || '尚未計算'} 元。任務是詢問聯絡姓名、電話和 Email。`;
    } else if (targetStateKey === 'confirm_booking') {
        description = `這是最終的預訂確認步驟。用戶已提供所有資訊。請禮貌性地提醒用戶檢查所有資訊，並強調這筆交易的最終總價 (${data.finalPrice || '未知'} 元)。`;
    } else if (targetStateKey === 'ask_room_type') {
         // 🎯 擴展通用性：處理房型選擇
         const nightsText = data.nights ? `共 ${data.nights} 晚` : '晚數未定';
         description = `用戶剛完成日期和人數輸入。請引導他們從可用的房型中進行選擇。已訂 ${nightsText}，人數 ${data.adultCount || 1} 大。`;
    }
    
    return description;
}


class PromptGenerator {

    /**
     * 統一的提示生成接口。
     */
    static async generatePrompt(targetStateKey, sessionData, flowConfig) {
        
        const state = flowConfig.states[targetStateKey];
        const basePromptTemplate = state?.prompt || "請繼續完成您的預訂流程。";
        const requiredEntities = state?.entities || [];
        
        // 1. 構建詳細的情境描述
        const contextDescription = generateContextDescription(targetStateKey, sessionData);
        
        // 2. 構建給 LLM 的 System Instruction
        const systemInstruction = `
            您是一位親切專業的旅館訂房助理。
            - 您的**語氣**必須是：${CONVERSATIONAL_TONE}
            - 必須強調**情境**：根據提供的 Context 描述，將提示包裝成自然流暢、帶有溫度、人性化的對話。
            - 必須包含**目標**：明確且禮貌地引導用戶提供所需的資訊 (${requiredEntities.join(', ')}) 或進行所需的操作。
            - 格式：只輸出生成的提示文本，不要有任何多餘的標籤或註釋。
            - **字數限制**：請將回覆控制在 ${LLM_DEFAULT_CHAR_LIMIT}，簡潔明瞭。

            ---
            [當前情境]：${contextDescription}
            [用戶已提供關鍵資訊]：${JSON.stringify(sessionData, null, 2)} 
            [目標狀態要求 (硬編碼 Prompt)]：${interpolatePrompt(basePromptTemplate, sessionData)}
            ---
            請根據以上資訊，為用戶生成一個自然的對話提示。
        `;

        try {
            // 3. 呼叫 LLM Manager 服務
            const dynamicPrompt = await LLMManager.callDynamicPrompt(systemInstruction);

            return dynamicPrompt;

        } catch (error) {
            console.error(`💥 LLM 提示生成失敗，啟用安全回退: ${error.message}`);
            // 4. 安全回退：失敗時，返回原始的硬編碼提示（進行插值）
            return interpolatePrompt(basePromptTemplate, sessionData);
        }
    }
}

export { PromptGenerator };

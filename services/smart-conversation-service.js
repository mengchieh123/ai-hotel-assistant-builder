/**
 * 智能對話服務
 * 整合 OpenAI + 模擬資料
 */

const openaiService = require('./openai-service');
const mockDataService = require('./mock-data-service');

class SmartConversationService {
    async chat(sessionId, userId, message) {
        try {
            // 1. 獲取對話歷史
            const history = await mockDataService.getConversationHistory(sessionId, 5);
            
            // 2. 分析意圖和提取實體
            const analysis = await this.analyzeMessage(message, history);
            
            // 3. 查詢相關數據
            const relevantData = await this.fetchRelevantData(analysis);
            
            // 4. 構建增強提示
            const enhancedPrompt = this.buildEnhancedPrompt(analysis, relevantData);
            
            // 5. 生成回覆
            const response = await openaiService.chat(message, [
                { role: 'system', content: enhancedPrompt },
                ...history.map(h => ({ role: h.role, content: h.content }))
            ]);
            
            // 6. 保存對話
            await mockDataService.saveConversation(sessionId, 'user', message, {
                intent: analysis.intent,
                entities: analysis.entities
            });
            
            await mockDataService.saveConversation(sessionId, 'assistant', response.message, {
                intent: analysis.intent
            });
            
            return {
                ...response,
                intent: analysis.intent,
                entities: analysis.entities,
                context: {
                    hasData: !!relevantData.rooms || !!relevantData.pricing,
                    roomCount: relevantData.rooms ? relevantData.rooms.length : 0
                }
            };
        } catch (error) {
            console.error('Smart Chat Error:', error);
            return {
                success: false,
                error: error.message,
                fallback: '抱歉，我現在無法處理您的請求。請稍後再試或聯繫客服：+886-2-2523-8000'
            };
        }
    }

    async analyzeMessage(message, history) {
        const systemPrompt = `分析用戶消息的意圖並提取關鍵信息。

支持的意圖：
- BOOKING: 預訂房間
- INQUIRY_ROOM: 查詢房型
- INQUIRY_PRICE: 查詢價格
- INQUIRY_FACILITY: 查詢設施
- RECOMMENDATION: 尋求推薦
- GREETING: 問候
- OTHER: 其他

返回 JSON 格式：
{
  "intent": "意圖類型",
  "confidence": 0.95,
  "entities": {
    "guests": 2,
    "checkIn": "2025-11-10",
    "checkOut": "2025-11-12",
    "budget": 5000,
    "preferences": ["安靜", "景觀"]
  }
}`;

        try {
            const response = await openaiService.chat(message, [
                { role: 'system', content: systemPrompt }
            ]);

            const cleaned = response.message
                .replace(/```
                .replace(/```\n?/g, '')
                .trim();
            
            return JSON.parse(cleaned);
        } catch (error) {
            console.error('分析錯誤:', error);
            return {
                intent: 'OTHER',
                confidence: 0,
                entities: {}
            };
        }
    }

    async fetchRelevantData(analysis) {
        const data = {};
        const { intent, entities } = analysis;

        try {
            switch (intent) {
                case 'BOOKING':
                case 'RECOMMENDATION':
                    data.rooms = await mockDataService.getAvailableRooms({
                        guests: entities.guests,
                        budget: entities.budget,
                        preferences: entities.preferences,
                        checkIn: entities.checkIn
                    });
                    break;

                case 'INQUIRY_ROOM':
                    data.rooms = await mockDataService.getAvailableRooms({
                        guests: entities.guests
                    });
                    break;

                case 'INQUIRY_PRICE':
                    if (entities.roomId && entities.checkIn && entities.checkOut) {
                        data.pricing = await mockDataService.calculatePrice(
                            entities.roomId,
                            entities.checkIn,
                            entities.checkOut
                        );
                    }
                    break;
            }
        } catch (error) {
            console.error('獲取數據錯誤:', error);
        }

        return data;
    }

    buildEnhancedPrompt(analysis, relevantData) {
        let prompt = `你是台北晶華酒店的專業 AI 客服助手。

用戶意圖: ${analysis.intent}
收集信息: ${JSON.stringify(analysis.entities, null, 2)}

`;

        // 添加真實房型數據
        if (relevantData.rooms && relevantData.rooms.length > 0) {
            prompt += `\n可用房型（真實數據）:\n`;
            relevantData.rooms.forEach((room, index) => {
                prompt += `
${index + 1}. ${room.name} (${room.nameEn})
   • 面積: ${room.size}㎡
   • 可住: ${room.maxGuests}人
   • 樓層: ${room.floor}
   • 景觀: ${room.view}
   • 價格: 平日 $${room.basePrice}/晚，週末 $${room.weekendPrice}/晚
   • 剩餘: ${room.availableRooms} 間
   • 設施: ${room.amenities.join('、')}
   • 描述: ${room.description}
`;
            });
        }

        // 添加價格明細
        if (relevantData.pricing) {
            const p = relevantData.pricing;
            prompt += `\n價格明細（${p.roomName}，${p.nights}晚）:
• 房費: $${p.breakdown.roomPrice}
• 服務費: $${p.breakdown.serviceFee}
• 稅金: $${p.breakdown.tax}
• 總計: $${p.breakdown.total}

平日/週末價格: $${p.pricePerNight.weekday} / $${p.pricePerNight.weekend}
`;
        }

        prompt += `\n回答要求:
1. 使用上述真實數據，不要編造
2. 如果數據不足，禮貌詢問缺失信息
3. 專業、友善、簡潔（150字內）
4. 主動提供建議
5. 預訂時確認所有細節後給出訂單號格式：BK1001`;

        return prompt;
    }
}

module.exports = new SmartConversationService();

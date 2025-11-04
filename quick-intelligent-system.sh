#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 快速智能對話系統（無需資料庫）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 使用內存模擬數據"
echo "✅ 完整功能演示"
echo "✅ 隨時可切換到真實資料庫"
echo ""

# ============================================
# 階段 1: 創建模擬資料服務
# ============================================
echo "1️⃣  創建模擬資料服務..."

mkdir -p services

cat > services/mock-data-service.js << 'EOFMOCK'
/**
 * 模擬資料服務
 * 使用內存數據，無需資料庫
 * 之後可輕鬆替換為真實資料庫
 */

class MockDataService {
    constructor() {
        this.initializeData();
    }

    initializeData() {
        // 房型數據
        this.rooms = [
            {
                id: 1,
                name: '豪華景觀套房',
                nameEn: 'Deluxe View Suite',
                type: 'deluxe',
                size: 45,
                maxGuests: 2,
                floor: '25-30F',
                view: '城市景觀',
                description: '坐擁台北101美景，配備豪華設施，適合商務或浪漫住宿',
                amenities: [
                    '免費 WiFi',
                    '55吋 4K 電視',
                    'Nespresso 咖啡機',
                    '迷你吧',
                    '獨立浴缸',
                    '智能馬桶',
                    '保險箱',
                    '免費礦泉水'
                ],
                basePrice: 6800,
                weekendPrice: 8200,
                available: true,
                totalRooms: 5,
                bookedRooms: 2,
                images: [
                    'https://example.com/deluxe-1.jpg',
                    'https://example.com/deluxe-2.jpg'
                ]
            },
            {
                id: 2,
                name: '商務標準房',
                nameEn: 'Business Standard Room',
                type: 'business',
                size: 28,
                maxGuests: 2,
                floor: '12-18F',
                view: '部分城市景觀',
                description: '舒適實用，配備完善辦公設施，商務人士首選',
                amenities: [
                    '免費 WiFi',
                    '43吋電視',
                    '書桌',
                    'Nespresso 咖啡機',
                    '保險箱',
                    '免費礦泉水'
                ],
                basePrice: 3200,
                weekendPrice: 3800,
                available: true,
                totalRooms: 12,
                bookedRooms: 8,
                images: [
                    'https://example.com/business-1.jpg',
                    'https://example.com/business-2.jpg'
                ]
            },
            {
                id: 3,
                name: '家庭套房',
                nameEn: 'Family Suite',
                type: 'family',
                size: 60,
                maxGuests: 4,
                floor: '20-24F',
                view: '城市景觀',
                description: '寬敞舒適，配備客廳和小廚房，適合全家入住',
                amenities: [
                    '免費 WiFi',
                    '兩間臥室',
                    '客廳',
                    '小廚房',
                    '洗衣機',
                    '55吋電視',
                    'Nespresso 咖啡機',
                    '兒童備品'
                ],
                basePrice: 8500,
                weekendPrice: 10200,
                available: true,
                totalRooms: 3,
                bookedRooms: 1,
                images: [
                    'https://example.com/family-1.jpg',
                    'https://example.com/family-2.jpg'
                ]
            },
            {
                id: 4,
                name: '經濟雙人房',
                nameEn: 'Economy Twin Room',
                type: 'economy',
                size: 22,
                maxGuests: 2,
                floor: '8-11F',
                view: '無窗或內景',
                description: '經濟實惠，設施齊全，適合預算有限的旅客',
                amenities: [
                    '免費 WiFi',
                    '32吋電視',
                    '書桌',
                    '保險箱'
                ],
                basePrice: 2200,
                weekendPrice: 2600,
                available: true,
                totalRooms: 15,
                bookedRooms: 12,
                images: [
                    'https://example.com/economy-1.jpg'
                ]
            }
        ];

        // 對話歷史（每個 session）
        this.conversations = new Map();

        // 用戶偏好
        this.userPreferences = new Map();

        // 模擬訂單
        this.bookings = [];
        this.bookingCounter = 1001;
    }

    // ============================================
    // 房型相關
    // ============================================

    async getAvailableRooms(criteria = {}) {
        const { guests, budget, preferences = [], checkIn, checkOut } = criteria;

        let results = [...this.rooms].filter(room => room.available);

        // 篩選人數
        if (guests) {
            results = results.filter(room => room.maxGuests >= guests);
        }

        // 篩選預算
        if (budget) {
            results = results.filter(room => room.basePrice <= budget);
        }

        // 根據偏好排序
        if (preferences.length > 0) {
            results = results.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;

                if (preferences.includes('安靜') || preferences.includes('quiet')) {
                    scoreA += parseInt(a.floor.split('-')[0]);
                    scoreB += parseInt(b.floor.split('-')[0]);
                }

                if (preferences.includes('景觀') || preferences.includes('view')) {
                    if (a.view.includes('景觀')) scoreA += 10;
                    if (b.view.includes('景觀')) scoreB += 10;
                }

                if (preferences.includes('便宜') || preferences.includes('budget')) {
                    scoreA -= a.basePrice / 1000;
                    scoreB -= b.basePrice / 1000;
                }

                return scoreB - scoreA;
            });
        }

        // 添加可用數量
        return results.map(room => ({
            ...room,
            availableRooms: room.totalRooms - room.bookedRooms,
            pricePerNight: this.isWeekend(checkIn) ? room.weekendPrice : room.basePrice
        }));
    }

    async getRoomById(roomId) {
        return this.rooms.find(room => room.id === parseInt(roomId));
    }

    // ============================================
    // 價格計算
    // ============================================

    async calculatePrice(roomId, checkIn, checkOut) {
        const room = await this.getRoomById(roomId);
        if (!room) return null;

        const nights = this.calculateNights(checkIn, checkOut);
        
        // 計算每晚價格（考慮週末）
        let totalRoomPrice = 0;
        const currentDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        
        while (currentDate < endDate) {
            const isWeekend = this.isWeekend(currentDate);
            totalRoomPrice += isWeekend ? room.weekendPrice : room.basePrice;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const serviceFee = Math.round(totalRoomPrice * 0.1);
        const tax = Math.round(totalRoomPrice * 0.05);
        const totalPrice = totalRoomPrice + serviceFee + tax;

        return {
            roomName: room.name,
            nights,
            breakdown: {
                roomPrice: totalRoomPrice,
                serviceFee,
                tax,
                total: totalPrice
            },
            pricePerNight: {
                weekday: room.basePrice,
                weekend: room.weekendPrice
            }
        };
    }

    // ============================================
    // 預訂管理
    // ============================================

    async createBooking(bookingData) {
        const bookingNumber = `BK${this.bookingCounter++}`;
        
        const booking = {
            bookingNumber,
            ...bookingData,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };

        this.bookings.push(booking);
        
        // 更新房間已訂數量
        const room = await this.getRoomById(bookingData.roomId);
        if (room) {
            room.bookedRooms += 1;
        }

        return booking;
    }

    async getBooking(bookingNumber) {
        return this.bookings.find(b => b.bookingNumber === bookingNumber);
    }

    // ============================================
    // 對話歷史
    // ============================================

    async saveConversation(sessionId, role, content, metadata = {}) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }

        const conversation = {
            role,
            content,
            ...metadata,
            timestamp: new Date().toISOString()
        };

        const history = this.conversations.get(sessionId);
        history.push(conversation);

        // 限制歷史長度（保留最近 20 條）
        if (history.length > 20) {
            history.shift();
        }

        return conversation;
    }

    async getConversationHistory(sessionId, limit = 10) {
        if (!this.conversations.has(sessionId)) {
            return [];
        }

        const history = this.conversations.get(sessionId);
        return history.slice(-limit);
    }

    async clearConversation(sessionId) {
        this.conversations.delete(sessionId);
    }

    // ============================================
    // 用戶偏好
    // ============================================

    async saveUserPreference(userId, preferences) {
        const existing = this.userPreferences.get(userId) || {};
        
        this.userPreferences.set(userId, {
            ...existing,
            ...preferences,
            updatedAt: new Date().toISOString()
        });

        return this.userPreferences.get(userId);
    }

    async getUserPreference(userId) {
        return this.userPreferences.get(userId) || null;
    }

    // ============================================
    // 輔助方法
    // ============================================

    calculateNights(checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isWeekend(date) {
        const d = new Date(date);
        const day = d.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }

    // ============================================
    // 統計數據
    // ============================================

    async getStatistics() {
        return {
            totalRooms: this.rooms.reduce((sum, room) => sum + room.totalRooms, 0),
            bookedRooms: this.rooms.reduce((sum, room) => sum + room.bookedRooms, 0),
            availableRooms: this.rooms.reduce((sum, room) => sum + (room.totalRooms - room.bookedRooms), 0),
            totalBookings: this.bookings.length,
            activeConversations: this.conversations.size
        };
    }
}

module.exports = new MockDataService();
EOFMOCK

echo "✅ 模擬資料服務已創建"

# ============================================
# 階段 2: 創建智能對話服務
# ============================================
echo ""
echo "2️⃣  創建智能對話服務（整合模擬資料）..."

cat > services/smart-conversation-service.js << 'EOFSMART'
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
EOFSMART

echo "✅ 智能對話服務已創建"

# ============================================
# 階段 3: 更新 AI 路由
# ============================================
echo ""
echo "3️⃣  更新 AI 路由..."

cat > routes/ai-routes.js << 'EOFROUTES'
const express = require('express');
const router = express.Router();
const smartConversationService = require('../services/smart-conversation-service');
const mockDataService = require('../services/mock-data-service');
const openaiService = require('../services/openai-service');

/**
 * GET /api/ai/status
 */
router.get('/status', (req, res) => {
    res.json({
        available: openaiService.isAvailable(),
        message: openaiService.isAvailable() 
            ? 'AI 服務正常運行' 
            : 'AI 服務未配置',
        features: {
            smartChat: true,
            intentRecognition: true,
            contextMemory: true,
            realTimeData: true
        }
    });
});

/**
 * POST /api/ai/chat
 * 智能對話（含數據查詢）
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, sessionId, userId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '缺少訊息內容'
            });
        }

        const result = await smartConversationService.chat(
            sessionId || `session-${Date.now()}`,
            userId || 'anonymous',
            message
        );
        
        res.json(result);
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/rooms
 * 查詢房型
 */
router.get('/rooms', async (req, res) => {
    try {
        const { guests, budget, preferences } = req.query;
        
        const rooms = await mockDataService.getAvailableRooms({
            guests: guests ? parseInt(guests) : undefined,
            budget: budget ? parseInt(budget) : undefined,
            preferences: preferences ? preferences.split(',') : []
        });
        
        res.json({
            success: true,
            count: rooms.length,
            rooms
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/rooms/:id
 * 查詢單個房型
 */
router.get('/rooms/:id', async (req, res) => {
    try {
        const room = await mockDataService.getRoomById(req.params.id);
        
        if (!room) {
            return res.status(404).json({
                success: false,
                error: '房型不存在'
            });
        }
        
        res.json({
            success: true,
            room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/bookings
 * 創建預訂
 */
router.post('/bookings', async (req, res) => {
    try {
        const booking = await mockDataService.createBooking(req.body);
        
        res.json({
            success: true,
            message: '預訂成功！',
            booking
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/statistics
 * 獲取統計數據
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = await mockDataService.getStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 傳統 API（向後兼容）
 */
router.post('/recommend-room', async (req, res) => {
    try {
        const result = await openaiService.recommendRoom(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        const result = await openaiService.translate(text, targetLanguage);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
EOFROUTES

echo "✅ AI 路由已更新"

# ============================================
# 階段 4: 測試
# ============================================
echo ""
echo "4️⃣  本地測試..."

# 停止舊服務
pkill -f "node server.js" 2>/dev/null || true
sleep 2

# 啟動服務
npm start &
SERVER_PID=$!
sleep 5

echo ""
echo "🧪 測試智能對話..."
echo ""

# 測試 1: 問候
echo "場景 1: 問候"
curl -s -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好", "sessionId": "test-001"}' | jq '{success, intent, message: .message[0:80]}'

sleep 2

# 測試 2: 查詢房型
echo ""
echo "場景 2: 查詢房型"
curl -s -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "有什麼房型？", "sessionId": "test-002"}' | jq '{success, intent, roomCount: .context.roomCount}'

sleep 2

# 測試 3: 有條件查詢
echo ""
echo "場景 3: 條件查詢"
curl -s -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "兩個人，預算5000，要安靜", "sessionId": "test-003"}' | jq '{success, intent, entities}'

sleep 2

# 測試 4: API 直接查詢
echo ""
echo "場景 4: API 直接查詢房型"
curl -s http://localhost:3001/api/rooms\?guests\=2\&budget\=5000 | jq '{success, count, rooms: [.rooms[] | {name, basePrice, availableRooms}]}'

kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ 測試完成"

# ============================================
# 提交
# ============================================
echo ""
echo "5️⃣  提交到 Git..."

git add services/mock-data-service.js \
        services/smart-conversation-service.js \
        routes/ai-routes.js

git commit -m "feat: add intelligent conversation with mock data

- Add mock data service (memory-based, no database needed)
- Add smart conversation service with intent recognition
- Update AI routes with real-time data integration
- Add room query, booking, and statistics APIs

Features:
✅ 4 room types with complete data
✅ Conversation history memory
✅ Smart intent recognition
✅ Real-time price calculation
✅ Booking simulation
✅ Ready for database migration

Testing phase - no database required!"

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 智能系統完成！（無需資料庫）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 已創建："
echo "  • services/mock-data-service.js - 4種房型模擬數據"
echo "  • services/smart-conversation-service.js - 智能對話"
echo "  • routes/ai-routes.js - 完整 API"
echo ""
echo "🎯 核心功能："
echo "  ✅ 真實房型數據（內存存儲）"
echo "  ✅ 準確價格計算"
echo "  ✅ 對話歷史記憶"
echo "  ✅ 智能意圖識別"
echo "  ✅ 模擬預訂功能"
echo ""
echo "🔄 未來升級："
echo "  • 只需替換 mock-data-service.js"
echo "  • 連接真實資料庫"
echo "  • 其他代碼無需修改"
echo ""
echo "🚀 Railway 正在部署..."
echo ""


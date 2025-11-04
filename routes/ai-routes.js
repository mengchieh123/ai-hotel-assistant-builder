const express = require('express');
const router = express.Router();

// 動態加載 AI 服務
let aiService;
let serviceType = 'none';

function loadAIService() {
    try {
        // 嘗試加載 mock 服務（優先用於測試）
        const mockService = require('../services/mock-ai-service');
        if (mockService && mockService.isAvailable()) {
            aiService = mockService;
            serviceType = 'mock';
            console.log('✅ 使用模擬 AI 服務');
            return true;
        }
    } catch (error) {
        console.log('⚠️  模擬服務加載失敗:', error.message);
    }

    try {
        // 嘗試加載 OpenAI 服務
        const openaiService = require('../services/openai-service');
        if (openaiService && openaiService.isAvailable()) {
            aiService = openaiService;
            serviceType = 'openai';
            console.log('✅ 使用 OpenAI 服務');
            return true;
        }
    } catch (error) {
        console.log('⚠️  OpenAI 服務加載失敗:', error.message);
    }

    console.log('❌ 所有 AI 服務加載失敗');
    return false;
}

// 初始化服務
loadAIService();

// GET /api/ai/status - 修復循環引用問題
router.get('/status', (req, res) => {
    const isAvailable = aiService && typeof aiService.isAvailable === 'function' && aiService.isAvailable();
    
    // 不要嘗試序列化整個 aiService 對象
    res.json({
        available: isAvailable,
        service: serviceType,
        message: isAvailable ? 'AI 服務正常運行' : 'AI 服務未配置',
        timestamp: new Date().toISOString()
    });
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
    try {
        if (!aiService || typeof aiService.chat !== 'function') {
            return res.json({
                success: false,
                message: '抱歉，AI 服務暫時不可用。請稍後再試。',
                error: 'Service not available'
            });
        }

        const { message, sessionId } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: '請輸入有效的訊息內容',
                error: 'Invalid message'
            });
        }

        console.log(`📨 收到訊息: ${message.substring(0, 50)}...`);
        
        const result = await aiService.chat(message, sessionId || 'default');
        
        // 確保返回正確格式
        if (result && result.message) {
            res.json({
                success: true,
                message: result.message,
                sessionId: result.sessionId || sessionId,
                service: serviceType
            });
        } else {
            res.json({
                success: false,
                message: '抱歉，我暫時無法回答您的問題。',
                error: 'No response generated'
            });
        }

    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({
            success: false,
            message: '抱歉，處理您的請求時發生錯誤。',
            error: error.message
        });
    }
});

// POST /api/ai/recommend-room
router.post('/recommend-room', async (req, res) => {
    try {
        if (!aiService || typeof aiService.recommendRoom !== 'function') {
            return res.json({
                success: false,
                message: 'AI 服務不可用'
            });
        }

        const result = await aiService.recommendRoom(req.body);
        res.json(result);

    } catch (error) {
        console.error('❌ Recommendation Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();

// 智能選擇服務：嘗試 OpenAI，失敗則使用模擬服務
let aiService;
let serviceName = 'unknown';

try {
    const openaiService = require('../services/openai-service');
    if (openaiService && openaiService.isAvailable && openaiService.isAvailable()) {
        aiService = openaiService;
        serviceName = 'OpenAI';
        console.log('✅ 使用 OpenAI 服務');
    } else {
        aiService = require('../services/mock-ai-service');
        serviceName = 'Mock';
        console.log('⚠️  OpenAI 不可用，使用模擬服務');
    }
} catch (error) {
    console.log('⚠️  加載 OpenAI 失敗，使用模擬服務');
    aiService = require('../services/mock-ai-service');
    serviceName = 'Mock';
}

// GET /api/ai/status
router.get('/status', (req, res) => {
    const isAvailable = aiService && aiService.isAvailable && aiService.isAvailable();
    
    res.json({
        available: isAvailable,
        message: isAvailable ? 'AI 服務正常運行' : 'AI 服務未配置',
        service: serviceName,
        timestamp: new Date().toISOString(),
        features: {
            basicChat: isAvailable,
            roomRecommendation: isAvailable,
            translation: isAvailable
        }
    });
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
    try {
        if (!aiService || !aiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務未配置',
                message: '請設置 OPENAI_API_KEY 環境變量'
            });
        }

        const { message, sessionId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '缺少訊息內容'
            });
        }

        const result = await aiService.chat(message, sessionId || 'default');
        
        res.json(result);

    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '抱歉，處理您的請求時發生錯誤。'
        });
    }
});

// POST /api/ai/recommend-room
router.post('/recommend-room', async (req, res) => {
    try {
        if (!aiService || !aiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務未配置'
            });
        }

        const result = await aiService.recommendRoom(req.body);
        
        res.json(result);

    } catch (error) {
        console.error('Recommendation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/ai/translate
router.post('/translate', async (req, res) => {
    try {
        if (!aiService || !aiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務未配置'
            });
        }

        const { text, targetLanguage } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }

        const result = await aiService.translate(text, targetLanguage);
        
        res.json(result);

    } catch (error) {
        console.error('Translation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

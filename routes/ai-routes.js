const express = require('express');
const router = express.Router();

// 強制使用 Mock 服務（不嘗試 OpenAI，避免配額錯誤）
let aiService;
let serviceType = 'mock';

try {
    aiService = require('../services/mock-ai-service');
    console.log('✅ 使用模擬 AI 服務（測試模式）');
} catch (error) {
    console.error('❌ 無法加載模擬服務:', error);
}

// GET /api/ai/status
router.get('/status', (req, res) => {
    const isAvailable = aiService && typeof aiService.isAvailable === 'function' && aiService.isAvailable();
    
    res.json({
        available: isAvailable,
        service: serviceType,
        mode: 'testing',
        message: isAvailable ? 'AI 服務正常運行（模擬模式）' : 'AI 服務未配置',
        timestamp: new Date().toISOString()
    });
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
    try {
        if (!aiService || typeof aiService.chat !== 'function') {
            return res.json({
                success: false,
                message: '抱歉，AI 服務暫時不可用。',
                error: 'Service not loaded'
            });
        }

        const { message, sessionId } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: '請輸入有效的訊息',
                error: 'Invalid message'
            });
        }

        console.log(`📨 [Mock AI] 收到訊息: "${message.substring(0, 50)}..."`);
        
        const result = await aiService.chat(message, sessionId || 'default');
        
        if (result && result.message) {
            res.json({
                success: true,
                message: result.message,
                sessionId: result.sessionId || sessionId,
                service: 'mock'
            });
        } else {
            res.json({
                success: false,
                message: '抱歉，無法生成回覆。',
                error: 'No response'
            });
        }

    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({
            success: false,
            message: '系統錯誤，請稍後再試。',
            error: error.message
        });
    }
});

// POST /api/ai/recommend-room
router.post('/recommend-room', async (req, res) => {
    try {
        if (!aiService) {
            return res.json({ success: false, message: 'AI 服務不可用' });
        }

        const result = await aiService.recommendRoom(req.body);
        res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

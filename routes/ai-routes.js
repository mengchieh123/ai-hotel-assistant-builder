const express = require('express');
const router = express.Router();

let aiService;

try {
    aiService = require('../services/mock-ai-service');
    console.log('✅ AI 路由已加載 Mock 服務');
} catch (error) {
    console.error('❌ AI 路由加載失敗:', error);
}

router.get('/status', (req, res) => {
    res.json({
        available: aiService ? aiService.isAvailable() : false,
        service: 'mock',
        message: 'AI 服務運行中'
    });
});

router.post('/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message) {
        return res.json({ success: false, error: '缺少 message' });
    }

    try {
        if (!aiService) {
            throw new Error('AI 服務未初始化');
        }
        
        const result = await aiService.chat(message, sessionId);
        res.json(result);
    } catch (error) {
        console.error('對話錯誤:', error);
        res.json({
            success: false,
            message: '處理錯誤: ' + error.message
        });
    }
});

module.exports = router;

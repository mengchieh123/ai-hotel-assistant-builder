const express = require('express');
const router = express.Router();
const openaiService = require('../services/openai-service');

/**
 * 檢查 AI 服務狀態
 */
router.get('/status', (req, res) => {
    res.json({
        available: openaiService.isAvailable(),
        message: openaiService.isAvailable() 
            ? 'AI 服務正常運行' 
            : 'AI 服務未配置或不可用'
    });
});

/**
 * POST /api/ai/chat
 * 基礎對話接口
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '缺少訊息內容'
            });
        }

        const result = await openaiService.chat(message, history || []);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallback: '服務暫時不可用，請稍後再試'
        });
    }
});

/**
 * POST /api/ai/recommend-room
 * 智能房型推薦
 */
router.post('/recommend-room', async (req, res) => {
    try {
        const preferences = req.body;
        const result = await openaiService.recommendRoom(preferences);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Recommendation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/translate
 * 多語言翻譯
 */
router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }

        const result = await openaiService.translate(text, targetLanguage);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Translation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

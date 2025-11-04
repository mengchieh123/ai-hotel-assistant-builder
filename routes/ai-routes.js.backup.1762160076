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

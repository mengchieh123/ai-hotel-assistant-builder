const express = require('express');
const router = express.Router();
const aiService = require('../services/mock-ai-service');

// POST /api/ai/chat - 處理聊天請求
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少訊息內容' 
      });
    }
    
    // 調用正確的方法
    const response = await aiService.processMessage(message, sessionId || 'default');
    
    res.json({
      success: true,
      message: response.message,
      intent: response.intent,
      timestamp: response.timestamp
    });
    
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      success: false, 
      message: '處理錯誤: ' + error.message 
    });
  }
});

module.exports = router;

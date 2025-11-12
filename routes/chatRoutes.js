const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');

router.post('/', async (req, res) => {
  try {
    const { body } = req;

    // 基本請求格式檢查
    if (!body || typeof body !== 'object' || !body.message) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的請求參數: message',
      });
    }

    // 呼叫業務邏輯服務層處理
    const result = await chatService.handleChat(body);

    // 確保結果格式合法再回應
    if (!result || typeof result !== 'object') {
      return res.status(500).json({
        success: false,
        error: '內部伺服器錯誤：無效的服務回應格式',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Chat route error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '伺服器內部錯誤',
    });
  }
});

module.exports = router;


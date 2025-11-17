// routes/webhook.js
const express = require('express');
const router = express.Router();

// 引入對話處理模組，需自行實作並匯出 processDialogflowWebhook
const { processDialogflowWebhook } = require('../services/chatService');

router.post('/dialogflow-webhook', async (req, res) => {
  try {
    const dialogflowRequest = req.body;

    const responseText = await processDialogflowWebhook(dialogflowRequest);

    res.json({
      fulfillmentText: responseText
    });
  } catch (error) {
    console.error('Webhook 處理錯誤:', error);
    res.json({
      fulfillmentText: '抱歉，處理您的請求時出錯，請稍後再試。'
    });
  }
});

module.exports = router;

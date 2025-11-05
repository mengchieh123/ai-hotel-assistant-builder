#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 AI 路由"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > routes/ai-routes.js << 'EOFROUTES'
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
EOFROUTES

echo "✅ ai-routes.js 已修復"
echo ""

echo "推送修復..."
git add routes/ai-routes.js
git commit -m "fix: correct AI service method call in routes

✅ Change aiService.chat() to aiService.processMessage()
✅ Add proper error handling
✅ Fix 'aiService.chat is not a function' error"

git push origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 修復已推送"
    echo "⏳ 等待 2 分鐘後測試..."
    sleep 120
    
    echo ""
    echo "🧪 測試修復..."
    curl -s -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat" \
        -H "Content-Type: application/json" \
        -d '{"message": "你好"}' | jq '.'
    
    echo ""
    echo "執行完整測試："
    echo "  bash test-booking-flow.sh"
fi


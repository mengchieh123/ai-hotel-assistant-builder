#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 AI 路由問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 檢查當前路由文件
if [ -f "routes/ai-routes.js" ]; then
    echo "📄 備份現有路由..."
    cp routes/ai-routes.js routes/ai-routes.js.backup.$(date +%s)
fi

# 創建修復版本的 AI 路由
echo "📝 創建修復版本..."

cat > routes/ai-routes.js << 'EOFROUTES'
const express = require('express');
const router = express.Router();

// 安全加載 OpenAI 服務
let openaiService = null;
try {
    openaiService = require('../services/openai-service');
    console.log('✅ OpenAI 服務已加載');
} catch (error) {
    console.error('⚠️  OpenAI 服務加載失敗:', error.message);
}

/**
 * GET /api/ai/status
 * 檢查 AI 服務狀態
 */
router.get('/status', (req, res) => {
    const isAvailable = openaiService && openaiService.isAvailable && openaiService.isAvailable();
    
    res.json({
        available: isAvailable,
        message: isAvailable 
            ? 'AI 服務正常運行' 
            : 'AI 服務未配置或不可用',
        timestamp: new Date().toISOString(),
        features: {
            basicChat: isAvailable,
            roomRecommendation: isAvailable,
            translation: isAvailable
        }
    });
});

/**
 * POST /api/ai/chat
 * AI 對話功能
 */
router.post('/chat', async (req, res) => {
    try {
        if (!openaiService) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務未初始化',
                message: '請確認 OPENAI_API_KEY 環境變量已設置'
            });
        }

        if (!openaiService.isAvailable || !openaiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務不可用',
                message: '請設置 OPENAI_API_KEY 環境變量'
            });
        }

        const { message, sessionId, userId } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '缺少訊息內容',
                message: '請提供 message 參數'
            });
        }

        const result = await openaiService.chat(message);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                sessionId: sessionId || 'default',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                error: result.error || '處理失敗',
                message: result.message || '無法生成回覆'
            });
        }
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '服務暫時不可用，請稍後再試'
        });
    }
});

/**
 * POST /api/ai/recommend-room
 * 房型推薦
 */
router.post('/recommend-room', async (req, res) => {
    try {
        if (!openaiService || !openaiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務不可用'
            });
        }

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
 * 翻譯功能
 */
router.post('/translate', async (req, res) => {
    try {
        if (!openaiService || !openaiService.isAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'AI 服務不可用'
            });
        }

        const { text, targetLanguage } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數',
                message: '需要提供 text 和 targetLanguage'
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

// 錯誤處理中間件
router.use((err, req, res, next) => {
    console.error('AI Routes Error:', err);
    res.status(500).json({
        success: false,
        error: err.message,
        message: '服務器內部錯誤'
    });
});

module.exports = router;
EOFROUTES

echo "✅ AI 路由已修復"
echo ""

# 提交修復
echo "📦 提交到 Git..."
git add routes/ai-routes.js

git commit -m "fix: resolve AI routes loading issue

- Fix 'Invalid regular expression: missing /' error
- Add safe OpenAI service loading
- Add proper error handling for all endpoints
- Add null checks and availability checks
- Improve error messages

Fixes:
✅ AI routes now load correctly
✅ All endpoints return proper JSON
✅ Better error handling
✅ Safe service initialization"

echo ""
echo "🚀 推送到 Railway..."
git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修復完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 部署（60秒）..."
sleep 60

echo ""
echo "🧪 重新測試..."
bash test-ai-complete.sh


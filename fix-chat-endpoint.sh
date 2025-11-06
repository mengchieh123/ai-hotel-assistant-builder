#!/bin/bash

echo "🔧 修復 /chat 端點問題"
echo "=========================================="

# 檢查當前的 server.js
echo "1️⃣ 檢查當前 server.js 配置..."
if [ -f "server.js" ]; then
    grep -n "app.post.*chat" server.js || echo "❌ 未找到 /chat 端點配置"
    grep -n "app.use.*json" server.js || echo "❌ 未找到 JSON 中間件配置"
else
    echo "❌ server.js 文件不存在"
fi

# 創建正確的 server.js
echo ""
echo "2️⃣ 創建正確的 server.js..."
cat > server.js << 'SERVER'
const express = require('express');
const cors = require('cors');

console.log('🚀 啟動 AI 酒店助手服務...');
const aiService = require('./services/enhanced-ai-service');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件配置
app.use(cors());
app.use(express.json());  // 重要：解析 JSON 請求體

// 根端點
app.get('/', (req, res) => {
    res.json({ 
        service: 'AI Hotel Assistant API',
        version: aiService.version,
        status: 'running',
        endpoints: {
            'GET /health': '健康檢查',
            'POST /chat': 'AI 對話服務',
            'GET /test': '功能測試'
        }
    });
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        version: aiService.version,
        timestamp: new Date().toISOString()
    });
});

// 聊天端點 - 修復路徑問題
app.post('/chat', async (req, res) => {
    try {
        console.log('📨 收到聊天請求:', req.body);
        
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                error: 'Message is required',
                version: aiService.version 
            });
        }

        const result = await aiService.processMessage(message);
        console.log('🤖 AI 回應:', result);
        
        res.json(result);
    } catch (error) {
        console.error('❌ 聊天端點錯誤:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            version: aiService.version,
            message: error.message
        });
    }
});

// 功能測試端點
app.get('/test', (req, res) => {
    res.json({
        version: aiService.version,
        status: '服務正常',
        timestamp: new Date().toISOString(),
        test: '請使用 POST /chat 進行對話測試'
    });
});

// 啟動服務
app.listen(PORT, '0.0.0.0', () => {
    console.log('🎉 ================================');
    console.log('🚀 AI 酒店助手服務已啟動');
    console.log('📋 版本:', aiService.version);
    console.log('🌐 端口:', PORT);
    console.log('📍 環境: 生產環境');
    console.log('📋 可用端點:');
    console.log('   GET  /health    - 健康檢查');
    console.log('   POST /chat      - AI 對話');
    console.log('   GET  /test      - 功能測試');
    console.log('================================');
});
SERVER

echo "✅ server.js 已更新"

# 驗證語法
echo ""
echo "3️⃣ 驗證代碼語法..."
node -c server.js && node -c services/enhanced-ai-service.js

if [ $? -eq 0 ]; then
    echo "✅ 語法檢查通過"
else
    echo "❌ 語法錯誤"
    exit 1
fi

# 本地測試
echo ""
echo "4️⃣ 本地測試..."
timeout 5s node server.js &
SERVER_PID=$!
sleep 2

if curl -s http://localhost:3000/health >/dev/null; then
    echo "✅ 本地服務啟動成功"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ 本地服務啟動失敗"
    kill $SERVER_PID 2>/dev/null
fi

# 提交修復
echo ""
echo "5️⃣ 提交修復..."
git add server.js
git commit -m "fix: correct /chat endpoint configuration

🔧 Fixes:
- Add express.json() middleware for JSON parsing
- Fix /chat endpoint route configuration
- Add proper error handling
- Improve logging for debugging

✅ Expected:
- POST /chat should work correctly
- JSON requests should be properly parsed
- All endpoints should return correct responses"

git push origin main

echo ""
echo "✅ 修復已部署！等待 Railway 重新部署..."
echo "⏳ 部署完成後測試命令:"
echo "   curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/chat \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"message\":\"你好\"}'"

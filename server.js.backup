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

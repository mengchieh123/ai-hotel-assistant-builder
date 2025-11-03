require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// 健康檢查
app.get('/health', (req, res) => {
    console.log('✅ 健康檢查被調用');
    res.json({
        status: 'healthy',
        service: 'AI Hotel Assistant',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        port: PORT,
        features: {
            speckit: '✅ 已啟用',
            openai: process.env.OPENAI_API_KEY ? '✅ 已配置' : '❌ 未配置',
            staticFiles: '✅ 已啟用'
        }
    });
});

// AI 路由
try {
    const aiRoutes = require('./routes/ai-routes');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI 路由已加載');
} catch (error) {
    console.warn('⚠️  AI 路由加載失敗:', error.message);
}

// 演示頁面路由
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-manager-demo.html'));
});

// 根路徑
app.get('/', (req, res) => {
    res.json({
        name: 'AI Hotel Assistant Builder',
        version: '2.1.0',
        description: 'Speckit-driven hotel management system with AI capabilities',
        features: [
            'Speckit Auto Development',
            'OpenAI Integration',
            'Smart Room Recommendation',
            'Multi-language Translation',
            'Natural Language Chat'
        ],
        endpoints: {
            system: {
                health: 'GET /health',
                root: 'GET /',
                demo: 'GET /demo'
            },
            ai: {
                status: 'GET /api/ai/status',
                chat: 'POST /api/ai/chat',
                recommendRoom: 'POST /api/ai/recommend-room',
                translate: 'POST /api/ai/translate'
            }
        },
        documentation: 'https://github.com/mengchieh123/ai-hotel-assistant-builder'
    });
});

// 404 處理
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: '請求的路徑不存在',
        availablePaths: [
            '/ - API 信息',
            '/health - 健康檢查',
            '/demo - 演示頁面',
            '/api/ai/status - AI 服務狀態',
            '/api/ai/chat - AI 對話',
            '/api/ai/recommend-room - 智能推薦',
            '/api/ai/translate - 多語言翻譯'
        ]
    });
});

// 錯誤處理
app.use((err, req, res, next) => {
    console.error('錯誤:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 啟動 AI Hotel Assistant 生產服務器...`);
    console.log(`📍 啟動端口: ${PORT}`);
    console.log(`✅ 服務器運行在: http://0.0.0.0:${PORT}`);
    console.log(`🔍 健康檢查: http://0.0.0.0:${PORT}/health`);
    console.log(`🎨 演示頁面: http://0.0.0.0:${PORT}/demo`);
    console.log(`🤖 OpenAI 狀態: ${process.env.OPENAI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
});

// 心跳
setInterval(() => {
    console.log('💓 服務器運行中 -', new Date().toISOString());
}, 30000);

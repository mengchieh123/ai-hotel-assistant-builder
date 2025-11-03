require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務 - 提供 HTML 演示頁面
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // 為了向後兼容，也服務根目錄

// 健康檢查
app.get('/health', (req, res) => {
    console.log('✅ 健康檢查被調用');
    res.json({
        status: 'healthy',
        service: 'AI Hotel Assistant',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        port: PORT,
        features: [
            'Speckit Auto Development',
            'Static File Serving',
            'Health Monitoring'
        ]
    });
});

// 演示頁面路由
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-manager-demo.html'));
});

// 根路徑
app.get('/', (req, res) => {
    res.json({
        name: 'AI Hotel Assistant Builder',
        version: '2.0.0',
        description: 'Speckit-driven hotel management system',
        endpoints: {
            health: '/health',
            demo: '/demo',
            speckit: '/speckit',
            static: '/product-manager-demo.html'
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
            '/product-manager-demo.html - 產品經理演示'
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
});

// 心跳
setInterval(() => {
    console.log('💓 服務器運行中 -', new Date().toISOString());
}, 30000);

const express = require('express');
const cors = require('cors');

console.log('🚀 启动生产环境服务...');
const aiService = require('./services/enhanced-ai-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        service: 'AI Hotel Assistant - PRODUCTION FIXED',
        version: aiService.version,
        status: 'running'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        version: aiService.version,
        timestamp: new Date().toISOString()
    });
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`📨 收到消息: ${message}`);
        const result = await aiService.processMessage(message);
        
        res.json(result);
    } catch (error) {
        console.error('错误:', error);
        res.status(500).json({ 
            error: '服务暂时不可用',
            version: aiService.version
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('================================');
    console.log('🎉 生产环境服务已启动!');
    console.log(`📋 版本: ${aiService.version}`);
    console.log(`🌐 端口: ${PORT}`);
    console.log('================================');
});

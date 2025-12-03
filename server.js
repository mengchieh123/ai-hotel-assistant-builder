// server.js (最終版本 - 極度精簡)
require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const path = require('path');

const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// --- 導入所有模組 ---
const config = require('./config'); 
const RuleEngine = require('./rule_engine'); // 導入規則引擎

// --- 僅保留用於啟動訊息的配置 ---
const {
    apiUrl,
} = config;

const app = express();

// ---------------------------------------------
// 1. EXPRESS 中間件與靜態檔案
// ---------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ---------------------------------------------
// 2. API ENDPOINT 和伺服器啟動
// ---------------------------------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 主要聊天 API
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
        return res.status(400).send({ error: '缺少 sessionId 或 message' });
    }

    try {
        // 將所有流程處理交給 RuleEngine 模組
        const result = await RuleEngine.processRules({ sessionId, userMessage: message });
        res.json(result);
    } catch (error) {
        console.error('API 處理錯誤:', error);
        res.status(500).json({ reply: '伺服器內部錯誤，請稍後再試。' });
    }
});

// 啟動伺服器
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器運行在 http://${HOST}:${PORT}`);
    console.log(`Gemini API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`);
});

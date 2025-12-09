// server.js (V1.1 - 最終修正版，強化 Session ID 淨化邏輯)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 引入 UUID 庫

// 設定 Port 和 Host
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// --- 導入所有模組 ---
const config = require('./config'); // 假設存在 
const RuleEngine = require(path.join(__dirname, 'rule_engine')); 

const { apiUrl } = config;

const app = express();

// ---------------------------------------------
// 1. EXPRESS 中間件與靜態檔案
// ---------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ---------------------------------------------
// 2. 路由定義
// ---------------------------------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'AI Hotel Assistant' });
});


/**
 * 主要聊天 API
 */
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    if (!message) {
        return res.status(400).send({ error: '缺少 message' });
    }

    // 🏆 V1.1 最終修正點：Session ID 淨化與生成邏輯
    const isSessionIdValid = sessionId && 
                             typeof sessionId === 'string' && 
                             sessionId.length > 0 &&
                             sessionId.toLowerCase() !== 'undefined'; // 排除 'undefined' 字串

    const safeSessionId = isSessionIdValid
                          ? sessionId
                          : uuidv4(); // 如果無效 (包含 'undefined')，則生成一個新的 UUID

    console.log(`[DEBUG_ID] 接收到 ID: ${sessionId} | 傳入 RuleEngine 的 ID: ${safeSessionId}`);

    let engineResult;
    try {
        // 傳入安全 ID
        engineResult = await RuleEngine.executeRules(message, safeSessionId);
        
    } catch (error) {
        console.error('API 處理錯誤: RuleEngine 執行失敗', error);
        
        return res.status(500).json({ 
            reply: `伺服器內部錯誤：規則引擎執行失敗。錯誤訊息: ${error.message}`,
            nextStep: 'init', endFlow: true, sessionId: safeSessionId
        });
    }

    if (engineResult && typeof engineResult.response === 'string') {
        
        const finalClientResponse = {
            reply: engineResult.response, 
            sessionId: safeSessionId,
            nextStep: engineResult.nextStep || null,
            richCard: engineResult.richCard || null,
            endFlow: engineResult.endFlow || false
        };
        
        res.json(finalClientResponse);
        
    } else {
        console.error('API 處理錯誤: RuleEngine 返回了無效結果', engineResult);
        
        return res.status(500).json({ 
            reply: '伺服器內部錯誤：規則引擎未能產生有效回覆或結果結構錯誤。',
            nextStep: 'init', sessionId: safeSessionId
        });
    }
});

// ---------------------------------------------
// 3. 伺服器啟動
// ---------------------------------------------
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器運行在 http://${HOST}:${PORT}`);
    console.log(`Gemini API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`); 
});

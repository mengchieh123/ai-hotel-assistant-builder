// server.js (ESM V1.3 - 最終部署修正版)

import 'dotenv/config'; 
import express from 'express';
import cors from 'cors'; 
import path from 'path';
import pkg from 'uuid';
const { v4: uuidv4 } = pkg;
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- 模擬 __dirname 和 __filename ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 導入所有模組 ---
// 🎯 修正點：使用預設導入 (Default Import) 來匹配 config.js 中的 export default
import config from './config.js'; 
import { RuleEngine } from './rule_engine.js'; // 命名導入 (Named Import)

// 設定 Port 和 Host
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

const { apiUrl } = config;

const app = express();

// ---------------------------------------------
// 📦 Express 中間件與靜態檔案
// ---------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ---------------------------------------------
// 🛣️ 路由定義
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

    // Session ID 淨化與生成邏輯
    const isSessionIdValid = sessionId && 
                             typeof sessionId === 'string' && 
                             sessionId.length > 0 &&
                             sessionId.toLowerCase() !== 'undefined';

    const safeSessionId = isSessionIdValid
                              ? sessionId
                              : uuidv4();

    console.log(`[DEBUG_ID] 接收到 ID: ${sessionId} | 傳入 RuleEngine 的 ID: ${safeSessionId}`);

    let engineResult;
    try {
        // 呼叫 RuleEngine 的靜態方法
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
// 🖥️ 伺服器啟動
// ---------------------------------------------
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器運行在 http://${HOST}:${PORT}`);
    console.log(`Gemini API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`); 
});

// server.js (最終修訂版 V1.0 - 強化 RuleEngine 結果檢查與 Session ID 生成)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 引入 UUID 庫

// 設定 Port 和 Host
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// --- 導入所有模組 ---
const config = require('./config'); 
const RuleEngine = require(path.join(__dirname, 'rule_engine')); 

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
// 2. 路由定義
// ---------------------------------------------

// 網站首頁
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 🛠️ 健康檢查 API (/health)
 */
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'AI Hotel Assistant' });
});


/**
 * 主要聊天 API
 */
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    // 檢查 message 是否存在
    if (!message) {
        return res.status(400).send({ error: '缺少 message' });
    }

    // 🏆 修正點：Session ID 檢查與生成邏輯
    const safeSessionId = sessionId && typeof sessionId === 'string' && sessionId.length > 0
                          ? sessionId
                          : uuidv4(); // 如果缺少或無效，則生成一個新的 UUID

    let engineResult;
    try {
        // 呼叫 RuleEngine 的主要執行函數，傳入安全 ID
        engineResult = await RuleEngine.executeRules(message, safeSessionId);
        
    } catch (error) {
        // 捕獲 RuleEngine 內部拋出的任何錯誤
        console.error('API 處理錯誤: RuleEngine 執行失敗', error);
        
        // 返回 500 錯誤給用戶
        return res.status(500).json({ 
            reply: `伺服器內部錯誤：規則引擎執行失敗。錯誤訊息: ${error.message}`,
            nextStep: 'init',
            endFlow: true,
            sessionId: safeSessionId // 即使出錯，也要返回 ID 讓客戶端可以重試
        });
    }

    /**
     * 強化結果檢查：
     * 1. 確保 engineResult 不是 null/undefined。
     * 2. 確保 engineResult.response 存在且為字串。
     */
    if (engineResult && typeof engineResult.response === 'string') {
        
        // 構建最終回傳給前端的 JSON 物件
        const finalClientResponse = {
            reply: engineResult.response, 
            // 確保返回最新的 Session ID
            sessionId: safeSessionId,
            // 使用安全鏈接操作符 (|| null) 來確保即使屬性不存在也不會導致 undefined
            nextStep: engineResult.nextStep || null,
            richCard: engineResult.richCard || null,
            endFlow: engineResult.endFlow || false
        };
        
        res.json(finalClientResponse);
        
    } else {
        // 如果 RuleEngine 返回的結果結構不正確 (例如 null 或 response 丟失)
        console.error('API 處理錯誤: RuleEngine 返回了無效結果', engineResult);
        
        return res.status(500).json({ 
            reply: '伺服器內部錯誤：規則引擎未能產生有效回覆或結果結構錯誤。',
            nextStep: 'init',
            sessionId: safeSessionId
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

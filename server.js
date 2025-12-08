// server.js (最終完整版本，包含 /health 路由和 RuleEngine 結果映射)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const path = require('path');

// 設定 Port 和 Host
// 在 Render 環境中，應使用 process.env.PORT
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// --- 導入所有模組 ---
const config = require('./config'); 
// 修正：假設 RuleEngine 的 main function 是 executeRules
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
    // 假設您的 index.html 位於 public/ 資料夾
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * 🛠️ 修正 1: 健康檢查 API (/health)
 * Render 部署平臺用於確認服務是否已啟動和健康。
 */
app.get('/health', (req, res) => {
    // 必須返回 200 OK 狀態碼
    res.status(200).json({ status: 'ok', service: 'AI Hotel Assistant' });
});


/**
 * 主要聊天 API
 * 接收 sessionId 和 message，返回 AI 助理的回應。
 */
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
        return res.status(400).send({ error: '缺少 sessionId 或 message' });
    }

    try {
        // 🚨 修正：呼叫 RuleEngine 的主要執行函數 executeRules
        const engineResult = await RuleEngine.executeRules(message, sessionId);
        
        /**
         * 🛠️ 修正 2: 檢查結果並將 RuleEngine 的 'response' 屬性映射為 'reply'
         * 確保回傳給客戶端的 JSON 格式符合預期，解決 200 null 問題。
         */
        if (engineResult && engineResult.response) {
            
            // 構建最終回傳給前端的 JSON 物件
            const finalClientResponse = {
                // 將 RuleEngine 的 response 映射為 reply 屬性
                reply: engineResult.response, 
                // 將 RuleEngine 的 nextStep, richCard 等控制屬性一起傳遞
                nextStep: engineResult.nextStep || null,
                richCard: engineResult.richCard || null,
                endFlow: engineResult.endFlow || false
                // 您可以包含其他任何需要的屬性...
            };
            
            res.json(finalClientResponse);
            
        } else {
            // 如果 RuleEngine 返回 null 或沒有 response 屬性 (不應該發生，但作為防禦性編程)
            console.error('API 處理錯誤: RuleEngine 返回了無效結果', engineResult);
            res.status(500).json({ reply: '伺服器內部錯誤：規則引擎未能產生有效回覆。' });
        }
        
    } catch (error) {
        console.error('API 處理錯誤:', error);
        res.status(500).json({ reply: `伺服器內部錯誤，請稍後再試。錯誤訊息: ${error.message}` });
    }
});

// ---------------------------------------------
// 3. 伺服器啟動
// ---------------------------------------------
app.listen(PORT, HOST, () => {
    console.log(`🚀 伺服器運行在 http://${HOST}:${PORT}`);
    console.log(`Gemini API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`); 
});

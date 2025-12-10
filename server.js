// server.js (ESM V1.6 - 兼容性優化版)

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
import config from './config.js'; 
import { RuleEngine } from './rule_engine.js'; // 命名導入 (Named Import)
import { sessionManager } from './session_manager.js'; // 🎯 新增：直接導入 session manager

// ----------------------------------------------------
// 🏆 核心修復點：伺服器啟動時，強制執行 RuleEngine 的配置初始化
// ----------------------------------------------------
try {
    // 必須在執行任何 RuleEngine 邏輯前呼叫
    RuleEngine.initializeFlowConfig(); 
    console.log('✅ RuleEngine 配置初始化完成');
} catch (error) {
    console.error(`💥 應用程式啟動失敗：RuleEngine 初始化錯誤。訊息: ${error.message}`);
    // 嚴重錯誤：終止應用程式啟動
    process.exit(1); 
}
// ----------------------------------------------------


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

// 請求日誌中間件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 假設您的前端檔案放在 public/
app.use(express.static(path.join(__dirname, 'public')));


// ---------------------------------------------
// 🛣️ 路由定義
// ---------------------------------------------

app.get('/', (req, res) => {
    // 服務靜態 index.html 頁面
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    // 健康檢查端點
    res.status(200).json({ 
        status: 'ok', 
        service: 'AI Hotel Assistant',
        timestamp: new Date().toISOString(),
        version: '1.6'
    });
});

// 🎯 新增：Session 除錯端點
app.get('/api/debug/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);
    
    if (session) {
        res.json({
            sessionId: session.id,
            currentState: session.currentState,
            currentStep: session.currentStep,
            collectedData: session.collectedData,
            lastMessage: session.lastMessage,
            lastIntent: session.lastIntent,
            fallbackCount: session.fallbackCount || 0,
            lastActive: new Date(session.lastActive).toISOString()
        });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// 🎯 新增：重置 Session 端點
app.post('/api/reset/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    sessionManager.resetSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} reset` });
});

/**
 * 主要聊天 API
 */
app.post('/api/chat', async (req, res) => {
    const { sessionId, message } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ 
            error: '缺少或無效的 message',
            sessionId: sessionId || uuidv4()
        });
    }

    // Session ID 淨化與生成邏輯
    const isSessionIdValid = sessionId && 
                             typeof sessionId === 'string' && 
                             sessionId.length > 0 &&
                             sessionId.toLowerCase() !== 'undefined';

    const safeSessionId = isSessionIdValid ? sessionId : uuidv4();

    console.log(`[DEBUG_ID] 接收到 ID: ${sessionId} | 傳入 RuleEngine 的 ID: ${safeSessionId}`);
    
    // 🎯 記錄原始訊息（用於除錯）
    const trimmedMessage = message.trim();
    console.log(`[MESSAGE] "${trimmedMessage}" (session: ${safeSessionId})`);

    let engineResult;
    try {
        // 確保 session 存在
        let session = sessionManager.getSession(safeSessionId);
        if (!session) {
            console.error(`[SESSION_ERROR] Session ${safeSessionId} 無法創建`);
            return res.status(500).json({
                reply: '會話初始化失敗，請重新開始。',
                nextStep: 'init',
                sessionId: safeSessionId
            });
        }
        
        // 呼叫 RuleEngine 的靜態方法
        engineResult = await RuleEngine.executeRules(trimmedMessage, safeSessionId);
        
        // 🎯 檢查 engineResult 結構
        if (!engineResult || typeof engineResult !== 'object') {
            throw new Error('RuleEngine 返回無效結果結構');
        }
        
    } catch (error) {
        console.error('💥 API 處理錯誤: RuleEngine 執行失敗', error);
        
        // 根據錯誤類型返回適當的回應
        let errorResponse;
        if (error.message.includes('Session')) {
            errorResponse = {
                reply: '會話處理失敗，請重新開始預訂流程。',
                nextStep: 'init', 
                endFlow: true, 
                sessionId: safeSessionId
            };
        } else {
            errorResponse = {
                reply: `伺服器內部錯誤：${error.message}`,
                nextStep: 'init', 
                sessionId: safeSessionId
            };
        }
        
        return res.status(500).json(errorResponse);
    }

    // 🎯 確保回應結構完整
    const finalResponse = {
        reply: engineResult.response || '抱歉，系統未能產生回應。',
        sessionId: safeSessionId,
        nextStep: engineResult.nextStep || 'init',
        richCard: engineResult.richCard || null,
        endFlow: engineResult.endFlow || false
    };
    
    // 🎯 關鍵 Rich Card 檢查日誌
    if (engineResult.richCard) {
        console.log("✅ [RICH_CARD_DEBUG] Rule Engine 輸出 Rich Card 數據：", JSON.stringify(engineResult.richCard, null, 2));
    } else {
        console.log(`❌ [RICH_CARD_DEBUG] engineResult.richCard 為空。當前狀態: ${engineResult.nextStep}`);
    }
    
    // 🎯 除錯日誌
    console.log(`[RESPONSE] ${safeSessionId} -> ${engineResult.nextStep}: "${finalResponse.reply.substring(0, 50)}..."`);
    
    res.json(finalResponse);
});


// ---------------------------------------------
// 🎯 錯誤處理中間件
// ---------------------------------------------

// 404 處理
app.use((req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// 全域錯誤處理
app.use((err, req, res, next) => {
    console.error('💥 全域錯誤處理:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : '請稍後再試'
    });
});

// ---------------------------------------------
// 🖥️ 伺服器啟動
// ---------------------------------------------
const server = app.listen(PORT, HOST, () => {
    console.log(`=========================================`);
    console.log(`🚀 AI 訂房助理伺服器啟動成功`);
    console.log(`📡 運行在 http://${HOST}:${PORT}`);
    console.log(`🔧 API Key: ${apiUrl ? '已設定' : '未設定 ⚠️'}`);
    console.log(`🕒 啟動時間: ${new Date().toISOString()}`);
    console.log(`=========================================`);
});

// 優雅關機處理
process.on('SIGTERM', () => {
    console.log('SIGTERM 信號收到，正在關閉伺服器...');
    server.close(() => {
        console.log('伺服器已關閉');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT 信號收到，正在關閉伺服器...');
    server.close(() => {
        console.log('伺服器已關閉');
        process.exit(0);
    });
});

// 未捕獲異常處理
process.on('uncaughtException', (err) => {
    console.error('💥 未捕獲異常:', err);
    // 記錄錯誤但不立即退出，讓伺服器繼續運行
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 未處理的 Promise 拒絕:', reason);
});

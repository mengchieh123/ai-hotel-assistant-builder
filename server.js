// server.js (ESM V1.7 - 增強模組化版本)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // 🏆 修正點：替換 'import pkg from "uuid"; const { v4: uuidv4 } = pkg;'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- 模擬 __dirname 和 __filename ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 導入所有模組 (包括外部化的 NLU Helper) ---
import config from './config.js';
import { RuleEngine } from './rule_engine.js';
import { sessionManager } from './session_manager.js';
import { SmartNLUHelper } from './smart_nlu_helper.js'; // 🏆 外部化導入

// ----------------------------------------------------
// 🏆 核心修復點：伺服器啟動時，強制執行 RuleEngine 的配置初始化
// ----------------------------------------------------
try {
    RuleEngine.initializeFlowConfig();
    console.log('✅ RuleEngine 配置初始化完成');
} catch (error) {
    console.error(`💥 應用程式啟動失敗：RuleEngine 初始化錯誤。訊息: ${error.message}`);
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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'AI Hotel Assistant',
        timestamp: new Date().toISOString(),
        version: '1.7',
        features: ['smart_intent_classification', 'modular_analysis']
    });
});

// 🎯 Session 除錯端點
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
            lastActive: new Date(session.lastActive).toISOString(),
            analysisHistory: session.analysisHistory || []
        });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// 🎯 重置 Session 端點
app.post('/api/reset/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    sessionManager.resetSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} reset` });
});


/**
 * 主要聊天 API - 增強版
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

    // 🎯 記錄原始訊息
    const trimmedMessage = message.trim();
    console.log(`[MESSAGE] "${trimmedMessage}" (session: ${safeSessionId})`);

    // 🎯 取得 Session 數據
    let session = sessionManager.getSession(safeSessionId);
    if (!session) {
        console.error(`[SESSION_ERROR] Session ${safeSessionId} 無法創建`);
        return res.status(500).json({
            reply: '會話初始化失敗，請重新開始。',
            nextStep: 'init',
            sessionId: safeSessionId
        });
    }

    // ==================== 🎯 新增：智慧分析階段 ====================
    let smartAnalysis = null;
    try {
        // 執行外部的智慧分析
        smartAnalysis = SmartNLUHelper.analyzeMessage(trimmedMessage, session);

        // 記錄分析歷史
        if (!session.analysisHistory) {
            session.analysisHistory = [];
        }

        const analysisSummary = SmartNLUHelper.generateAnalysisSummary(smartAnalysis);
        session.analysisHistory.push(analysisSummary);

        // 保持最近5條記錄
        if (session.analysisHistory.length > 5) {
            session.analysisHistory = session.analysisHistory.slice(-5);
        }

        // 🎯 合併智慧提取的實體到 session（如果 RuleEngine 沒有提取到）
        if (smartAnalysis.extractedEntities && Object.keys(smartAnalysis.extractedEntities).length > 0) {
            if (!session.collectedData) {
                session.collectedData = {};
            }

            // 只添加 RuleEngine 可能漏掉的實體
            Object.entries(smartAnalysis.extractedEntities).forEach(([key, value]) => {
                // 檢查 collectedData 中是否已存在該 key
                if (!session.collectedData[key] && value) {
                    session.collectedData[key] = value;
                    console.log(`🎯 [SMART_EXTRACTION] 智慧提取: ${key} = ${value}`);
                }
            });
        }

        // 🎯 輸出分析結果
        console.log(`🧠 [SMART_ANALYSIS] 模組: ${smartAnalysis.module}`);
        console.log(`  ├─ 檢測意圖: ${smartAnalysis.detectedIntents.join(', ')}`);
        console.log(`  ├─ 信心度: ${smartAnalysis.confidence}%`);
        console.log(`  ├─ 提取實體: ${Object.keys(smartAnalysis.extractedEntities).join(', ')}`);
        console.log(`  └─ 建議: ${smartAnalysis.suggestions.join(' → ')}`);

    } catch (analysisError) {
        console.error('⚠️ 智慧分析失敗:', analysisError);
        // 分析失敗不影響主要流程
    }
    // ==================== 智慧分析階段結束 ====================

    let engineResult;
    try {
        // 呼叫 RuleEngine 的靜態方法
        engineResult = await RuleEngine.executeRules(trimmedMessage, safeSessionId);

        // 🎯 檢查 engineResult 結構
        if (!engineResult || typeof engineResult !== 'object') {
            throw new Error('RuleEngine 返回無效結果結構');
        }

    } catch (error) {
        console.error('💥 API 處理錯誤: RuleEngine 執行失敗', error);

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

    // 🎯 構建增強回應
    const finalResponse = {
        reply: engineResult.response || '抱歉，系統未能產生回應。',
        sessionId: safeSessionId,
        nextStep: engineResult.nextStep || 'init',
        richCard: engineResult.richCard || null,
        endFlow: engineResult.endFlow || false,
        // 🎯 新增：智慧分析數據（可選，用於前端除錯）
        analysis: smartAnalysis ? {
            module: smartAnalysis.module,
            confidence: smartAnalysis.confidence,
            suggestions: smartAnalysis.suggestions,
            detectedIntents: smartAnalysis.detectedIntents.slice(0, 3)
        } : null
    };

    // 🎯 關鍵 Rich Card 檢查日誌
    if (engineResult.richCard) {
        console.log("✅ [RICH_CARD_DEBUG] Rule Engine 輸出 Rich Card 數據：", JSON.stringify(engineResult.richCard, null, 2));
    } else {
        console.log(`❌ [RICH_CARD_DEBUG] engineResult.richCard 為空。當前狀態: ${engineResult.nextStep}`);
    }

    // 🎯 增強除錯日誌
    console.log(`[RESPONSE] ${safeSessionId} -> ${engineResult.nextStep}: "${finalResponse.reply.substring(0, 50)}..."`);
    if (smartAnalysis) {
        console.log(`  └─ 🧠 智慧分析: ${smartAnalysis.module} (${smartAnalysis.confidence}%)`);
    }

    res.json(finalResponse);
});

// ---------------------------------------------
// 🎯 智慧分析歷史端點 (調用外部 helper)
// ---------------------------------------------
app.get('/api/debug/analysis/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessionManager.getSession(sessionId);

    if (session && session.analysisHistory) {
        const stats = {};
        session.analysisHistory.forEach(entry => {
            if (!stats[entry.module]) {
                stats[entry.module] = { count: 0, totalConfidence: 0 };
            }
            stats[entry.module].count++;
            stats[entry.module].totalConfidence += entry.confidence || 0;
        });

        // 計算平均信心度
        Object.keys(stats).forEach(module => {
            stats[module].avgConfidence = Math.round(stats[module].totalConfidence / stats[module].count);
        });

        res.json({
            sessionId,
            totalAnalyses: session.analysisHistory.length,
            recentAnalyses: session.analysisHistory.slice(-3),
            moduleStats: stats,
            fullHistory: session.analysisHistory
        });
    } else {
        res.status(404).json({ error: 'Session not found or no analysis history' });
    }
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
    console.log(`🧠 版本: 1.7 - 智慧分析增強版`);
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
    // 應立即關閉應用程式以防止不確定的狀態
    server.close(() => {
        process.exit(1);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 未處理的 Promise 拒絕:', reason);
});

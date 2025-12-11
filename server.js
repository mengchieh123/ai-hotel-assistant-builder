// server.js (ESM V1.7 - 增強模組化版本)

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
import { RuleEngine } from './rule_engine.js';
import { sessionManager } from './session_manager.js';

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
            lastActive: new Date(session.lastActive).toISOString(),
            analysisHistory: session.analysisHistory || []
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
 * 🎯 智慧分析輔助函數（內嵌在 server.js 中）
 */
class SmartAnalysisHelper {
    /**
     * 智慧意圖增強分析
     */
    static analyzeMessage(message, session) {
        const lowerMsg = message.toLowerCase().trim();
        const analysis = {
            detectedIntents: [],
            extractedEntities: {},
            confidence: 0,
            module: 'GENERAL',
            suggestions: []
        };
        
        // 🎯 智慧意圖檢測
        const intentPatterns = {
            booking: ['訂房', '預約', '訂一間', '想訂', 'book', '預訂', '我要訂', '想預約'],
            date_selection: ['今天', '明天', '後天', '週一', '週二', '週三', '週四', '週五', '週六', '週日', '聖誕節', '跨年', '春節'],
            room_selection: ['標準', '豪華', '行政', '家庭', '套房', '雙人房', '四人房'],
            people_count: ['位', '人', '大', '大人', '小孩', '兒童', '幾位', '幾人', '幾大幾小'],
            modification: ['修改', '更改', '重選', '換', '改一下', '調整'],
            inquiry: ['價格', '房價', '費用', '多少錢', '貴不貴', '價位'],
            member: ['會員', '登入', '帳號', '積分', '點數', '優惠', '登入會員'],
            cancel: ['取消', '退訂', '退款', '不要了', '中止', '停止'],
            contact: ['聯絡', '電話', 'email', '郵件', '客服', 'help', '姓名', '手機', '號碼'],
            addons: ['加購', '附加', '服務', '接送', '早餐', '晚餐', 'spa'],
            payment: ['付款', '支付', '信用卡', '現金', '轉帳', 'line pay']
        };
        
        // 檢測意圖
        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            if (keywords.some(keyword => lowerMsg.includes(keyword))) {
                analysis.detectedIntents.push(intent);
            }
        }
        
        // 🎯 智慧實體提取
        // 日期提取
        const dateMatch = message.match(/(\d{1,2})[月\/\-](\d{1,2})[日號]?/);
        if (dateMatch) {
            analysis.extractedEntities.dateRaw = dateMatch[0];
        }
        
        // 人數提取
        const peopleMatch = message.match(/(\d+)\s*(位|人|大|大人)/);
        if (peopleMatch) {
            analysis.extractedEntities.peopleCount = parseInt(peopleMatch[1]);
        }
        
        // 房間數提取
        const roomMatch = message.match(/(\d+)\s*(間|個|room)/i);
        if (roomMatch) {
            analysis.extractedEntities.roomCount = parseInt(roomMatch[1]);
        }
        
        // 電話提取
        const phoneMatch = message.match(/(\d{8,11})/);
        if (phoneMatch) {
            analysis.extractedEntities.phone = phoneMatch[1];
        }
        
        // 郵件提取
        const emailMatch = message.match(/([\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            analysis.extractedEntities.email = emailMatch[1];
        }
        
        // 姓名提取
        const nameMatch = message.match(/(?:姓名|名字|我叫|我是)[:：]?\s*([\u4e00-\u9fa5]{2,4})/);
        if (nameMatch) {
            analysis.extractedEntities.name = nameMatch[1];
        } else if (message.match(/^[\u4e00-\u9fa5]{2,4}$/)) {
            analysis.extractedEntities.name = message;
        }
        
        // 🎯 根據當前狀態和內容判斷模組
        const currentState = session?.currentStep || 'init';
        
        if (analysis.detectedIntents.includes('booking')) {
            analysis.module = 'BOOKING';
            analysis.confidence = 85;
            analysis.suggestions = ['請提供入住日期', '選擇房型', '確認人數'];
        } else if (analysis.detectedIntents.includes('date_selection')) {
            analysis.module = 'DATE_SELECTION';
            analysis.confidence = 80;
            analysis.suggestions = ['確認日期是否正確', '詢問住宿晚數'];
        } else if (currentState.includes('contact') || analysis.extractedEntities.name || analysis.extractedEntities.phone) {
            analysis.module = 'CONTACT_INFO';
            analysis.confidence = 75;
            analysis.suggestions = ['確認聯繫資訊', '詢問是否完整'];
        } else if (analysis.detectedIntents.includes('member')) {
            analysis.module = 'MEMBER_SERVICE';
            analysis.confidence = 90;
            analysis.suggestions = ['詢問會員帳號', '驗證身份', '提供專屬優惠'];
        } else if (analysis.detectedIntents.includes('cancel')) {
            analysis.module = 'CANCELLATION';
            analysis.confidence = 95;
            analysis.suggestions = ['確認取消意圖', '說明取消政策'];
        } else if (analysis.detectedIntents.includes('inquiry')) {
            analysis.module = 'INQUIRY';
            analysis.confidence = 70;
            analysis.suggestions = ['提供價格資訊', '詢問是否預訂'];
        } else {
            analysis.module = 'GENERAL';
            analysis.confidence = 50;
            analysis.suggestions = ['理解需求', '提供協助'];
        }
        
        // 🎯 計算信心度
        const entityCount = Object.keys(analysis.extractedEntities).length;
        analysis.confidence = Math.min(100, analysis.confidence + (entityCount * 5));
        
        return analysis;
    }
    
    /**
     * 產生分析摘要
     */
    static generateAnalysisSummary(analysis) {
        return {
            module: analysis.module,
            primaryIntents: analysis.detectedIntents.slice(0, 3),
            confidence: analysis.confidence,
            entitiesFound: Object.keys(analysis.extractedEntities),
            suggestions: analysis.suggestions,
            timestamp: new Date().toISOString()
        };
    }
}

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
        // 執行智慧分析
        smartAnalysis = SmartAnalysisHelper.analyzeMessage(trimmedMessage, session);
        
        // 記錄分析歷史
        if (!session.analysisHistory) {
            session.analysisHistory = [];
        }
        
        const analysisSummary = SmartAnalysisHelper.generateAnalysisSummary(smartAnalysis);
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
                if (!session.collectedData[key] && value) {
                    session.collectedData[key] = value;
                    console.log(`🎯 [SMART_EXTRACTION] 智慧提取: ${key} = ${value}`);
                }
            });
        }
        
        // 🎯 輸出分析結果
        console.log(`🧠 [SMART_ANALYSIS] 模組: ${smartAnalysis.module}`);
        console.log(`   ├─ 檢測意圖: ${smartAnalysis.detectedIntents.join(', ')}`);
        console.log(`   ├─ 信心度: ${smartAnalysis.confidence}%`);
        console.log(`   ├─ 提取實體: ${Object.keys(smartAnalysis.extractedEntities).join(', ')}`);
        console.log(`   └─ 建議: ${smartAnalysis.suggestions.join(' → ')}`);
        
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
        console.log(`   └─ 🧠 智慧分析: ${smartAnalysis.module} (${smartAnalysis.confidence}%)`);
    }
    
    res.json(finalResponse);
});

// ---------------------------------------------
// 🎯 新增：智慧分析歷史端點
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
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 未處理的 Promise 拒絕:', reason);
});

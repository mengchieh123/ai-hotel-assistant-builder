// session_manager.js (V2.0 - 穩健性優化版)

import { v4 as uuidv4 } from 'uuid';

/**
 * 模擬一個 FlowLoader 最小化接口，以確保服務能載入並啟動。
 */
const mockFlowLoader = {
    getFlow: () => ({
        initial_state: 'init', // 建議初始狀態統一設為 'init' (或 'ask_dates_and_nights')
    })
};

// --- 輔助方法：獲取基礎 collectedData 結構 ---
function getInitialCollectedData() {
    // 確保每次呼叫都返回一個新的、獨立的物件副本
    return {
        finalPrice: 0, totalPrice: 0, childCost: 0, serviceFee: 0, transferFee: 0,
        roomType: null, checkInDate: null, nights: null, roomCount: null, adultCount: null, childCount: 0,
        contactName: null, contactPhone: null, contactEmail: null, paymentMethod: '未選擇', specialRequest: null,
        memberAccount: null, isLoggedIn: false, memberPassword: null,
        priceDetails: null, CUSTOM_PROMPT: null, addons: [],
        inventoryLockId: null 
    };
}


class SessionManager {
    constructor() {
        this.flowLoader = mockFlowLoader; 
        this.sessions = new Map(); 
        
        // 🚨 優化：將清理間隔設為 10 分鐘，減少累積過期會話
        setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000); 
        console.log('[SESSION_MGR] Manager initialized. Cleanup timer set.');
    }

    /** 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            // 如果會話不存在，則創建新會話
            return this.createNewSession(sessionId);
        }
        
        const session = this.sessions.get(sessionId);
        const now = new Date().getTime();
        
        // 🚨 優化 3：立即檢查會話是否已超時 (例如 60 分鐘未活動)
        const TIMEOUT_MS = 60 * 60 * 1000; 
        if (now - session.lastActive > TIMEOUT_MS) {
            console.log(`[SESSION] Session ${sessionId} timed out (${(now - session.lastActive) / 60000} min). Resetting.`);
            this.resetSession(sessionId);
            // 重置後返回新的會話狀態
            return this.sessions.get(sessionId);
        }

        // 更新最後活動時間
        session.lastActive = now;
        return session;
    }
    
    /** 創建新的會話 */
    createNewSession(sessionId) {
        const initialState = this.flowLoader.getFlow().initial_state || 'init'; 
        const newSessionId = sessionId || uuidv4();
        const now = new Date().getTime();
        
        const newSession = {
            id: newSessionId, 
            // 🚨 修正 2：統一使用 currentState 
            currentState: initialState, 
            collectedData: getInitialCollectedData(),
            conversationHistory: [],
            lastActive: now,
            pausedState: null,
            executedHandlers: {}, 
            previousStep: null, 
            tempQuery: null, 
            lastIntent: null,
            handlerExecutedStates: [] 
        };

        this.sessions.set(newSessionId, newSession);
        console.log(`[SESSION] New session created: ${newSessionId}, initial state: ${initialState}`);
        return newSession;
    }
    
    /** 🎯 新增：將 NLP 解析到的實體安全地合併到 collectedData */
    mergeEntities(sessionId, newEntities) {
        const session = this.getSession(sessionId);
        
        // 🚨 修正 1：核心功能 - 安全合併實體
        Object.keys(newEntities).forEach(key => {
            const value = newEntities[key];
            // 確保值既不是 null 也不是 undefined，才進行覆蓋或設定
            if (value !== null && value !== undefined) {
                session.collectedData[key] = value;
            }
        });

        session.lastActive = new Date().getTime();
        return session.collectedData;
    }

    /** 記錄使用者輸入與意圖，並更新 lastActive */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'user', message, intents, timestamp: new Date().toISOString()
        });
        
        // 歷史紀錄限制
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        session.lastActive = new Date().getTime();
        session.lastIntent = intents[0]?.name || null;
        return session;
    }

    /** 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.conversationHistory.push({
                role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString()
            });
            session.lastActive = new Date().getTime();
        }
    }
    
    /** 🎯 關鍵方法：重置會話 (取代舊的 endSession) */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 

            console.log(`🧹 會話重置：${sessionId}`);
            // 🚨 修正 2：統一使用 currentState 
            session.currentState = initialState;
            session.collectedData = getInitialCollectedData(); 
            session.pausedState = null;
            session.executedHandlers = {}; 
            session.previousStep = null;
            session.tempQuery = null;
            session.lastIntent = null;
            session.handlerExecutedStates = []; 
            session.conversationHistory = []; 
            session.lastActive = new Date().getTime();
        }
    }
    
    /** 清除過期的會話 */
    cleanupExpiredSessions() {
        const timeout = 60 * 60 * 1000; // 1 小時未活動
        const now = new Date().getTime();
        let deletedCount = 0;
        
        this.sessions.forEach((session, sessionId) => {
            if (now - session.lastActive > timeout) {
                this.sessions.delete(sessionId);
                deletedCount++;
            }
        });
        if (deletedCount > 0) {
            console.log(`🧹 已清理 ${deletedCount} 個過期的會話。`);
        }
    }
    
    // 💡 新增：用於 Rule Engine 變更狀態
    updateCurrentState(sessionId, newState) {
        const session = this.getSession(sessionId);
        session.currentState = newState;
        session.lastActive = new Date().getTime();
    }
}

// 導出 SessionManager 的單例實例 (Singleton)
const sessionManager = new SessionManager();

// 🏆 ESM 命名匯出
export { sessionManager };

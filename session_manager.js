// session_manager.js (V1.19 - 最終 ESM 修正版)

/**
 * 模擬一個 FlowLoader 最小化接口，以確保服務能載入並啟動。
 */
const mockFlowLoader = {
    getFlow: () => ({
        initial_state: 'ask_room_type', 
    })
};

class SessionManager {
    constructor() {
        this.flowLoader = mockFlowLoader; 
        this.sessions = new Map(); 
        
        // 定期清理過期的 session (每 30 分鐘)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    /** 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 
            
            this.sessions.set(sessionId, {
                id: sessionId, 
                currentStep: initialState, 
                collectedData: this.initializeCollectedData(),
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null,
                executedHandlers: {}, 
                previousStep: null, 
                tempQuery: null, 
                lastIntent: null,
                handlerExecutedStates: [] 
            });
            console.log(`[SESSION] New session created: ${sessionId}`);
        }
        const session = this.sessions.get(sessionId);
        session.lastActive = new Date().getTime();
        return session;
    }
    
    /** 內部方法：初始化 CollectedData */
    initializeCollectedData() {
        return {
            finalPrice: 0, totalPrice: 0, childCost: 0, serviceFee: 0, transferFee: 0,
            roomType: null, checkInDate: null, nights: null, roomCount: null, adultCount: null, childCount: 0,
            contactName: null, contactPhone: null, contactEmail: null, paymentMethod: '未選擇', specialRequest: null,
            memberAccount: null, isLoggedIn: false, memberPassword: null,
            priceDetails: null, CUSTOM_PROMPT: null, addons: [],
            inventoryLockId: null 
        };
    }

    /** 🎯 關鍵方法：記錄使用者輸入與意圖，並更新 lastActive */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'user', message, intents, timestamp: new Date().toISOString()
        });
        // 歷史紀錄限制
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        return session;
    }

    /** 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.conversationHistory.push({
                role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString()
            });
        }
    }
    
    /** 🎯 關鍵方法：重置會話 (取代舊的 endSession) */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 

            console.log(`🧹 會話重置：${sessionId}`);
            session.currentStep = initialState;
            session.collectedData = this.initializeCollectedData(); 
            session.pausedState = null;
            session.executedHandlers = {}; 
            session.previousStep = null;
            session.tempQuery = null;
            session.lastIntent = null;
            session.handlerExecutedStates = []; 
            session.conversationHistory = []; 
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
}

// 導出 SessionManager 的單例實例 (Singleton)
const sessionManager = new SessionManager();

// 🏆 修正：將 CommonJS 匯出 (module.exports) 替換為 ESM 命名匯出
export { sessionManager };

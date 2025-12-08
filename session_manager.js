// session_manager.js (V1.18 - 修正對 RuleEngine 依賴的架構，確保功能完整性)

/**
 * 模擬一個 FlowLoader 最小化接口，以確保服務能載入並啟動。
 * 🚨 SessionManager 不應該直接依賴 FlowLoader 實例，這裡使用 Mock 避免循環依賴或啟動失敗。
 */
const mockFlowLoader = {
    // 假設有一個 getFlow 函數返回流程配置
    getFlow: () => ({
        initial_state: 'ask_room_type', // 預設的初始狀態，確保流程能開始
    })
};

// -------------------------------------------------------------

class SessionManager {
    constructor() {
        // 使用 Mock 實例代替外部依賴
        this.flowLoader = mockFlowLoader; 
        this.sessions = new Map(); 
        
        // 定期清理過期的 session (每 30 分鐘)
        // 🚨 注意：實際環境中建議將超時時間設定得更長，例如 1 小時 (60 * 60 * 1000)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    /** 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            // 🚨 使用 Mock Loader 獲取初始狀態
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 
            
            this.sessions.set(sessionId, {
                id: sessionId, 
                currentStep: initialState, 
                collectedData: this.initializeCollectedData(),
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null,
                executedHandlers: {},
                // 為了兼容 RuleEngine.js 中的 Object.assign(session, updates) 寫法，
                // 這裡也需要初始化 RuleEngine 會讀寫的屬性:
                handlerExecutedStates: [] // RuleEngine V4.0/4.1 使用此屬性
            });
            console.log(`[SESSION] New session created: ${sessionId}`);
        }
        const session = this.sessions.get(sessionId);
        session.lastActive = new Date().getTime();
        return session;
    }
    
    /** 內部方法：初始化 CollectedData (包含所有預設實體) */
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

    /**
     * 🏆 修正後的方法：更新會話，主要用於紀錄使用者輸入。
     * ⚠️ 注意：RuleEngine 內部的狀態和 collectedData 更新仍是透過直接修改 session 物件或使用 Object.assign。
     */
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

    /** 記錄助理回應 (與 RuleEngine 邏輯同步) */
    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString()
        });
    }
    
    /** 🎯 關鍵修正：定義 resetSession 函數，用於完整重置或取代 endSession */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            // 🚨 使用 Mock Loader 獲取初始狀態
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 

            console.log(`🧹 會話重置：${sessionId}`);
            session.currentStep = initialState;
            session.collectedData = this.initializeCollectedData(); 
            session.pausedState = null;
            session.executedHandlers = {}; 
            session.handlerExecutedStates = []; // 清除 RuleEngine 追蹤
            session.conversationHistory = []; 
        }
    }
    
    /** 清除預訂核心實體 (保持不變) */
    clearBookingEssentials(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const data = session.collectedData;
            
            delete data.roomType; delete data.checkInDate; delete data.nights; delete data.roomCount; 
            delete data.adultCount; delete data.childCount; delete data.inventoryLockId; 
            
            data.finalPrice = 0; data.totalPrice = 0; data.serviceFee = 0; data.transferFee = 0;
            data.priceDetails = null; data.addons = []; 
            
            session.executedHandlers = {}; 
            session.pausedState = null;
            session.handlerExecutedStates = []; // 重置 RuleEngine 追蹤

            console.log(`⚠️ 已清除會話 ${sessionId} 的核心預訂數據並重置 Handler 追蹤。`);
        }
    }

    /** 清除特定 Handler 的執行狀態 (保持不變) */
    clearHandlerExecution(sessionId, handlerName) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.executedHandlers && session.executedHandlers[handlerName]) {
                delete session.executedHandlers[handlerName];
                console.log(`♻️ 清除 Handler 追蹤：${handlerName}`);
            }
        }
    }
    
    /** 定期清理過期的會話 (保持不變) */
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

module.exports = sessionManager;

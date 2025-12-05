// session_manager.js (V1.18 - 修正對 FlowConfigLoader 的依賴，確保啟動安全)

/**
 * 模擬一個 FlowLoader 最小化接口，以確保服務能載入並啟動。
 * 🚨 移除對外部 flow_loader.js 的 require，避免同步啟動錯誤。
 */
const mockFlowLoader = {
    // 假設有一個 getFlow 函數返回流程配置
    getFlow: () => ({
        initial_state: 'ask_room_type', // 預設的初始狀態，確保流程能開始
        // 實際流程配置...
    })
};

// -------------------------------------------------------------

class SessionManager {
    constructor() {
        // 使用 Mock 實例代替外部依賴
        this.flowLoader = mockFlowLoader; 
        this.sessions = new Map(); 
        
        // 定期清理過期的 session (每 30 分鐘)
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
                executedHandlers: {}
            });
        }
        const session = this.sessions.get(sessionId);
        session.lastActive = new Date().getTime();
        return session;
    }
    
    /** 內部方法：初始化 CollectedData (包含會員密碼/addons) */
    initializeCollectedData() {
        return {
            finalPrice: 0, totalPrice: 0, childCost: 0, serviceFee: 0, transferFee: 0,
            roomType: null, checkInDate: null, nights: null, roomCount: null, adultCount: null, childCount: 0,
            contactName: null, contactPhone: null, contactEmail: null, paymentMethod: '未選擇', specialRequest: null,
            memberAccount: null, isLoggedIn: false, memberPassword: null,
            priceDetails: null, CUSTOM_PROMPT: null, addons: [],
            inventoryLockId: null // 🏆 確保鎖定 ID 被初始化
        };
    }

    /** 更新會話 (用戶輸入) */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'user', message, intents, timestamp: new Date().toISOString()
        });
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        return session;
    }

    /** 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString()
        });
    }
    
    // --- 流程重置和清除核心實體的方法 ---

    /** 完整重置會話 */
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
            session.conversationHistory = []; 
        }
    }
    
    /** 清除預訂核心實體 */
    clearBookingEssentials(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const data = session.collectedData;
            
            delete data.roomType; delete data.checkInDate; delete data.nights; delete data.roomCount; 
            delete data.adultCount; delete data.childCount; delete data.inventoryLockId; // 🏆 清除鎖定 ID
            
            data.finalPrice = 0; data.totalPrice = 0; data.serviceFee = 0; data.transferFee = 0;
            data.priceDetails = null; data.addons = []; 
            
            session.executedHandlers = {}; 
            session.pausedState = null;

            console.log(`⚠️ 已清除會話 ${sessionId} 的核心預訂數據並重置 Handler 追蹤。`);
        }
    }

    /** 清除特定 Handler 的執行狀態 (用於強制重新計算) */
    clearHandlerExecution(sessionId, handlerName) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (session.executedHandlers && session.executedHandlers[handlerName]) {
                delete session.executedHandlers[handlerName];
                console.log(`♻️ 清除 Handler 追蹤：${handlerName}`);
            }
        }
    }
    
    // --- 會話清理邏輯 ---

    /** 定期清理過期的會話 */
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

// 導出 SessionManager 的單例實例
const sessionManager = new SessionManager();

module.exports = sessionManager;

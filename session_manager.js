// session_manager.js
// 導入 flowLoader 實例
const { FlowConfigLoader } = require('./flow_loader'); // 🚨 請確保此模組存在
const flowLoader = new FlowConfigLoader('dialogue_flow.json'); // 確保實例化

class SessionManager {
    constructor() {
        // 🏆 修正：移除了多餘的 'new' 關鍵字
        this.sessions = new Map(); 
        
        // 定期清理過期的 session (每 30 分鐘)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    /** 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            const initialState = flowLoader.getFlow().initial_state || 'init';
            
            this.sessions.set(sessionId, {
                id: sessionId, // 方便在 Handler 中識別
                currentStep: initialState, 
                collectedData: this.initializeCollectedData(), // 使用初始化函數
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null,
                executedHandlers: {} // 🏆 追蹤 RuleEngine 內 Handler 的執行狀態
            });
        }
        // 確保每次獲取會話時更新活動時間
        const session = this.sessions.get(sessionId);
        session.lastActive = new Date().getTime();
        return session;
    }
    
    /** 內部方法：初始化 CollectedData */
    initializeCollectedData() {
        return {
            // 初始化核心數據結構
            finalPrice: 0, 
            totalPrice: 0,
            childCost: 0,
            serviceFee: 0,    // 服務費
            transferFee: 0,   // 接送費/加購費
            
            // 預訂實體
            roomType: null,
            checkInDate: null,
            nights: null,
            adultCount: null,
            roomCount: null,
            childCount: 0,

            // 聯絡/支付
            contactName: null,
            contactPhone: null,
            contactEmail: null,
            paymentMethod: '未選擇',
            specialRequest: null,
            
            // 會員/折扣
            memberAccount: null,
            isLoggedIn: false,
            
            // 價格詳情 (由 calculatePrice Handler 填充的結構)
            priceDetails: null, 
            
            // Handler 追蹤的額外數據 (例如自訂 Prompt)
            CUSTOM_PROMPT: null,
            
            // 儲存已選擇的 addons
            addons: []
        };
    }

    /** 更新會話 (用戶輸入) */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        
        session.conversationHistory.push({
            role: 'user',
            message,
            intents,
            timestamp: new Date().toISOString()
        });
        
        // 歷史記錄只保留最近 20 則
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        return session;
    }

    /** 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model',
            message: reply,
            richCard: richCard,
            timestamp: new Date().toISOString()
        });
    }
    
    // --- 流程重置和清除核心實體的方法 ---

    /** 🏆 完整重置會話 */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const initialState = flowLoader.getFlow().initial_state || 'init';

            console.log(`🧹 會話重置：${sessionId}`);
            // 重置所有流程相關數據
            session.currentStep = initialState;
            session.collectedData = this.initializeCollectedData(); // 使用初始化函數
            session.pausedState = null;
            session.executedHandlers = {}; // 清除 Handler 追蹤
            session.conversationHistory = []; 
        }
    }
    
    /** 🏆 清除預訂核心實體（用於價格檢查失敗或強制重訂） */
    clearBookingEssentials(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const data = session.collectedData;
            
            // 清除需要重新收集的核心實體
            delete data.roomType;
            delete data.checkInDate;
            delete data.nights;
            delete data.roomCount;
            delete data.adultCount;
            delete data.childCount;
            
            // 清除所有計算出的價格和細節
            data.finalPrice = 0;
            data.totalPrice = 0;
            data.serviceFee = 0;
            data.transferFee = 0;
            data.priceDetails = null;
            data.addons = []; // 清除加購選項
            
            // 重置 Handler 追蹤，確保價格計算、核心檢查會再次執行
            session.executedHandlers = {}; 
            session.pausedState = null;

            console.log(`⚠️ 已清除會話 ${sessionId} 的核心預訂數據並重置 Handler 追蹤。`);
        }
    }

    /** 🏆 清除特定 Handler 的執行狀態 (用於強制重新計算) */
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

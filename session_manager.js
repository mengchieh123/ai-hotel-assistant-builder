// 導入 flowLoader 實例
const { FlowConfigLoader } = require('./flow_loader');
const flowLoader = new FlowConfigLoader('dialogue_flow.json'); // 確保實例化

class SessionManager {
    constructor() {
        this.sessions = new Map();
        // 定期清理過期的 session (每 30 分鐘)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    /** 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            const initialState = flowLoader.getFlow().initial_state || 'init';
            
            this.sessions.set(sessionId, {
                currentStep: initialState, 
                collectedData: {
                    // 初始化核心數據結構，新增 serviceFee 和 transferFee 以支援價格明細
                    finalPrice: '0', 
                    totalPrice: '0',
                    totalPriceNoChild: '0',
                    childCost: '0',
                    discountRate: '0',
                    serviceFee: '0',      // 新增：服務費
                    transferFee: '0',     // 新增：接送費
                    paymentMethod: '未選擇'
                }, 
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null,
                executedHandlers: {} // 🏆 新增：追蹤 RuleEngine 內 Handler 的執行狀態
            });
        }
        // 確保每次獲取會話時更新活動時間
        const session = this.sessions.get(sessionId);
        session.lastActive = new Date().getTime();
        return session;
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
    
    // --- 【新增：流程重置和清除核心實體的方法】 ---

    /** 🏆 新增：完整重置會話（解決 RuleEngine 的 TypeError） */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const initialState = flowLoader.getFlow().initial_state || 'init';

            console.log(`🧹 會話重置：${sessionId}`);
            // 重置所有流程相關數據
            session.currentStep = initialState;
            session.collectedData = {
                finalPrice: '0', 
                totalPrice: '0',
                totalPriceNoChild: '0',
                childCost: '0',
                discountRate: '0',
                serviceFee: '0', 
                transferFee: '0', 
                paymentMethod: '未選擇'
            }; 
            session.pausedState = null;
            session.executedHandlers = {}; // 清除 Handler 追蹤
            session.conversationHistory = []; 
        }
    }
    
    /** 🏆 新增：清除預訂核心實體（用於價格檢查失敗時重訂） */
    clearBookingEssentials(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const data = session.collectedData;
            
            // 清除流程中斷時需要重新收集的核心實體
            delete data.roomType;
            delete data.checkInDate;
            delete data.nights;
            delete data.roomCount;
            
            // 清除計算出的價格
            data.finalPrice = '0';
            data.totalPrice = '0';
            data.serviceFee = '0';
            data.transferFee = '0';
            
            // 重置 Handler 追蹤，確保價格計算會再次執行
            session.executedHandlers = {}; 

            console.log(`⚠️ 已清除會話 ${sessionId} 的核心預訂數據。`);
        }
    }
    
    // --- 【會話清理邏輯】 ---

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

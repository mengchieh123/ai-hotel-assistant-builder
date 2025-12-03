// 導入 flowLoader 實例
const { FlowConfigLoader } = require('./flow_loader');
const flowLoader = new FlowConfigLoader('dialogue_flow.json'); // 確保實例化

class SessionManager {
    constructor() {
        this.sessions = new Map();
        // 定期清理過期的 session (每 30 分鐘)
        setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000); 
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                currentStep: flowLoader.getFlow().initial_state || 'init', 
                collectedData: {
                    finalPrice: '0', 
                    totalPrice: '0',
                    totalPriceNoChild: '0',
                    childCost: '0',
                    discountRate: '0',
                    paymentMethod: '未選擇'
                }, 
                conversationHistory: [],
                lastActive: new Date().getTime(),
                pausedState: null
            });
        }
        return this.sessions.get(sessionId);
    }

    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.lastActive = new Date().getTime(); // 更新時間戳
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

    addAssistantResponse(sessionId, reply, richCard) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'model',
            message: reply,
            richCard: richCard,
            timestamp: new Date().toISOString()
        });
    }

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

// 導出 SessionManager 的實例，讓其他模組可以直接使用
const sessionManager = new SessionManager();

module.exports = sessionManager;

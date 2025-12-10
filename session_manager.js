// session_manager.js (V2.1 - 最終穩健性修正版 - 配合 V8.3 流程恢復版)

import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

/**
 * 模擬一個 FlowLoader 最小化接口
 */
const mockFlowLoader = {
    getFlow: () => ({
        initial_state: 'init',
    })
};

// --- 輔助方法：獲取基礎 collectedData 結構 ---
function getInitialCollectedData() {
    return {
        finalPrice: 0, totalPrice: 0, childCost: 0, serviceFee: 0, transferFee: 0,
        roomType: null, checkInDate: null, nights: null, roomCount: null, adultCount: null, childCount: 0,
        contactName: null, 
        contactPhone: null, 
        contactEmail: null, 
        paymentMethod: '未選擇', 
        specialRequest: null,
        memberAccount: null, isLoggedIn: false, memberPassword: null,
        priceDetails: null, CUSTOM_PROMPT: null, addons: [],
        inventoryLockId: null,
        customRichCard: null, // 新增：用於 UI 控制
        pauseFromState: null, // 🎯 修正：新增流程暫停狀態，配合 BookingController V8.3 的流程恢復
    };
}


class SessionManager {
    constructor() {
        this.flowLoader = mockFlowLoader; 
        this.sessions = new Map(); 
        
        setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000); 
        console.log('[SESSION_MGR] Manager initialized. Cleanup timer set.');
    }

    /** 1. 獲取或初始化會話 */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            return this.createNewSession(sessionId);
        }
        
        const session = this.sessions.get(sessionId);
        const now = new Date().getTime();
        
        const TIMEOUT_MS = 60 * 60 * 1000; 
        if (now - session.lastActive > TIMEOUT_MS) {
            console.log(`[SESSION] Session ${sessionId} timed out. Resetting.`);
            this.resetSession(sessionId);
            return this.sessions.get(sessionId);
        }

        session.lastActive = now;
        return session;
    }
    
    /** 2. 創建新的會話 */
    createNewSession(sessionId) {
        const initialState = this.flowLoader.getFlow().initial_state || 'init'; 
        const newSessionId = sessionId || uuidv4();
        const now = new Date().getTime();
        
        const newSession = {
            id: newSessionId, 
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
    
    /** 3. 將 NLP 解析到的實體安全地合併到 collectedData */
    mergeEntities(sessionId, newEntities) {
        const session = this.getSession(sessionId);
        
        Object.keys(newEntities).forEach(key => {
            const value = newEntities[key];
            // 🎯 注意：這裡不應允許 collectedData 內的 pauseFromState 被外部實體覆蓋
            if (key === 'pauseFromState') {
                return; 
            }
            if (value !== null && value !== undefined) {
                session.collectedData[key] = value;
            }
        });

        session.lastActive = new Date().getTime();
        return session.collectedData;
    }

    /** 4. 記錄使用者輸入與意圖，並更新 lastActive */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        session.conversationHistory.push({
            role: 'user', message, intents, timestamp: new Date().toISOString()
        });
        
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        session.lastActive = new Date().getTime();
        session.lastIntent = intents[0]?.name || null;
        
        // 🎯 修正：記錄最後一則訊息，供 LLM 查詢使用
        session.lastMessage = message; 

        return session;
    }

    /** 5. 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.conversationHistory.push({
                role: 'model', message: reply, richCard: richCard, timestamp: new Date().toISOString()
            });
            session.lastActive = new Date().getTime();
        }
    }
    
    /** 6. 重置會話 */
    resetSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            const initialState = this.flowLoader.getFlow().initial_state || 'init'; 

            console.log(`🧹 會話重置：${sessionId}`);
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
            // 🎯 新增：重置 lastMessage
            session.lastMessage = null; 
        }
    }
    
    /** 7. 清除過期的會話 */
    cleanupExpiredSessions() {
        const timeout = 60 * 60 * 1000; 
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
    
    /** 8. 用於 Rule Engine 變更狀態 */
    updateCurrentState(sessionId, newState) {
        const session = this.getSession(sessionId);
        session.currentState = newState;
        session.lastActive = new Date().getTime();
    }
}

const sessionManager = new SessionManager();

export { sessionManager };

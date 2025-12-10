// session_manager.js (V2.2 - 兼容性修正版)

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
        // 價格相關
        finalPrice: 0, totalPrice: 0, childCost: 0, serviceFee: 0, transferFee: 0,
        roomBasePrice: 0, discountAmount: 0, roomPriceAfterDiscount: 0, totalAddonCost: 0,
        
        // 預訂資訊
        roomType: null, checkInDate: null, nights: null, roomCount: null, 
        adultCount: null, childCount: 0,
        
        // 聯絡資訊
        contactName: null, contactPhone: null, contactEmail: null, 
        
        // 其他
        paymentMethod: '未選擇', specialRequest: null,
        memberAccount: null, isLoggedIn: false, memberPassword: null,
        priceDetails: null, CUSTOM_PROMPT: null, addons: [],
        inventoryLockId: null,
        
        // UI 控制
        customRichCard: null,
        
        // 🎯 修正：流程暫停狀態
        pauseFromState: null,
        
        // 🎯 新增：用於通用查詢
        llm_response: null,
        llm_source: null,
        
        // 🎯 新增：錯誤訊息
        errorMessage: null
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
        
        // 🔧 修正：確保 session 有 currentStep 屬性（與 currentState 同步）
        if (!session.currentStep && session.currentState) {
            session.currentStep = session.currentState;
        }
        
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
            currentStep: initialState, // 🎯 新增：確保與 rule_engine 兼容
            collectedData: getInitialCollectedData(),
            conversationHistory: [],
            lastActive: now,
            pausedState: null,
            executedHandlers: {}, 
            previousStep: null, 
            tempQuery: null, 
            lastIntent: null,
            handlerExecutedStates: [],
            lastMessage: null, // 🎯 確保初始化
            fallbackCount: 0 // 🎯 新增：用於追蹤連續 fallback 次數
        };

        this.sessions.set(newSessionId, newSession);
        console.log(`[SESSION] New session created: ${newSessionId}, initial state: ${initialState}`);
        return newSession;
    }
    
    /** 3. 將 NLP 解析到的實體安全地合併到 collectedData */
    mergeEntities(sessionId, newEntities) {
        const session = this.getSession(sessionId);
        
        // 🔧 修正：確保 session.collectedData 存在
        if (!session.collectedData) {
            session.collectedData = getInitialCollectedData();
        }
        
        Object.keys(newEntities).forEach(key => {
            const value = newEntities[key];
            // 🎯 注意：這裡不應允許 collectedData 內的 pauseFromState 被外部實體覆蓋
            if (key === 'pauseFromState') {
                return; 
            }
            if (value !== null && value !== undefined && value !== '') {
                session.collectedData[key] = value;
            }
        });

        session.lastActive = new Date().getTime();
        return session.collectedData;
    }

    /** 4. 記錄使用者輸入與意圖，並更新 lastActive */
    updateSession(sessionId, message, intents) {
        const session = this.getSession(sessionId);
        
        // 確保必要屬性存在
        if (!session.conversationHistory) {
            session.conversationHistory = [];
        }
        
        session.conversationHistory.push({
            role: 'user', 
            message: message, 
            intents: intents, 
            timestamp: new Date().toISOString()
        });
        
        if (session.conversationHistory.length > 20) {
            session.conversationHistory.shift();
        }
        
        session.lastActive = new Date().getTime();
        session.lastIntent = intents && intents.length > 0 ? intents[0] : null;
        
        // 🎯 記錄最後一則訊息，供 LLM 查詢使用
        session.lastMessage = message; 

        return session;
    }

    /** 5. 記錄助理回應 */
    addAssistantResponse(sessionId, reply, richCard) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            
            // 確保 conversationHistory 存在
            if (!session.conversationHistory) {
                session.conversationHistory = [];
            }
            
            session.conversationHistory.push({
                role: 'model', 
                message: reply, 
                richCard: richCard, 
                timestamp: new Date().toISOString()
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
            
            // 重置所有屬性
            session.currentState = initialState;
            session.currentStep = initialState; // 🎯 同步重置
            session.collectedData = getInitialCollectedData(); 
            session.pausedState = null;
            session.executedHandlers = {}; 
            session.previousStep = null;
            session.tempQuery = null;
            session.lastIntent = null;
            session.handlerExecutedStates = []; 
            session.conversationHistory = []; 
            session.lastActive = new Date().getTime();
            session.lastMessage = null;
            session.fallbackCount = 0; // 🎯 重置 fallback 計數
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
        session.currentStep = newState; // 🎯 同步更新
        session.lastActive = new Date().getTime();
    }
    
    /** 9. 🎯 新增：安全獲取 session 屬性 */
    getSessionProperty(sessionId, property, defaultValue = null) {
        const session = this.getSession(sessionId);
        if (session && session[property] !== undefined) {
            return session[property];
        }
        return defaultValue;
    }
    
    /** 10. 🎯 新增：設置 session 屬性 */
    setSessionProperty(sessionId, property, value) {
        const session = this.getSession(sessionId);
        if (session) {
            session[property] = value;
            session.lastActive = new Date().getTime();
            return true;
        }
        return false;
    }
}

const sessionManager = new SessionManager();

export { sessionManager };

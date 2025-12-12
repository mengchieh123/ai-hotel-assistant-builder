// config.js (ESM 系統兼容版)

// --- 虛擬資料庫與配置 (系統兼容版) ---

const ROOM_RATES = {
    '標準雙人房': 2200,
    '豪華客房': 3200,
    '行政套房': 4800,
    '家庭四人房': 4500,
};

// --- 價格與費用常數 ---
const WEEKEND_MULTIPLIER = 1.2; 
const CHILD_FEE_PER_NIGHT = 500; 
const PET_FEE_PER_PET_PER_NIGHT = 300; 
const SERVICE_FEE_RATE = 0.1; 
const VIRTUAL_PAYMENT_BASE_URL = 'https://secure.payment.gateway.com/pay'; 

// 🎯 新增：會員折扣率（與 booking_controller.js 中的 0.95 保持一致）
const MEMBER_DISCOUNT_RATE = 0.95;

// 🎯 新增：加購服務價格計算類型
const ADDON_CALCULATION_TYPES = {
    PER_NIGHT: 'per_night',
    PER_PERSON: 'per_person',
    ONE_TIME: 'one_time'
};

// 🎯 新增：訂房限制
const BOOKING_LIMITS = {
    MAX_ROOMS: 10,
    MAX_GUESTS_PER_ROOM: 4,
    MAX_NIGHTS: 30,
    MIN_ADULTS: 1,
    MAX_ADULTS: 10
};

// --- 庫存與會員數據 ---
const DEFAULT_ROOM_INVENTORY = 10; 

// 虛擬庫存表：以 YYYY-MM-DD 為 Key (當前年份是 2025)
const VIRTUAL_INVENTORY = {
    '2025-12-24': {
        '標準雙人房': 5,
        '豪華客房': 2,
        '行政套房': 1,
        '家庭四人房': 3,
    },
    '2025-12-25': {
        '標準雙人房': 4,
        '豪華客房': 3,
        '行政套房': 0, 
        '家庭四人房': 2,
    },
    '2025-12-30': {
        '標準雙人房': 8,
        '豪華客房': 6,
        '行政套房': 4,
        '家庭四人房': 5,
    },
    '2025-12-31': {
        '標準雙人房': 7,
        '豪華客房': 5,
        '行政套房': 3,
        '家庭四人房': 4,
    }
};

// 虛擬會員數據
const VIRTUAL_MEMBERS = {
    '123456789': { isMember: true, level: 'Gold', discount: 0.8 },
    '0912345678': { isMember: true, level: 'Silver', discount: 0.9 },
    '0987654321': { isMember: true, level: 'Basic', discount: 0.95 },
    'test@example.com': { isMember: true, level: 'Basic', discount: 0.95 }
};

// 🎯 新增：虛擬加購服務
const VIRTUAL_ADDONS = {
    'breakfast': {
        name: '早餐',
        price: 300,
        isPerNight: true,
        type: 'per_person',
        description: '每日自助式早餐'
    },
    'parking': {
        name: '停車位',
        price: 200,
        isPerNight: true,
        type: 'one_time',
        description: '每日停車位'
    },
    'spa': {
        name: 'SPA 券',
        price: 800,
        isPerNight: false,
        type: 'one_time',
        description: '一次 SPA 體驗'
    },
    'airport_transfer': {
        name: '機場接送',
        price: 1200,
        isPerNight: false,
        type: 'one_time',
        description: '單趟機場接送服務'
    }
};

// --- AI 與系統配置 ---
const CHAT_INSTRUCTIONS = `你是一個專業且友善的飯店訂房助理。你必須遵守以下規則：
1. 優先引導用戶完成訂房流程。
2. 如果用戶詢問非訂房相關問題（例如：天氣、交通、設施），請禮貌地回答問題，並提醒用戶可以隨時回復『繼續』來回到訂房流程。
3. 你的回應需簡潔明瞭，使用繁體中文。
4. 你不需要自己判斷房價或庫存，這些資訊由系統提供。
5. 當用戶詢問價格時，請根據 collectedData 中的價格信息回答，若無則請用戶開始訂房。
6. 保持熱情和專業的態度。`;

// 🎯 新增：系統行為配置
const SYSTEM_BEHAVIOR = {
    ENABLE_LLM_FALLBACK: true,
    MAX_FALLBACK_ATTEMPTS: 3,
    SESSION_TIMEOUT_MINUTES: 60,
    ENABLE_RICH_CARDS: true,
    AUTO_ADVANCE_ON_ENTITIES: true,
    VALIDATE_DATES: true
};

// 🎯 新增：開發模式配置
const DEVELOPMENT = {
    LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
    ENABLE_API_LOGGING: process.env.NODE_ENV !== 'production',
    MOCK_API_DELAY: process.env.NODE_ENV === 'test' ? 0 : 100
};

// Gemini API 配置
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.0-flash-exp";
const API_VERSION = "v1";
const apiUrl = apiKey ? `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}` : null;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// 🎯 新增：應用程式配置
const APP_CONFIG = {
    PORT: process.env.PORT || 10000,
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_NAME: 'AI Hotel Booking Assistant',
    VERSION: '2.0.0'
};

// 整合所有配置到一個物件中
const config = {
    // 價格相關
    ROOM_RATES,
    WEEKEND_MULTIPLIER,
    CHILD_FEE_PER_NIGHT,
    PET_FEE_PER_PET_PER_NIGHT,
    SERVICE_FEE_RATE,
    MEMBER_DISCOUNT_RATE, // 🎯 新增
    VIRTUAL_PAYMENT_BASE_URL,
    
    // 計算類型
    ADDON_CALCULATION_TYPES, // 🎯 新增
    
    // 限制
    BOOKING_LIMITS, // 🎯 新增
    
    // 庫存
    DEFAULT_ROOM_INVENTORY,
    VIRTUAL_INVENTORY,
    
    // 會員
    VIRTUAL_MEMBERS,
    
    // 加購服務
    VIRTUAL_ADDONS, // 🎯 新增
    
    // AI 指令
    CHAT_INSTRUCTIONS,
    
    // 系統行為
    SYSTEM_BEHAVIOR, // 🎯 新增
    
    // 開發配置
    DEVELOPMENT, // 🎯 新增
    
    // API 配置
    apiUrl,
    MAX_RETRIES,
    INITIAL_BACKOFF_MS,
    
    // 應用程式配置
    APP_CONFIG // 🎯 新增
};

// 🏆 最終修正：使用 ES 模組的預設匯出 (Default Export)
export default config;

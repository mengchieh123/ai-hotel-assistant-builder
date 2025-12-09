// config.js (ESM 最終修正版 - 使用 export default)

// --- 虛擬資料庫與配置 (最終修正版) ---

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
};

// 虛擬會員數據
const VIRTUAL_MEMBERS = {
    '123456789': { isMember: true, level: 'Gold', discount: 0.8 }
};

// --- AI 與系統配置 ---
const CHAT_INSTRUCTIONS = "你是一個專業且友善的飯店訂房助理。你必須遵守以下規則： 1. 優先引導用戶完成訂房流程。2. 如果用戶詢問非訂房相關問題（例如：天氣、交通、設施），請禮貌地回答問題，並提醒用戶可以隨時回復『繼續』來回到訂房流程。3. 你的回應需簡潔明瞭，使用繁體中文。4. 你不需要自己判斷房價或庫存，這些資訊由系統提供。5. 當用戶詢問價格時，請根據 collectedData 中的價格信息回答，若無則請用戶開始訂房。";

// Gemini API 配置
const apiKey = process.env.GEMINI_API_KEY;
const API_BASE = "https://generativelanguage.googleapis.com";
const MODEL_NAME = "gemini-2.5-flash";
const API_VERSION = "v1";
const apiUrl = apiKey ? `${API_BASE}/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${apiKey}` : null;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// 整合所有配置到一個物件中
const config = {
    ROOM_RATES,
    WEEKEND_MULTIPLIER,
    CHILD_FEE_PER_NIGHT,
    PET_FEE_PER_PET_PER_NIGHT,
    SERVICE_FEE_RATE,
    VIRTUAL_PAYMENT_BASE_URL,
    DEFAULT_ROOM_INVENTORY,
    VIRTUAL_INVENTORY,
    VIRTUAL_MEMBERS,
    CHAT_INSTRUCTIONS,
    apiUrl,
    MAX_RETRIES,
    INITIAL_BACKOFF_MS
};

// 🏆 最終修正：使用 ES 模組的預設匯出 (Default Export)
export default config;

AI 酒店助理系統 - 專業技術文檔

🏨 專案概述

這是一個智慧型酒店對話助理系統，結合了規則引擎、對話狀態管理和大型語言模型（Gemini API）的多層次對話處理框架。系統專門設計用於酒店預訂和旅遊諮詢場景，具備完整的訂房流程處理能力。

核心特點

混合式對話處理：規則引擎 + 狀態機 + LLM 智能回答
強健的錯誤處理：多層級回退機制確保服務不中斷
多意圖識別：可同時識別多個用戶意圖
上下文感知：智能處理流程中斷與主題切換
豐富回應格式：支援按鈕式 Rich Card 回應
📁 主要檔案架構

1. server.js - 主伺服器檔案（完整對話流程整合版）

檔案路徑：/server.js
作用：應用程式的核心入口點，整合所有對話處理邏輯

主要模組組成：

text
server.js
├── 1. 模組導入與基本設定 (0-50行)
├── 2. Dialogue Flow 配置 (53-136行)
├── 3. 核心工具類 (140-541行)
│   ├── SmartIntentClassifier (意圖分類器)
│   ├── BookingFlowController (狀態機控制器)
│   ├── RuleEngine (規則引擎)
│   └── SessionManager (會話管理器)
├── 4. API 通訊工具 (544-575行)
├── 5. 回應生成與 LLM 邏輯 (578-745行)
│   └── ResponseGenerator (回應生成器)
├── 6. Express 路由定義 (748-880行)
│   ├── 靜態檔案服務
│   ├── 健康檢查 (/healthz)
│   └── 主要聊天端點 (/chat)
└── 7. 伺服器啟動 (883-890行)
2. 環境配置檔案

檔案路徑：/.env
作用：儲存敏感配置和環境變數

env
# Gemini API 設定
GEMINI_API_KEY=your_gemini_api_key_here

# 伺服器設定
PORT=10000
HOST=0.0.0.0

# 部署設定
RENDER_EXTERNAL_URL=https://ai-hotel-assistant-builder.onrender.com
3. 靜態檔案目錄

目錄路徑：/public/
作用：存放前端介面和測試頁面

text
public/
├── index.html          # 主要前端介面
├── style.css          # 樣式表
└── script.js          # 前端 JavaScript
4. package.json - 專案依賴配置

檔案路徑：/package.json
作用：定義專案依賴和啟動指令

json
{
  "name": "ai-hotel-assistant",
  "version": "1.1.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node test-chat.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "node-fetch": "^3.3.2"
  }
}
🔧 核心功能模組詳解

A. 智能意圖分類器 (SmartIntentClassifier)

位置：server.js (140-250行)

功能：

正則表達式匹配 15+ 種用戶意圖
實體提取（日期、人數、房型、聯絡方式）
用戶類型識別（家庭、情侶、商務、個人）
支援的意圖：

booking - 訂房相關
transfer - 交通接送
restaurant - 餐廳推薦
member - 會員相關
emergency - 緊急求助
affirm/deny - 確認/拒絕
...等 15 種以上
B. 對話狀態機 (BookingFlowController)

位置：server.js (252-298行)

對話狀態流程：

text
init → collect_room_and_dates → ask_guest_count → check_availability_and_price
       ↓
ask_contact_info → confirm_member_and_meal → (apply_member_discount) → confirm_booking
       ↓
booking_complete 或 end_conversation
價格計算邏輯：

基礎房價：標準房 2200、豪華房 3200、行政房 4800
兒童加收：每位 300 元
會員折扣：8折優惠
C. 規則引擎 (RuleEngine)

位置：server.js (300-431行)

三層級規則處理：

緊急規則 (優先級 100)：處理火警、急救等緊急情況
訂房流程規則 (優先級 95)：處理完整訂房流程
一般規則 (優先級 10)：LLM 失敗時的最終回退
智能流程切換：

偵測流程中斷，避免無關意圖干擾訂房流程
上下文感知的回應引導
D. 回應生成器 (ResponseGenerator)

位置：server.js (578-745行)

多層次回應策略：

特殊指令處理（如翻譯指令）
高優先級規則回應（緊急、訂房）
Gemini LLM 智能回應
安全回退機制（LLM 失敗時）
🚀 部署與執行

本地開發環境

bash
# 1. 複製專案
git clone <repository-url>
cd ai-hotel-assistant

# 2. 安裝依賴
npm install

# 3. 配置環境變數
cp .env.example .env
# 編輯 .env 檔案，填入 GEMINI_API_KEY

# 4. 啟動開發伺服器
npm run dev
Render.com 雲端部署

連接 GitHub 儲存庫
設定環境變數：

GEMINI_API_KEY：您的 Gemini API 金鑰
PORT：10000
使用啟動指令：node server.js
API 端點

主端點：POST /chat
健康檢查：GET /healthz
前端介面：GET / (自動導向 index.html)
📡 API 使用方式

基本請求格式

json
POST /chat
{
  "sessionId": "unique-session-id-123",
  "message": "我要預訂豪華客房，6/1入住，共2晚"
}
成功回應格式

json
{
  "reply": "好的，我們將開始預訂...",
  "richCard": {
    "type": "button_list",
    "title": "請選擇服務類型：",
    "buttons": [
      { "text": "🛏️ 預訂房間", "value": "我要訂房" },
      { "text": "ℹ️ 查詢資訊", "value": "我想查詢資訊" }
    ]
  },
  "sessionId": "unique-session-id-123"
}
🧪 測試階段功能

測試指令

bash
# 使用 curl 測試
curl -X POST https://ai-hotel-assistant-builder.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-001","message":"我要訂房"}'

# 翻譯功能測試
curl -X POST https://your-app.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-002","message":"[translate:我想預訂兩晚豪華客房]"}'
前端測試頁面

訪問 https://your-app.onrender.com 可使用網頁版測試介面

常見測試案例

完整訂房流程：從詢問到完成預訂
流程中斷測試：訂房中詢問其他問題
緊急狀況測試：輸入緊急關鍵字
錯誤恢復測試：模擬 LLM API 失敗
⚠️ 已知限制與注意事項

當前限制

Gemini API 依賴：需要有效的 API 金鑰
中文為主：系統優化繁體中文處理
測試階段：部分邊界情況可能處理不完善
無資料庫：會話數據僅存於記憶體中
錯誤處理機制

系統具備四層錯誤處理：

API 重試機制：網路錯誤時自動重試
規則回退：LLM 失敗時使用規則回應
安全回退：所有層級失敗時返回通用問候
客戶端錯誤處理：400/500 錯誤的結構化回應
🛠️ 開發者指南

擴展對話狀態

在 DIALOGUE_FLOW.states 中添加新狀態：

javascript
"new_state": {
  "prompt": "您的提示訊息 {variable}",
  "entities": ["entity1", "entity2"],
  "next_state": "next_state_key",
  "intents": {
    "intent_name": "target_state"
  },
  "fallback": "回退訊息",
  "richCard": { /* 可選的 Rich Card 配置 */ }
}
添加新意圖

在 SmartIntentClassifier.classify() 中添加新的正則表達式：

javascript
if (/(新關鍵字|模式)/.test(lowerMessage)) intents.add('new_intent');
修改價格邏輯

調整 BookingFlowController.calculatePrice() 方法中的計算公式

📊 系統日誌說明

系統輸出結構化的日誌訊息，便於監控和除錯：

text
✅ Server is running on http://0.0.0.0:10000
🔑 Gemini API Key Status: Loaded
📝 Dialogue Flow Status: Fully Integrated

🎯 意圖識別: booking, date_input, affirm, 用戶類型: individual
🎯 規則觸發: bookingFlowRule, 優先級: 95
🟢 使用高優先級規則引擎回覆。

⚠️ 用戶在流程中 (State: ask_guest_count) 詢問了不相關的主題 (member)
🎯 規則觸發: generalRule, 優先級: 10
🤖 嘗試使用 Gemini AI 處理複雜問題
🔍 故障排除

常見問題

400 Bad Request：檢查請求格式是否正確
Gemini API 404：驗證 API 金鑰和模型名稱
無回應：檢查環境變數和伺服器日誌
會話重置：長時間無活動會重置會話狀態
除錯步驟

javascript
// 啟用詳細日誌
console.log('📥 收到請求:', JSON.stringify(req.body, null, 2));
console.log('🎯 識別意圖:', intents);
console.log('🏨 當前狀態:', session.bookingState);
console.log('📊 收集數據:', session.collectedData);
📈 未來擴展方向

資料庫整合：MySQL/PostgreSQL 儲存會話與訂單
多語言支援：擴展英文、日文等語言
支付整合：串接金流服務
通知系統：Email/SMS 確認通知
分析儀表板：對話分析與業務洞察
📝 版本記錄

v1.1.0 (當前版本)

增強意圖切換邏輯
改進錯誤隔離機制
優化 Render 部署配置
添加 Rich Card 按鈕支援
v1.0.0

基礎對話流程實現
混合式規則引擎
Gemini API 整合
基本錯誤處理
專案狀態：測試階段（功能完整，生產環境需進一步測試）

最後更新：2024年1月

維護者：AI 酒店助理開發團隊

支援：如有問題，請檢查伺服器日誌並參考本文件故障排除章節

# 🏨 酒店 AI 客服助理


一個基於 Node.js + Express + Gemini AI 的智能酒店客服系統，提供訂房、接送、餐廳推薦等服務。

## ✨ 功能特色

### 🤖 智能意圖識別
- 自動識別用戶意圖：訂房、接送、餐廳、價格查詢等
- 多輪對話上下文管理
- 用戶類型識別（家庭、商務、情侶等）

### 🎯 規則引擎 + AI 混合系統
- **規則引擎**：處理常見標準問題（價格、接送、設施等）
- **Gemini AI**：處理複雜創意問題（行程規劃、宣傳語等）
- **智能路由**：自動選擇最佳回應方式

### 🔄 智能重試機制
- 自動重試失敗的 API 請求
- 指數退避策略
- 完整的錯誤處理

## 🚀 快速開始

### 環境要求
- Node.js 18+
- npm 或 yarn

### 安裝步驟

1. **克隆專案**
```bash
git clone <your-repo-url>
cd claude-booking-assistant
安裝依賴
bash
npm install
環境變數設定
建立 .env 檔案：
bash
GEMINI_API_KEY=你的_Gemini_API_Key
啟動伺服器
bash
# 開發模式
npm start

# 或直接運行
node server.js
Railway 部署

專案已配置 Railway 部署：

連接 GitHub 倉庫到 Railway
設定環境變數 GEMINI_API_KEY
自動部署觸發
📡 API 端點

健康檢查

http
GET /health
首頁資訊

http
GET /
聊天接口

http
POST /api/chat
Content-Type: application/json

{
  "message": "請給我寫一個關於金卡會員的簡短宣傳語。",
  "sessionId": "可選的會話ID"
}
網頁聊天界面

http
GET /working-chat.html
🎪 支援的意圖類型

意圖	範例	處理方式
booking	我想訂房	規則引擎
transfer	機場接送	規則引擎
restaurant	推薦餐廳	規則引擎
pricing	房價多少	規則引擎
member	金卡會員宣傳	AI 生成
attractions	旅遊景點	AI 生成
itinerary	行程規劃	AI 生成
shopping	購物推薦	AI 生成
weather	天氣查詢	規則引擎
facilities	設施資訊	規則引擎
emergency	緊急狀況	規則引擎
🔧 技術架構

核心模組

SmartIntentClassifier - 意圖分類器
RuleEngine - 規則引擎
SessionManager - 會話管理
ResponseGenerator - 回應生成器
外部服務

Google Gemini AI - 自然語言處理
Express.js - Web 框架
CORS - 跨域支援
錯誤處理

fetchWithRetry - 自動重試機制
指數退避策略 (1s, 2s, 4s)
優雅的降級處理
📊 系統日誌

啟動後會顯示：

text
🚀 伺服器啟動完成！
🌐 端口: 8080
🔑 Gemini API: 已配置/未配置
🤖 規則引擎: 已啟用
🔄 Fetch重試: 已修復
🛠️ 開發指南

添加新的規則

在 RuleEngine 類別中添加新的規則方法：

javascript
static yourNewRule(intents, session, message) {
  if (intents.includes('your_intent')) {
    return {
      shouldProcess: true,
      priority: 90,
      response: "你的回覆內容"
    };
  }
  return { shouldProcess: false, priority: 0 };
}
添加新的意圖

在 SmartIntentClassifier.classify() 中添加識別邏輯：

javascript
if (/(你的關鍵字)/.test(lowerMessage)) intents.add('your_intent');
🐛 故障排除

常見問題

Gemini API 無法連接

檢查 GEMINI_API_KEY 是否正確
確認模型名稱是否可用
依賴安裝失敗

bash
rm -rf node_modules package-lock.json
npm install
端口被佔用

bash
lsof -ti:8080 | xargs kill -9
日誌級別

系統會輸出詳細的日誌資訊：

🎯 意圖識別 - 識別到的用戶意圖
⚠️ 偵測到複雜意圖 - 交給 AI 處理的請求
🔧 [DEBUG] - 調試資訊（如需要）
📄 版本資訊

v6.0.0 - 完整修復版本

✅ 修復 fetchWithRetry 重試邏輯
✅ 改進錯誤處理機制
✅ 優化規則引擎優先級
✅ 支援 Railway 部署
📞 支援

如有問題請提交 Issue 或聯繫開發團隊。


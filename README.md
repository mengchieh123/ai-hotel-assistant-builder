# 🏨 AI 飯店助理服務 (AI Hotel Assistant Builder)

這是一個基於 Node.js / Express 框架，並整合 Google Gemini API 和自定義規則引擎 (Rule Engine) 的智能飯店聊天助理服務。本服務旨在提供即時的客戶服務，包括訂房流程引導、飯店設施查詢、周邊景點推薦等功能。

---

## ✨ 服務狀態與亮點

| 項目 | 狀態 | 備註 |
| :--- | :--- | :--- |
| **部署狀態** | 🟢 **已上線 (Live)** | 服務已成功部署至 Render 平台。 |
| **外部 URL** | `https://ai-hotel-assistant-builder.onrender.com` | 服務的主要訪問地址。 |
| **核心 AI** | 🔑 **Gemini API** | 已配置並成功連線，用於處理複雜和創意性的請求。 |
| **業務邏輯** | 🤖 **規則引擎** | 已啟用，用於處理高優先級的流程性對話（如訂房）。 |

### 🚀 核心功能

* **智能訂房引導 (Rule Engine)**：引導用戶完成入住日期、退房日期等關鍵訂房資訊的收集。
* **設施資訊查詢 (Rule Engine)**：快速提供飯店設施（如泳池、健身房）的清單和營業時間。
* **周邊景點與餐廳推薦 (Gemini)**：利用 AI 生成創意和在地化的景點或餐廳推薦。
* **會員問題處理 (Gemini)**：處理關於金卡、VIP 服務等複雜的會員權益問題。

---

## 🛠️ 技術棧與要求

* **後端框架**：Node.js / Express
* **AI 服務**：Google Gemini API
* **數據格式**：JSON
* **部署平台**：Render

### 環境要求

您必須在您的環境中設置以下**環境變數 (Environment Variables)** 才能運行服務：

| 變數名稱 | 說明 |
| :--- | :--- |
| `PORT` | 服務監聽的端口 (例如：`10000`) |
| `GEMINI_API_KEY` | 您的 Google Gemini API 金鑰 |

---

## 💻 本地運行指南

### 1. 安裝依賴

進入專案根目錄，安裝所有必要的 Node.js 依賴：

```bash
npm install
2. 配置環境變數

創建一個 .env 文件（或直接在終端機中設置），並填入您的金鑰：

Bash
# .env 檔案範例
PORT=10000
GEMINI_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
3. 啟動服務

運行服務器：

Bash
node server.js
成功啟動後，您將看到以下輸出：

🚀 伺服器成功啟動！
🌐 監聽端口: 10000
❤️  健康檢查: http://localhost:10000/health
💬 聊天端點: http://localhost:10000/chat
4. 測試 API 端點

您可以使用 curl 命令來測試 /api/chat 端點（以本地端口 10000 為例）：

Bash
curl -X POST 'http://localhost:10000/api/chat' \
-H 'Content-Type: application/json' \
-d '{
    "message": "我想訂房",
    "sessionId": "test-local-001"
}'
⚠️ 已知問題與待辦事項
在最近的測試中，發現以下問題需要修復：

意圖混淆問題 (待修復)：當用戶詢問「景點推薦」時，系統有時會同時識別出 attractions 和 restaurant 意圖，並錯誤地返回餐廳資訊。

解決方向：需優化 RuleEngine.js 或 ResponseGenerator.js 中的多意圖處理邏輯，確保選取最相關的回應。

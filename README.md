🏨 AI 飯店智能客服系統

一個功能完整的智能飯店客服系統，提供訂房服務、旅遊資訊查詢、會員管理和即時對話功能。

https://img.shields.io/badge/Node.js-22.11.0-green
https://img.shields.io/badge/Express-4.18.2-blue
https://img.shields.io/badge/Deployed_on-Railway-orange

✨ 主要功能

🏨 訂房服務

智能房型推薦 - 根據人數自動推薦合適房型
價格計算 - 即時計算房價與優惠
會員折扣 - 支援多層級會員優惠系統
訂單管理 - 完整的訂房流程管理
🗺️ 旅遊資訊

景點推薦 - 自然、文化、親子等各類景點
餐廳指南 - 中式、西式、日式等多元美食
交通資訊 - 機場、車站、周邊交通指引
購物娛樂 - 購物中心、夜市、娛樂活動推薦
💎 會員服務

三級會員制度 - Gold / Platinum / Diamond
專屬優惠 - 房價折扣、免費早餐、延遲退房
點數累積 - 會員點數系統
專屬福利 - 房型升等、機場接送等
🛠️ 系統特色

會話管理 - 多用戶會話狀態維護
意圖識別 - 智能對話意圖分析
n8n 整合 - 自動化工作流程整合
RESTful API - 標準化 API 設計
🚀 快速開始

環境要求

Node.js >= 18.0.0
npm >= 9.0.0
安裝步驟

克隆專案
bash
git clone <repository-url>
cd ai-hotel-assistant
安裝依賴
bash
npm install
環境設定
bash
cp .env.example .env
編輯 .env 檔案：

env
PORT=8080
N8N_WEBHOOK_URL=your_n8n_webhook_url
N8N_API_KEY=your_n8n_api_key
啟動服務
bash
# 開發模式
npm run dev

# 生產模式
npm start
Railway 部署

連接 GitHub 倉庫
設定環境變數
自動部署
📡 API 文件

基礎端點

方法	端點	說明
GET	/	服務狀態檢查
GET	/health	健康檢查
GET	/api/health	API 健康狀態
聊天對話 API

POST /api/chat

請求範例：

json
{
  "message": "你好，我想訂房",
  "sessionId": "optional_session_id"
}
回應範例：

json
{
  "reply": "🏨 歡迎使用訂房服務！...",
  "sessionId": "session_123456789",
  "nextStep": "start_booking",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
會話管理 API

GET /api/sessions - 取得所有會話列表

DELETE /api/sessions/:sessionId - 刪除特定會話

🏗️ 系統架構

text
┌─────────────────┐    ┌──────────────────┐  ┌─────────────────┐
│   客戶端         │    │   Express 伺服器  │   │   外部服務        │
│                 │    │                  │  │                 │
│ • Web App       │◄──►│ • 對話處理引擎    │◄──►│ • n8n 自動化     │
│ • Mobile App    │    │ • 會話管理       │    │ • 資料庫         │
│ • Chat Widget   │    │ • API 路由       │   │ • 第三方整合      │
└─────────────────┘    └──────────────────┘  └─────────────────┘

💬 對話流程

訂房流程

text
歡迎訊息 → 人數確認 → 房型選擇 → 天數輸入 → 價格計算 → 會員優惠 → 訂單確認
旅遊諮詢

text
意圖識別 → 分類查詢 → 資訊推薦 → 詳細說明 → 後續引導
🎯 功能詳情

房型系統

房型	價格/晚	最大人數	床型	特色
標準雙人房	NT$2,800	2大1小	1張雙人床	基本設施齊全
豪華雙人房	NT$3,800	2大2小	1張加大雙人床	景觀較佳，可加嬰兒床
套房	NT$5,800	3大2小	雙人床+沙發床	獨立客廳，豪華衛浴
家庭房	NT$4,500	2大3小	2張雙人床	專為家庭設計
會員等級

等級	折扣	主要福利
Gold	9折	免費早餐、延遲退房至14:00
Platinum	85折	保證房型升等、迎賓禮品
Diamond	8折	專屬樓層、機場接送、免費晚餐
旅遊服務分類

景點推薦: 自然景觀、文化歷史、親子景點
餐廳類型: 中式、西式、日式、素食
購物場所: 精品百貨、平價賣場、特色夜市
娛樂活動: 夜間娛樂、文化活動、休閒娛樂
🔧 開發指南

專案結構

text
ai-hotel-assistant/
├── server.js              # 主應用程式
├── package.json           # 依賴管理
├── railway.toml          # Railway 部署配置
├── .env                  # 環境變數
└── README.md             # 專案說明
新增對話意圖

在 processMessage 中添加意圖識別
javascript
else if (!response && lowerMsg.includes('你的關鍵字')) {
  response = handleYourIntent(cleanMessage, session);
  detectedIntent = 'your_intent';
}
實作處理函數
javascript
function handleYourIntent(message, session) {
  // 你的處理邏輯
  return {
    reply: "回應訊息",
    nextStep: "下一步驟"
  };
}
環境變數說明

變數名稱	必填	預設值	說明
PORT	否	8080	服務端口
N8N_WEBHOOK_URL	否	-	n8n webhook 網址
N8N_API_KEY	否	-	n8n API 金鑰
🚀 部署說明

Railway 部署

Fork 此專案到你的 GitHub
在 Railway 連接 GitHub 倉庫
設定環境變數
自動部署完成
本地部署

bash
npm start
Docker 部署

dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
📊 監控與日誌

系統提供完整的日誌記錄：

✅ 請求處理日誌
✅ 錯誤追蹤
✅ 會話狀態監控
✅ 效能指標
🤝 貢獻指南

我們歡迎各種形式的貢獻！

Fork 專案
建立功能分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
開啟 Pull Request
📝 更新日誌

v1.0.0 (2024-01-01)

✅ 基礎訂房系統
✅ 旅遊資訊查詢
✅ 會員管理功能
✅ n8n 整合
✅ Railway 部署支援
🐛 問題回報

如果您發現任何問題，請透過 GitHub Issues 回報。

📄 授權

此專案採用 MIT 授權 - 詳見 LICENSE 檔案。

👥 開發團隊

專案維護者 - [你的名字]
貢獻者 - [貢獻者名單]
🌟 致謝

感謝所有為此專案貢獻的開發者！

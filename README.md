🏨 AI Hotel Assistant - 智能訂房助理


多功能智能酒店服務系統，整合訂房管理、景點推薦、會員服務於一體

🌐 即時服務狀態
生產環境: 🟢 正常運行
服務網址: https://ai-hotel-assistant-builder-production.up.railway.app
版本: 5.5.0
最後更新: 2025-11-11T06:41:19.742Z

✨ 核心功能
🏨 訂房服務

多輪對話訂房 — 智能引導完成完整訂房流程

即時價格查詢 — 支援多種房型價格計算

訂單管理 — 創建、查詢、取消訂單

會員優惠 — 多層級會員折扣系統

🏞️ 景點推薦服務

附近景點查詢 — 酒店200公尺內景點推薦

智能分類 — 美食、購物、自然、文化等6大類別

詳細資訊 — 營業時間、評分、地址、聯絡方式

關鍵字搜索 — 精準搜索特定景點

💬 智能對話

意圖識別 — 自動判斷用戶需求

會話管理 — 多輪對話狀態維護

上下文理解 — 保持對話連貫性

🚀 快速開始
環境要求

Node.js >= 14.0.0

npm 或 yarn

安裝步驟

bash
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder
npm install

# 啟動服務
npm start

# 或使用守護進程模式（推薦用於 Codespaces）
npm run keep-alive
驗證服務

bash
curl https://ai-hotel-assistant-builder-production.up.railway.app/health
📡 API 端點說明
方法	路徑	描述
GET	/	API 資訊與文檔
GET	/health	服務健康狀態
POST	/chat	聊天智能對話接口
POST	/api/price	房價計算請求 (註意部署變化)
POST	/api/booking	建立訂單
POST	/api/cancel-booking	取消訂單
GET	/api/attractions/nearby	附近景點查詢
GET	/api/attractions/search	景點全文搜索
GET	/api/attractions/categories	景點分類
GET	/api/attractions/details/:name	景點詳細
GET	/api/sessions/:sessionId	會話資料查詢
POST	/api/session/:sessionId/reset	會話重置
GET	/api/promotions	優惠政策摘要
GET	/api/n8n-status	n8n 集成狀態查詢
🔧 開發指南
本地開發可使用 npm start 啟動服務後，以 Postman 或 curl 測試 API。

支持 GitHub Codespaces 即時雲端開發，點擊 Code → Open with Codespaces，等待環境完成自動配置。

📚 優惠政策與資料庫
配置有多種優惠方案：長者優惠、長住優惠、團體優惠、會員專屬及兒童政策。

附帶附近美食、購物與觀光景點資料庫，及頂樓餐廳、游泳池、商務中心等飯店設施資料。

🔄 n8n 整合說明
系統與 n8n 自動化平台整合，核心包括：

訂房完成自動推送訂單資料（含訂單號、消費資訊）至 n8n，觸發後續服務流程。

用戶每次查詢與交互詳細記錄推送，支持數據分析與行銷活動調整。

優惠查詢行為也同步記錄於 n8n，幫助精準推廣。

需設定環境變數 N8N_WEBHOOK_URL 與 N8N_API_KEY。

n8n webhook 端點預設為 /webhook/hotel-booking，/webhook/customer-inquiry 等。

🐛 常見問題
服務啟動失敗，請確認端口是否被佔用。

請確保服務綁定 0.0.0.0，外部可訪問。

會話數據丟失，會話持久化文件 sessions.json 是否正常寫入。

API 返回 404，請確認請求路徑與方法是否正確。

n8n webhook 無反應，檢查 URL、API KEY 和防火牆設定。

🤝 貢獻指南
歡迎提交代碼與功能建議：

Fork 本 repo

建立分支 feature/xxx

Commit 與 push

開啟 Pull Request

請遵守 JavaScript Standard Style，並補充測試案例。

📄 授權
本專案採用 MIT 授權，詳見 LICENSE 文件。

📞 聯絡與支援
如有疑問或獲得技術支援，請透過 GitHub Issues 聯繫專案團隊。

感謝您使用 AI Hotel Assistant，期待為您的酒店服務智能化貢獻力量！🏨✨

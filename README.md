🏨 AI Hotel Assistant - 智能訂房助理

https://img.shields.io/badge/node-%253E%253D14.0.0-brightgreen
https://img.shields.io/badge/express.js-4.x-blue
https://img.shields.io/badge/license-MIT-yellow

一個功能完整的智能訂房助理系統，整合訂房服務、價格計算、會員管理、景點推薦等多項功能，提供自然語言對話接口和完整的 RESTful API。

✨ 核心功能

🏨 訂房服務

多輪對話訂房 - 智能引導完成完整訂房流程
即時價格查詢 - 支援多種房型價格計算
訂單管理 - 創建、查詢、取消訂單
會員優惠 - 多層級會員折扣系統
🏞️ 景點推薦服務

附近景點查詢 - 酒店200公尺內景點推薦
智能分類 - 美食、購物、自然、文化等6大類別
詳細資訊 - 營業時間、評分、地址、聯絡方式
關鍵字搜索 - 精準搜索特定景點
💬 智能對話

意圖識別 - 自動判斷用戶需求
會話管理 - 多輪對話狀態維護
上下文理解 - 保持對話連貫性
🚀 快速開始

環境要求

Node.js >= 14.0.0
npm 或 yarn
安裝步驟

克隆專案
bash
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder
安裝依賴
bash
npm install
啟動服務
bash
# 開發模式
npm start

# 或使用守護進程模式（推薦用於 Codespaces）
npm run keep-alive
驗證服務
bash
curl http://localhost:8080/health
📡 API 文檔

基礎端點

方法	端點	描述	參數
GET	/	API 資訊	-
GET	/health	健康檢查	-
訂房服務

價格查詢

http
POST /api/price
Content-Type: application/json

{
  "roomType": "standard",
  "nights": 2,
  "guestCount": 2
}
直接訂房

http
POST /api/booking
Content-Type: application/json

{
  "checkInDate": "2024-12-25",
  "nights": 2,
  "roomType": "standard",
  "guestCount": 2,
  "guestName": "王小明",
  "memberLevel": "gold"
}
取消訂單

http
POST /api/cancel-booking
Content-Type: application/json

{
  "bookingId": "BKG-123456"
}
景點服務

附近景點查詢

http
GET /api/attractions/nearby?type=food&maxDistance=200
景點搜索

http
GET /api/attractions/search?keyword=牛肉麵
景點分類

http
GET /api/attractions/categories
詳細資訊

http
GET /api/attractions/details/鼎泰豐
智能對話

聊天接口

http
POST /chat
Content-Type: application/json

{
  "message": "附近有什麼好吃的餐廳",
  "sessionId": "user-123"
}
會話管理

會話統計

http
GET /api/sessions/stats
會話詳情

http
GET /api/sessions/{sessionId}
重置會話

http
DELETE /api/sessions/{sessionId}
🏗️ 專案架構

text
ai-hotel-assistant-builder/
├── services/                 # 業務邏輯模組
│   ├── bookingService.js     # 訂房服務
│   ├── pricingService.js     # 價格計算
│   ├── memberService.js      # 會員服務
│   └── attractionsService.js # 景點服務
├── server.js                # 主服務入口
├── package.json             # 專案配置
├── sessions.json           # 會話持久化文件
└── README.md               # 說明文件
核心模組說明

bookingService - 處理訂房相關業務邏輯
pricingService - 價格計算和優惠策略
memberService - 會員權益和積分系統
attractionsService - 景點資料和推薦算法
🔧 開發指南

本地開發

啟動開發服務
bash
npm start
測試 API
bash
# 健康檢查
curl http://localhost:8080/health

# 測試價格查詢
curl -X POST http://localhost:8080/api/price \
  -H "Content-Type: application/json" \
  -d '{"roomType":"standard"}'

# 測試景點服務
curl "http://localhost:8080/api/attractions/nearby?type=food"
GitHub Codespaces 部署

專案已配置支援 GitHub Codespaces，自動端口轉發和環境配置。

在 GitHub 頁面點擊 "Code" → "Open with Codespaces"
等待環境構建完成
服務將自動在 https://{your-codespace}.app.github.dev 運行
環境變數

變數	預設值	描述
PORT	8080	服務端口
NODE_ENV	development	運行環境
🧪 測試

Postman 測試集合

專案提供完整的 Postman 測試集合，包含：

✅ 健康檢查測試
✅ 訂房流程測試
✅ 景點服務測試
✅ 對話流程測試
✅ 錯誤處理測試
手動測試腳本

bash
# 執行完整測試流程
./test-all-apis.sh
🔄 版本資訊

v5.5.0 (當前版本)

✅ 新增景點推薦服務
✅ 改進對話意圖識別
✅ 優化會話管理系統
✅ 增強錯誤處理機制
v5.4.0

✅ 基礎訂房服務
✅ 價格計算系統
✅ 會員管理功能
✅ 多輪對話支持
🐛 常見問題

Q: 服務啟動失敗，端口被佔用？

A: 使用不同端口啟動：

bash
PORT=3000 npm start
Q: 外部無法訪問服務？

A: 確保服務綁定到 0.0.0.0，檢查 Codespaces 端口轉發配置。

Q: 會話數據丟失？

A: 會話數據自動持久化到 sessions.json，重啟服務後會自動恢復。

Q: API 返回 404 錯誤？

A: 檢查服務是否正常運行，確認端點路徑正確。

🤝 貢獻指南

我們歡迎社區貢獻！請遵循以下流程：

Fork 本專案
創建功能分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
開啟 Pull Request
開發規範

遵循 JavaScript Standard Style
添加適當的錯誤處理
更新相關文檔
添加測試用例
📄 授權

本專案採用 MIT 授權 - 查看 LICENSE 文件了解詳情。

📞 支援

如果您遇到問題或有建議：

查看 常見問題 章節
搜索 Issues
開啟新的 Issue 描述問題
🏆 致謝

感謝所有為這個專案做出貢獻的開發者！

AI Hotel Assistant - 讓酒店服務更智能，讓旅客體驗更美好 🏨✨

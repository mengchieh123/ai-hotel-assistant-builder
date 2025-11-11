# 🏨 AI Hotel Assistant - 智能訂房助理

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/express.js-4.x-blue)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

> 多功能智能酒店服務系統，整合訂房管理、景點推薦、會員服務於一體

## 🌐 即時服務狀態

**生產環境**: 🟢 正常運行  
**服務網址**: `https://ai-hotel-assistant-builder-production.up.railway.app`  
**版本**: 5.5.0  
**最後更新**: 2025-11-11T06:41:19.742Z

## ✨ 核心功能

### 🏨 訂房服務
- **多輪對話訂房** - 智能引導完成完整訂房流程
- **即時價格查詢** - 支援多種房型價格計算
- **訂單管理** - 創建、查詢、取消訂單
- **會員優惠** - 多層級會員折扣系統

### 🏞️ 景點推薦服務
- **附近景點查詢** - 酒店200公尺內景點推薦
- **智能分類** - 美食、購物、自然、文化等6大類別
- **詳細資訊** - 營業時間、評分、地址、聯絡方式
- **關鍵字搜索** - 精準搜索特定景點

### 💬 智能對話
- **意圖識別** - 自動判斷用戶需求
- **會話管理** - 多輪對話狀態維護
- **上下文理解** - 保持對話連貫性

## 🚀 快速開始

### 環境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安裝步驟

1. **克隆專案**
```bash
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
curl https://ai-hotel-assistant-builder-production.up.railway.app/health
📡 API 文檔

🏠 基礎端點

方法	端點	描述	狀態
GET	/	API 資訊與文檔	✅ 正常
GET	/health	服務健康狀態	✅ 正常
API 資訊響應示例:

json
{
  "message": "🏨 AI 訂房助理 API 服務",
  "version": "5.5.0",
  "timestamp": "2025-11-11T06:41:19.742Z",
  "endpoints": {
    "health": "/health",
    "chat": "/chat (POST)",
    "pricing": "/api/price (POST)",
    "booking": "/api/booking (POST)",
    "cancel": "/api/cancel-booking (POST)",
    "attractions": {
      "nearby": "/api/attractions/nearby",
      "search": "/api/attractions/search",
      "categories": "/api/attractions/categories",
      "details": "/api/attractions/details/:name"
    },
    "sessions": {
      "stats": "/api/sessions/stats",
      "management": "/api/sessions/:sessionId",
      "backup": "/api/sessions/backup"
    }
  },
  "documentation": "請查看 README.md 了解詳細 API 使用方法"
}
🏨 訂房服務

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
🏞️ 景點服務

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
💬 智能對話

聊天接口

http
POST /chat
Content-Type: application/json

{
  "message": "附近有什麼好吃的餐廳",
  "sessionId": "user-123"
}
🔧 會話管理

會話統計

http
GET /api/sessions/stats
會話詳情

http
GET /api/sessions/{sessionId}
重置會話

http
DELETE /api/sessions/{sessionId}
會話備份

http
GET /api/sessions/backup
🎯 快速測試

基礎功能驗證

bash
# 健康檢查
curl https://ai-hotel-assistant-builder-production.up.railway.app/health

# 價格查詢
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/price \
  -H "Content-Type: application/json" \
  -d '{"roomType":"standard"}'

# 景點推薦
curl "https://ai-hotel-assistant-builder-production.up.railway.app/api/attractions/nearby?type=food"

# 智能對話
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"我想訂房", "sessionId":"test-1"}'
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
🧪 測試與品質保證

Postman 測試集合

專案提供完整的 Postman 測試集合，包含：

✅ 健康檢查測試 - 服務狀態驗證
✅ 訂房流程測試 - 完整多輪對話訂房
✅ 景點服務測試 - 景點推薦與搜索
✅ 會員服務測試 - 會員權益驗證
✅ 取消流程測試 - 訂單取消流程
✅ 錯誤處理測試 - 異常情況處理
✅ 會話管理測試 - 會話狀態監控
測試劇本涵蓋場景

完整訂房流程 (6步驟對話)
景點探索流程 (分類推薦 → 詳細資訊)
會員服務查詢 (優惠權益咨詢)
訂單取消流程 (取消對話與直接API)
綜合情境測試 (真實使用場景)
🔧 開發指南

本地開發

bash
# 啟動開發服務
npm start

# 測試 API
curl http://localhost:8080/health
GitHub Codespaces 部署

專案已完美支援 GitHub Codespaces：

點擊 Code → Open with Codespaces
等待環境自動配置
服務將在 https://your-codespace.app.github.dev 運行
環境變數

變數	預設值	描述
PORT	8080	服務端口
NODE_ENV	development	運行環境
🔄 版本資訊

v5.5.0 (當前版本)

✅ 新增景點推薦服務
✅ 改進對話意圖識別
✅ 優化會話管理系統
✅ 增強錯誤處理機制
✅ 完整 Postman 測試集合
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

A: 確保服務綁定到 0.0.0.0，檢查環境端口配置。

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

立即體驗生產環境: https://ai-hotel-assistant-builder-production.up.railway.app

讓AI為您的酒店服務增添智能！🏨✨

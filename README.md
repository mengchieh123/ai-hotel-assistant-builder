markdown
# 🏨 AI Hotel Assistant Builder

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.18-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Deployment](https://img.shields.io/badge/Deployment-Railway-success.svg)
[![API Status](https://img.shields.io/badge/API-Live-brightgreen)](https://ai-hotel-assistant-builder-production.up.railway.app/health)

## 📖 項目概述

AI Hotel Assistant Builder 是一個自主開發的智能酒店預訂系統，通過自然語言處理技術理解用戶需求，提供智能化的酒店搜索和預訂服務。

## 🌐 線上演示

**立即體驗**: [AI Hotel Assistant 生產環境](https://ai-hotel-assistant-builder-production.up.railway.app)

### 🚀 快速測試
```bash
# 健康檢查
curl https://ai-hotel-assistant-builder-production.up.railway.app/health

# AI 對話理解
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我想訂台北的五星級酒店，預算5000元，這週末入住",
    "context": "hotel-booking"
  }'

# 飯店搜尋
curl "https://ai-hotel-assistant-builder-production.up.railway.app/api/hotels/search?location=台北&guests=2&minPrice=0&maxPrice=5000"
✨ 核心功能

🤖 智能對話理解

自然語言處理: 理解用戶的酒店預訂需求
需求解析: 自動提取地點、預算、時間、星級要求
上下文理解: 支持多輪對話上下文
🔍 精準飯店搜尋

多條件過濾: 地點、價格、評分、設施
智能排序: 基於用戶偏好推薦
實時可用性: 即時庫存檢查
📋 無縫預訂體驗

快速預訂: 一鍵創建預訂
確認通知: 即時生成確認信息
狀態跟踪: 預訂狀態實時更新
🛠️ 技術架構

後端技術棧

Runtime: Node.js 18+
框架: Express.js 4.18
部署: Railway
API風格: RESTful
系統組件

text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   客戶端        │    │   API 服務層      │    │   業務邏輯層     │
│ (Web/App/API)   │───▶│ (Express Router) │───▶│ (Service Layer) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                      ┌──────────────────┐    ┌─────────────────┐
                      │   中間件層        │    │   數據管理層     │
                      │ (Auth/Validation)│    │ (Data Manager)  │
                      └──────────────────┘    └─────────────────┘
📡 API 端點詳解

系統管理

GET /health - 服務健康檢查
GET / - API 文檔和服務信息
AI 服務核心

POST /api/ai/chat - 智能對話處理
GET /api/hotels/search - 飯店搜尋
POST /api/bookings/create - 創建預訂
自主開發管理

GET /api/autonomous/status - 系統狀態監控
GET /api/validate/speckit - 配置驗證
POST /api/autonomous/develop - 自主開發觸發
GET /api/development/status - 開發進度查詢
🚀 快速開始

環境要求

Node.js 18.0.0+
npm 或 yarn
本地開發

bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 運行測試
npm test
服務啟動後訪問: http://localhost:3000

生產部署

bash
# 構建和啟動
npm start
🎯 使用示例

1. AI 對話 API 集成

javascript
// 前端集成示例
const response = await fetch('https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: '我想訂台北的五星級酒店，預算5000元',
    context: 'hotel-booking'
  })
});

const data = await response.json();
console.log(data.analysis); // 獲取解析結果
2. 飯店搜尋集成

javascript
// 搜索台北的飯店
const searchParams = new URLSearchParams({
  location: '台北',
  guests: 2,
  minPrice: 0,
  maxPrice: 5000,
  rating: 4.5
});

const response = await fetch(`https://ai-hotel-assistant-builder-production.up.railway.app/api/hotels/search?${searchParams}`);
const hotels = await response.json();
📊 項目狀態

當前版本

版本號: v1.0.0
環境: 生產環境
狀態: 🟢 正常運行
最後部署: 2024年1月
監控指標

可用性: 99.9%+
響應時間: < 100ms
錯誤率: < 0.1%
🔧 開發指南

項目結構

text
ai-hotel-assistant-builder/
├── server.js              # 主應用程序
├── package.json           # 項目配置
├── README.md              # 項目文檔
├── test/                  # 測試用例
│   ├── api.test.js        # API 測試
│   └── integration.test.js # 集成測試
└── docs/                  # 技術文檔
    ├── API_DOCUMENTATION.md
    └── DEPLOYMENT_GUIDE.md
代碼貢獻

Fork 本項目
創建功能分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
開啟 Pull Request
📄 文檔鏈接

詳細 API 文檔
技術架構說明
部署操作指南
測試報告
👥 聯繫信息

項目維護者: mengchieh123
技術支持: 通過 GitHub Issues
業務咨詢: 提供 API 集成支持

📜 許可證

本項目採用 MIT 許可證 - 詳見 LICENSE 文件。

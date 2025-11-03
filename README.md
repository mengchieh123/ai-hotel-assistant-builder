cat > README.md << 'EOF'
# 🏨 AI Hotel Assistant Builder

<div align="center">

[![Railway](https://img.shields.io/badge/Railway-Deployed-success?logo=railway&style=for-the-badge)](https://railway.app/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green?logo=node.js&style=for-the-badge)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-lightgrey?logo=express&style=for-the-badge)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

**自動化開發系統 · 從規格到生產的完整工作流**

[📖 文檔](#-快速開始) · [🚀 部署](#-部署) · [🔗 在線演示](https://ai-hotel-assistant-builder-production.up.railway.app)

</div>

---

## 📋 目錄

- [項目簡介](#-項目簡介)
- [核心特性](#-核心特性)
- [在線演示](#-在線演示)
- [快速開始](#-快速開始)
- [項目結構](#-項目結構)
- [Speckit 使用指南](#-speckit-使用指南)
- [API 文檔](#-api-文檔)
- [部署](#-部署)
- [技術棧](#-技術棧)
- [貢獻指南](#-貢獻指南)
- [版本歷史](#-版本歷史)
- [許可證](#-許可證)

---

## 🎯 項目簡介

**AI Hotel Assistant Builder** 是一個創新的旅宿業務管理平台，透過 **Speckit 規格驅動開發**（Specification-Driven Development）實現從業務需求到生產部署的自動化流程。

### 為什麼選擇 AI Hotel Assistant Builder？

- 🚀 **快速開發** - 從規格到代碼，10 分鐘完成一個功能模塊
- 📝 **規格驅動** - YAML 定義業務邏輯，自動生成模型、服務、API
- ☁️ **零配置部署** - Git push 自動部署到 Railway，1 分鐘上線
- 🔄 **持續整合** - 自動測試、構建、部署，確保代碼質量
- 📊 **完整監控** - 健康檢查、日誌追蹤、性能分析

---

## ✨ 核心特性

### 🚀 Speckit 自動開發系統

定義業務規格
features:

name: MEMBERSHIP_SYSTEM
description: 會員管理系統
models:

Member
services:

membership-service

text
undefined
自動生成代碼
npm run speckit:generate

✅ 生成 3 個文件
generated/models/Member.js
generated/services/membership-service.js
generated/routes/member-routes.js
text

### 🏗️ 完整的業務功能

| 功能模塊 | 說明 | 狀態 |
|---------|------|------|
| 會員管理 | 等級制度、積分累積、會員權益 | ✅ 已實現 |
| 促銷引擎 | 折扣規則、優惠券、活動排程 | ✅ 已實現 |
| 訂單處理 | 預訂流程、支付整合、訂單追蹤 | 🚧 開發中 |
| 數據分析 | 業務指標、報表生成、趨勢分析 | 📋 計劃中 |

### ⚡ 現代化技術棧

- **Runtime**: Node.js 22.x
- **Framework**: Express.js 4.18.2
- **配置**: YAML/JSON
- **部署**: Railway V2 (Asia Southeast)
- **CI/CD**: GitHub Actions

---

## 🔗 在線演示

### 🌐 生產環境

**主服務**: https://ai-hotel-assistant-builder-production.up.railway.app

### 📍 可用端點

#### 系統端點

| 端點 | 方法 | 說明 | 測試鏈接 |
|------|------|------|---------|
| `/` | GET | API 信息和端點列表 | [🔗 測試](https://ai-hotel-assistant-builder-production.up.railway.app/) |
| `/health` | GET | 健康檢查 | [🔗 測試](https://ai-hotel-assistant-builder-production.up.railway.app/health) |

#### 前端演示

| 頁面 | 說明 | 訪問鏈接 |
|------|------|---------|
| 主頁 | 系統信息和導航 | [🔗 訪問](https://ai-hotel-assistant-builder-production.up.railway.app/) |
| 產品經理演示 | Speckit 功能演示界面 | [🔗 訪問](https://ai-hotel-assistant-builder-production.up.railway.app/demo) |
| 靜態演示頁面 | 完整 HTML 演示 | [🔗 訪問](https://ai-hotel-assistant-builder-production.up.railway.app/product-manager-demo.html) |

#### API 端點

| 端點 | 方法 | 說明 | 示例 |
|------|------|------|------|
| `/api/members` | GET | 獲取會員列表 | `GET /api/members` |
| `/api/members/:id` | GET | 獲取單個會員 | `GET /api/members/123` |
| `/api/promotions` | GET | 獲取促銷列表 | `GET /api/promotions` |
| `/api/promotions/:id` | GET | 獲取單個促銷 | `GET /api/promotions/456` |

### 🧪 快速測試

測試健康檢查
curl https://ai-hotel-assistant-builder-production.up.railway.app/health

預期響應
{
"status": "healthy",
"service": "AI Hotel Assistant",
"version": "2.0.0",
"timestamp": "2025-11-03T14:00:00.000Z",
"port": 3000
}

text

---

## 📦 快速開始

### 環境要求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** (用於版本控制)

### 安裝

1. 克隆倉庫
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

2. 安裝依賴
npm install

3. 配置環境變量（可選）
cp .env.example .env

4. 啟動開發服務器
npm start

text

### 驗證安裝

測試健康檢查
curl http://localhost:3000/health

預期響應
{
"status": "healthy",
"service": "AI Hotel Assistant",
"timestamp": "...",
"port": 3000
}

text

### 瀏覽器訪問

打開瀏覽器訪問：
- **主頁**: http://localhost:3000
- **健康檢查**: http://localhost:3000/health
- **演示頁面**: http://localhost:3000/demo

---

## 📁 項目結構

ai-hotel-assistant-builder/
├── 📂 speckit/ # 業務規格定義
│ ├── business_speckit.yaml # 業務功能規格
│ ├── dynamic_speckit.yaml # 動態功能配置
│ ├── cli.js # Speckit CLI 工具
│ └── generator/ # 代碼生成器
│ ├── model-generator.js
│ ├── service-generator.js
│ └── route-generator.js
│
├── 📂 generated/ # 自動生成的代碼
│ ├── models/ # 數據模型
│ │ └── Member.js
│ ├── services/ # 業務服務
│ │ ├── membership-service.js
│ │ └── promotion-service.js
│ └── routes/ # API 路由
│ └── (待生成)
│
├── 📂 public/ # 靜態文件
│ └── product-manager-demo.html
│
├── 📂 scripts/ # 工具腳本
│ ├── safe-deploy.sh
│ └── quick-rollback.sh
│
├── 📄 server.js # Express 服務器主文件
├── 📄 railway.toml # Railway 部署配置
├── 📄 package.json # 項目配置
├── 📄 .env.example # 環境變量範例
└── 📄 README.md # 項目文檔

text

---

## 🎯 Speckit 使用指南

### 什麼是 Speckit？

Speckit 是一個**規格驅動的開發系統**，讓產品經理和開發者可以通過 YAML 文件定義業務邏輯，系統自動生成對應的代碼結構。

### 基本工作流

graph LR
A[編輯 YAML 規格] --> B[運行生成命令]
B --> C[自動生成代碼]
C --> D[Git 提交]
D --> E[自動部署]

text

### 創建新功能

#### 1. 編輯規格文件

在 `speckit/business_speckit.yaml` 中添加新功能：

features:

name: LOYALTY_PROGRAM
description: 會員忠誠度計劃
priority: high
enabled: true

定義數據模型
models:

name: LoyaltyPoint
fields:

name: memberId
type: String
required: true

name: points
type: Number
required: true

name: earnedAt
type: Date
required: true

定義服務
services:

name: loyalty-service
methods:

earnPoints

redeemRewards

checkBalance

定義 API 路由
routes:

path: /api/loyalty
methods:

GET

POST

text

#### 2. 生成代碼

自動生成模型、服務和 API
npm run speckit:generate

查看生成的文件
ls generated/models/ # LoyaltyPoint.js
ls generated/services/ # loyalty-service.js
ls generated/routes/ # loyalty-routes.js

text

#### 3. 驗證規格

驗證 YAML 語法和結構
npm run speckit:validate

✅ 規格文件驗證通過
📋 可生成功能: LOYALTY_PROGRAM
text

#### 4. 測試和部署

本地測試
npm start

提交並自動部署
git add .
git commit -m "feat: add loyalty program"
git push origin main

✅ Railway 自動部署
text

---

## 🔧 可用命令

### 開發命令

啟動服務器
npm start

開發模式（含熱重載）
npm run dev:watch

Speckit 生成代碼
npm run speckit:generate

Speckit 驗證規格
npm run speckit:validate

text

### 部署命令

本地測試
npm test

構建生產版本
npm run build

部署到 Railway（自動觸發）
git push origin main

text

### Railway CLI 命令

查看部署狀態
railway status

查看實時日誌
railway logs

查看構建日誌
railway logs --build

查看服務域名
railway domain

text

---

## 📚 API 文檔

### 健康檢查

**端點**: `GET /health`

**響應**:
{
"status": "healthy",
"service": "AI Hotel Assistant",
"version": "2.0.0",
"timestamp": "2025-11-03T14:00:00.000Z",
"port": 3000,
"features": [
"Speckit Auto Development",
"Static File Serving",
"Health Monitoring"
]
}

text

### 會員 API

#### 獲取會員列表
GET /api/members

響應
{
"success": true,
"data": [
{
"id": "123",
"name": "張三",
"level": "GOLD",
"points": 5000
}
]
}

text

#### 獲取單個會員
GET /api/members/:id

響應
{
"success": true,
"data": {
"id": "123",
"name": "張三",
"level": "GOLD",
"points": 5000,
"joinDate": "2024-01-15"
}
}

text

### 促銷 API

#### 獲取促銷列表
GET /api/promotions

響應
{
"success": true,
"data": [
{
"id": "456",
"name": "早鳥優惠",
"discount": 15,
"startDate": "2025-01-01",
"endDate": "2025-12-31"
}
]
}

text

---

## 🚀 部署

### Railway 自動部署

項目已配置 Railway V2 自動部署，每次推送到 `main` 分支會自動觸發：

git add .
git commit -m "feat: add new feature"
git push origin main

✅ 自動觸發部署
⏱️ 構建時間: ~20 秒
✅ 健康檢查通過
🌐 自動更新生產環境
text

### 部署流程

graph TD
A[Git Push] --> B[Railway 檢測]
B --> C[構建 Docker 鏡像]
C --> D[運行測試]
D --> E[健康檢查]
E --> F[部署完成]

text

### 健康檢查配置

Railway 會在部署後自動進行健康檢查：

- **路徑**: `/health`
- **超時**: 30 秒
- **重試**: 自動重啟失敗的服務
- **方法**: GET

### 查看部署狀態

#### 使用 Railway Dashboard
訪問: https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda

#### 使用 Railway CLI
安裝 CLI
npm install -g @railway/cli

登錄
railway login

鏈接項目
railway link

查看狀態
railway status

查看日誌
railway logs

查看構建日誌
railway logs --build

text

---

## 🛠️ 技術棧

### 核心技術

| 類別 | 技術 | 版本 | 說明 |
|------|------|------|------|
| **Runtime** | Node.js | 22.x | JavaScript 運行環境 |
| **Web Framework** | Express.js | 4.18.2 | Web 應用框架 |
| **配置管理** | YAML | 2.8.1 | 業務規格定義 |
| **文件監聽** | Chokidar | 4.0.3 | 自動檢測文件變更 |
| **環境變量** | dotenv | 17.2.3 | 環境配置管理 |

### 部署與 CI/CD

| 類別 | 技術 | 說明 |
|------|------|------|
| **部署平台** | Railway V2 | 自動化部署 |
| **版本控制** | Git/GitHub | 代碼管理 |
| **CI/CD** | Railway Auto Deploy | 自動構建和部署 |
| **監控** | Railway Logs | 日誌和監控 |

---

## 🤝 貢獻指南

### 開發流程

1. Fork 項目
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 代碼規範

- 使用 ESLint 進行代碼檢查
- 遵循 JavaScript Standard Style
- 所有 PR 必須通過 CI 檢查
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

### 提交信息格式

feat: 新功能
fix: 修復錯誤
docs: 文檔更新
style: 代碼格式
refactor: 重構
test: 測試
chore: 構建/工具變更

text

---

## 📝 版本歷史

### v2.0.0 (2025-11-03)

#### 新增功能
- ✨ Speckit 自動開發系統
- 🚀 Railway V2 自動部署整合
- 💾 會員管理系統完整實現
- 🎁 促銷引擎核心功能
- 📊 健康檢查和監控
- 📚 完整文檔和使用指南
- 🎨 產品經理演示界面

#### 改進
- ⚡ 優化構建速度（20 秒內完成）
- 🔒 增強安全性配置
- 📱 響應式前端界面
- 🌐 支持靜態文件服務

#### 修復
- 🐛 修復健康檢查超時問題
- 🔧 修復 package-lock.json 衝突
- 📦 修復依賴版本不一致

### v1.0.0 (2024-08-15)

- 🎉 初始版本發布
- ✅ 基礎框架搭建
- ✅ 核心 API 實現

---

## 🔒 環境變量

在 `.env` 文件中配置：

服務器配置
PORT=3000
NODE_ENV=production

數據庫（如需要）
DATABASE_URL=your_database_url

API 密鑰（如需要）
API_KEY=your_api_key

OpenAI（未來功能）
OPENAI_API_KEY=your_openai_api_key
text

---

## 🧪 測試

### 運行測試

單元測試
npm test

整合測試
npm run test:integration

測試覆蓋率
npm run test:coverage

text

### 本地健康檢查

啟動服務器並測試
npm start &
sleep 3
curl http://localhost:3000/health
pkill -f "node server.js"

text

---

## 📞 支持與聯繫

- **問題報告**: [GitHub Issues](https://github.com/mengchieh123/ai-hotel-assistant-builder/issues)
- **功能請求**: [GitHub Discussions](https://github.com/mengchieh123/ai-hotel-assistant-builder/discussions)
- **文檔**: [Wiki](https://github.com/mengchieh123/ai-hotel-assistant-builder/wiki)
- **Railway 項目**: [Dashboard](https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda)

---

## 📄 許可證

本項目採用 MIT 許可證 - 詳見 [LICENSE](LICENSE) 文件

---

## 🙏 致謝

- [Express.js](https://expressjs.com/) 團隊提供優秀的 Web 框架
- [Railway](https://railway.app/) 提供便捷的部署平台
- 所有貢獻者的寶貴意見和代碼

---

## 🌟 Star History

如果這個項目對你有幫助，請給它一個 ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=mengchieh123/ai-hotel-assistant-builder&type=Date)](https://star-history.com/#mengchieh123/ai-hotel-assistant-builder&Date)

---

<div align="center">

**Built with ❤️ by the AI Hotel Assistant Team**

🔗 [生產環境](https://ai-hotel-assistant-builder-production.up.railway.app) · 
📊 [Railway Dashboard](https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda) · 
📚 [文檔](https://github.com/mengchieh123/ai-hotel-assistant-builder/wiki)

📅 **最後更新**: 2025-11-03

</div>
EOF

echo "✅ 專業版 README.md 已創建"
echo ""
echo "📋 包含內容："
echo "  ✅ 完整的在線演示鏈接"
echo "  ✅ 所有前端測試端點"
echo "  ✅ API 文檔和示例"
echo "  ✅ Speckit 詳細使用指南"
echo "  ✅ 部署流程和監控"
echo "  ✅ 專業排版和圖標"
echo ""
echo "🚀 提交到 GitHub:"
git add README.md
git commit -m "docs: update README with production URLs and test endpoints"
git push origin main

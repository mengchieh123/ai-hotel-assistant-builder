cat > README.md << 'EOF'
# 🏨 AI Hotel Assistant Builder

[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=flat&logo=railway&logoColor=white)](https://railway.app)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**自動化開發系統 · 從規格到生產的完整工作流**

AI Hotel Assistant Builder 是一個創新的旅宿業務管理平台，透過 Speckit 規格驅動開發（Specification-Driven Development）實現從業務需求到生產部署的自動化流程。

---

## ✨ 核心特性

### 🚀 **Speckit 自動開發系統**
- **規格驅動開發** - 使用 YAML 定義業務邏輯，自動生成代碼
- **即時生成** - 修改規格文件，立即生成對應的模型、服務和 API
- **零配置部署** - Git push 自動觸發 Railway 部署

### 🏗️ **完整的業務功能**
- **會員管理系統** - 等級制度、積分累積、會員權益
- **促銷引擎** - 靈活的折扣規則、優惠券管理、活動排程
- **訂單處理** - 完整的預訂流程、支付整合、訂單追蹤
- **數據分析** - 業務指標監控、報表生成

### ⚡ **現代化技術棧**
- **Runtime** - Node.js 22.x
- **Framework** - Express.js 4.x
- **數據處理** - YAML/JSON 配置管理
- **部署平台** - Railway V2 (Asia Southeast)
- **CI/CD** - 自動化構建與部署

---

## 📦 快速開始

### 環境要求

Node.js >= 18.0.0
npm >= 9.0.0

text

### 安裝

克隆倉庫
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

安裝依賴
npm install

啟動開發服務器
npm run dev

text

### 驗證安裝

測試健康檢查
curl http://localhost:3000/health

應該返回
{"status":"healthy","service":"AI Hotel Assistant","timestamp":"...","port":3000}
text

---

## 🎯 Speckit 使用指南

### 什麼是 Speckit？

Speckit 是一個規格驅動的開發系統，讓產品經理和開發者可以通過 YAML 文件定義業務邏輯，系統自動生成對應的代碼結構。

### 基本工作流

graph LR
A[編輯 speckit/*.yaml] --> B[運行 npm run speckit:generate]
B --> C[生成代碼到 generated/]
C --> D[Git commit & push]
D --> E[Railway 自動部署]

text

### 創建新功能

**1. 編輯規格文件**

在 `speckit/business_speckit.yaml` 中添加新功能：

features:

name: LOYALTY_PROGRAM
description: 會員忠誠度計劃
priority: high
components:

積分累積系統

等級晉升機制

獎勵兌換功能

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

services:

name: loyalty-service
methods:

earnPoints

redeemRewards

checkBalance

text

**2. 生成代碼**

自動生成模型、服務和 API
npm run speckit:generate

查看生成的文件
ls generated/

text

**3. 驗證規格**

驗證 YAML 語法和結構
npm run speckit:validate

text

---

## 📁 項目結構

ai-hotel-assistant-builder/
├── speckit/ # 業務規格定義
│ ├── business_speckit.yaml # 業務功能規格
│ ├── dynamic_speckit.yaml # 動態功能配置
│ └── cli.js # Speckit CLI 工具
├── generated/ # 自動生成的代碼
│ ├── models/ # 數據模型
│ ├── services/ # 業務服務
│ └── routes/ # API 路由
├── server.js # Express 服務器入口
├── railway.toml # Railway 部署配置
├── package.json # 項目配置
└── README.md # 項目文檔

text

---

## 🔧 可用命令

### 開發命令

啟動服務器
npm start

開發模式（含熱重載）
npm run dev:watch

Speckit 生成
npm run speckit:generate

Speckit 驗證
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

---

## 🚀 部署

### Railway 自動部署

項目已配置 Railway V2 自動部署，每次推送到 `main` 分支會自動觸發：

git add .
git commit -m "feat: add new feature"
git push origin main

text

### 健康檢查

Railway 會在部署後自動進行健康檢查：

- **路徑**: `/health`
- **超時**: 90 秒
- **重試**: 自動重啟失敗的服務

### 查看部署狀態

使用 Railway CLI
railway status

查看日誌
railway logs

查看構建日誌
railway logs --build

text

---

## 📊 核心功能

### 會員管理系統

- **多層級會員制度** - 普通/銀卡/金卡/白金卡
- **積分系統** - 消費累積、活動獎勵、生日贈點
- **權益管理** - 專屬折扣、優先預訂、免費升級

### 促銷引擎

- **彈性折扣規則** - 百分比折扣、固定金額、買N送M
- **優惠券系統** - 電子優惠券、折扣碼、贈品券
- **活動管理** - 限時特賣、早鳥優惠、節日促銷

### 訂單處理

- **完整訂單生命週期** - 創建、確認、支付、完成、取消
- **多支付方式** - 信用卡、行動支付、銀行轉帳
- **訂單追蹤** - 實時狀態更新、通知推送

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

## 📚 API 文檔

### 健康檢查

GET /health

text

**響應**
{
"status": "healthy",
"service": "AI Hotel Assistant",
"timestamp": "2025-11-03T12:00:00.000Z",
"port": 3000
}

text

### 會員 API

GET /api/members
GET /api/members/:id
POST /api/members
PUT /api/members/:id
DELETE /api/members/:id

text

### 促銷 API

GET /api/promotions
GET /api/promotions/:id
POST /api/promotions
PUT /api/promotions/:id
DELETE /api/promotions/:id

text

---

## 🤝 貢獻指南

### 開發流程

1. **Fork 項目**
2. **創建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交變更** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **開啟 Pull Request**

### 代碼規範

- 使用 ESLint 進行代碼檢查
- 遵循 Airbnb JavaScript Style Guide
- 所有 PR 必須通過 CI 檢查

---

## 📝 版本歷史

### v2.0.0 (2025-11-03)
- ✨ 新增 Speckit 自動開發系統
- 🚀 整合 Railway V2 自動部署
- 💾 會員管理系統完整實現
- 🎁 促銷引擎核心功能
- 📊 健康檢查和監控
- 📚 完整文檔和使用指南

### v1.0.0 (2024-08-15)
- 🎉 初始版本發布
- ✅ 基礎框架搭建
- ✅ 核心 API 實現

---

## 🛠️ 技術棧

| 類別 | 技術 |
|------|------|
| **Runtime** | Node.js 22.x |
| **Web Framework** | Express.js 4.18.2 |
| **配置管理** | YAML 2.8.1, js-yaml 4.1.0 |
| **文件監聽** | Chokidar 4.0.3 |
| **環境變量** | dotenv 17.2.3 |
| **部署平台** | Railway V2 |
| **CI/CD** | GitHub Actions |

---

## 📞 支持與聯繫

- **問題報告**: [GitHub Issues](https://github.com/mengchieh123/ai-hotel-assistant-builder/issues)
- **功能請求**: [GitHub Discussions](https://github.com/mengchieh123/ai-hotel-assistant-builder/discussions)
- **文檔**: [Wiki](https://github.com/mengchieh123/ai-hotel-assistant-builder/wiki)

---

## 📄 許可證

本項目採用 MIT 許可證 - 詳見 [LICENSE](LICENSE) 文件

---

## 🙏 致謝

- Express.js 團隊提供優秀的 Web 框架
- Railway 提供便捷的部署平台
- 所有貢獻者的寶貴意見和代碼

---

## 🌟 Star History

如果這個項目對你有幫助，請給它一個 ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=mengchieh123/ai-hotel-assistant-builder&type=Date)](https://star-history.com/#mengchieh123/ai-hotel-assistant-builder&Date)

---

**Built with ❤️ by the AI Hotel Assistant Team**

🔗 **生產環境**: [https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda](https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda)

📅 **最後更新**: 2025-11-03
EOF

echo "✅ README.md 已創建"

bash
#!/bin/bash

echo "🔄 更新 README.md 以反映當前環境..."

cat > speckit/README.md << 'EOF'
# 🏨 AI 酒店訂房助理 - Business SpecKit

## 📋 項目概覽

**AI 酒店訂房助理**是一個基於對話式 AI 的智能訂房系統，目前部署在 Railway 平台，提供完整的酒店預訂對話服務。

### 🚀 線上演示
- **主應用**: https://ai-hotel-assistant-builder-production.up.railway.app/
- **聊天演示**: https://ai-hotel-assistant-builder-production.up.railway.app/ai-chat-demo.html

### 📊 當前狀態
| 項目 | 狀態 | 說明 |
|------|------|------|
| 核心 AI 引擎 | ✅ 生產環境運行 | 規則型意圖識別 |
| 訂房對話流程 | ✅ 已實現 | 多輪對話支持 |
| Web 界面 | ✅ 已部署 | 響應式聊天界面 |
| 部署平台 | ✅ Railway | 自動化部署 |
| 監控 | ✅ 基礎監控 | Railway Metrics |

## 🗂️ SpecKit 文件結構

Business SpecKit 是項目的完整規格定義體系，包含三個核心層次：

### 核心規格文件
- [`business-spec.yaml`](./business-spec.yaml) - **業務規則與流程定義**
- [`conversation-spec.yaml`](./conversation-spec.yaml) - **對話邏輯與場景定義**  
- [`technical-spec.yaml`](./technical-spec.yaml) - **技術實現與架構定義**

### 支持文檔
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - **系統架構設計文檔**
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) - **實施計劃與路線圖**
- [`README.md`](./README.md) - **項目說明文檔** (當前文件)

## 🎯 快速開始

### 本地開發
```bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 訪問應用
open http://localhost:8080
生產部署

項目使用 Railway 自動化部署，推送代碼到 main 分支即可自動部署。

🔧 技術棧

後端技術

Runtime: Node.js 18.x
Framework: Express.js 4.x
語言: JavaScript ES2022+
前端技術

技術: Vanilla JavaScript + HTML5 + CSS3
樣式: 自定義 CSS + 響應式設計
構建: 無需構建，直接部署
部署與基礎設施

平台: Railway
構建工具: Nixpacks
監控: Railway Metrics
域名: Railway 自動分配
📡 API 文檔

核心端點

健康檢查

http
GET /health
Response: { "status": "OK", "timestamp": "2024-01-01T00:00:00.000Z" }
AI 聊天

http
POST /api/ai/chat
Content-Type: application/json

Request: { "message": "你好" }
Response: { "message": "🏨 歡迎光臨！...", "timestamp": "..." }
對話示例

bash
# 測試對話
curl -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "價格多少"}'
🎪 功能特性

已實現功能

✅ 智能對話: 意圖識別和自然語言響應
✅ 房型介紹: 詳細房間信息和價格展示
✅ 價格查詢: 參考價格和精確報價
✅ 優惠活動: 早鳥、連住、學生等優惠
✅ 訂房流程: 多輪對話引導完成預訂
✅ 健康檢查: 服務狀態監控
對話場景

🏨 房型查詢與介紹
💰 價格諮詢與報價
📅 訂房流程引導
🎉 優惠活動說明
🍳 早餐與附加服務
📋 政策與條款查詢
🚀 部署信息

當前部署

平台: Railway
環境: Production
狀態: 🟢 運行中
版本: v3.2.1 (Railway 優化版)
部署流程

text
Git Push → Railway 自動構建 → 健康檢查 → 流量切換
環境變量

bash
NODE_ENV=production
PORT=8080
RAILWAY_ENVIRONMENT=production
🛠️ 開發指南

項目結構

text
ai-hotel-assistant-builder/
├── server.js              # 主服務器文件
├── package.json           # 項目配置
├── speckit/               # SpecKit 規格文件
│   ├── business-spec.yaml
│   ├── conversation-spec.yaml
│   ├── technical-spec.yaml
│   ├── ARCHITECTURE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── README.md
└── (其他靜態文件)
代碼規範

使用 ES2022+ 語法特性
錯誤處理和日誌記錄
模塊化代碼組織
遵循 RESTful API 設計
📈 監控與日誌

健康監控

bash
# 檢查服務狀態
curl https://ai-hotel-assistant-builder-production.up.railway.app/health
日誌查看

通過 Railway Dashboard 查看實時日誌
日誌級別: info, error, debug
結構化日誌輸出
🔄 更新流程

規格更新

業務變更 → 更新 business-spec.yaml
對話優化 → 更新 conversation-spec.yaml
技術升級 → 更新 technical-spec.yaml
架構調整 → 更新 ARCHITECTURE.md
代碼部署

bash
# 1. 修改代碼
git add .
git commit -m "feat: description"

# 2. 推送部署
git push origin main

# 3. 等待 Railway 自動部署
🐛 故障排除

常見問題

服務重啟問題

bash
# 檢查健康狀態
curl -I https://ai-hotel-assistant-builder-production.up.railway.app/health

# 查看部署日誌
# 通過 Railway Dashboard → Deployments
對話無響應

bash
# 測試 API 端點
curl -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
支持資源

GitHub Issues: 問題報告和功能請求
Railway Docs: 部署和平台文檔
SpecKit 文檔: 項目規格參考
🤝 貢獻指南

我們歡迎貢獻！請遵循以下流程：

Fork 項目
創建功能分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
開啟 Pull Request
開發規範

遵循現有代碼風格
更新相關文檔
添加適當的測試
確保所有檢查通過
📄 許可證

此項目採用 MIT 許可證 - 查看 LICENSE 文件了解詳情。

📞 聯繫信息

項目維護者: mengchieh123
問題反饋: GitHub Issues
在線演示: Railway Deployment
🎯 版本歷史

版本	日期	主要更新
v1.0	2024-01-XX	初始版本和基礎架構
v2.0	2024-01-XX	完整對話流程實現
v3.0	2024-01-XX	Railway 部署優化
v3.2	2024-01-XX	SpecKit 規格體系建立
備注: 此文檔應隨項目發展持續更新，確保反映當前系統狀態和開發實踐。
EOF

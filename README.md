bash
#!/bin/bash

echo "🔄 更新 README.md 以反映當前環境..."

cat > README.md << 'EOF'
# 🏨 AI 酒店訂房助理 - 增強版 v5.0.0

## 📋 項目概覽

**AI 酒店訂房助理**是一個基於多層次意圖識別的智能訂房系統，目前部署在 Railway 平台，提供完整的酒店預訂對話服務。

### 🚀 線上服務
- **主服務**: https://ai-hotel-assistant-builder.up.railway.app/
- **健康檢查**: https://ai-hotel-assistant-builder.up.railway.app/health
- **API 文檔**: https://ai-hotel-assistant-builder.up.railway.app/api

### 📊 當前狀態
| 項目 | 狀態 | 版本 |
|------|------|------|
| 核心 AI 引擎 | ✅ 生產環境運行 | 5.0.0-ENHANCED |
| 意圖識別 | ✅ 多層次識別 | 增強版 v5 |
| 部署平台 | ✅ Railway | 自動化部署 |
| 異步處理 | ✅ 已實現 | async/await |

## 🏗️ 系統架構

### Business SpecKit 流程
Business SpecKit 配置 → Git 提交 → Railway 自動部署 → 健康檢查 → 監控回報

text

### 核心組件
- **前端**: 純 HTML/CSS/JS 響應式界面
- **後端**: Node.js + Express.js
- **AI 引擎**: 多層次意圖識別系統
- **部署**: Railway 自動化部署
- **監控**: 內建健康檢查端點

## 🎯 快速開始

### 本地開發
```bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

# 安裝依賴
npm install

# 啟動開發服務器
npm start

# 訪問應用
open http://localhost:3000
生產部署

項目使用 Railway 自動化部署，推送代碼到 main 分支即可自動部署。

📡 API 文檔

核心端點

健康檢查

http
GET /health
Response:

json
{
  "status": "服務運行中",
  "version": "5.0.0-ENHANCED",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "features": ["多層次意圖識別", "特殊需求處理", ...]
}
AI 聊天端點

http
POST /chat
Content-Type: application/json

Request: 
{
  "message": "我要訂房，聖誕節預計住4晚"
}

Response:
{
  "response": "🎄 聖誕節訂房專案...",
  "metadata": {
    "processingTime": "125ms",
    "version": "5.0.0-ENHANCED",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
兼容端點

http
POST /api/ai/chat
(與 /chat 相同功能，用於向後兼容)

測試端點

http
GET /test-enhanced
返回增強版功能測試結果

🎪 功能特性

已實現功能

✅ 多層次意圖識別 - 3層架構處理複雜查詢
✅ 實體提取 - 自動提取日期、人數、會員等級
✅ 個性化回應 - 針對不同意圖的專屬回應模板
✅ 異步處理 - 支持 async/await 異步操作
✅ 特殊需求處理 - 無障礙、寵物、兒童政策
✅ 節日專案 - 聖誕節、生日等特殊活動
支持的意圖類型

基礎意圖: price, facility, greeting
進階意圖:

special_need - 特殊需求 (無障礙、寵物、兒童)
group_booking - 團體訂房
long_stay - 長期住宿
policy - 政策查詢
special_event - 特殊活動
transport - 交通服務
booking - 完整訂房
🔧 技術棧

後端技術

Runtime: Node.js 18.x
Framework: Express.js 4.x
語言: JavaScript ES2022+
異步處理: async/await
前端技術

技術: Vanilla JavaScript + HTML5 + CSS3
樣式: 自定義 CSS + 響應式設計
構建: 無需構建，直接部署
部署與基礎設施

平台: Railway
構建工具: Nixpacks
監控: Railway Metrics + 自定義健康檢查
CORS: 手動 CORS 處理
🗂️ 項目結構

text
ai-hotel-assistant-builder/
├── server.js                      # 主服務器文件 (異步版本)
├── package.json                   # 項目配置和依賴
├── services/
│   └── enhanced-ai-service.js     # 增強版 AI 服務核心
├── speckit/                       # Business SpecKit 規格文件
│   ├── business-spec.yaml         # 業務規則與流程定義
│   └── (其他規格文件)
├── test-enhanced-ai.js            # 增強版功能測試
├── test-client.js                 # 快速測試客戶端
├── advanced-conversation-test.sh  # 進階對話測試
├── verify-enhanced-deployment.sh  # 部署驗證腳本
└── *.html                         # 網頁測試界面
🚀 部署信息

當前部署

平台: Railway
環境: Production
狀態: 🟢 運行中
版本: 5.0.0-ENHANCED
端口: 自動分配 (通常 8080)
部署流程

bash
# 1. 代碼修改
git add .
git commit -m "feat: 描述修改內容"

# 2. 觸發部署
git push origin main

# 3. 等待自動部署 (2-3分鐘)
# 4. 驗證部署
./verify-enhanced-deployment.sh
環境變量

bash
NODE_ENV=production
PORT=3000
RAILWAY_ENVIRONMENT=production
🛠️ 開發指南

代碼規範

使用 ES2022+ 語法特性
錯誤處理和日誌記錄
模塊化代碼組織
遵循 RESTful API 設計
添加新的意圖類型

在 services/enhanced-ai-service.js 的 intentPatterns 中添加模式
在 prioritizeIntents 中設置優先級
創建對應的響應生成函數
在 generateResponse 中添加 case 處理
測試新功能

bash
# 本地測試
node test-client.js

# 完整測試
node test-enhanced-ai.js

# 進階對話測試
bash advanced-conversation-test.sh
📈 監控與維護

健康監控

bash
# 檢查服務狀態
curl https://ai-hotel-assistant-builder.up.railway.app/health

# 測試 AI 功能
curl -X POST https://ai-hotel-assistant-builder.up.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"測試查詢"}'
日誌查看

bash
# 通過 Railway CLI
railway logs

# 或通過 Railway Dashboard
🔄 更新流程

業務規則更新

更新 speckit/business-spec.yaml
同步更新 AI 服務邏輯
測試驗證功能
部署到生產環境
代碼部署

bash
# 完整部署流程
./redeploy-complete.sh

# 或手動部署
git add . && git commit -m "更新描述" && git push
🐛 故障排除

常見問題

服務無法訪問

bash
# 檢查健康狀態
curl -I https://ai-hotel-assistant-builder.up.railway.app/health

# 查看 Railway 日誌
railway logs --tail 50
API 端點問題

bash
# 診斷 API 問題
./diagnose-api-issue.sh

# 測試正確端點
./test-correct-endpoints.sh
部署失敗

檢查 server.js 語法: node -c server.js
檢查依賴: npm install
查看 Railway 構建日誌
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
v5.0.0	2024-11-05	多層次意圖識別、異步處理、完整訂房支持
v4.x	2024-11-05	增強版 AI 服務、實體提取
v3.x	2024-11-05	Railway 部署優化、基礎架構
v1.x	2024-11-05	初始版本和基礎對話功能
備注: 此文檔應隨項目發展持續更新，確保反映當前系統狀態和開發實踐。
EOF

echo "✅ README.md 已更新完成"
echo "📋 新文檔包含:"
echo " - 當前版本: 5.0.0-ENHANCED"
echo " - 異步處理說明"
echo " - 完整的 API 文檔"
echo " - 部署和故障排除指南"

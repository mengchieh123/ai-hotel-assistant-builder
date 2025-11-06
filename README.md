🏨 AI 酒店訂房助理 - 增強版 v5.0.0

📋 項目概覽

AI 酒店訂房助理是一個基於多層次意圖識別的智能訂房系統，整合了本地 AI 模型與雲端部署，提供完整的酒店預訂對話服務。系統支援繁體中文界面，並提供完整的 Postman 測試集合。

🚀 線上服務

主服務: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev
健康檢查: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/health
聊天 API: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/api/ai/chat
📊 當前狀態

項目	狀態	版本
核心 AI 引擎	✅ 生產環境運行	5.0.0-ENHANCED-ASYNC
意圖識別	✅ 多層次識別	增強版 v5
部署平台	✅ Railway + GitHub Codespaces	自動化部署
異步處理	✅ 已實現	async/await
路由架構	✅ 標準化	/api/ai/chat
🏗️ 系統架構

整體流程

text
用戶請求 → Express 路由 (/api/ai/chat) 
↓ 
Enhanced AI Service (async) 
↓ 
多層次意圖識別
├─ 主意圖識別
├─ 實體提取
└─ 個性化回應生成
↓ 
JSON 回應返回
核心組件

後端: Node.js 18+ + Express.js 4.x
AI 引擎: Enhanced AI Service v5.0 (async) + Ollama
部署: Railway + GitHub Codespaces (自動化部署)
監控: 內建健康檢查端點 + Postman 測試集合
🎯 快速開始

環境要求

Node.js 18+
Ollama (本地 AI 模型)
至少 8GB 記憶體
本地開發

bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

# 安裝依賴
npm install

# 安裝並配置 Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen2.5:7b

# 啟動開發服務器
npm start

# 訪問應用
open http://localhost:3000
生產部署

項目使用 Railway 自動化部署，推送代碼到 main 分支即可自動部署。

bash
# 完整部署流程
git add .
git commit -m "feat: 描述修改內容"
git push origin main

# Railway 部署
railway up --detach

# 等待 2-3 分鐘後驗證
bash verify-enhanced-deployment.sh
📡 API 文檔

核心端點

1. 健康檢查

GET /health

Response:

json
{
  "status": "服務運行中",
  "version": "5.0.0-ENHANCED-ASYNC",
  "timestamp": "2025-11-05T06:06:41.058Z",
  "features": [
    "多層次意圖識別",
    "異步消息處理", 
    "特殊需求處理",
    "團體訂房支援"
  ]
}
2. 房型列表

GET /rooms

Response:

json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": 1,
        "name": "標準大床房",
        "type": "standard",
        "price": 588,
        "size": "32㎡",
        "bed": "1張雙人床",
        "amenities": ["免費WiFi", "空調", "電視", "迷你吧", "獨立衛浴"],
        "available": true
      }
    ]
  },
  "timestamp": "2025-11-05T06:06:41.058Z"
}
3. AI 聊天端點（標準路由）

POST /api/ai/chat
Content-Type: application/json

Request:

json
{
  "message": "我要訂房，聖誕節預計住4晚",
  "guestName": "王小明"
}
Response:

json
{
  "success": true,
  "data": {
    "message": "我要訂房，聖誕節預計住4晚",
    "response": "AI 生成的完整回應",
    "guestName": "王小明",
    "model": "qwen2.5:7b"
  },
  "timestamp": "2025-11-05T06:06:41.058Z"
}
4. 兼容端點

POST /chat (與 /api/ai/chat 相同功能，用於向後兼容)

🧪 Postman 測試集合

產品經理測試端點

我們提供完整的 Postman 測試集合，確保 API 符合產品規格：

測試環境配置

Base URL: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev
Environment: Production
測試案例

健康檢查測試

Method: GET
Endpoint: /health
Assertions:

狀態碼 200
回應包含 status: "服務運行中"
版本號正確
房型列表測試

Method: GET
Endpoint: /rooms
Assertions:

狀態碼 200
success: true
包含完整的房型資料
AI 聊天功能測試

Method: POST
Endpoint: /api/ai/chat
Body:

json
{
  "message": "請問週末有優惠嗎？",
  "guestName": "測試用戶"
}
Assertions:

狀態碼 200
success: true
包含 AI 回應
回應時間 < 5秒
意圖識別測試

測試多種用戶意圖：

價格查詢
設施詢問
訂房流程
特殊需求
自動化測試腳本

bash
# 執行完整測試套件
npm test

# Postman 集合測試
./test-postman.sh

# 快速健康檢查
./quick-test.sh
🎪 功能特性

已實現功能

✅ 多層次意圖識別 - 3層架構處理複雜查詢
✅ 實體提取 - 自動提取日期、人數、會員等級
✅ 個性化回應 - 針對不同意圖的專屬回應模板
✅ 異步處理 - 支援 async/await 異步操作
✅ 特殊需求處理 - 無障礙、寵物、兒童政策
✅ 節日專案 - 聖誕節、生日等特殊活動
✅ Postman 整合 - 完整的 API 測試集合

支持的意圖類型

基礎意圖: price, facility, greeting, policy
進階意圖:

special - 特殊需求（無障礙、寵物、兒童）
booking - 訂房意圖
service - 額外服務
comparison - 房型比較
🔧 技術棧

後端技術

Runtime: Node.js 18.x+
Framework: Express.js 4.x
語言: JavaScript ES2022+ (async/await)
CORS: 手動 CORS 處理（cors ^2.8.5）
AI 引擎: Ollama + Qwen2.5-7B
部署與基礎設施

平台: Railway + GitHub Codespaces
構建工具: Nixpacks
監控: Railway Metrics + 自定義健康檢查
環境: Production + Development
測試: Postman Collections + 自動化腳本
🗂️ 項目結構

text
ai-hotel-assistant-builder/
├── server.js                          # 主服務器文件（異步版本）
├── index-postman.js                   # Postman 兼容版本
├── package.json                       # 項目配置和依賴
├── services/
│   └── enhanced-ai-service.js         # 增強版 AI 服務核心
├── public/
│   └── index.html                     # 網頁聊天界面
├── test-enhanced-ai.js                # 增強版功能測試
├── test-postman.sh                    # Postman 測試腳本
├── quick-test.sh                      # 快速測試腳本
├── advanced-conversation-test.sh      # 進階對話測試
├── verify-enhanced-deployment.sh      # 部署驗證腳本
├── fix-route-path.sh                  # 路由修復腳本
├── Railway-Deployment-Guide.md        # 完整部署指南
└── README.md                          # 項目說明文件
🚀 部署信息

當前部署

平台: Railway + GitHub Codespaces
環境: Production
狀態: 🟢 運行中
版本: 5.0.0-ENHANCED-ASYNC
主 URL: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev
環境變量

bash
NODE_ENV=production
PORT=8080
RAILWAY_ENVIRONMENT=production
OLLAMA_HOST=http://127.0.0.1:11434
MODEL_NAME=qwen2.5:7b
🛠️ 開發指南

代碼規範

使用 ES2022+ 語法特性
所有異步操作使用 async/await
錯誤處理和日誌記錄
模塊化代碼組織
遵循 RESTful API 設計
完整的 Postman 測試案例
添加新的意圖類型

在 services/enhanced-ai-service.js 的 intentKeywords 中添加模式
在 identifyPrimaryIntent 中設置優先級規則
創建對應的響應生成函數
在 generateResponse 中添加 case 處理
更新 Postman 測試集合
測試新功能

bash
# 本地測試
node test-client.js

# 完整測試
node test-enhanced-ai.js

# Postman 集合測試
./test-postman.sh

# 進階對話測試
bash advanced-conversation-test.sh
📈 監控與維護

健康監控

bash
# 檢查服務狀態
curl https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/health

# 測試 AI 功能
curl -X POST https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"測試查詢"}'
Postman 監控

定期執行 Postman 集合測試
監控 API 回應時間
驗證意圖識別準確率
檢查錯誤率統計
日誌查看

bash
# 通過 Railway CLI
railway logs --tail 50

# 實時日誌
railway logs --follow

# 本地開發日誌
tail -f npm-debug.log
🐛 故障排除

常見問題

服務無法訪問

bash
# 檢查健康狀態
curl -I https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/health

# 查看 Railway 日誌
railway logs --tail 50
API 端點問題

bash
# 測試正確端點
curl -X POST https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}'

# 應該返回有效的 JSON，包含 response 和 metadata
Postman 測試失敗

確認 Base URL 正確
檢查環境變量設定
驗證 API 回應格式
查看測試腳本日誌
部署失敗

檢查 server.js 語法: node -c server.js
檢查依賴: npm install
查看 Railway 構建日誌
參考 Railway-Deployment-Guide.md
路由路徑不匹配

bash
# 如果 API 返回 null 或空響應：
# 執行路由修復腳本
bash fix-route-path.sh

# 確認路由配置
grep "app.post" server.js
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
添加適當的測試（包括 Postman 測試）
確保所有檢查通過
更新版本號和變更日誌
📄 許可證

此項目採用 MIT 許可證 - 查看 LICENSE 文件了解詳情。

📞 聯繫信息

項目維護者: mengchieh123
問題反饋: GitHub Issues
在線演示: Railway Deployment
測試集合: Postman Collection
🎯 版本歷史

版本	日期	主要更新
v5.0.0	2025-11-05	多層次意圖識別、異步處理、完整訂房支援、Postman 整合
v4.x	2025-11-05	增強版 AI 服務、實體提取
v3.x	2025-11-05	Railway 部署優化、基礎架構
v1.x	2025-11-05	初始版本和基礎對話功能
📚 相關文檔

Railway 部署指南 - 完整的部署和故障排除指南
AI 意圖模型設計 - 多層次意圖識別架構說明
整合指南 - 增強版 AI 服務整合步驟
Postman 測試指南 - 完整的 API 測試教學
📝 備註: 此文檔應隨項目發展持續更新，確保反映當前系統狀態和開發實踐。

最後更新: 2025-11-06 10:20 CST

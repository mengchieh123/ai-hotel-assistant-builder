# 🎯 優化 README.md 反映最新環境
cat > update-readme-optimized.sh << 'EOF'
#!/bin/bash

echo "🔄 [translate:優化 README.md 以反映當前最新環境...]"

cat > README.md << 'READMEEOF'
# 🏨 AI [translate:酒店訂房助理] - [translate:增強版] v5.0.0

## 📋 [translate:項目概覽]

**AI [translate:酒店訂房助理]**[translate:是一個基於多層次意圖識別的智能訂房系統，目前部署在 Railway 平台，提供完整的酒店預訂對話服務。]

### 🚀 [translate:線上服務]
- **[translate:主服務]**: https://ai-hotel-assistant-builder-production.up.railway.app/
- **[translate:健康檢查]**: https://ai-hotel-assistant-builder-production.up.railway.app/health
- **[translate:聊天 API]**: https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat

### 📊 [translate:當前狀態]
| [translate:項目] | [translate:狀態] | [translate:版本] |
|------|------|------|
| [translate:核心 AI 引擎] | ✅ [translate:生產環境運行] | 5.0.0-ENHANCED-ASYNC |
| [translate:意圖識別] | ✅ [translate:多層次識別] | [translate:增強版] v5 |
| [translate:部署平台] | ✅ Railway | [translate:自動化部署] |
| [translate:異步處理] | ✅ [translate:已實現] | async/await |
| [translate:路由架構] | ✅ [translate:標準化] | /api/ai/chat |

---

## 🏗️ [translate:系統架構]

### [translate:整體流程]
用戶請求﻿ → Express 路由﻿ (/api/ai/chat)
↓
Enhanced AI Service (async)
↓
多層次意圖識別﻿
├─ 主意圖識別﻿
├─ 實體提取﻿
└─ 個性化回應生成﻿
↓
JSON 回應返回﻿

text

### [translate:核心組件]
- **[translate:後端]**: Node.js 18+ + Express.js 4.x
- **AI [translate:引擎]**: Enhanced AI Service v5.0 (async)
- **[translate:部署]**: Railway ([translate:自動化部署])
- **[translate:監控]**: [translate:內建健康檢查端點]

---

## 🎯 [translate:快速開始]

### [translate:本地開發]
克隆項目﻿
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

安裝依賴﻿
npm install

啟動開發服務器﻿
npm start

訪問應用﻿
open http://localhost:3000

text

### [translate:生產部署]

[translate:項目使用 Railway 自動化部署，推送代碼到] `main` [translate:分支即可自動部署。]

完整部署流程﻿
git add .
git commit -m "feat: 描述修改內容﻿"
git push origin main
railway up --detach

等待﻿ 2-3 分鐘後驗證﻿
bash verify-enhanced-deployment.sh

text

---

## 📡 API [translate:文檔]

### [translate:核心端點]

#### 1. [translate:健康檢查]

GET /health

text

**Response:**
{
"status": "服務運行中﻿",
"version": "5.0.0-ENHANCED-ASYNC",
"timestamp": "2025-11-05T06:06:41.058Z",
"features": 多層次意圖識別﻿",
"異步消息處理﻿",
"特殊需求處理﻿",
"團體訂房支援﻿"
]
}

text

#### 2. AI [translate:聊天端點]（[translate:標準路由]）

POST /api/ai/chat
Content-Type: application/json

text

**Request:**
{
"message": "我要訂房，聖誕節預計住4晚﻿"
}

text

**Response:**
{
"response": "AI 生成的完整回應﻿",
"metadata": {
"processingTime": "1ms",
"version": "5.0.0-ENHANCED-ASYNC",
"timestamp": "2025-11-05T06:06:41.058Z",
"async": false
}
}

text

#### 3. [translate:兼容端點]

POST /chat
(與﻿ /api/ai/chat 相同功能，用於向後兼容﻿)

text

---

## 🎪 [translate:功能特性]

### [translate:已實現功能]

✅ **[translate:多層次意圖識別]** - 3[translate:層架構處理複雜查詢]  
✅ **[translate:實體提取]** - [translate:自動提取日期、人數、會員等級]  
✅ **[translate:個性化回應]** - [translate:針對不同意圖的專屬回應模板]  
✅ **[translate:異步處理]** - [translate:支持] async/await [translate:異步操作]  
✅ **[translate:特殊需求處理]** - [translate:無障礙、寵物、兒童政策]  
✅ **[translate:節日專案]** - [translate:聖誕節、生日等特殊活動]  

### [translate:支持的意圖類型]

- **[translate:基礎意圖]**: `price`, `facility`, `greeting`, `policy`
- **[translate:進階意圖]**:
  - `special` - [translate:特殊需求]（[translate:無障礙、寵物、兒童]）
  - `booking` - [translate:訂房意圖]
  - `service` - [translate:額外服務]
  - `comparison` - [translate:房型比較]

---

## 🔧 [translate:技術棧]

### [translate:後端技術]

- **Runtime**: Node.js 18.x+
- **Framework**: Express.js 4.x
- **[translate:語言]**: JavaScript ES2022+ (async/await)
- **CORS**: [translate:手動 CORS 處理]（cors ^2.8.5）

### [translate:部署與基礎設施]

- **[translate:平台]**: Railway
- **[translate:構建工具]**: Nixpacks
- **[translate:監控]**: Railway Metrics + [translate:自定義健康檢查]
- **[translate:環境]**: Production

---

## 🗂️ [translate:項目結構]

ai-hotel-assistant-builder/
├── server.js # 主服務器文件﻿（異步版本﻿）
├── package.json # 項目配置和依賴﻿
├── services/
│ └── enhanced-ai-service.js # 增強版 AI 服務核心﻿
├── test-enhanced-ai.js # 增強版功能測試﻿
├── advanced-conversation-test.sh # 進階對話測試﻿
├── verify-enhanced-deployment.sh # 部署驗證腳本﻿
├── fix-route-path.sh # 路由修復腳本﻿
├── Railway-Deployment-Guide.md # 完整部署指南﻿
└── *.html # 網頁測試界面﻿

text

---

## 🚀 [translate:部署信息]

### [translate:當前部署]

- **[translate:平台]**: Railway
- **[translate:環境]**: Production
- **[translate:狀態]**: 🟢 [translate:運行中]
- **[translate:版本]**: 5.0.0-ENHANCED-ASYNC
- **[translate:端口]**: [translate:自動分配]（[translate:通常] 8080）
- **[translate:主 URL]**: https://ai-hotel-assistant-builder-production.up.railway.app

### [translate:部署流程]

1. 代碼修改﻿
git add .
git commit -m "feat: 描述修改內容﻿"

2. 觸發部署﻿
git push origin main

3. 等待自動部署﻿（2-3分鐘﻿）
4. 驗證部署﻿
bash verify-enhanced-deployment.sh

text

### [translate:環境變量]

NODE_ENV=production
PORT=8080
RAILWAY_ENVIRONMENT=production

text

---

## 🛠️ [translate:開發指南]

### [translate:代碼規範]

- [translate:使用] ES2022+ [translate:語法特性]
- [translate:所有異步操作使用] async/await
- [translate:錯誤處理和日誌記錄]
- [translate:模塊化代碼組織]
- [translate:遵循] RESTful API [translate:設計]

### [translate:添加新的意圖類型]

1. [translate:在] `services/enhanced-ai-service.js` [translate:的] `intentKeywords` [translate:中添加模式]
2. [translate:在] `identifyPrimaryIntent` [translate:中設置優先級規則]
3. [translate:創建對應的響應生成函數]
4. [translate:在] `generateResponse` [translate:中添加] case [translate:處理]

### [translate:測試新功能]

本地測試﻿
node test-client.js

完整測試﻿
node test-enhanced-ai.js

進階對話測試﻿
bash advanced-conversation-test.sh

text

---

## 📈 [translate:監控與維護]

### [translate:健康監控]

檢查服務狀態﻿
curl https://ai-hotel-assistant-builder-production.up.railway.app/health

測試 AI 功能﻿
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat
-H "Content-Type: application/json"
-d '{"message":"測試查詢﻿"}'

text

### [translate:日誌查看]

通過 Railway CLI﻿
railway logs --tail 50

實時日誌﻿
railway logs --follow

text

---

## 🐛 [translate:故障排除]

### [translate:常見問題]

#### 1. [translate:服務無法訪問]

檢查健康狀態﻿
curl -I https://ai-hotel-assistant-builder-production.up.railway.app/health

查看 Railway 日誌﻿
railway logs --tail 50

text

#### 2. API [translate:端點問題]

測試正確端點﻿
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat
-H "Content-Type: application/json"
-d '{"message":"你好﻿"}'

應該返回有效的 JSON，包含﻿ response 和﻿ metadata
text

#### 3. [translate:部署失敗]

- [translate:檢查] server.js [translate:語法]: `node -c server.js`
- [translate:檢查依賴]: `npm install`
- [translate:查看] Railway [translate:構建日誌]
- [translate:參考] `Railway-Deployment-Guide.md`

#### 4. [translate:路由路徑不匹配]

[translate:如果 API 返回] null [translate:或空響應]：

執行路由修復腳本﻿
bash fix-route-path.sh

確認路由配置﻿
grep "app.post" server.js

text

---

## 🤝 [translate:貢獻指南]

[translate:我們歡迎貢獻！請遵循以下流程]：

1. Fork [translate:項目]
2. [translate:創建功能分支] (`git checkout -b feature/AmazingFeature`)
3. [translate:提交更改] (`git commit -m 'Add some AmazingFeature'`)
4. [translate:推送到分支] (`git push origin feature/AmazingFeature`)
5. [translate:開啟 Pull Request]

### [translate:開發規範]

- [translate:遵循現有代碼風格]
- [translate:更新相關文檔]
- [translate:添加適當的測試]
- [translate:確保所有檢查通過]

---

## 📄 [translate:許可證]

[translate:此項目採用 MIT 許可證] - [translate:查看] LICENSE [translate:文件了解詳情。]

---

## 📞 [translate:聯繫信息]

- **[translate:項目維護者]**: mengchieh123
- **[translate:問題反饋]**: [GitHub Issues](https://github.com/mengchieh123/ai-hotel-assistant-builder/issues)
- **[translate:在線演示]**: [Railway Deployment](https://ai-hotel-assistant-builder-production.up.railway.app)

---

## 🎯 [translate:版本歷史]

| [translate:版本] | [translate:日期] | [translate:主要更新] |
|------|--------|----------|
| v5.0.0 | 2025-11-05 | [translate:多層次意圖識別、異步處理、完整訂房支持] |
| v4.x | 2025-11-05 | [translate:增強版 AI 服務、實體提取] |
| v3.x | 2025-11-05 | Railway [translate:部署優化、基礎架構] |
| v1.x | 2025-11-05 | [translate:初始版本和基礎對話功能] |

---

## 📚 [translate:相關文檔]

- [**Railway [translate:部署指南]**](Railway-Deployment-Guide.md) - [translate:完整的部署和故障排除指南]
- [**AI [translate:意圖模型設計]**](AI_INTENT_MODEL_DESIGN.md) - [translate:多層次意圖識別架構說明]
- [**[translate:整合指南]**](INTEGRATION_GUIDE.md) - [translate:增強版 AI 服務整合步驟]

---

**📝 [translate:備註]**: [translate:此文檔應隨項目發展持續更新，確保反映當前系統狀態和開發實踐。]

**[translate:最後更新]**: 2025-11-05 14:09 CST
READMEEOF

echo "✅ README.md [translate:已優化完成]"
echo ""
echo "📋 [translate:優化內容]:"
echo "   • [translate:修正了生產環境 URL]"
echo "   • [translate:更新了當前版本號] (5.0.0-ENHANCED-ASYNC)"
echo "   • [translate:添加了路由架構說明]"
echo "   • [translate:修正了 API 端點路徑] (/api/ai/chat)"
echo "   • [translate:更新了實際的] JSON [translate:響應格式]"
echo "   • [translate:添加了路由故障排除章節]"
echo "   • [translate:關聯了相關文檔]"

EOF

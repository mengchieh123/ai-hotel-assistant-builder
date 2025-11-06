AI 酒店訂房助理 - 增強版 v5.0.0﻿

📋 項目概覽﻿
AI 酒店訂房助理是一個基於多層次意圖識別的智能訂房系統，整合了本地 AI 模型與雲端部署，提供完整的酒店預訂對話服務。系統支援繁體中文界面，並提供完整的 Postman 測試集合。

🚀 線上服務﻿
主服務: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev
健康檢查: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/health
聊天 API: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev/api/ai/chat

📊 當前狀態﻿

項目	狀態	版本	核心 AI 引擎
生產環境運行	✅	5.0.0-ENHANCED-ASYNC	多層次意圖識別、增強版 v5
部署平台	✅	Railway + GitHub Codespaces	自動化部署、異步處理
🏗️ 系統架構﻿
用戶請求 (text) → Express 路由 (/api/ai/chat)
→ Enhanced AI Service (async)
→ 多層次意圖識別（主意圖、實體提取、個性化回應）
→ JSON 格式回應

🎯 快速開始﻿

環境要求﻿

Node.js 18+

Ollama（本地部署 AI 模型），內存≥8GB

本地開發﻿

bash
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git  
cd ai-hotel-assistant-builder  
npm install  
curl -fsSL https://ollama.ai/install.sh | sh  
ollama pull qwen2.5:7b  
npm start  
open http://localhost:3000  
生產部署﻿
Railway 自動化部署，推送到 main 分支即可觸發：

bash
git add .  
git commit -m "feat: 新增功能"  
git push origin main  
railway up --detach  
📡 API 文檔﻿

核心端點：

GET /health — 回應狀態、版本、特性

GET /rooms — 房型列表

POST /api/ai/chat — 聊天對話（異步多層意圖識別）

POST /chat — 與 /api/ai/chat 等效，兼容舊端點

🧪 Postman 測試集合﻿
環境 Base URL: https://psychic-spoon-p4wgg4x6g5vc6vg5.github.dev
內含健康檢查、房型查詢、會員優惠、意圖識別測試

📋 產品經理測試點﻿

測試項目	目的	測試方法與檢查內容
系統健康檢查	確保服務線上正常，無故障	GET /health，檢查返回 status 為"服務運行中"、版本號
房型列表檢查	房型數據完整、價格合理	GET /rooms，確認 success=true，並列出至少三種房型
AI 基本回應測試	AI 能對簡單問候和查詢提供合理回應	POST /api/ai/chat，使用簡單訊息（如"你好"）檢查回應文字
複雜多重需求測試	支持同時處理多個用戶請求的複雜對話	POST /api/ai/chat，複合訊息（如入住、會員、小孩、樓層等）檢查回答完整度
會員優惠測試	檢測會員折扣權益是否正確實施	查詢會員優惠關鍵詞，判斷回應中是否包含相關折扣與規則
兒童政策測試	確認兒童入住收費與免費政策的準確描述	提問兒童相關問題，判斷回應是否完整覆蓋免費/半價年齡段
異常輸入與錯誤處理	確保對空訊息和錯誤輸入能正確回應並提示錯誤	空字串 POST 請求，返回錯誤狀態 400 與合理錯誤訊息
🧰 開發人員手冊﻿

專案結構

text
ai-hotel-assistant-builder/  
├── server.js            # 主服務器入口，Express 路由實現  
├── package.json         # 依賴與啟動腳本  
├── prompts/             # 系統提示語模板  
├── public/              # 前端靜態資源（聊天界面）  
├── tests/               # 測試腳本及 Postman 集合  
├── README.md            # 專案說明文檔  
├── services/            # AI服務邏輯與意圖識別實現  
├── utils/               # 工具與輔助函數  
└── docs/                # 專案文檔與設計說明  
主要工作流程

用戶發送請求至 /api/ai/chat

後端透過 Enhanced AI Service 處理，採用異步 async/await 邏輯

多層次意圖識別分析，抽取用戶需求實體資訊（日期、會員等）

根據識別結果生成個性化回應

將結構化結果以 JSON 格式返回

版本管理

使用 Git，嚴格跟蹤提交與分支管理

通過標籤（tag）標示版本

持續更新 Postman 測試，確保新功能回歸測試通過

錯誤偵測與日誌

集成 Railway CLI 日誌輸出，實時監控服務狀態

將錯誤詳細信息記錄於日誌，方便追蹤

📞 聯絡方式﻿
項目負責: mengchieh123
問題反饋: GitHub issues

📝 最終更新﻿
2025-11-06 10:20 CST

本文件將隨專案迭代持續更新，確保產品經理與開發團隊同步最新狀態和流程﻿

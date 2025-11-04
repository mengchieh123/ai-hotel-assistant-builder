#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 創建 technical-spec.yaml"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 確保在 main 分支
git checkout main

# 確保目錄存在
mkdir -p speckit

# 創建 technical-spec.yaml
cat > speckit/technical-spec.yaml << 'EOFSPEC'
name: hotel-ai-assistant-technical-spec
version: 1.0.0
description: 飯店 AI 助手技術實現規格書
last_updated: 2025-11-04

# ============================================
# 系統架構
# ============================================
system_architecture:
  deployment_platform: Railway
  runtime: Node.js
  framework: Express.js
  
  components:
    frontend:
      - public/ai-chat-demo.html
      - 純 HTML/CSS/JavaScript
      - 無框架依賴
    
    backend:
      - server.js (Express 服務器)
      - routes/ai-routes.js (API 路由)
      - services/mock-ai-service.js (AI 對話引擎)
      - services/hotel-data.js (飯店資料)
      - services/booking-calculator.js (計算邏輯)
    
    specification:
      - speckit/business-spec.yaml (業務規格)
      - speckit/conversation-spec.yaml (對話規格)
      - speckit/technical-spec.yaml (技術規格)

# ============================================
# 技術棧
# ============================================
tech_stack:
  backend:
    runtime: Node.js 18+
    framework: Express.js 4.x
    dependencies:
      - express: "^4.18.2"
      - cors: "^2.8.5"
    
  frontend:
    core: Vanilla JavaScript (ES6+)
    styling: CSS3
    layout: Flexbox/Grid
    no_frameworks: true
    
  deployment:
    platform: Railway
    auto_deploy: true
    branch: main
    health_check: /health
    port: 8080

# ============================================
# API 設計
# ============================================
api_design:
  base_url: https://ai-hotel-assistant-builder-production.up.railway.app
  
  endpoints:
    health_check:
      path: /health
      method: GET
      response:
        status: 200
        body:
          status: "ok"
          version: "3.2"
    
    root:
      path: /
      method: GET
      response:
        status: 200
        body:
          status: "running"
          message: "AI Hotel Assistant API"
    
    chat:
      path: /api/ai/chat
      method: POST
      request_body:
        message: string (required)
        sessionId: string (optional, default: "default")
      response_success:
        success: true
        message: string
        reply: string
        sessionId: string
      response_error:
        success: false
        message: string
      examples:
        - request:
            message: "你好"
            sessionId: "user123"
          response:
            success: true
            message: "您好！我是智能助手..."
            sessionId: "user123"

# ============================================
# 資料結構
# ============================================
data_structures:
  room_type:
    id: string
    name: string
    basePrice: number
    size: string
    capacity:
      adults: number
      children: number
    breakfastIncluded: boolean
    amenities: string[]
  
  booking_info:
    roomType: string (deluxe|executive|suite|presidential)
    nights: number
    adults: number
    children: number
    childrenAges: number[]
    includeBreakfast: boolean
  
  conversation_session:
    sessionId: string
    roomType: string | null
    nights: number | null
    adults: number | null
    children: number
    includeBreakfast: boolean
    history: object[]

# ============================================
# 業務邏輯實現
# ============================================
business_logic_implementation:
  
  price_calculation:
    file: services/booking-calculator.js
    function: calculateTotal(bookingInfo)
    steps:
      - 計算基礎房價 (basePrice * nights)
      - 應用長住折扣 (3晚95折、5晚9折、7晚85折)
      - 計算兒童費用 (依年齡)
      - 計算早餐費用 (豪華客房需加購)
      - 計算總價
    returns:
      basePrice: number
      discountRate: number
      roomTotal: number
      childrenFee: number
      breakfastFee: number
      subtotal: number
      tax: number
      total: number
  
  intent_detection:
    file: services/mock-ai-service.js
    method: detectIntent(message)
    approach: 
      - 精確匹配 (exact match)
      - 模式匹配 (regex patterns)
      - 優先級排序
    returns: string (intent name)
  
  entity_extraction:
    file: services/mock-ai-service.js
    method: extractEntities(message, session)
    patterns:
      roomType: /豪華|行政|套房|總統/
      nights: /(\d+)(晚|天)/
      adults: /(\d+)(大人|成人|位)/
    modifies: session object

# ============================================
# 錯誤處理
# ============================================
error_handling:
  api_errors:
    - 400 Bad Request: 缺少必要參數
    - 500 Internal Server Error: 系統錯誤
  
  graceful_degradation:
    - AI 服務失敗 → 返回友好錯誤訊息
    - 計算錯誤 → 提示重新輸入
    - 網路錯誤 → 顯示重試選項
  
  logging:
    level: info
    outputs:
      - console (開發環境)
      - Railway logs (生產環境)

# ============================================
# 安全性
# ============================================
security:
  input_validation:
    - 所有用戶輸入進行驗證
    - 防止 SQL 注入 (不使用資料庫，N/A)
    - 防止 XSS 攻擊 (使用 textContent)
  
  cors_policy:
    - 允許所有來源 (開發階段)
    - 生產環境應限制特定域名
  
  rate_limiting:
    - 目前未實現
    - 建議：每 IP 每分鐘 60 次請求
  
  data_privacy:
    - 不儲存個人資料
    - Session 僅在記憶體中
    - 無持久化儲存

# ============================================
# 性能優化
# ============================================
performance:
  server_startup:
    target: < 1 second
    optimization:
      - 健康檢查立即響應
      - AI 服務異步加載 (50ms delay)
      - 最小化啟動依賴
  
  response_time:
    target: < 500ms
    optimizations:
      - 簡化意圖匹配邏輯
      - 避免複雜計算
      - 使用記憶體緩存
  
  memory_usage:
    target: < 256MB
    optimization:
      - 簡化資料結構
      - 定期清理過期 session
      - 避免大型物件儲存

# ============================================
# 測試策略
# ============================================
testing_strategy:
  unit_tests:
    framework: Jest (建議)
    coverage_target: 80%
    focus_areas:
      - 意圖識別準確率
      - 實體提取準確率
      - 價格計算正確性
  
  integration_tests:
    approach: API 端點測試
    tools: curl / Postman
    scenarios:
      - 完整訂房流程
      - 各種查詢場景
      - 錯誤處理
  
  manual_tests:
    interface: public/ai-chat-demo.html
    test_cases:
      - 10 個對話場景
      - 多輪訂房流程
      - 邊界情況

# ============================================
# 部署流程
# ============================================
deployment:
  platform: Railway
  
  workflow:
    - 開發者推送到 GitHub main 分支
    - Railway 自動偵測變更
    - 執行構建 (npm install)
    - 啟動服務 (npm start)
    - 健康檢查 (/health)
    - 部署完成
  
  rollback:
    method: Railway 控制台回滾
    或: git revert + push
  
  monitoring:
    health_check: /health endpoint
    logs: Railway 日誌面板
    uptime: Railway 自動監控

# ============================================
# 檔案結構
# ============================================
file_structure: |
  ai-hotel-assistant-builder/
  ├── server.js                 # Express 服務器
  ├── package.json              # 依賴管理
  ├── package-lock.json
  │
  ├── routes/
  │   └── ai-routes.js          # API 路由
  │
  ├── services/
  │   ├── mock-ai-service.js    # AI 對話引擎
  │   ├── hotel-data.js         # 飯店資料
  │   └── booking-calculator.js # 計算邏輯
  │
  ├── public/
  │   └── ai-chat-demo.html     # 測試介面
  │
  ├── speckit/
  │   ├── business-spec.yaml        # 業務規格
  │   ├── conversation-spec.yaml    # 對話規格
  │   ├── technical-spec.yaml       # 技術規格
  │   ├── README.md
  │   ├── ARCHITECTURE.md
  │   └── IMPLEMENTATION_PLAN.md
  │
  └── README.md

# ============================================
# 環境變數
# ============================================
environment_variables:
  PORT:
    description: 服務器端口
    default: 8080
    required: false
  
  NODE_ENV:
    description: 運行環境
    values: [development, production]
    default: production
    required: false

# ============================================
# 依賴管理
# ============================================
dependencies:
  production:
    express: "^4.18.2"
    cors: "^2.8.5"
  
  development:
    nodemon: "^3.0.1" (建議)
    jest: "^29.0.0" (建議)
  
  update_policy:
    - 每月檢查安全更新
    - 小版本自動更新
    - 大版本需測試後更新

# ============================================
# 開發指南
# ============================================
development_guide:
  setup:
    - git clone <repository>
    - npm install
    - npm start
    - 訪問 http://localhost:8080
  
  coding_standards:
    - 使用 ES6+ 語法
    - 函數命名：camelCase
    - 檔案命名：kebab-case
    - 註解：關鍵邏輯必須註解
  
  git_workflow:
    - main 分支：生產環境
    - feature/* 分支：功能開發
    - fix/* 分支：錯誤修復
    - 提交訊息：feat/fix/docs/refactor

# ============================================
# 已知限制
# ============================================
known_limitations:
  - 無資料庫持久化（所有資料在記憶體）
  - 無用戶認證系統
  - 無 Session 持久化
  - 無真實支付整合
  - 無預訂確認郵件
  - 無管理後台

# ============================================
# 未來改進方向
# ============================================
future_improvements:
  short_term:
    - 實現 Session 持久化 (Redis)
    - 增加單元測試覆蓋
    - 優化意圖識別準確率
    - 增加更多對話場景
  
  medium_term:
    - 整合真實飯店 API
    - 實現用戶認證系統
    - 增加管理後台
    - 實現預訂確認流程
  
  long_term:
    - 使用真實 NLP 模型
    - 多語言支持
    - 語音輸入支持
    - 行動應用開發

# ============================================
# 版本歷史
# ============================================
version_history:
  v3.2:
    date: 2025-11-04
    changes:
      - 極簡穩定版
      - 精確意圖匹配
      - 優化啟動速度
  
  v3.1:
    date: 2025-11-04
    changes:
      - 全面優化意圖識別
      - 新增詳細回覆
      - 修復已知問題
  
  v3.0:
    date: 2025-11-04
    changes:
      - 產品級多輪對話
      - 智能資訊收集
      - 完整業務功能
EOFSPEC

echo "✅ technical-spec.yaml 已創建"

# 檢查文件
if [ -f "speckit/technical-spec.yaml" ]; then
    echo "   大小：$(wc -c < speckit/technical-spec.yaml) bytes"
    echo "   行數：$(wc -l < speckit/technical-spec.yaml) lines"
fi

# Git 操作
echo ""
echo "📤 推送到 GitHub..."

git add speckit/technical-spec.yaml

git commit -m "feat: add technical-spec.yaml

✅ System architecture definition
✅ API design specifications
✅ Data structures
✅ Business logic implementation
✅ Security & performance guidelines
✅ Testing strategy
✅ Deployment workflow

Complete technical blueprint for the AI chat system.
File: speckit/technical-spec.yaml"

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 成功推送 technical-spec.yaml"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔗 GitHub 連結："
    echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder/blob/main/speckit/technical-spec.yaml"
    echo ""
    echo "📂 完整 SpecKit 結構："
    echo ""
    echo "   speckit/"
    echo "   ├── business-spec.yaml       ← 業務規格"
    echo "   ├── conversation-spec.yaml   ← 對話規格"
    echo "   ├── technical-spec.yaml      ← 技術規格 (新增)"
    echo "   ├── README.md"
    echo "   ├── ARCHITECTURE.md"
    echo "   └── IMPLEMENTATION_PLAN.md"
    echo ""
    echo "✅ 三大規格文件齊全！"
    echo ""
    echo "📋 涵蓋內容："
    echo "   • 系統架構設計"
    echo "   • API 端點規格"
    echo "   • 資料結構定義"
    echo "   • 業務邏輯實現"
    echo "   • 安全性與性能"
    echo "   • 測試策略"
    echo "   • 部署流程"
    echo "   • 開發指南"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
    echo "手動推送："
    echo "   git add speckit/technical-spec.yaml"
    echo "   git commit -m 'feat: add technical-spec.yaml'"
    echo "   git push origin main"
    echo ""
fi


# Business SpecKit 架構設計

**版本**：1.0.0  
**更新日期**：2025-11-04

---

## 📐 三層架構概述

Business SpecKit 採用三層架構設計，清晰分離需求定義、技術實現和系統運行：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    第一層：業務規格層（SpecKit）                       │
│                         (What to Build)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📋 business-spec.yaml                                               │
│  ├─ 業務領域定義 (預訂、房態、價格、會員)                             │
│  ├─ 業務規則庫 (取消政策、會員等級、定價規則)                         │
│  ├─ 跨系統關聯 (與支付、通知系統的整合點)                             │
│  └─ 業務流程圖 (預訂生命週期、會員升級流程)                           │
│                                                                       │
│  💬 conversation-spec.yaml                                           │
│  ├─ 對話場景定義 (10+ 個場景：房型查詢、優惠查詢等)                   │
│  ├─ 意圖識別規則 (如何判斷用戶想做什麼)                               │
│  ├─ 實體提取模式 (從對話中提取房型、天數、人數)                       │
│  ├─ 多輪對話流程 (訂房需要收集哪些資訊、順序如何)                     │
│  └─ 回覆模板庫 (每個場景的標準回應)                                   │
│                                                                       │
│  🔧 technical-spec.yaml                                              │
│  ├─ 系統架構設計 (組件、部署平台)                                     │
│  ├─ API 端點規格 (請求/響應格式)                                      │
│  ├─ 資料結構定義 (所有資料模型)                                       │
│  ├─ 業務邏輯實現 (計算、識別、提取邏輯)                               │
│  ├─ 安全性指南 (驗證、CORS、隱私)                                     │
│  ├─ 性能優化 (啟動、響應、記憶體)                                     │
│  └─ 測試與部署 (策略、流程)                                           │
│                                                                       │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  │ 指導實現 (開發團隊依據 Spec 開發)
                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    第二層：應用實現層（Code）                          │
│                         (How to Build)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📁 services/                                                        │
│  ├─ mock-ai-service.js                                              │
│  │  └─ 實現 conversation-spec 定義的對話邏輯                         │
│  │     • 意圖識別 (detectIntent)                                     │
│  │     • 實體提取 (extractEntities)                                  │
│  │     • 回覆生成 (generateResponse)                                 │
│  │                                                                   │
│  ├─ booking-calculator.js                                           │
│  │  └─ 實現 business-spec 定義的計算規則                             │
│  │     • 價格計算 (calculateTotal)                                   │
│  │     • 折扣計算 (長住、會員、促銷)                                  │
│  │     • 明細格式化 (formatBreakdown)                                │
│  │                                                                   │
│  └─ hotel-data.js                                                   │
│     └─ 實現 business-spec 定義的資料結構                              │
│        • 房型資料                                                     │
│        • 會員等級                                                     │
│        • 優惠方案                                                     │
│                                                                       │
│  📁 routes/                                                          │
│  └─ ai-routes.js                                                    │
│     └─ 實現 technical-spec 定義的 API                                │
│        • POST /api/ai/chat                                           │
│        • 請求驗證                                                     │
│        • 錯誤處理                                                     │
│                                                                       │
│  📁 public/                                                          │
│  └─ ai-chat-demo.html                                               │
│     └─ 用戶界面實現                                                   │
│        • 聊天界面                                                     │
│        • 訊息顯示                                                     │
│        • API 呼叫                                                     │
│                                                                       │
│  📄 server.js                                                        │
│  └─ Express 服務器                                                    │
│     • 路由註冊                                                        │
│     • 中間件配置                                                      │
│     • 健康檢查                                                        │
│                                                                       │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  │ 部署運行
                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    第三層：運行時層（Runtime）                         │
│                        (Running System)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  🚀 Railway 平台                                                     │
│  ├─ 自動部署 (GitHub main 分支觸發)                                  │
│  ├─ 健康檢查 (GET /health)                                           │
│  ├─ 日誌監控                                                          │
│  └─ 環境變數管理                                                      │
│                                                                       │
│  🌐 AI 聊天服務 (https://...up.railway.app)                          │
│  ├─ Node.js Runtime                                                 │
│  ├─ Express API Server                                              │
│  └─ WebSocket 連接 (未來擴展)                                        │
│                                                                       │
│  👤 用戶互動                                                          │
│  ├─ Web Chat 界面 (/ai-chat-demo.html)                              │
│  ├─ API 調用 (POST /api/ai/chat)                                    │
│  └─ 實時對話體驗                                                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 需求變更流程

### 標準變更流程

```
需求變更
    ↓
1️⃣ 更新 business-spec.yaml
   └─ 定義新的業務規則
    ↓
2️⃣ 更新 conversation-spec.yaml (如需要)
   └─ 定義對話如何處理新需求
    ↓
3️⃣ 更新 technical-spec.yaml (如需要)
   └─ 定義技術實現方案
    ↓
4️⃣ 實現代碼
   └─ services/ 和 routes/ 中實現邏輯
    ↓
5️⃣ 測試驗證
   └─ 確保符合 Spec 定義
    ↓
6️⃣ 部署上線
   └─ 推送到 GitHub main 分支，Railway 自動部署
```

### 變更範例：新增「生日優惠」

**Step 1: 更新 business-spec.yaml**
```yaml
會員體系規則:
  會員權益:
    生日優惠: 當月入住享85折  # ← 新增
```

**Step 2: 更新 conversation-spec.yaml**
```yaml
promotions_inquiry:
  response: |
    🎉 優惠活動
    🎂 **生日優惠**：當月入住享85折  # ← 新增
```

**Step 3: 實現代碼**
```javascript
// services/booking-calculator.js
function applyBirthdayDiscount(price, userBirthday, checkinDate) {
  if (isSameMonth(userBirthday, checkinDate)) {
    return price * 0.85;
  }
  return price;
}
```

**Step 4: 更新 AI 服務**
```javascript
// services/mock-ai-service.js
case 'promotions':
  response += '🎂 生日優惠：當月入住享85折\n';
  break;
```

---

## 🎭 角色與職責

### 產品經理
**負責文件**：business-spec.yaml

**職責**：
- ✅ 定義業務需求和規則
- ✅ 維護業務邏輯的真實性
- ✅ 與業務團隊溝通確認

**工作流**：
1. 收集業務需求
2. 更新 business-spec.yaml
3. 與開發團隊 review
4. 驗收最終實現

---

### 對話設計師 / UX Writer
**負責文件**：conversation-spec.yaml

**職責**：
- ✅ 設計對話場景和流程
- ✅ 編寫友善自然的回覆
- ✅ 優化用戶體驗

**工作流**：
1. 基於 business-spec 理解業務
2. 設計對話流程和回覆
3. 更新 conversation-spec.yaml
4. 測試對話體驗

---

### 開發工程師
**負責文件**：technical-spec.yaml + 實際代碼

**職責**：
- ✅ 設計技術架構
- ✅ 實現業務邏輯和對話邏輯
- ✅ 確保性能和安全性

**工作流**：
1. 閱讀 business-spec 和 conversation-spec
2. 設計技術方案，更新 technical-spec.yaml
3. 實現代碼
4. 編寫測試
5. 部署上線

---

### 測試工程師
**負責文件**：所有 Spec（作為測試依據）

**職責**：
- ✅ 驗證實現符合 Spec
- ✅ 編寫測試案例
- ✅ 執行回歸測試

**工作流**：
1. 基於 Spec 編寫測試案例
2. 執行功能測試
3. 驗證業務邏輯正確性
4. 回報問題

---

## 📊 文件間關係

### 依賴關係

```
business-spec.yaml
    ↓ (定義業務)
conversation-spec.yaml
    ↓ (定義對話)
technical-spec.yaml
    ↓ (定義技術)
實際代碼 (services/, routes/)
    ↓ (實現功能)
運行系統 (Railway)
```

### 數據流向

**用戶請求流**：
```
用戶輸入
    ↓
AI Service (mock-ai-service.js)
    ↓
意圖識別 (conversation-spec 定義的規則)
    ↓
實體提取 (conversation-spec 定義的模式)
    ↓
業務邏輯處理 (business-spec 定義的規則)
    ↓
生成回覆 (conversation-spec 定義的模板)
    ↓
返回用戶
```

---

## 🛠️ 開發指南

### 新功能開發流程

1. **需求確認階段**
   - 產品經理更新 `business-spec.yaml`
   - 團隊 review 業務邏輯

2. **設計階段**
   - 對話設計師更新 `conversation-spec.yaml`
   - 開發工程師更新 `technical-spec.yaml`
   - 評估技術可行性

3. **實現階段**
   - 創建功能分支 `feature/xxx`
   - 按 Spec 實現代碼
   - 編寫單元測試

4. **測試階段**
   - 功能測試
   - 與 Spec 對比驗證
   - 修復問題

5. **部署階段**
   - 合併到 main 分支
   - Railway 自動部署
   - 生產環境驗證

---

### Bug 修復流程

1. **問題確認**
   - 檢查是 Spec 問題還是實現問題

2. **如果是 Spec 問題**
   - 更新相應的 Spec 文件
   - 通知團隊

3. **如果是實現問題**
   - 創建修復分支 `fix/xxx`
   - 修復代碼
   - 確保符合 Spec

4. **部署**
   - 合併到 main
   - 驗證修復效果

---

## 🎯 最佳實踐

### ✅ 應該做的

1. **保持 Spec 與代碼同步**
   - 代碼變更前先更新 Spec
   - 定期 review Spec 與實現的一致性

2. **使用 Spec 作為溝通橋樑**
   - 團隊討論時引用 Spec
   - 減少口頭溝通的歧義

3. **版本管理**
   - Spec 文件與代碼一起管理
   - 使用 Git 追蹤變更歷史

4. **定期更新**
   - 業務變更時及時更新 business-spec
   - 對話優化時及時更新 conversation-spec

---

### ❌ 不應該做的

1. **不要直接在代碼裡寫死業務規則**
   - ❌ 硬編碼取消政策
   - ✅ 從 business-spec 定義讀取

2. **不要繞過 Spec 修改代碼**
   - ❌ 直接改代碼不更新 Spec
   - ✅ 先更新 Spec，再改代碼

3. **不要讓 Spec 過時**
   - ❌ Spec 與實現不一致
   - ✅ 持續維護 Spec

---

## 📈 未來擴展

### 短期計劃
- 完善多輪對話狀態管理
- 提高意圖識別準確率
- 增加更多對話場景

### 中期計劃
- 整合真實飯店 API
- 實現用戶認證系統
- 增加管理後台

### 長期計劃
- 使用真實 NLP 模型
- 多語言支持
- 語音輸入支持

---

## 📚 相關文檔

- [Business Spec](./business-spec.yaml) - 業務規格
- [Conversation Spec](./conversation-spec.yaml) - 對話規格
- [Technical Spec](./technical-spec.yaml) - 技術規格
- [README](./README.md) - SpecKit 說明

---

**維護者**：Product & Development Team  
**最後更新**：2025-11-04  
**版本**：1.0.0

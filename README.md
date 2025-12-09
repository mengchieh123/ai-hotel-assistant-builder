# 旅萌大酒店 AI 訂房系統 (Hotel Booking AI System)

## 💡 專案概述

本系統旨在提供一個高度穩定、可配置的對話式 AI 介面，以實現端到端的酒店訂房服務。系統核心由 **Rule Engine** 驅動，結合後端 **Handler** 服務，提供精準的狀態追蹤與業務邏輯處理，確保用戶從查詢到訂單提交的順暢體驗。

---

## 🛠️ 系統架構 (System Architecture)

本系統採三層架構設計：

1.  **使用者介面 (Frontend/Channel)**：接收用戶輸入。
2.  **對話管理層 (Rule Engine Core)**：處理自然語言理解 (NLU) 與流程狀態管理。
3.  **業務邏輯層 (Backend Handlers/APIs)**：執行關鍵業務操作和數據查詢。

### 核心組成部分

| 組成部分 | 關鍵技術 | 職責 |
| :--- | :--- | :--- |
| **Rule Engine** | `dialogue_flow.json` (JSON) | **對話核心**。負責狀態機的推進、意圖 (Intent) 識別、實體 (Entity) 收集，以及定義流程的轉移規則。 |
| **NLU Module** | (外部或內建分類器) | 將用戶的自然語言輸入分類為流程中定義的 Intent 和 Entity。 |
| **Handlers** | (業務服務層) | 處理複雜業務邏輯，例如：價格計算、庫存鎖定、資料驗證、API 呼叫。 |
| **Backend API** | (庫存/訂單系統) | 提供即時庫存、會員服務、支付處理、訂單提交等關鍵數據與服務。 |

---

## ⚙️ 核心流程機制

### 1. 狀態機 (State Machine)

流程定義於 `dialogue_flow.json`。每個 State 定義了：
* **`type`**：`entity_collection` (收集實體), `logic_exec` (執行 Handler), `prompt` (提示/結束)。
* **`next_state`**：成功時的跳轉目標。
* **`fallback_state`**：當 NLU 或 Handler 失敗時的明確回彈點 (**V1.20 穩定版的核心增強點**)。

### 2. 實體與意圖 (Entities & Intents)

* **關鍵實體 (Entities)**：`checkInDate`, `nights`, `roomType`, `contactName`, `finalPrice` 等，用於追蹤訂單數據。
* **關鍵意圖 (Intents)**：`booking` (開始預訂), `affirm` (確認), `skip` (跳過), `login` (登入), `correction` (修改)。

### 3. Handler 邏輯執行 (Logic Execution)

Handler 負責與後端服務進行數據交換，主要分為兩大類：

| Handler 類型 | 範例 Handler | 描述 |
| :--- | :--- | :--- |
| **資料驗證/流程控制** | `checkDateCompleteness`, `validateContactInfo` | 驗證輸入的有效性，控制流程的轉向。 |
| **關鍵交易/API 呼叫** | `lockInventory`, `calculatePrice`, `submitBooking` | 呼叫後端 API，執行房型鎖定、價格計算和最終訂單提交。 **(當靜態資料無法支援時，則調用此類 API)** |

---

## 🛡️ V1.20_Stable 版本重點增強 (Stability & Robustness)

V1.20 版本的重點是解決流程中的「**無預警回彈**」和「**實體數據污染**」問題，從而大幅提升系統的健壯性。

| 改善項目 | 實作細節 | 影響範圍 |
| :--- | :--- | :--- |
| **強化 Fallback 機制** | 在所有 `logic_exec` 狀態 (如 `ask_contact_info`) 設置明確的 `fallback_state`。 | 確保 Handler 執行失敗時，流程穩定停留在當前狀態，要求用戶重試，而非回彈至 `init`。 |
| **清除實體數據** | 擴大 `init` 狀態中的 `clear_entities` 列表。 | 解決實體殘留 (Stale Entity) 問題，確保每次新訂單從「乾淨」的狀態開始。 |
| **登入流程穩定** | 修正 `login_member_account` 和 `ask_member_password` 的跳轉邏輯。 | 提升會員登入環節的穩定性，優化跳過登入至加購服務的路徑。 |

---

## 📘 系統操作與部署

### 前置要求
* [列出所需的環境或框架，例如 Node.js / Python Runtime]
* 後端 Booking API 服務需正常運行。

### 部署步驟
1.  **Clone 專案：** `git clone [https://github.com/mengchieh123/ai-hotel-assistant-builder/]`
2.  前端測試網址：https://ai-hotel-assistant-builder.onrender.com/
3.  **配置 Rule Engine：** 將 `dialogue_flow.json` 載入 Rule Engine 伺服器。
4.  **配置 Handlers：** 確保所有 Handler 服務已部署並正確配置 API 呼叫路徑。
5.  **啟動服務：** 執行 Rule Engine 服務和 Handler 服務。

### 貢獻與除錯
* **Bug 報告：** 請附上 **Session ID** 和詳細的 **DEBUG 日誌**。
* **除錯原則：** 優先檢查 `fallback_state` 設定，確保沒有流程無頭狀態。

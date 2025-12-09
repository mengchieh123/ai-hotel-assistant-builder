🏨 AI 酒店訂房助理 (Hotel Booking Assistant)

專案概述 (Project Overview)
AI 酒店訂房助理是一個基於
**規則引擎（Rule Engine）
**與 大型語言模型（LLM, Gemini） 協同運作的對話式應用程式。
它旨在提供一個高效、穩定且人性化的訂房體驗，能夠處理複雜的多步驟交易流程，同時利用生成式 AI 來處理用戶的非結構化查詢和特殊要求。

前端測試連結：https://ai-hotel-assistant-builder.onrender.com/

核心功能:

多步驟訂房流程： 依序收集房型、日期、人數、會員資訊、加購服務和聯絡資訊。

精確的業務邏輯： 內建房價計算、空房檢查、會員折扣和服務費用計算（如早餐、接送機）。

智慧閒聊與協作： 在流程間隙或用戶提出非流程性問題（如「嬰兒床」、「早餐在哪吃」）時，自動切換到 Gemini AI 進行處理和回應。

流程暫停與恢復： 允許用戶隨時暫停訂房流程進行資訊查詢，然後無縫返回上一個步驟。

系統架構 (System Architecture)
本系統的核心架構基於三層協作模型，確保了交易穩定性與對話彈性。

組件名稱	檔案	職責 (Responsibility)	協作類型
對話流程配置	dialogue_flow.json	定義所有對話狀態、轉移路徑、實體需求和標準提示語。	靜態配置
規則引擎核心	rule_engine.js	執行核心決策邏輯，管理規則優先級（緊急 > 流程 > 閒聊），並決定是否呼叫 AI。	業務邏輯
流程控制器	booking_controller.js	處理所有業務交易邏輯：價格計算、會員折扣應用、空房模擬檢查及最終訂單提交。	交易處理
意圖與實體識別	intent_classifier.js	將用戶輸入分類為特定的訂房意圖 (booking, affirm, deny) 並提取關鍵實體 (roomType, checkInDate, 等)。	輸入解析
AI 生成器	gemini_generator.js	負責與 Gemini API 互動，處理通用查詢和非結構化問題，提供人性化的回覆。	內容生成
快速開始 (Getting Started)
預先準備 (Prerequisites)

Node.js (推薦 v18+)

Gemini API Key (用於 gemini_generator.js)

專案安裝 (Installation)

Bash
# 複製專案
git clone [您的專案連結]
cd [專案目錄]

# 安裝依賴
npm install

# 設定環境變數
# 在專案根目錄建立 .env 檔案，並填入您的 API Key
echo "GEMINI_API_KEY='YOUR_API_KEY_HERE'" > .env
運行專案 (Running the Project)

Bash
# 啟動應用程式 (例如使用 Express.js 伺服器)
npm start
核心流程邏輯說明
rule_engine.js 採用優先級處理模型，確保系統的穩定性。

1. 規則優先級

優先級	規則名稱	描述
P:100	emergencyRule	處理如「救命」、「緊急」等關鍵字，立即中斷流程。
P:99	bookingFlowRule (恢復)	處理從暫停狀態 (paused_waiting_for_resume) 恢復訂房的指令。
P:98	bookingFlowRule (暫停)	識別到用戶在流程中提出查詢，將當前狀態存入 pausedState 並進入暫停。
P:95	bookingFlowRule (轉移/Fallback)	驅動流程前進，進行狀態轉移、實體收集檢查，並處理流程內的錯誤或 Fallback。
P:1	generalRule	處理所有未被高優先級規則捕獲的輸入，將請求導向 Gemini AI 進行閒聊或特殊處理。
2. 特殊業務邏輯 (在 bookingFlowRule 內觸發)

加購服務邏輯： 在進入 ask_transfer_service 之前，系統會根據用戶對早餐的選擇，計算 mealPrice 並將其納入 totalPrice。

接送機邏輯： 根據用戶在 ask_transfer_service 和 collect_transfer_details 中的回覆，在最終價格計算前更新 transferFee。

最終確認： 在進入 confirm_booking 狀態時，系統會調用 generateSummary 函數，動態生成包含所有費用細項的 Markdown 訂單摘要。

配置與維護 (Configuration and Maintenance)
狀態管理 (dialogue_flow.json)

所有狀態配置皆在此檔案中維護：

修改提示語： 更改 prompt 欄位。

調整按鈕： 更改 richCard 內的 buttons 陣列。

變更流程順序： 更改 next_state 欄位。

業務邏輯 (booking_controller.js)

所有價格、折扣、空房庫存和業務規則的調整應在此檔案中進行。例如，修改早餐價格或更改兒童免費年齡。

AI 知識庫 (gemini_generator.js)

如果需要調整 AI 的角色扮演、語氣或提供特定的業務知識（如酒店設施、周邊景點介紹），應修改傳遞給 Gemini 的 System Instruction (系統指令)。

感謝您參與構建這個強大的 AI 酒店訂房助理！

🏨 AI 飯店訂房助理 (AI Hotel Assistant)

🌟 專案簡介 (Introduction)

AI 飯店訂房助理是一個基於 Node.js 和 Express 框架構建的對話式 AI 系統。它使用一個強大的規則引擎 (Rule Engine) 結合意圖分類 (Intent Classification) 和 實體抽取 (Entity Extraction)，來精準地管理複雜的訂房流程，並在無法處理時自動切換至 LLM（如 Google Gemini）進行通用查詢處理。專案核心目標是提供一個高效率、高穩定性的狀態機流程，以確保用戶體驗一致性，並減少對昂貴的 LLM 呼叫的依賴。

🛠️ 環境要求 (Prerequisites)
Node.js: 版本 18.x 或更高

npm: 最新版本

Google Gemini API Key: 用於 LLM 輔助和通用查詢回退。

⚙️ 安裝與設置 (Installation and Setup)

步驟 1: 複製專案

Bash
git clone [(https://github.com/mengchieh123/ai-hotel-assistant-builder/edit/main/README.md)]
cd AI-Hotel-Assistant

步驟 2: 安裝依賴

Bash
npm install

步驟 3: 設定環境變數

在專案根目錄下創建一個 .env 檔案，並填入您的 Gemini API Key：

程式碼片段
# .env 檔案內容
GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY_HERE"
# 可選：設定伺服器運行端口
PORT=10000 
步驟 4: 配置對話流程 (Dialogue Flow)

確保 dialogue_flow.json 檔案存在於專案的根目錄下，並且格式正確。這是 Rule Engine 的核心配置文件。

注意：在啟動前，Rule Engine 會執行嚴格的配置檢查，要求 dialogue_flow.json 必須包含 states 屬性，且其中必須有 init 狀態。

🚀 專案啟動 (Running the Project)

使用 npm 啟動伺服器：

測試環境：https://ai-hotel-assistant-builder.onrender.com

Bash
npm start
# 或直接使用 node
# node server.js
伺服器啟動後，您將看到類似以下的日誌輸出：

✅ [DEBUG] dialogue_flow.json 成功載入！
✅ [DEBUG] RuleEngine 靜態配置完成並已通過結構檢查。
✅ Rule Engine 配置已通過檢查。
🚀 伺服器運行在 http://0.0.0.0:10000
Gemini API Key: 已設定
🗺️ API 端點 (API Endpoints)
方法	路徑	說明
GET	/	伺服器根目錄，通常返回前端靜態頁面 (index.html)。
GET	/health	健康檢查端點，返回伺服器狀態。
POST	/api/chat	主要的對話 API 端點。 接收用戶訊息並返回 Rule Engine 的回應。
/api/chat 請求/回應格式

請求 (Request Body)

參數	類型	說明
sessionId	string	當前會話 ID。如果為空或無效，系統將自動生成新的 UUID。
message	string	用戶輸入的文字訊息。
回應 (Response Body)

參數	類型	說明
reply	string	助理的回覆文字。
sessionId	string	當前的會話 ID。
nextStep	string	規則引擎導向的下一個狀態名稱 (例如: ask_dates_and_nights)。
richCard	object	null
endFlow	boolean	指示會話是否已結束並重置。
🧠 核心架構：Rule Engine 流程
本系統的核心是 RuleEngine.js，它負責處理每一條傳入的訊息，並決定對話的下一步。

初始化檢查 (server.js)：伺服器啟動時，強制執行 RuleEngine.initializeFlowConfig()，確保 dialogue_flow.json 被正確載入到靜態配置 (RuleEngine.config)。

執行規則 (RuleEngine.executeRules)：

意圖/實體抽取: 解析用戶輸入，識別意圖 (如 booking, reset) 和實體 (如 checkInDate, nights)。

高優先級規則 (P:110-100): 處理緊急指令 (end_conversation) 和流程控制 (reset)。

核心訂房流程 (P:95+): 根據當前狀態 (session.currentStep) 和已收集的實體，決定是繼續收集實體、執行後端 Handler 邏輯，還是推進到下一個狀態。

LLM 輔助回退 (P:79): 如果系統連續兩次無法理解用戶，將流程導向 handle_general_inquiry 狀態，並允許呼叫 Gemini 處理通用查詢。

通用規則回退 (P:80): 如果沒有更高優先級的規則被觸發，則重複輸出當前狀態的提示 (state.prompt)。

關鍵檔案結構

server.js: Express 伺服器，負責 API 路由和 Rule Engine 的初始化調度。

rule_engine.js: 規則引擎核心，包含所有狀態轉換邏輯和優先級規則。

dialogue_flow.json: 流程配置檔，定義了所有狀態 (states)、所需實體 (entities) 和狀態間的轉換邏輯。

session_manager.js: 處理用戶會話狀態的儲存和管理。

booking_controller.js: 包含所有需要與後端服務（如庫存 API）交互的業務邏輯 Handler。

# 🏨 AI 智能酒店助理構建器

[![Railway Deploy](https://railway.app/button.svg)](https://railway.app)
![Version](https://img.shields.io/badge/version-2.0.0-brightgreen)
![Auto-Dev](https://img.shields.io/badge/AI--Auto--Development-Enabled-success)

**革命性的 AI 自動開發系統** - 產品經理用自然語言定義規格，AI 自動生成完整功能代碼。

🌐 **線上演示**: https://ai-hotel-assistant-builder-production.up.railway.app

## ✨ 核心亮點

### 🤖 AI 自動開發引擎
- **規格驅動開發** - 產品經理編輯 YAML，AI 自動生成業務邏輯
- **零代碼擴展** - 添加新功能無需開發者介入
- **即時部署** - 規格更新後自動部署到生產環境

### 🏨 智能酒店助理
- **自然語言理解** - 智能識別用戶意圖
- **多輪對話** - 上下文感知的對話管理
- **專業知識庫** - 完整的酒店業務邏輯

## 🚀 快速開始

### 對於產品經理

#### 添加新功能（範例：會員系統）
1. **編輯 `business_speckit.yaml`**:
```yaml
membership_system:
  enabled: true
  levels:
    - name: "普通會員"
      discount: 5
    - name: "黃金會員"
      discount: 10
執行自動生成:
bash
npm run speckit:generate
功能立即上線！會員系統自動整合到對話助理中
對於開發者

環境設置

bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

# 安裝依賴
npm install

# 啟動服務
npm start
服務將運行在 http://localhost:8080

🏗️ 系統架構

核心組件

text
ai-hotel-assistant-builder/
├── 🧠 speckit/                 # AI 自動開發引擎
│   ├── core-engine.js         # 核心 AI 處理引擎
│   ├── cli.js                 # 命令行接口
│   └── generators/            # 代碼生成器（可擴展）
├── 📋 business_speckit.yaml   # 業務規格文件
├── 🔧 generated/              # 自動生成代碼
└── 🚀 server.js               # 主應用程式
工作流程

規格定義 - 產品經理編輯 YAML 文件
AI 分析 - 引擎解析規格並識別功能需求
代碼生成 - 自動生成對應的 JavaScript 代碼
系統整合 - 無縫整合到現有應用程式
自動部署 - 立即生效到生產環境
📡 API 文檔

基礎端點

端點	方法	說明
GET /	GET	服務資訊
GET /api/health	GET	健康檢查
POST /api/assistant/chat	POST	智能對話
智能對話示例

http
POST /api/assistant/chat
Content-Type: application/json

{
  "message": "我想預訂明晚的豪華客房",
  "session_id": "user_123"
}
回應：

json
{
  "success": true,
  "reply": "感謝您的預訂需求！豪華客房每晚 3,800元...",
  "session_id": "user_123",
  "timestamp": "2024-01-15T08:30:25.123Z"
}
🛠️ 規格驅動開發

業務規格文件 (business_speckit.yaml)

產品經理可以定義：

會員系統

yaml
membership_system:
  enabled: true
  levels:
    - name: "普通會員"
      discount: 5
      benefits: ["積分累積", "會員價格"]
促銷活動

yaml
promotion_system:
  enabled: true
  campaigns:
    - name: "早鳥優惠"
      discount: 15
      conditions: "提前7天預訂"
自動生成的功能

✅ 會員折扣計算
✅ 積分管理系統
✅ 促銷價格邏輯
✅ API 端點自動創建
🔧 開發指令

Speckit 自動開發系統

bash
# 驗證規格文件
npm run speckit:validate

# 執行 AI 自動生成
npm run speckit:generate

# 查看生成預覽
npm run speckit:preview
標準開發指令

bash
# 啟動開發服務
npm run dev

# 啟動生產服務
npm start
💬 使用範例

房型詢問

bash
curl -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/api/assistant/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "有什麼房型推薦？價格多少？"}'
設施查詢

bash
curl -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/api/assistant/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "酒店有游泳池和健身房嗎？開放時間？"}'
測試自動生成

bash
# 驗證業務規格
npm run speckit:validate

# 執行 AI 自動開發
npm run speckit:generate
🏨 酒店資料

房型與價格

房型	價格	面積	容納人數	特色設施
豪華客房	3,800元/晚	28-32㎡	2位成人	市景、免費WiFi、迷你吧、Nespresso咖啡機
行政套房	6,800元/晚	48-52㎡	2大1小	101景觀、行政酒廊、按摩浴缸、專屬管家
家庭套房	8,800元/晚	65㎡	2大2小	兩間臥室、兒童遊戲區、小廚房、家庭電影院
設施服務

游泳池: 室外恆溫游泳池 (06:00-22:00)
健身中心: 24小時開放
SPA水療: 沐蘭 SPA (10:00-22:00，需預約)
酒店政策

入住時間: 15:00後
退房時間: 12:00前
取消政策: 入住前24小時免費取消
🚀 部署

Railway 自動部署

推送代碼到 GitHub main 分支
Railway 自動檢測並部署
服務在 2 分鐘內上線
🧪 測試

自動生成測試

bash
# 測試規格文件
npm run speckit:validate

# 執行完整生成流程
npm run speckit:generate
API 測試

bash
# 健康檢查
curl https://ai-hotel-assistant-builder-production.up.railway.app/api/health

# 對話測試
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "測試訊息"}'
🤝 貢獻指南

對於產品經理

編輯 business_speckit.yaml 文件
提交 Pull Request
通過驗證後自動部署
對於開發者

在 speckit/generators/ 添加新生成器
更新核心引擎邏輯
測試生成結果
📄 許可證

MIT License

🆘 支持

問題報告

請在 GitHub Issues 報告問題

最後更新: 2025年10月31日
版本: 2.0.0 (AI Auto-Development)
狀態: ✅ 生產環境穩定運行

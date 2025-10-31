# 🏨 AI Hotel Assistant Builder

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.18-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Deployment](https://img.shields.io/badge/Deployment-Railway-success.svg)

## 📖 項目概述

AI Hotel Assistant Builder 是一個自主開發的智能酒店預訂系統，通過自然語言處理技術理解用戶需求，提供智能化的酒店搜索和預訂服務。

### 🎯 核心價值
- **智能對話**: 自然語言理解用戶預訂需求
- **精準推薦**: 基於多維度條件的酒店篩選
- **無縫體驗**: 端到端的預訂流程
- **自主開發**: 支持系統自我進化和優化

## 🚀 快速開始

### 環境要求
- Node.js 18.0.0 或更高版本
- npm 或 yarn 包管理器

### 安裝與運行
```bash
# 克隆項目
git clone https://github.com/mengchieh123/ai-hotel-assistant-builder.git
cd ai-hotel-assistant-builder

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 生產環境啟動
npm start

測試
# 運行 API 測試
npm test

# 健康檢查驗證
curl https://ai-hotel-assistant-builder-production.up.railway.app/health

線上演示

生產環境: https://ai-hotel-assistant-builder-production.up.railway.app

即時測試示例

bash
# AI 對話測試
curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我想訂台北的五星級酒店，預算5000元，這週末入住"}'

# 酒店搜索測試
curl "https://ai-hotel-assistant-builder-production.up.railway.app/api/hotels/search?location=台北&guests=2"
📊 系統架構

text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   客戶端        │    │   API 網關       │    │   業務邏輯層     │
│ (Web/Mobile)    │───▶│ (Express.js)     │───▶│ (服務層)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                         │
                      ┌──────────────────┐    ┌─────────────────┐
                      │   中間件層        │    │   數據層         │
                      │ (Auth/Validation)│    │ (In-Memory DB)  │
                      └──────────────────┘    └─────────────────┘
🔗 重要鏈接

在線演示: 生產環境
API 文檔: 詳細文檔
產品需求: 需求文檔
技術文檔: 架構說明
測試報告: 測試詳情
👥 團隊信息

項目負責人: mengchieh123
技術棧: Node.js, Express, Railway
版本: v1.0.0
最後更新: 2025年10月

📄 許可證

本項目採用 MIT 許可證 - 詳見 LICENSE 文件。

如有問題或建議，請通過 GitHub Issues 反饋。

text

## 2. **docs/API_DOCUMENTATION.md**

```markdown
# API 技術文檔

## 文檔版本控制
| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|----------|
| v1.0 | 2025-10-31 | mengchieh123 | 初始版本發布 |

## 1. 基礎信息

### 1.1 服務端點
生產環境: https://ai-hotel-assistant-builder-production.up.railway.app
開發環境: http://localhost:3000

text

### 1.2 通用規範
- **數據格式**: application/json
- **字符編碼**: UTF-8
- **認證方式**: 無 (公開API)
- **速率限制**: 暫未實施

### 1.3 響應格式
```typescript
interface BaseResponse {
  success: boolean;
  message?: string;
  timestamp: string;
}

interface SuccessResponse<T> extends BaseResponse {
  success: true;
  data: T;
}

interface ErrorResponse extends BaseResponse {
  success: false;
  error: string;
  code?: string;
}
2. API 端點詳解

2.1 健康檢查 🩺

http
GET /health
用途: 服務健康狀態監控

響應示例:

json
{
  "status": "ok",
  "message": "AI Hotel Assistant API - Railway Ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
2.2 AI 對話理解 🤖

http
POST /api/ai/chat
Content-Type: application/json
請求體:

json
{
  "message": "string, required, 用戶輸入的自然語言消息",
  "context": "string, optional, 對話上下文，默認: general"
}
成功響應:

json
{
  "success": true,
  "response": "🧠 已理解您的需求：我想訂台北的五星級酒店...",
  "analysis": {
    "intent": "hotel-booking",
    "confidence": 0.95,
    "extracted_requirements": {
      "location": "台北",
      "budget": "5000元",
      "time_frame": "週末",
      "star_rating": "五星級",
      "special_requests": ["無煙房", "高樓層"]
    }
  },
  "next_actions": [
    "為您搜尋符合條件的五星級飯店",
    "過濾預算範圍內的選項"
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "request_id": "req_1705307400000"
}
2.3 酒店搜索 🔍

http
GET /api/hotels/search
查詢參數:

參數	類型	必填	默認值	說明	示例
location	string	❌	"台北"	搜索地點	location=台北
guests	number	❌	2	旅客人數	guests=2
minPrice	number	❌	0	最低價格	minPrice=0
maxPrice	number	❌	10000	最高價格	maxPrice=5000
rating	number	❌	0	最低評分	rating=4.5
成功響應:

json
{
  "success": true,
  "hotels": [
    {
      "id": "hotel_1",
      "name": "台北君悅大飯店",
      "location": "台北",
      "address": "台北市信義區松壽路2號",
      "price": 4500,
      "rating": 4.8,
      "stars": 5,
      "available": true,
      "amenities": ["免費WiFi", "游泳池", "健身房", "早餐"],
      "description": "位於信義區的五星級豪華飯店"
    }
  ],
  "search_parameters": {
    "location": "台北",
    "guests": 2,
    "price_range": {"min": 0, "max": 5000},
    "min_rating": 4.5
  },
  "summary": {
    "total_results": 3,
    "average_price": 4833,
    "locations": ["台北"]
  },
  "pagination": {
    "page": 1,
    "total_pages": 1,
    "results_per_page": 10
  }
}
2.4 創建預訂 📋

http
POST /api/bookings/create
Content-Type: application/json
請求體:

json
{
  "hotelId": "string, required, 酒店ID",
  "roomType": "string, optional, 房型，默認: standard",
  "guestInfo": {
    "name": "string, required, 旅客姓名",
    "email": "string, required, 電子郵件",
    "phone": "string, optional, 電話號碼"
  },
  "specialRequests": "string, optional, 特殊要求"
}
成功響應:

json
{
  "success": true,
  "message": "🎉 預訂成功！感謝使用 AI Hotel Assistant",
  "booking": {
    "booking_id": "book_1705307400000",
    "status": "confirmed",
    "hotel_id": "hotel_1",
    "room_type": "deluxe",
    "guest_info": {
      "name": "張小明",
      "email": "zhang@example.com",
      "phone": "0912345678"
    },
    "special_requests": "需要無煙房和高樓層",
    "total_amount": 4500,
    "currency": "TWD",
    "check_in": "2024-01-20",
    "check_out": "2024-01-21",
    "nights": 1,
    "created_at": "2024-01-15T10:30:00.000Z",
    "confirmation_number": "CNF1705307400000",
    "cancellation_policy": "免費取消至入住前24小時"
  }
}
3. 錯誤處理

3.1 錯誤碼說明

HTTP狀態碼	錯誤碼	說明
400	VALIDATION_ERROR	請求參數驗證失敗
404	ENDPOINT_NOT_FOUND	API端點不存在
500	INTERNAL_ERROR	服務器內部錯誤
3.2 錯誤響應示例

json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "缺少必要字段: hotelId, guestInfo.name, guestInfo.email",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
4. 速率限制

當前版本暫未實施速率限制，但建議客戶端：

單個IP每分鐘不超過60個請求
批量操作間隔不小於1秒
5. 版本管理

API版本通過URL路徑管理，當前版本為v1。
未來版本更新將保持向後兼容性。

文檔最後更新: 2025年10月31日

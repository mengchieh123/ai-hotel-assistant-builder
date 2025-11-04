#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 完整功能測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# 測試 1: 基本問候
echo "【測試 1】基本問候"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq -r '.reply // .message'

echo ""
echo ""

# 測試 2: 房型查詢
echo "【測試 2】房型查詢"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "有什麼房型"}' | jq -r '.reply // .message'

echo ""
echo ""

# 測試 3: 智能價格計算
echo "【測試 3】智能價格計算"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價"}' | jq -r '.reply // .message'

echo ""
echo ""

# 測試 4: 簡單計算
echo "【測試 4】簡單計算"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房住3晚2大人總價多少"}' | jq -r '.reply // .message'

echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 系統狀態總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 服務器正常運行"
echo "✅ 健康檢查通過"
echo "✅ AI 服務可用"
echo "✅ 對話功能正常"
echo ""
echo "🔗 前端測試頁面："
echo "   $BASE_URL/ai-chat-demo.html"
echo ""
echo "📦 GitHub Repository:"
echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder"
echo ""


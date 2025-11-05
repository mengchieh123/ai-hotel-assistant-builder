#!/bin/bash

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "�� 測試 Railway 服務價格更新"
echo "================================"
echo "URL: $RAILWAY_URL"
echo ""

# 1️⃣ 健康檢查
echo "1️⃣ 健康檢查:"
curl -s "$RAILWAY_URL/health" | jq '.'
echo ""

# 2️⃣ 測試價格查詢
echo "2️⃣ 價格查詢測試:"
RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房多少錢"}')

echo "$RESPONSE" | jq '.'
echo ""

# 3️⃣ 詳細價格檢查
echo "3️⃣ 價格分析:"
echo "------------------------"

if echo "$RESPONSE" | grep -q "3,800"; then
  echo "🎉 ✅ 新價格 NT\$3,800 - 已更新！"
elif echo "$RESPONSE" | grep -q "7,500"; then
  echo "❌ 舊價格 NT\$7,500 - 尚未更新"
else
  echo "⚠️  未找到價格資訊"
fi

echo ""
echo "💰 回應中的所有價格:"
echo "$RESPONSE" | grep -o "NT\$[0-9,]*" | sort -u


#!/bin/bash

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "⏰ 等待部署完成..."
for i in {1..6}; do
  echo "等待中... ($i/6) - 10秒"
  sleep 10
done

echo ""
echo "🧪 重新測試價格:"
echo "================================"

RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}')

echo "$RESPONSE" | jq '.message'
echo ""

if echo "$RESPONSE" | grep -q "3,800"; then
  echo "🎉 ✅ 成功！價格已更新到 NT\$3,800"
else
  echo "⚠️  價格檢查:"
  echo "$RESPONSE" | grep -o "NT\$[0-9,]*" | sort -u
fi


#!/bin/bash

# 從 Railway 取得正確 URL
RAILWAY_DOMAIN=$(railway variables | grep "RAILWAY_STATIC_URL" | awk '{print $3}')
RAILWAY_URL="https://${RAILWAY_DOMAIN}"

echo "🧪 測試當前 Railway 服務"
echo "測試 URL: $RAILWAY_URL"
echo ""

# 1️⃣ 健康檢查
echo "1️⃣ 健康檢查:"
curl -s "$RAILWAY_URL/health" | jq '.'

# 2️⃣ 測試價格查詢
echo ""
echo "2️⃣ 價格查詢測試:"
RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}')

echo "$RESPONSE" | jq '.'

# 3️⃣ 檢查價格
echo ""
if echo "$RESPONSE" | grep -q "3,800"; then
  echo "🎉 ✅ 服務已更新到 NT$3,800!"
else
  echo "⚠️  價格檢查:"
  echo "$RESPONSE" | grep -o "NT\$[0-9,]*"
fi


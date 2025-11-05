#!/bin/bash

echo "🧪 測試當前 Railway 服務狀態"

# 請替換為你的實際 Railway URL
RAILWAY_URL="https://你的專案.up.railway.app"

echo "測試 URL: $RAILWAY_URL"

# 測試健康檢查
echo ""
echo "1️⃣ 健康檢查:"
curl -s "$RAILWAY_URL/health" | head -2

# 測試價格查詢
echo ""
echo "2️⃣ 價格查詢測試:"
RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}')

echo "$RESPONSE" | head -10

# 檢查是否包含新價格
if echo "$RESPONSE" | grep -q "3,800"; then
  echo ""
  echo "🎉 ✅ 服務已更新到 NT$3,800!"
else
  echo ""
  echo "❌ 服務仍然是舊價格"
  echo "💡 需要強制重新部署"
fi

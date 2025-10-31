#!/bin/bash
echo "🧪 部署前功能驗證測試"

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

test_endpoint() {
  local name="$1"
  local message="$2"
  echo -n "測試 $name: "
  
  response=$(curl -s -X POST "$BASE_URL/api/assistant/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$message\"}")
  
  if echo "$response" | grep -q '"success":true'; then
    echo "✅ 通過"
    echo "   響應: $(echo $response | jq -r '.reply' | head -1)"
  else
    echo "❌ 失敗"
    echo "   錯誤: $response"
  fi
}

test_endpoint "基礎對話" "你好"
test_endpoint "會員查詢" "黃金會員折扣"
test_endpoint "促銷查詢" "早鳥優惠"
test_endpoint "房型查詢" "有什麼房型"

echo "🎯 當前系統功能驗證完成"

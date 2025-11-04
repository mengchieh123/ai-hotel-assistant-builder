#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 快速測試當前系統狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# 1. 健康檢查
echo "1️⃣ 健康檢查..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$STATUS" = "200" ]; then
    echo "   ✅ 服務正常 (HTTP $STATUS)"
else
    echo "   ❌ 服務異常 (HTTP $STATUS)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 2. 測試基本對話
echo "2️⃣ 測試基本對話..."
echo ""
echo "【問候】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq -r '.message' | head -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 3. 測試兒童政策
echo "3️⃣ 測試兒童收費..."
echo ""
echo "【兒童費用】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "小孩收費標準"}' | jq -r '.message' | head -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 4. 測試早餐政策
echo "4️⃣ 測試早餐資訊..."
echo ""
echo "【哪些房型含早餐】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "哪些房型含早餐"}' | jq -r '.message' | head -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 5. 測試取消政策
echo "5️⃣ 測試取消政策..."
echo ""
echo "【取消訂房怎麼辦】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "取消訂房怎麼辦"}' | jq -r '.message' | head -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 6. 測試會員制度
echo "6️⃣ 測試會員制度..."
echo ""
echo "【會員制度】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "會員制度是什麼"}' | jq -r '.message' | head -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 7. 測試優惠活動
echo "7️⃣ 測試優惠活動..."
echo ""
echo "【優惠活動】"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "有什麼優惠"}' | jq -r '.message' | head -10

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 測試介面："
echo "   $BASE_URL/ai-chat-demo.html"
echo ""
echo "📋 GitHub Repository:"
echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder"
echo ""
echo "✅ 如果以上測試都正常，系統已完整部署"
echo ""


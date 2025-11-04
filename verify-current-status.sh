#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 驗證當前服務狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# 測試 1: 健康檢查
echo "1️⃣  健康檢查..."
HEALTH=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE_URL/health")
HTTP_CODE=$(echo "$HEALTH" | tail -n 1)
RESPONSE=$(echo "$HEALTH" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 健康檢查成功 (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | jq .
else
    echo "❌ 健康檢查失敗 (HTTP $HTTP_CODE)"
    echo "$RESPONSE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 測試 2: AI 狀態
echo "2️⃣  AI 服務狀態..."
AI_STATUS=$(curl -s -w "\n%{http_code}" --max-time 10 "$BASE_URL/api/ai/status")
HTTP_CODE=$(echo "$AI_STATUS" | tail -n 1)
RESPONSE=$(echo "$AI_STATUS" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ AI 狀態檢查成功 (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | jq .
else
    echo "❌ AI 狀態檢查失敗 (HTTP $HTTP_CODE)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 測試 3: 實際對話
echo "3️⃣  測試對話功能..."
CHAT_TEST=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "你好", "sessionId": "verify-test"}')
HTTP_CODE=$(echo "$CHAT_TEST" | tail -n 1)
RESPONSE=$(echo "$CHAT_TEST" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 對話測試成功 (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | jq -r '.message' | head -10
else
    echo "❌ 對話測試失敗 (HTTP $HTTP_CODE)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 測試 4: 智能計算
echo "4️⃣  測試智能計算..."
CALC_TEST=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價", "sessionId": "calc-test"}')
HTTP_CODE=$(echo "$CALC_TEST" | tail -n 1)
RESPONSE=$(echo "$CALC_TEST" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 計算測試成功 (HTTP $HTTP_CODE)"
    REPLY=$(echo "$RESPONSE" | jq -r '.message')
    
    if echo "$REPLY" | grep -q "訂房明細\|計算"; then
        echo "✅ 智能計算功能正常！"
        echo "$REPLY" | head -15
    else
        echo "⚠️  收到回覆但未包含計算結果"
        echo "$REPLY" | head -10
    fi
else
    echo "❌ 計算測試失敗 (HTTP $HTTP_CODE)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 前端測試頁面："
echo "   $BASE_URL/ai-chat-demo.html"
echo ""
echo "📋 GitHub Repository:"
echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder"
echo ""


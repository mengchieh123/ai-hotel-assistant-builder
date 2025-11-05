#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 測試增強版 v4.0.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1️⃣ 健康檢查:"
curl -s "$RAILWAY_URL/health" | jq '.' 2>/dev/null

echo ""
echo "2️⃣ 測試各種對話場景:"

TEST_CASES=(
    "豪華客房價格"
    "我要訂房"
    "有什麼設施"
    "可以取消訂房嗎"
    "行政客房和套房的差別"
    "最近有優惠嗎"
)

for test_case in "${TEST_CASES[@]}"; do
    echo ""
    echo "🔍 測試: \"$test_case\""
    RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$test_case\"}")
    
    if [ -n "$RESPONSE" ]; then
        INTENT=$(echo "$RESPONSE" | jq -r '.intent' 2>/dev/null)
        VERSION=$(echo "$RESPONSE" | jq -r '.version' 2>/dev/null)
        ENHANCED=$(echo "$RESPONSE" | jq -r '.enhanced' 2>/dev/null)
        
        echo "✅ 意圖: $INTENT"
        echo "✅ 版本: $VERSION"
        echo "✅ 增強: $ENHANCED"
        
        # 檢查是否有建議
        SUGGESTIONS=$(echo "$RESPONSE" | jq -r '.suggestions | length' 2>/dev/null)
        if [ "$SUGGESTIONS" -gt 0 ]; then
            echo "💡 建議: $SUGGESTIONS 個"
        fi
    else
        echo "❌ 無回應"
    fi
done

echo ""
echo "🎯 重點驗證價格:"
echo "測試: 豪華客房價格"
RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}')

if echo "$RESPONSE" | grep -q "3,800"; then
    echo "🎉 ✅ 價格確認: NT$3,800"
    echo ""
    echo "📝 回應內容:"
    echo "$RESPONSE" | jq -r '.message' | head -8
else
    echo "❌ 價格不正確"
    echo "$RESPONSE"
fi

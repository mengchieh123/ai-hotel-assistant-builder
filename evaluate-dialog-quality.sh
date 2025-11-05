#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 AI 對話質量評估"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

QUALITY_METRICS=()

test_dialog() {
    local test_name="$1"
    local message="$2"
    local expected_intent="$3"
    
    echo ""
    echo "�� $test_name: \"$message\""
    RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$message\"}")
    
    ACTUAL_INTENT=$(echo "$RESPONSE" | jq -r '.intent' 2>/dev/null)
    MESSAGE_LENGTH=$(echo "$RESPONSE" | jq -r '.message | length' 2>/dev/null)
    HAS_SUGGESTIONS=$(echo "$RESPONSE" | jq -r '.suggestions != null' 2>/dev/null)
    
    # 評估指標
    if [ "$ACTUAL_INTENT" = "$expected_intent" ]; then
        echo "✅ 意圖識別正確: $ACTUAL_INTENT"
        QUALITY_METRICS+=("$test_name: 意圖識別 ✓")
    else
        echo "❌ 意圖識別錯誤: 期望 $expected_intent, 實際 $ACTUAL_INTENT"
        QUALITY_METRICS+=("$test_name: 意圖識別 ✗")
    fi
    
    if [ "$MESSAGE_LENGTH" -gt 50 ]; then
        echo "✅ 回應長度適當: $MESSAGE_LENGTH 字元"
        QUALITY_METRICS+=("$test_name: 回應長度 ✓")
    else
        echo "⚠️ 回應可能過短: $MESSAGE_LENGTH 字元"
        QUALITY_METRICS+=("$test_name: 回應長度 ⚠️")
    fi
    
    if [ "$HAS_SUGGESTIONS" = "true" ]; then
        echo "✅ 有提供建議"
        QUALITY_METRICS+=("$test_name: 建議提供 ✓")
    else
        echo "⚠️ 無建議提供"
        QUALITY_METRICS+=("$test_name: 建議提供 ✗")
    fi
}

# 執行測試用例
test_dialog "價格查詢" "豪華客房多少錢" "price"
test_dialog "訂房意圖" "我要訂房" "booking"
test_dialog "設施詢問" "有什麼設施" "facility"
test_dialog "一般問候" "你好" "greeting"

# 顯示評估結果
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 對話質量評估結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for metric in "${QUALITY_METRICS[@]}"; do
    echo "• $metric"
done

echo ""
echo "🎯 總體評估:"
TOTAL_TESTS=${#QUALITY_METRICS[@]}
SUCCESS_COUNT=$(printf '%s\n' "${QUALITY_METRICS[@]}" | grep -c "✓")
SUCCESS_RATE=$((SUCCESS_COUNT * 100 / TOTAL_TESTS))

echo "成功率: $SUCCESS_RATE% ($SUCCESS_COUNT/$TOTAL_TESTS)"

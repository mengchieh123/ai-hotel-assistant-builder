#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 驗證增強版部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "等待部署完成..."
for i in {1..18}; do
    echo "⏳ 檢查第 $i 次 (等待 10 秒)..."
    sleep 10
    
    # 測試健康檢查
    HEALTH=$(curl -s --max-time 5 "$RAILWAY_URL/health")
    VERSION=$(echo "$HEALTH" | grep -o '"version":"[^"]*"' | head -1)
    
    if echo "$VERSION" | grep -q "4.0.0"; then
        echo "🎉 檢測到新版本: $VERSION"
        break
    fi
done

echo ""
echo "🧪 執行完整測試套件:"

TEST_CASES=(
    "豪華客房價格"
    "我要訂房"
    "有什麼設施"
    "你好"
)

for test_case in "${TEST_CASES[@]}"; do
    echo ""
    echo "🔍 測試: \"$test_case\""
    RESPONSE=$(curl -s --max-time 5 -X POST "$RAILWAY_URL/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$test_case\"}")
    
    if [ -n "$RESPONSE" ]; then
        INTENT=$(echo "$RESPONSE" | jq -r '.intent' 2>/dev/null)
        VERSION=$(echo "$RESPONSE" | jq -r '.version' 2>/dev/null)
        ENHANCED=$(echo "$RESPONSE" | jq -r '.enhanced' 2>/dev/null)
        
        echo "✅ 意圖: $INTENT"
        echo "✅ 版本: $VERSION"
        echo "✅ 增強: $ENHANCED"
        
        # 檢查價格
        if echo "$RESPONSE" | grep -q "3,800"; then
            echo "🎉 價格: NT$3,800 ✓"
        else
            echo "❌ 價格: 未找到 NT$3,800"
        fi
    else
        echo "❌ 無回應"
    fi
done

echo ""
echo "📊 最終狀態檢查:"
curl -s "$RAILWAY_URL/health" | jq '{status: .status, version: .version, features: .features}' 2>/dev/null

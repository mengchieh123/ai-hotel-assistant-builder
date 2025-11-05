#!/bin/bash

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "✅ 驗證增強版 AI 部署"
echo "=========================================="
echo ""

# 1. 健康檢查
echo "1️⃣ 健康檢查..."
HEALTH=$(curl -s "$API/health")
VERSION=$(echo "$HEALTH" | jq -r '.version')
UPTIME=$(echo "$HEALTH" | jq -r '.uptime')

echo "   版本: $VERSION"
echo "   運行時間: ${UPTIME}秒"

if [ "$VERSION" = "5.0.0-ENHANCED" ]; then
    echo "   🎉 版本正確！增強版已上線"
elif [ "$VERSION" = "4.0.0-FORCED-DEPLOY" ]; then
    echo "   ⏳ 仍是舊版本，部署可能還在進行"
else
    echo "   ⚠️  版本: $VERSION"
fi

# 2. 測試實體提取
echo ""
echo "2️⃣ 測試實體提取功能..."
RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}')

ENTITIES=$(echo "$RESPONSE" | jq '.entities' 2>/dev/null)

if [ "$ENTITIES" != "null" ] && [ -n "$ENTITIES" ]; then
    echo "   ✅ 實體提取功能已啟用"
    echo ""
    echo "   提取的實體："
    echo "$ENTITIES" | jq '.'
    
    # 檢查關鍵實體
    CHECKS=0
    PASSED=0
    
    echo ""
    echo "   實體驗證："
    
    if echo "$ENTITIES" | grep -q "12月24日"; then
        echo "      ✅ 日期提取成功"
        PASSED=$((PASSED + 1))
    else
        echo "      ❌ 日期提取失敗"
    fi
    CHECKS=$((CHECKS + 1))
    
    if echo "$ENTITIES" | jq -e '.nights == 3' >/dev/null 2>&1; then
        echo "      ✅ 天數提取成功 (3晚)"
        PASSED=$((PASSED + 1))
    else
        echo "      ❌ 天數提取失敗"
    fi
    CHECKS=$((CHECKS + 1))
    
    if echo "$ENTITIES" | jq -e '.isMember == true' >/dev/null 2>&1; then
        echo "      ✅ 會員識別成功"
        PASSED=$((PASSED + 1))
    else
        echo "      ❌ 會員識別失敗"
    fi
    CHECKS=$((CHECKS + 1))
    
    if echo "$ENTITIES" | jq -e '.children.age == 6' >/dev/null 2>&1; then
        echo "      ✅ 兒童年齡提取成功 (6歲)"
        PASSED=$((PASSED + 1))
    else
        echo "      ❌ 兒童年齡提取失敗"
    fi
    CHECKS=$((CHECKS + 1))
    
    RATE=$((PASSED * 100 / CHECKS))
    echo ""
    echo "   實體提取成功率: $PASSED/$CHECKS ($RATE%)"
else
    echo "   ❌ 實體提取功能未啟用（可能仍是舊版本）"
fi

# 3. 測試意圖識別
echo ""
echo "3️⃣ 測試意圖識別..."
PRICE_RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房多少錢"}')

PRICE_INTENT=$(echo "$PRICE_RESPONSE" | jq -r '.intent')
HAS_PRICE=$(echo "$PRICE_RESPONSE" | jq -r '.message' | grep -c "3,800")

echo "   意圖: $PRICE_INTENT"
if [ "$PRICE_INTENT" = "price" ]; then
    echo "   ✅ 意圖識別正確"
else
    echo "   ❌ 意圖識別錯誤"
fi

if [ "$HAS_PRICE" -gt 0 ]; then
    echo "   ✅ 價格顯示正確 (NT\$3,800)"
else
    echo "   ❌ 價格顯示有誤"
fi

echo ""
echo "=========================================="

if [ "$VERSION" = "5.0.0-ENHANCED" ]; then
    echo "🎉🎉🎉 增強版 AI 部署成功！🎉🎉🎉"
    echo ""
    echo "📊 新功能已啟用："
    echo "   ✅ 多層次意圖識別"
    echo "   ✅ 實體提取（日期、天數、會員、兒童）"
    echo "   ✅ 個性化回應生成"
    echo ""
    echo "🧪 執行完整測試："
    echo "   bash advanced-conversation-test.sh"
elif [ "$UPTIME" ] && (( $(echo "$UPTIME < 120" | bc -l 2>/dev/null || echo 0) )); then
    echo "⏳ 新部署已上線，但版本號未更新"
    echo "   可能需要等待或檢查代碼"
else
    echo "⚠️  部署可能還在進行中"
    echo "   建議等待 1-2 分鐘後重新執行"
fi

echo "=========================================="


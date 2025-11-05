#!/bin/bash

echo "⏳ 等待增強版 AI 部署穩定..."
echo "=========================================="
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app"

# 倒計時 120 秒
for i in {120..1}; do
    printf "\r   等待中... %3d 秒" $i
    sleep 1
done

echo ""
echo ""
echo "🔍 開始驗證增強版部署..."
echo "=========================================="
echo ""

# 1. 健康檢查
echo "1️⃣ 健康檢查..."
HEALTH=$(curl -s "$API/health")
VERSION=$(echo "$HEALTH" | jq -r '.version')
echo "   版本: $VERSION"

if [ "$VERSION" = "5.0.0-ENHANCED" ]; then
    echo "   🎉 增強版已上線！"
else
    echo "   ⚠️  當前版本: $VERSION"
fi

echo ""
echo "2️⃣ 測試複雜查詢（你的範例）..."
RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲可不可以同行？有沒有額外費用？"}')

echo "   意圖: $(echo "$RESPONSE" | jq -r '.intent')"
echo ""
echo "   提取的實體:"
echo "$RESPONSE" | jq '.entities'

echo ""
echo "   AI 回應:"
echo "$RESPONSE" | jq -r '.message' | head -20

echo ""
echo "=========================================="
echo "📊 執行完整進階測試..."
echo ""

bash advanced-conversation-test.sh | tail -30


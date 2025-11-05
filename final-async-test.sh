#!/bin/bash

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "⏳ 等待 Railway 部署完成（120秒）..."
sleep 120

echo ""
echo "🔍 測試異步功能"
echo "=========================================="
echo ""

# 1. 健康檢查
echo "1️⃣ 健康檢查..."
HEALTH=$(curl -s "$API/health" 2>&1)
echo "$HEALTH"
echo ""

# 2. 測試簡單查詢
echo "2️⃣ 測試簡單查詢..."
SIMPLE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}' 2>&1)

if echo "$SIMPLE" | jq '.' > /dev/null 2>&1; then
    echo "✅ 返回有效 JSON"
    echo "$SIMPLE" | jq '{intent, version, message: (.message | .[0:100])}'
else
    echo "❌ 返回無效 JSON"
    echo "原始回應:"
    echo "$SIMPLE"
fi

echo ""
echo "3️⃣ 測試複雜查詢（實體提取）..."
COMPLEX=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}' 2>&1)

if echo "$COMPLEX" | jq '.' > /dev/null 2>&1; then
    echo "✅ 返回有效 JSON"
    echo ""
    echo "意圖: $(echo "$COMPLEX" | jq -r '.intent')"
    echo "版本: $(echo "$COMPLEX" | jq -r '.version')"
    echo ""
    echo "實體提取:"
    echo "$COMPLEX" | jq '.entities'
else
    echo "❌ 返回無效 JSON"
    echo "原始回應:"
    echo "$COMPLEX"
fi

echo ""
echo "4️⃣ 檢查 Railway 日誌..."
railway logs --tail 20

echo ""
echo "=========================================="
echo "📊 測試完成"


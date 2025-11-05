#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 快速驗證 - AI 服務是否正常"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1️⃣ 測試健康檢查..."
health=$(curl -s "${BASE_URL}/health")
echo "回應: ${health}"
echo ""

echo "2️⃣ 測試 AI 聊天（價格查詢）..."
response=$(curl -s -X POST "${BASE_URL}/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d '{"message": "豪華客房多少錢", "sessionId": "quick-test"}')

echo "完整回應:"
echo "${response}" | jq '.'
echo ""

message=$(echo "${response}" | jq -r '.message')
echo "訊息內容:"
echo "${message}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 驗證結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 檢查價格是否正確
if echo "${message}" | grep -q "3,800\|3800"; then
    echo "✅ 價格正確：NT\$ 3,800（符合 business-spec v2.1.0）"
    PRICE_OK=1
elif echo "${message}" | grep -q "7,500\|7500"; then
    echo "❌ 價格錯誤：仍然是 NT\$ 7,500（舊版）"
    PRICE_OK=0
else
    echo "⚠️ 價格格式未知"
    PRICE_OK=0
fi

# 檢查是否有會員資訊
if echo "${message}" | grep -qi "會員\|銀卡\|金卡"; then
    echo "✅ 包含會員資訊"
    MEMBER_OK=1
else
    echo "❌ 缺少會員資訊"
    MEMBER_OK=0
fi

echo ""
if [ $PRICE_OK -eq 1 ] && [ $MEMBER_OK -eq 1 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 AI 服務已成功升級！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "可以執行完整測試："
    echo "  bash test-ai-service-upgraded.sh"
    echo ""
elif [ $PRICE_OK -eq 1 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️ 部分升級成功"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "價格正確但缺少部分資訊，執行完整測試查看詳情："
    echo "  bash test-ai-service-upgraded.sh"
    echo ""
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ AI 服務尚未升級"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "可能原因："
    echo "1. Railway 正在部署新版本（等待 2-3 分鐘）"
    echo "2. 程式碼未成功推送（檢查 git push）"
    echo "3. 快取問題（稍後再試）"
    echo ""
fi


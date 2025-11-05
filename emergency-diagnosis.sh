#!/bin/bash

echo "🚨 緊急診斷 AI 服務狀態"
echo "========================"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1. 檢查服務是否在線..."
curl -s --max-time 10 "$RAILWAY_URL/health"
HEALTH_STATUS=$?

if [ $HEALTH_STATUS -eq 0 ]; then
    echo "✅ 服務在線"
else
    echo "❌ 服務離線或無法訪問"
    exit 1
fi

echo ""
echo "2. 測試基本對話..."
RESPONSE=$(curl -s --max-time 10 -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}')

if [ -n "$RESPONSE" ]; then
    echo "✅ 對話端點響應正常"
    echo "回應: $RESPONSE"
else
    echo "❌ 對話端點無響應"
fi

echo ""
echo "3. 檢查服務日誌..."
echo "請在 Railway Dashboard 中查看日誌:"
echo "https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda/deployments"

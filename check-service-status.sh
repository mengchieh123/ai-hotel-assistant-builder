#!/bin/bash

echo "🩺 服務狀態檢查"
echo "=========================================="

URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1. 健康檢查:"
curl -s "$URL/health" | jq . 2>/dev/null || curl -s "$URL/health"
echo ""

echo "2. 根端點:"
curl -s "$URL/" | jq . 2>/dev/null || curl -s "$URL/" | head -c 200
echo ""

echo "3. 測試端點是否存在:"
curl -s -I "$URL/chat" | head -1
echo ""

echo "4. 服務日誌檢查:"
echo "請在 Railway Dashboard 中檢查部署日誌"
echo "命令: railway logs --tail 20"

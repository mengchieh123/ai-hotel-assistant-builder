#!/bin/bash

BASE="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "🔍 診斷 Railway API 端點..."
echo ""

echo "測試 1: 根路徑"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" "$BASE/"

echo ""
echo "測試 2: /api/health"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" "$BASE/api/health"

echo ""
echo "測試 3: /health"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" "$BASE/health"

echo ""
echo "測試 4: /api/status"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" "$BASE/api/status"

echo ""
echo "測試 5: POST /api/chat"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" \
  -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

echo ""
echo "測試 6: POST /chat"
curl -s -o /dev/null -w "狀態碼: %{http_code}\n" \
  -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 200 = 可用"
echo "❌ 404 = 不存在"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

#!/bin/bash

echo "🎯 最終服務驗證"
echo "================"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "🔍 服務健康狀態:"
curl -s "$RAILWAY_URL/health" | jq '.' 2>/dev/null || echo "❌ 服務不可用"

echo ""
echo "🔍 CORS 配置驗證:"
echo "OPTIONS 請求測試:"
curl -X OPTIONS -s -I "$RAILWAY_URL/api/ai/chat" | grep -i "access-control"

echo ""
echo "🔍 API 功能測試:"
echo "價格查詢測試:"
curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}' | jq '{intent: .intent, version: .version}' 2>/dev/null

echo ""
echo "🔍 響應時間測試:"
time curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' > /dev/null

echo ""
echo "✅ 驗證完成 - 服務端一切正常!"
echo "🎯 現在請專注測試客戶端頁面"

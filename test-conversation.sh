#!/bin/bash
echo "🧪 測試完整訂房對話流程..."

echo "1. 開始訂房"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"我想訂房"}' | jq '.response'

echo ""
echo "2. 選擇房型"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華雙人房"}' | jq '.response'

echo ""
echo "3. 提供日期"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"2025-02-10"}' | jq '.response'

echo ""
echo "4. 提供人數"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"2大1小"}' | jq '.response'

echo ""
echo "5. 確認預訂"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"確認"}' | jq '.response'

echo ""
echo "📊 會話統計:"
curl -s http://localhost:8080/api/sessions/stats | jq

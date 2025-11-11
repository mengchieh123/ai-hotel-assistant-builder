#!/bin/bash
echo "🧪 測試完整訂房對話流程（簡單版）..."

# 使用單引號避免 JSON 語法問題
echo "1. 開始訂房"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"我想訂房", "sessionId":"test-session-123"}' | jq '.response'

echo ""
echo "2. 選擇房型"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華雙人房", "sessionId":"test-session-123"}' | jq '.response'

echo ""
echo "3. 提供日期"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"2025-02-10", "sessionId":"test-session-123"}' | jq '.response'

echo ""
echo "4. 提供人數"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"2大1小", "sessionId":"test-session-123"}' | jq '.response'

echo ""
echo "5. 確認預訂"
curl -s -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"確認", "sessionId":"test-session-123"}' | jq '.response'

#!/bin/bash

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "🔍 診斷 API 問題"
echo "=========================================="
echo ""

# 1. 測試健康檢查（應該能正常返回）
echo "1️⃣ 測試健康檢查..."
HEALTH_RAW=$(curl -s "$API/health")
echo "原始回應:"
echo "$HEALTH_RAW"
echo ""

# 2. 測試 AI 聊天（查看原始回應）
echo "2️⃣ 測試 AI 聊天 API..."
echo "發送: 你好"
CHAT_RAW=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}')

echo "原始回應:"
echo "$CHAT_RAW"
echo ""
echo "回應長度: $(echo "$CHAT_RAW" | wc -c) 字元"
echo ""

# 3. 檢查回應格式
if echo "$CHAT_RAW" | jq '.' > /dev/null 2>&1; then
    echo "✅ 回應是有效的 JSON"
    echo "$CHAT_RAW" | jq '.'
else
    echo "❌ 回應不是有效的 JSON"
    echo ""
    echo "可能的問題："
    echo "1. server.js 未正確返回 JSON"
    echo "2. AI 服務拋出錯誤"
    echo "3. CORS 問題"
fi

echo ""
echo "3️⃣ 檢查 Railway 日誌..."
railway logs --tail 20

echo ""
echo "=========================================="
echo "📋 建議："
echo "1. 檢查 server.js 的 /api/ai/chat 端點"
echo "2. 確認 enhanced-ai-service.js 是否正確載入"
echo "3. 查看完整日誌: railway logs --tail 50"


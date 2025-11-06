#!/bin/bash

echo "🔍 測試生產環境 API"
echo "=========================================="

API_BASE="https://ai-hotel-assistant-builder-production.up.railway.app"
echo "API 基礎網址: $API_BASE"

# 首先測試健康檢查
echo ""
echo "1️⃣ 測試健康檢查..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/health")
echo "健康檢查響應: $HEALTH_RESPONSE"

# 測試根端點
echo ""
echo "2️⃣ 測試根端點..."
ROOT_RESPONSE=$(curl -s "$API_BASE/")
echo "根端點響應: $ROOT_RESPONSE"

# 正確的聊天端點路徑
CHAT_API="$API_BASE/chat"

echo ""
echo "3️⃣ 測試簡單查詢..."
SIMPLE_QUERY="你好"
echo "查詢: $SIMPLE_QUERY"
RESPONSE=$(curl -s -X POST "$CHAT_API" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$SIMPLE_QUERY\"}")

echo "原始響應: $RESPONSE"

# 嘗試不同方式解析響應
echo ""
echo "4️⃣ 解析響應..."
if echo "$RESPONSE" | jq -e '.message' >/dev/null 2>&1; then
    echo "✅ 新版本響應格式"
    MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
    VERSION=$(echo "$RESPONSE" | jq -r '.version')
    echo "版本: $VERSION"
    echo "消息: $MESSAGE"
elif echo "$RESPONSE" | jq -e '.response.message' >/dev/null 2>&1; then
    echo "⚠️  舊版本響應格式"
    MESSAGE=$(echo "$RESPONSE" | jq -r '.response.message')
    VERSION=$(echo "$RESPONSE" | jq -r '.metadata.version')
    echo "版本: $VERSION"
    echo "消息: $MESSAGE"
else
    echo "❌ 未知響應格式"
    echo "完整響應: $RESPONSE"
fi

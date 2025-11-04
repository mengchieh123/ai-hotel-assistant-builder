#!/bin/bash

echo "🔧 系統配置檢查"
echo "================"

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1. 檢查服務狀態..."
health_response=$(curl -s "$BASE_URL/health")
echo "$health_response" | jq '.'

echo ""
echo "2. 檢查 AI 服務配置..."
ai_status=$(curl -s "$BASE_URL/api/ai/status")
echo "$ai_status" | jq '.'

echo ""
echo "3. 檢查環境變量..."
if command -v railway &> /dev/null; then
    echo "Railway CLI 可用，檢查環境變量..."
    railway variables list
else
    echo "⚠️  Railway CLI 未安裝，請在 Dashboard 檢查環境變量"
fi

echo ""
echo "4. 測試基礎對話..."
test_messages=(
    "你好"
    "介紹酒店"
    "房型價格"
)

for msg in "${test_messages[@]}"; do
    echo "測試: \"$msg\""
    response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$msg\", \"sessionId\": \"config-test\"}")
    
    echo "回應: $(echo "$response" | jq -r '.reply')"
    echo "狀態: $(echo "$response" | jq -r '.success')"
    echo ""
done

echo "5. 檢查可能的問題..."
echo "• OpenAI API Key 是否有效"
echo "• 模型配置是否正確" 
echo "• 提示詞工程是否優化"
echo "• 上下文長度設置"
echo "• 溫度參數設置"

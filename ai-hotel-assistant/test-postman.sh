#!/bin/bash

echo "🧪 Postman 测试验证"
echo "=========================================="

BASE="http://localhost:3000"

echo "1. 测试健康检查 (/health):"
response=$(curl -s -w "\n状态码: %{http_code}" "$BASE/health")
echo "$response"

echo ""
echo "2. 测试房型列表 (/rooms):"
response=$(curl -s -w "\n状态码: %{http_code}" "$BASE/rooms")
echo "$response" | head -20

echo ""
echo "3. 测试AI聊天 (/chat):"
response=$(curl -s -w "\n状态码: %{http_code}" -X POST "$BASE/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "請問週末有優惠嗎？",
    "guestName": "王小明"
  }')
echo "$response"

echo ""
echo "=========================================="
echo "✅ 如果状态码都是 200，就可以在 Postman 中测试了！"

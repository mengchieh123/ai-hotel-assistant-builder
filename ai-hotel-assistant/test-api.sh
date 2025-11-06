#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 測試 API 接口"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1️⃣  健康檢查..."
curl -s http://localhost:3000/api/health | json_pp

echo ""
echo ""
echo "2️⃣  房型列表..."
curl -s http://localhost:3000/api/rooms | json_pp

echo ""
echo ""
echo "3️⃣  測試聊天..."
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "請問週末有優惠嗎？",
    "guestName": "王小明"
  }' | json_pp

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

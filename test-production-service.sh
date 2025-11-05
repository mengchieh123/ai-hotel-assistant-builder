#!/bin/bash

echo "🔍 测试生产环境服务"
echo "=========================================="
echo "服务地址: https://ai-hotel-assistant-builder-production.up.railway.app"
echo ""

# 1. 测试健康检查端点
echo "1️⃣ 健康检查:"
curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/health" | jq . 2>/dev/null || curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/health"
echo ""

# 2. 测试根端点
echo "2️⃣ 根端点:"
curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/" | jq . 2>/dev/null || curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/"
echo ""

# 3. 测试功能测试端点
echo "3️⃣ 功能测试:"
curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/test-enhanced" | jq . 2>/dev/null || curl -s "https://ai-hotel-assistant-builder-production.up.railway.app/test-enhanced"
echo ""

# 4. 测试中文复杂查询
echo "4️⃣ 中文复杂查询测试:"
curl -s -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我要订12月24号入住3晚，我是会员，小孩6岁和8岁需要加床",
    "userId": "production-test"
  }' | jq . 2>/dev/null || curl -s -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我要订12月24号入住3晚，我是会员，小孩6岁和8岁需要加床",
    "userId": "production-test"
  }'
echo ""

# 5. 测试英文查询
echo "5️⃣ 英文查询测试:"
curl -s -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "We need two rooms for Christmas week, with children ages 6 and 8",
    "userId": "production-test-english"
  }' | jq . 2>/dev/null || curl -s -X POST "https://ai-hotel-assistant-builder-production.up.railway.app/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "We need two rooms for Christmas week, with children ages 6 and 8", 
    "userId": "production-test-english"
  }'
echo ""

echo "=========================================="
echo "✅ 测试完成！检查上面的输出版本信息"

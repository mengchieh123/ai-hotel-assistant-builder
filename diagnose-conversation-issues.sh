#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 診斷對話體驗問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# 測試各種查詢
echo "【測試 1】基本問候"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq -r '.message'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "【測試 2】查詢房型"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "有什麼房型"}' | jq -r '.message'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "【測試 3】價格查詢"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房多少錢"}' | jq -r '.message'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "【測試 4】計算價格"
curl -s -X POST "$BASE_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房住3晚2大人計算總價"}' | jq -r '.message'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 診斷結果："
echo ""
echo "問題分析："
echo "❌ 增強版 AI 可能沒有正確部署"
echo "❌ 仍在使用簡化版 mock-ai-service"
echo "❌ 缺少豐富的對話能力"
echo ""


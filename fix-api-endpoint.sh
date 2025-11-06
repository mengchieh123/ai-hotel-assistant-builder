#!/bin/bash

echo "🔧 [translate:診斷 API 端點問題]"
echo "========================================"
echo ""

# 1️⃣ [translate:檢查 Railway 服務狀態]
echo "1️⃣ [translate:檢查服務基本狀態]..."
API_BASE="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "   [translate:根端點]:"
curl -s "$API_BASE" | jq '.' 2>/dev/null || curl -s "$API_BASE"
echo ""

echo "   [translate:健康檢查]:"
curl -s "$API_BASE/health" | jq '.' 2>/dev/null || curl -s "$API_BASE/health"
echo ""

# 2️⃣ [translate:測試 API 端點]
echo "2️⃣ [translate:測試 API 端點]..."
echo "   [translate:嘗試] /api/ai/chat..."
RESPONSE=$(curl -s -X POST "$API_BASE/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}')

echo "$RESPONSE"
echo ""

# 3️⃣ [translate:檢查本地 server.js 配置]
echo "3️⃣ [translate:檢查本地路由配置]..."
if [ -f "server.js" ]; then
    echo "   [translate:查找 POST 路由]:"
    grep -n "app.post.*chat" server.js || echo "   ⚠️  [translate:未找到 chat 路由]"
    echo ""
    
    echo "   [translate:查找所有路由]:"
    grep -n "app\.\(get\|post\)" server.js
else
    echo "   ❌ server.js [translate:文件不存在]"
fi
echo ""

# 4️⃣ [translate:分析問題]
echo "========================================"
echo "🔍 [translate:問題分析]"
echo "========================================"
echo ""

if echo "$RESPONSE" | grep -q "Cannot POST"; then
    echo "❌ [translate:問題確認]: API 端點不存在"
    echo ""
    echo "📋 [translate:可能原因]:"
    echo "   1. server.js [translate:中缺少路由定義]"
    echo "   2. [translate:路由路徑不正確]"
    echo "   3. Railway [translate:部署的代碼版本過舊]"
    echo ""
    echo "🔧 [translate:建議解決方案]:"
    echo "   1. [translate:檢查並更新] server.js [translate:中的路由]"
    echo "   2. [translate:重新部署到] Railway"
    echo "   3. [translate:確認部署成功]"
elif echo "$RESPONSE" | grep -q "version"; then
    echo "✅ API [translate:端點正常工作]"
    echo ""
    echo "[translate:回應內容]:"
    echo "$RESPONSE" | jq '.'
else
    echo "⚠️  [translate:未知問題]"
    echo ""
    echo "[translate:實際回應]:"
    echo "$RESPONSE"
fi


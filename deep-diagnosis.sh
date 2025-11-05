#!/bin/bash

echo "🔍 深度診斷測試失敗原因"
echo "=========================================="
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app"

# 1. 測試 Railway 服務健康
echo "1️⃣ 測試 Railway 服務健康..."
HEALTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API/health")
HTTP_CODE=$(echo "$HEALTH" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH" | grep -v "HTTP_CODE")

echo "   HTTP 狀態碼: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ 服務健康檢查正常"
    echo "   版本: $(echo "$BODY" | jq -r '.version' 2>/dev/null || echo 'unknown')"
else
    echo "   ❌ 服務健康檢查失敗"
fi

echo ""

# 2. 測試對話 API
echo "2️⃣ 測試對話 API..."
CHAT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"測試"}')

CHAT_HTTP_CODE=$(echo "$CHAT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
CHAT_BODY=$(echo "$CHAT_RESPONSE" | grep -v "HTTP_CODE")

echo "   HTTP 狀態碼: $CHAT_HTTP_CODE"
if [ "$CHAT_HTTP_CODE" = "200" ]; then
    echo "   ✅ 對話 API 正常"
    echo "   回應預覽: $(echo "$CHAT_BODY" | jq -r '.message' 2>/dev/null | head -c 80)..."
else
    echo "   ❌ 對話 API 失敗"
    echo "   錯誤: $CHAT_BODY"
fi

echo ""

# 3. 測試 CORS 設定
echo "3️⃣ 測試 CORS 設定..."
CORS_TEST=$(curl -s -I -X OPTIONS "$API/api/ai/chat" \
  -H "Origin: https://psychic-spoon-p4wgg4x6g5vc6vg5-8000.app.github.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type")

if echo "$CORS_TEST" | grep -qi "access-control-allow-origin"; then
    echo "   ✅ CORS 已設定"
    echo "$CORS_TEST" | grep -i "access-control"
else
    echo "   ❌ CORS 未設定或有問題"
    echo "   這可能是測試失敗的主要原因！"
fi

echo ""

# 4. 檢查服務器文件
echo "4️⃣ 檢查測試頁面文件..."
if [ -f "test-codespaces.html" ]; then
    echo "   ✅ test-codespaces.html 存在"
    SIZE=$(wc -c < test-codespaces.html)
    echo "   檔案大小: $SIZE bytes"
else
    echo "   ❌ test-codespaces.html 不存在"
fi

echo ""

# 5. 檢查本地服務器
echo "5️⃣ 檢查本地服務器狀態..."
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   ✅ 本地服務器運行中"
    lsof -i :8000 | grep LISTEN
else
    echo "   ❌ 本地服務器未運行"
fi

echo ""
echo "=========================================="
echo "📋 診斷總結"
echo "=========================================="
echo ""

# 生成建議
if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️  主要問題: Railway 服務不可用"
    echo "   建議: 檢查 Railway Dashboard 部署狀態"
elif ! echo "$CORS_TEST" | grep -qi "access-control-allow-origin"; then
    echo "⚠️  主要問題: CORS 跨域限制"
    echo "   建議: 需要在 Railway 服務端添加 CORS 支持"
    echo ""
    echo "💡 臨時解決方案："
    echo "   1. 使用 Railway 提供的直接 URL"
    echo "   2. 在 server.js 中添加 CORS 中間件"
else
    echo "✅ API 服務正常，問題可能在前端頁面"
    echo "   建議: 檢查瀏覽器控制台錯誤 (F12)"
fi


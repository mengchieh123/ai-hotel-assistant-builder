#!/bin/bash

echo "🔍 直接測試當前 CORS 狀態"
echo "=========================================="
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "1️⃣ 測試健康檢查的 CORS 頭..."
curl -s -I "$API/health" 2>&1 | grep -i "access-control"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ CORS 頭部存在！"
else
    echo ""
    echo "❌ CORS 頭部不存在"
fi

echo ""
echo "2️⃣ 測試 POST 請求的 CORS 頭..."
curl -s -I -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" 2>&1 | grep -i "access-control"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ POST 請求 CORS 正常！"
else
    echo ""
    echo "❌ POST 請求 CORS 有問題"
fi

echo ""
echo "3️⃣ 完整響應頭查看..."
curl -s -I "$API/health" | head -15

echo ""
echo "=========================================="
echo "🌐 現在測試前端頁面"
echo "=========================================="
echo ""
echo "即使版本號未更新，CORS 可能已經生效"
echo "請在瀏覽器測試:"
echo ""
echo "https://psychic-spoon-p4wgg4x6g5vc6vg5-8000.app.github.dev/test-codespaces.html"
echo ""
echo "按 F12 打開控制台查看是否還有 CORS 錯誤"


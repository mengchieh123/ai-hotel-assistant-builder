#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 診斷 Railway 部署失敗原因"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  檢查 Railway 日誌..."
railway logs --tail 50

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  檢查本地檔案結構..."
echo ""

# 檢查關鍵檔案
echo "📁 關鍵檔案檢查："
files=(
    "package.json"
    "server.js"
    "services/mock-ai-service.js"
    "services/hotel-data.js"
    "routes/ai-routes.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (缺失)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  檢查 package.json 配置..."
echo ""

if [ -f "package.json" ]; then
    echo "start script:"
    cat package.json | grep -A 2 '"scripts"'
    echo ""
    echo "dependencies:"
    cat package.json | grep -A 10 '"dependencies"'
else
    echo "❌ package.json 不存在！"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  檢查 server.js 語法..."
echo ""

if [ -f "server.js" ]; then
    echo "檢查語法錯誤..."
    node -c server.js && echo "✅ server.js 語法正確" || echo "❌ server.js 有語法錯誤"
else
    echo "❌ server.js 不存在！"
fi


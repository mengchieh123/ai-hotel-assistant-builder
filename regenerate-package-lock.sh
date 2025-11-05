#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 重新生成 package-lock.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣ 刪除舊的鎖定文件和模組..."
rm -rf package-lock.json node_modules

echo ""
echo "2️⃣ 重新安裝依賴並生成新的 package-lock.json..."
npm install

echo ""
echo "3️⃣ 檢查生成的文件..."
if [ -f "package-lock.json" ]; then
    echo "✅ package-lock.json 已生成"
    echo "   大小: $(wc -c < package-lock.json) bytes"
else
    echo "❌ package-lock.json 生成失敗"
    exit 1
fi

echo ""
echo "4️⃣ 提交並推送..."

git add package.json package-lock.json

git commit -m "fix: regenerate package-lock.json to sync with package.json

✅ Remove nodemon from dependencies (dev only)
✅ Sync package-lock.json with package.json
✅ Fix Railway npm ci build failure

Fixes: Missing dependencies in lock file"

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ package-lock.json 已同步並推送"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚀 Railway 將在 2-3 分鐘內重新部署"
    echo ""
    echo "Railway 現在會："
    echo "   1. npm ci (使用新的 package-lock.json)"
    echo "   2. npm start"
    echo ""
    echo "部署成功後測試："
    echo "   bash test-booking-flow.sh"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
fi


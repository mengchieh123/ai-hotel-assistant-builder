#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 package-lock.json 同步問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 刪除舊的 lock 文件和 node_modules
echo "1️⃣  清理舊文件..."
rm -f package-lock.json
rm -rf node_modules

# 2. 重新生成 package-lock.json
echo ""
echo "2️⃣  重新生成 package-lock.json..."
npm install

# 3. 檢查生成的文件
echo ""
echo "3️⃣  檢查 package.json 和 package-lock.json..."
echo ""
echo "package.json 內容:"
cat package.json
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 4. 提交
echo ""
echo "4️⃣  提交同步的 package files..."

git add package.json package-lock.json
git commit -m "fix: sync package-lock.json with package.json

Resolves npm ci error in Railway deployment:
✅ Removed old package-lock.json
✅ Regenerated with npm install
✅ Now synced with package.json dependencies
✅ Railway npm ci should work now

Dependencies:
- express: ^4.18.2
- cors: ^2.8.5
- dotenv: ^16.3.1"

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ package-lock.json 已同步並推送！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 重新構建（120秒）..."
sleep 120

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 測試部署結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 測試健康檢查
echo "測試 1: 健康檢查"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/health | jq .

echo ""
echo "測試 2: 根路徑"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/ | jq .

echo ""
echo "測試 3: AI 狀態"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/status | jq .

echo ""
echo "測試 4: 對話功能"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 測試完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


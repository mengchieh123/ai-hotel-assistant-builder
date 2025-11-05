#!/bin/bash

echo "🔧 [translate:修復 API 路由路徑]"
echo "=========================================="
echo ""

# [translate:檢查當前路由]
echo "📋 [translate:當前路由配置:]"
grep -n "app.post.*chat" server.js

echo ""
echo "🔄 [translate:更新路由路徑...]"

# [translate:備份]
cp server.js server.js.backup.route

# [translate:修改路由從] /chat [translate:到] /api/ai/chat
sed -i "s|app.post('/chat'|app.post('/api/ai/chat'|g" server.js

echo "✅ [translate:路由已更新]"
echo ""
echo "📋 [translate:新路由配置:]"
grep -n "app.post.*chat" server.js

echo ""
echo "🚀 [translate:提交並部署...]"
git add server.js
git commit -m "fix: update chat route path from /chat to /api/ai/chat

- Changed POST /chat to POST /api/ai/chat
- Matches test script expectations
- Fixes null response issue"

git push origin main
railway up --detach

echo ""
echo "=========================================="
echo "✅ [translate:修復完成]"
echo "=========================================="
echo ""
echo "⏳ [translate:等待] 120 [translate:秒後測試...]"
sleep 120

echo ""
echo "🧪 [translate:測試修復後的路由...]"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}' | jq '.'

echo ""
echo "🧪 [translate:測試複雜查詢...]"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}' | jq '.'


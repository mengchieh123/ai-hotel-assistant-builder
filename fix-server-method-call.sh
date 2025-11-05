#!/bin/bash

echo "🔧 修復 server.js 方法調用"
echo "=========================================="
echo ""

# 備份
cp server.js server.js.backup.methodfix.$(date +%Y%m%d%H%M%S)

# 修復方法調用
sed -i 's/const response = enhancedAI\.generateResponse(message);/const response = await enhancedAI.processMessage(message);/g' server.js

# 確保路由是 async
sed -i "s/app\.post('\/chat', (req, res) => {/app.post('\/chat', async (req, res) => {/g" server.js

echo "✅ 已修復方法調用"
echo ""
echo "📋 查看變更："
git diff server.js

echo ""
read -p "確認提交並部署？(y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add server.js
    git commit -m "fix: correct enhanced AI service method call

- Changed generateResponse() to processMessage()
- Added async/await to chat route
- Fixes API returning empty responses"
    
    git push origin main
    railway up --detach
    
    echo ""
    echo "✅ 已部署修復"
    echo ""
    echo "⏳ 等待 120 秒後測試..."
    sleep 120
    
    # 測試
    curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
      -H "Content-Type: application/json" \
      -d '{"message":"你好"}' | jq '.'
fi


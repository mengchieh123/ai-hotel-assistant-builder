#!/bin/bash

echo "🚀 強制重新部署到 Railway"
echo "================================"
echo ""

# 1️⃣ 確認當前分支的代碼是最新的
echo "1️⃣ 檢查本地代碼版本:"
git show HEAD:services/mock-ai-service.js | grep -i "3,800" | head -2
echo ""

# 2️⃣ 確認遠端代碼是最新的
echo "2️⃣ 檢查遠端 origin/main 版本:"
git show origin/main:services/mock-ai-service.js | grep -i "3,800" | head -2
echo ""

# 3️⃣ 推送到遠端（觸發 Railway 重新部署）
echo "3️⃣ 推送到 GitHub (觸發 Railway 部署):"
git push origin main
echo ""

# 4️⃣ 等待幾秒讓部署開始
echo "⏳ 等待 Railway 開始部署..."
sleep 5

# 5️⃣ 監控部署日誌
echo ""
echo "5️⃣ 部署日誌:"
echo "------------------------"
railway logs --tail 30


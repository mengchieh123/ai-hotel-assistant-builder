#!/bin/bash

echo "🔍 部署診斷"
echo "================================"
echo ""

# 1️⃣ 檢查本地代碼
echo "1️⃣ 本地代碼 (services/mock-ai-service.js):"
grep -n "豪華客房.*3,800\|豪華客房.*7,500" services/mock-ai-service.js | head -3
echo ""

# 2️⃣ 檢查 GitHub 上的代碼
echo "2️⃣ GitHub main 分支代碼:"
git fetch origin
git show origin/main:services/mock-ai-service.js | grep -n "豪華客房.*3,800\|豪華客房.*7,500" | head -3
echo ""

# 3️⃣ 檢查是否有未提交的變更
echo "3️⃣ Git 狀態:"
git status --short
echo ""

# 4️⃣ 檢查最近的提交
echo "4️⃣ 最近 3 次提交:"
git log --oneline -3
echo ""

# 5️⃣ 檢查 Railway 設定
echo "5️⃣ Railway 專案資訊:"
railway status
echo ""

echo "6️⃣ Railway 環境變數中的分支設定:"
railway variables | grep -i branch || echo "   (未找到 branch 相關變數)"


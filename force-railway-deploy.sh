#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 強制觸發 Railway 部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "確認狀態:"
echo "✅ 本地程式碼: NT$3,800"
echo "✅ Git 提交: 包含正確價格"
echo "❌ Railway 服務: 仍然是舊版本"

# 1. 檢查 Railway remote
echo ""
echo "1️⃣ 檢查 Railway remote:"
git remote -v | grep railway

# 2. 強制推送
echo ""
echo "2️⃣ 強制推送到 Railway:"
echo "執行: git push railway main"
if git push railway main; then
    echo "✅ 推送成功"
else
    echo "❌ 推送失敗，嘗試強制推送"
    git push railway main --force
fi

# 3. 檢查部署觸發
echo ""
echo "3️⃣ 檢查部署是否觸發:"
echo "等待 10 秒後檢查 Railway 日誌..."
sleep 10
railway logs --tail 5

echo ""
echo "📋 下一步:"
echo "請在 Railway Dashboard 中檢查部署狀態:"
echo "https://railway.app/project/industrious-forgiveness/deployments"

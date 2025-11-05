#!/bin/bash

echo "🚀 Railway 強制重新部署流程"
echo "=========================================="
echo ""

# 步驟 1: 創建空提交
echo "1️⃣ 創建空提交觸發部署..."
git commit --allow-empty -m "Force Railway redeploy - GitHub already has NT\$3,800 update"
git push origin main

echo ""
echo "✅ 已推送到 GitHub"
echo ""

# 步驟 2: 等待 Railway 開始處理
echo "2️⃣ 等待 Railway 開始部署 (20秒)..."
sleep 20

# 步驟 3: 檢查部署日誌
echo ""
echo "3️⃣ 查看部署日誌:"
echo "----------------------------"
railway logs --tail 50

echo ""
echo "=========================================="
echo "📋 接下來的步驟:"
echo ""
echo "如果上面的日誌顯示新的部署正在進行："
echo "   - 等待 1-2 分鐘讓部署完成"
echo "   - 然後執行: bash test-new-deployment.sh"
echo ""
echo "如果日誌沒有顯示新部署："
echo "   - 需要在 Railway Dashboard 手動觸發"
echo "   - 執行: railway open"
echo "   - 找到 'Deployments' 標籤"
echo "   - 點擊最新部署的 '...' 選單 > 'Redeploy'"


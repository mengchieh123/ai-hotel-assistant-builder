#!/bin/bash

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 正確的 Railway 部署流程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1️⃣ 檢查當前狀態
echo "1️⃣ 檢查文件版本和價格:"
echo "   server.js 版本:"
grep -o "version.*[0-9]\+\.[0-9]\+\.[0-9]\+" server.js | head -1 || echo "   (未找到版本號)"

echo "   包含 NT\$3,800?"
if grep -q "3,800" services/mock-ai-service.js 2>/dev/null || grep -q "3,800" server.js 2>/dev/null; then
  echo "   ✅ 是"
else
  echo "   ❌ 否"
fi
echo ""

# 2️⃣ 確保所有變更已提交
echo "2️⃣ 提交所有變更:"
git add -A
git commit -m "deploy: force update to v4.0.0 with NT\$3,800 prices [$(date +%Y%m%d-%H%M%S)]" || echo "   (無新變更)"
echo ""

# 3️⃣ 推送到 GitHub (Railway 會自動監聽)
echo "3️⃣ 推送到 GitHub origin/main:"
git push origin main --force
echo "   ✅ 已推送到 GitHub"
echo ""

# 4️⃣ 使用 Railway CLI 強制重新部署
echo "4️⃣ 觸發 Railway 重新部署:"
railway up --detach
echo "   ✅ Railway 部署已觸發"
echo ""

# 5️⃣ 等待並監控
echo "5️⃣ 監控部署日誌 (30秒):"
sleep 5
railway logs --tail 30
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 部署命令已執行"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏳ 請等待 2-3 分鐘，然後執行驗證:"
echo "   bash verify-enhanced-deployment.sh"
echo ""
echo "或者持續監控日誌:"
echo "   railway logs --follow"


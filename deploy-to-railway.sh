#!/bin/bash

set -e  # 遇到錯誤立即停止

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "🚀 Railway 完整部署流程"
echo "=========================================="
echo ""

# ============================================
# 階段 1: 代碼驗證
# ============================================
echo "📋 階段 1/4: 代碼驗證"
echo "----------------------------------------"

echo "   檢查本地代碼..."
if grep -q "3,800" services/mock-ai-service.js; then
  echo "   ✅ 本地代碼包含 NT\$3,800"
else
  echo "   ❌ 本地代碼不包含 NT\$3,800"
  exit 1
fi

echo "   檢查 Git 狀態..."
if git diff --quiet services/mock-ai-service.js; then
  echo "   ✅ 工作目錄乾淨"
else
  echo "   ⚠️  有未提交的變更，正在提交..."
  git add services/mock-ai-service.js
  git commit -m "update: sync price changes to NT\$3,800"
fi

echo ""

# ============================================
# 階段 2: 推送到 GitHub
# ============================================
echo "📤 階段 2/4: 推送到 GitHub"
echo "----------------------------------------"

echo "   推送到 origin/main..."
git push origin main

echo "   驗證 GitHub 上的代碼..."
git fetch origin
if git show origin/main:services/mock-ai-service.js | grep -q "3,800"; then
  echo "   ✅ GitHub 代碼已更新"
else
  echo "   ❌ GitHub 代碼未更新"
  exit 1
fi

echo ""

# ============================================
# 階段 3: 觸發 Railway 部署
# ============================================
echo "🚂 階段 3/4: 觸發 Railway 部署"
echo "----------------------------------------"

echo "   方法 1: 創建空提交觸發自動部署..."
git commit --allow-empty -m "chore: trigger Railway deployment [$(date +%Y%m%d-%H%M%S)]"
git push origin main

echo "   等待 10 秒..."
sleep 10

echo "   方法 2: 使用 Railway CLI 強制部署..."
railway up --detach

echo "   ✅ 部署已觸發"
echo ""

# ============================================
# 階段 4: 等待並驗證部署
# ============================================
echo "⏳ 階段 4/4: 等待並驗證部署"
echo "----------------------------------------"

echo "   等待部署完成（最多 3 分鐘）..."
echo ""

MAX_ATTEMPTS=12
ATTEMPT=0
DEPLOYMENT_SUCCESS=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "   嘗試 $ATTEMPT/$MAX_ATTEMPTS (等待 15 秒)"
  sleep 15
  
  # 檢查健康狀態
  HEALTH=$(curl -s "$RAILWAY_URL/health" || echo '{}')
  UPTIME=$(echo "$HEALTH" | jq -r '.uptime // 999999' 2>/dev/null || echo "999999")
  
  # 如果 uptime < 300，表示最近重啟過
  if (( $(echo "$UPTIME < 300" | bc -l 2>/dev/null || echo "0") )); then
    echo "   ℹ️  檢測到服務重啟 (uptime: ${UPTIME}s)"
    
    # 測試價格
    RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d '{"message":"豪華客房價格"}' || echo '{}')
    
    if echo "$RESPONSE" | grep -q "3,800"; then
      echo ""
      echo "   🎉 ✅ 部署成功！價格已更新到 NT\$3,800"
      DEPLOYMENT_SUCCESS=true
      break
    fi
  fi
done

echo ""
echo "=========================================="

if [ "$DEPLOYMENT_SUCCESS" = true ]; then
  echo "✅ 部署完成並驗證成功！"
  echo ""
  echo "📊 最終驗證:"
  RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"豪華客房價格"}')
  echo "$RESPONSE" | jq '.message'
  echo ""
  echo "🌐 服務 URL: $RAILWAY_URL"
else
  echo "⚠️  自動驗證超時"
  echo ""
  echo "請手動檢查:"
  echo "1. railway logs --tail 50"
  echo "2. railway open (在 Dashboard 檢查部署狀態)"
  echo ""
  echo "或執行快速測試:"
  echo "curl -s $RAILWAY_URL/health | jq '.'"
fi


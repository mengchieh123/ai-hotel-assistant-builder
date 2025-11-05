#!/bin/bash

set -e

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Railway 部署系統 v2"
echo "=========================================="
echo ""

# ============================================
# 步驟 1: 驗證代碼
# ============================================
echo "📋 [1/5] 驗證代碼"
if grep -q "3,800" services/mock-ai-service.js; then
  echo -e "   ${GREEN}✅ 代碼包含 NT\$3,800${NC}"
else
  echo -e "   ${RED}❌ 代碼不包含 NT\$3,800${NC}"
  exit 1
fi

# ============================================
# 步驟 2: 提交變更（如果有）
# ============================================
echo ""
echo "📝 [2/5] 檢查 Git 狀態"
if ! git diff --quiet; then
  echo -e "   ${YELLOW}⚠️  有未提交變更，正在提交...${NC}"
  git add -A
  git commit -m "deploy: update prices $(date +%Y%m%d-%H%M%S)"
  git push origin main
else
  echo -e "   ${GREEN}✅ 無待提交變更${NC}"
fi

# ============================================
# 步驟 3: 強制觸發部署
# ============================================
echo ""
echo "🚂 [3/5] 觸發 Railway 部署"

# 使用 Railway CLI 直接部署
railway up --detach
echo -e "   ${GREEN}✅ 部署命令已執行${NC}"

# ============================================
# 步驟 4: 監控部署日誌
# ============================================
echo ""
echo "📊 [4/5] 監控部署進度 (30秒)"
sleep 5

# 顯示最近的日誌
railway logs --tail 20

echo ""
echo -e "${YELLOW}⏳ 等待 90 秒讓部署完成...${NC}"
sleep 90

# ============================================
# 步驟 5: 驗證部署
# ============================================
echo ""
echo "🧪 [5/5] 驗證部署結果"
echo "----------------------------------------"

# 健康檢查
HEALTH=$(curl -s "$RAILWAY_URL/health")
UPTIME=$(echo "$HEALTH" | jq -r '.uptime // 0')
VERSION=$(echo "$HEALTH" | jq -r '.version // "unknown"')

echo "   版本: $VERSION"
echo "   運行時間: ${UPTIME}秒"

# 價格測試
RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"豪華客房價格"}')

echo ""
echo "   價格回應:"
echo "$RESPONSE" | jq -r '.message' | head -5

echo ""
if echo "$RESPONSE" | grep -q "3,800"; then
  echo -e "${GREEN}🎉🎉🎉 部署成功！價格已更新到 NT\$3,800！ 🎉🎉🎉${NC}"
  echo ""
  echo "=========================================="
  echo "✅ 部署完成"
  echo "🌐 服務 URL: $RAILWAY_URL"
  echo "📊 測試 URL: $RAILWAY_URL/health"
  exit 0
else
  echo -e "${RED}❌ 價格尚未更新${NC}"
  echo ""
  echo "目前價格:"
  echo "$RESPONSE" | grep -o "NT\$[0-9,]*" | sort -u
  echo ""
  echo "請執行以下命令進行診斷:"
  echo "1. railway logs --tail 50"
  echo "2. railway open"
  exit 1
fi


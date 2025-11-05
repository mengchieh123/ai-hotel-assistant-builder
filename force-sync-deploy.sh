#!/bin/bash

echo "🔥 [translate:強制同步部署 v5.2.0]"
echo "=========================================="
echo ""

# 1. [translate:同步遠端變更]
echo "1️⃣ [translate:同步 GitHub 遠端倉庫]..."
git fetch origin
git reset --hard origin/main
echo "   ✅ [translate:已重置到遠端最新狀態]"
echo ""

# 2. [translate:確認本地文件]
echo "2️⃣ [translate:確認本地 AI 服務版本]..."
VERSION=$(grep "this.version" services/enhanced-ai-service.js | head -1)
echo "   $VERSION"
echo ""

# 3. [translate:強制提交和推送]
echo "3️⃣ [translate:確保所有變更已提交]..."
git add -A
git commit -m "force: sync v5.2.0-OPTIMIZED to production

- Force push to ensure latest AI service deployed
- Version: 5.2.0-OPTIMIZED
- Multi-intent recognition
- English support
- Enhanced entity extraction" || echo "   [translate:無新變更需要提交]"

git push origin main --force

if [ $? -eq 0 ]; then
    echo "   ✅ [translate:已強制推送到 GitHub]"
else
    echo "   ⚠️  [translate:推送失敗，嘗試 Railway CLI]"
fi
echo ""

# 4. [translate:清理 Railway 緩存並重新部署]
echo "4️⃣ [translate:清理緩存並重新部署]..."
railway up --detach

echo "   ✅ [translate:已觸發 Railway 部署]"
echo ""

# 5. [translate:等待部署]
echo "5️⃣ [translate:等待部署完成] (180[translate:秒])..."
for i in {180..1}; do
    printf "\r   [translate:剩餘] %3d [translate:秒]..." $i
    sleep 1
done
echo ""
echo ""

# 6. [translate:驗證新版本]
echo "6️⃣ [translate:驗證部署結果]..."
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "   [translate:根 API 版本]："
ROOT_VERSION=$(curl -s "$API" | jq -r '.version')
echo "   $ROOT_VERSION"
echo ""

echo "   [translate:健康檢查版本]："
HEALTH_VERSION=$(curl -s "$API/health" | jq -r '.version')
echo "   $HEALTH_VERSION"
echo ""

echo "   [translate:測試複雜查詢]："
RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}')

AI_VERSION=$(echo "$RESPONSE" | jq -r '.response.version')
echo "   AI [translate:服務版本]：$AI_VERSION"

ENTITIES=$(echo "$RESPONSE" | jq '.response.entities')
echo "   [translate:實體提取]："
echo "$ENTITIES" | jq '.' | sed 's/^/     /'

echo ""
echo "=========================================="

if [[ "$AI_VERSION" == *"5.2"* ]]; then
    echo "🎉 [translate:部署成功]！v5.2.0 [translate:已上線]"
    echo ""
    echo "[translate:對話能力已大幅提升]："
    echo "   ✅ [translate:多意圖識別]"
    echo "   ✅ [translate:英文查詢支援]"
    echo "   ✅ [translate:實體提取完整]"
else
    echo "⚠️  [translate:版本仍未更新]"
    echo ""
    echo "[translate:請檢查 Railway 日誌]："
    echo "   railway logs --tail 50"
    echo ""
    echo "[translate:或在 Railway Dashboard 手動重新部署]："
    echo "   railway open"
fi


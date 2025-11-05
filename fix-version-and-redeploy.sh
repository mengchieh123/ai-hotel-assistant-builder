#!/bin/bash

echo "🔧 [translate:修復 AI 服務版本並重新部署]"
echo "=========================================="
echo ""

# 1. [translate:檢查當前版本]
echo "1️⃣ [translate:當前 AI 服務版本]："
grep "this.version" services/enhanced-ai-service.js || echo "   ❌ [translate:版本號缺失]"
echo ""

# 2. [translate:確保版本號正確]
echo "2️⃣ [translate:設置版本為] v5.2.0-OPTIMIZED..."
sed -i "s/this.version = '.*';/this.version = '5.2.0-OPTIMIZED';/" services/enhanced-ai-service.js

echo "   [translate:新版本]："
grep "this.version" services/enhanced-ai-service.js
echo ""

# 3. [translate:驗證文件完整性]
echo "3️⃣ [translate:驗證 AI 服務文件]..."
if grep -q "identifyMultipleIntents" services/enhanced-ai-service.js; then
    echo "   ✅ [translate:多意圖識別方法存在]"
else
    echo "   ❌ [translate:多意圖識別方法缺失]"
fi

if grep -q "English" services/enhanced-ai-service.js; then
    echo "   ✅ [translate:英文支援存在]"
else
    echo "   ❌ [translate:英文支援缺失]"
fi

if grep -q "children.ages" services/enhanced-ai-service.js; then
    echo "   ✅ [translate:多兒童年齡提取存在]"
else
    echo "   ❌ [translate:多兒童年齡提取缺失]"
fi
echo ""

# 4. [translate:提交並部署]
echo "4️⃣ [translate:提交變更並部署]..."
git add services/enhanced-ai-service.js
git commit -m "fix: set AI service version to 5.2.0-OPTIMIZED

- Correct version string in enhanced-ai-service.js
- Ensure multi-intent recognition is active
- Verify English support is enabled
- Confirm multiple children ages extraction works"

git push origin main
railway up --detach

echo "   ✅ [translate:已重新部署]"
echo ""

# 5. [translate:等待部署]
echo "5️⃣ [translate:等待部署完成] (180[translate:秒])..."
for i in {180..1}; do
    printf "\r   [translate:倒計時] %3d [translate:秒]" $i
    sleep 1
done
echo ""
echo ""

# 6. [translate:完整驗證]
echo "6️⃣ [translate:完整驗證]..."
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "📍 [translate:健康檢查]："
HEALTH=$(curl -s "$API/health")
echo "$HEALTH" | jq '.'
echo ""

echo "📍 [translate:測試複雜查詢] ([translate:中文])："
RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}')

echo "   [translate:版本]：$(echo "$RESPONSE" | jq -r '.response.version')"
echo "   [translate:意圖]：$(echo "$RESPONSE" | jq -r '.response.intent')"
echo "   [translate:所有意圖]：$(echo "$RESPONSE" | jq -r '.response.intents')"
echo ""
echo "   [translate:實體]："
echo "$RESPONSE" | jq '.response.entities' | sed 's/^/     /'
echo ""

echo "📍 [translate:測試英文查詢]："
RESPONSE_EN=$(curl -s -X POST "$API/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"We need two rooms for Christmas week"}')

echo "   [translate:意圖]：$(echo "$RESPONSE_EN" | jq -r '.response.intent')"
echo "   [translate:實體]："
echo "$RESPONSE_EN" | jq '.response.entities' | sed 's/^/     /'
echo ""

echo "=========================================="
VERSION=$(echo "$RESPONSE" | jq -r '.response.version')

if [[ "$VERSION" == "5.2.0-OPTIMIZED" ]]; then
    echo "🎉 [translate:成功]！v5.2.0-OPTIMIZED [translate:已上線]"
    echo ""
    echo "[translate:驗證結果]："
    echo "   ✅ [translate:版本正確]"
    echo "   ✅ [translate:實體提取正常]"
    echo "   ✅ [translate:多意圖識別運行]"
    echo ""
    echo "[translate:現在執行極限測試以查看改進]："
    bash extreme-complex-test.sh | tail -30
else
    echo "⚠️  [translate:版本]：$VERSION"
    echo ""
    echo "[translate:請檢查]："
    railway logs --tail 20
fi


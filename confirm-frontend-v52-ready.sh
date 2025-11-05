#!/bin/bash

echo "🎨 [translate:確認前端可以使用 v5.2.0 測試]"
echo "=========================================="
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat"

# 1️⃣ [translate:確認 AI 服務版本]
echo "1️⃣ [translate:確認 AI 服務版本]..."
RESPONSE=$(curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"message":"你好"}')

AI_VERSION=$(echo "$RESPONSE" | jq -r '.response.version')
echo "   [translate:AI 版本]: $AI_VERSION"

if [[ "$AI_VERSION" == "5.2.0-OPTIMIZED" ]]; then
    echo "   ✅ [translate:版本正確]"
else
    echo "   ⚠️  [translate:版本不符預期]: $AI_VERSION"
fi

echo ""

# 2️⃣ [translate:測試核心功能]
echo "2️⃣ [translate:測試 v5.2.0 核心功能]..."

echo ""
echo "   📝 [translate:測試 1: 多意圖識別]"
RESPONSE=$(curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}')

INTENTS=$(echo "$RESPONSE" | jq -r '.response.intents')
echo "   [translate:識別的意圖]: $INTENTS"

if [[ "$INTENTS" == *"booking"* ]]; then
    echo "   ✅ [translate:多意圖識別正常]"
else
    echo "   ❌ [translate:多意圖識別失敗]"
fi

echo ""
echo "   📝 [translate:測試 2: 完整實體提取]"
ENTITIES=$(echo "$RESPONSE" | jq '.response.entities')
echo "   [translate:提取的實體]:"
echo "$ENTITIES" | jq '.' | sed 's/^/      /'

HAS_DATE=$(echo "$ENTITIES" | jq -e '.date' > /dev/null && echo "true" || echo "false")
HAS_NIGHTS=$(echo "$ENTITIES" | jq -e '.nights' > /dev/null && echo "true" || echo "false")
HAS_MEMBER=$(echo "$ENTITIES" | jq -e '.isMember' > /dev/null && echo "true" || echo "false")
HAS_CHILDREN=$(echo "$ENTITIES" | jq -e '.children' > /dev/null && echo "true" || echo "false")

if [[ "$HAS_DATE" == "true" && "$HAS_NIGHTS" == "true" && "$HAS_MEMBER" == "true" && "$HAS_CHILDREN" == "true" ]]; then
    echo "   ✅ [translate:實體提取完整]"
else
    echo "   ⚠️  [translate:部分實體缺失]"
fi

echo ""
echo "   📝 [translate:測試 3: 英文查詢支援]"
RESPONSE_EN=$(curl -s -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"message":"We need two rooms for Christmas"}')

INTENT_EN=$(echo "$RESPONSE_EN" | jq -r '.response.intent')
echo "   [translate:英文意圖]: $INTENT_EN"

if [[ "$INTENT_EN" == "booking" ]]; then
    echo "   ✅ [translate:英文查詢支援正常]"
else
    echo "   ⚠️  [translate:英文查詢識別問題]"
fi

echo ""
echo "=========================================="
echo "3️⃣ [translate:前端測試準備狀態]"
echo "=========================================="
echo ""

# [translate:計算功能狀態]
READY=0
TOTAL=4

if [[ "$AI_VERSION" == "5.2.0-OPTIMIZED" ]]; then READY=$((READY + 1)); fi
if [[ "$INTENTS" == *"booking"* ]]; then READY=$((READY + 1)); fi
if [[ "$HAS_DATE" == "true" ]]; then READY=$((READY + 1)); fi
if [[ "$INTENT_EN" == "booking" ]]; then READY=$((READY + 1)); fi

READINESS=$((READY * 100 / TOTAL))

if [ $READY -eq $TOTAL ]; then
    echo "🎉 [translate:完全就緒]！($READY/$TOTAL - $READINESS%)"
    echo ""
    echo "✅ [translate:所有核心功能正常]"
    echo "✅ [translate:可以開始前端測試]"
    echo ""
    echo "📋 [translate:前端測試方式]："
    echo ""
    echo "   [translate:方式 1]: [translate:打開 HTML 文件]"
    echo "   open pm-test-interface.html"
    echo ""
    echo "   [translate:方式 2]: [translate:啟動本地服務器]"
    echo "   python3 -m http.server 8000"
    echo "   [translate:然後訪問]: http://localhost:8000/pm-test-interface.html"
    echo ""
    echo "🎯 [translate:測試重點]："
    echo "   1. [translate:使用快速測試按鈕測試各種場景]"
    echo "   2. [translate:查看實時統計數據]"
    echo "   3. [translate:測試複雜查詢]（[translate:日期 + 會員 + 兒童]）"
    echo "   4. [translate:測試英文查詢]"
    echo "   5. [translate:導出測試結果]"
elif [ $READY -ge 3 ]; then
    echo "✅ [translate:基本就緒] ($READY/$TOTAL - $READINESS%)"
    echo ""
    echo "✅ [translate:核心功能正常]"
    echo "⚠️  [translate:部分增強功能需檢查]"
    echo "✅ [translate:可以開始測試，但建議先優化]"
else
    echo "⚠️  [translate:未完全就緒] ($READY/$TOTAL - $READINESS%)"
    echo ""
    echo "❌ [translate:多個核心功能異常]"
    echo "⚠️  [translate:建議先修復問題再測試]"
fi

echo ""
echo "=========================================="
echo "📊 [translate:功能檢查清單]"
echo "=========================================="
echo ""

if [[ "$AI_VERSION" == "5.2.0-OPTIMIZED" ]]; then
    echo "✅ [translate:版本號]: v5.2.0-OPTIMIZED"
else
    echo "❌ [translate:版本號]: $AI_VERSION"
fi

if [[ "$INTENTS" == *"booking"* ]]; then
    echo "✅ [translate:多意圖識別]: [translate:正常]"
else
    echo "❌ [translate:多意圖識別]: [translate:異常]"
fi

if [[ "$HAS_DATE" == "true" ]]; then
    echo "✅ [translate:實體提取]: [translate:正常]"
else
    echo "❌ [translate:實體提取]: [translate:異常]"
fi

if [[ "$INTENT_EN" == "booking" ]]; then
    echo "✅ [translate:英文支援]: [translate:正常]"
else
    echo "❌ [translate:英文支援]: [translate:異常]"
fi

echo ""
echo "=========================================="
echo "[translate:測試時間]: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="


#!/bin/bash

API="https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat"

echo "🎯 [translate:產品經理視角 - 前端測試報告]"
echo "=========================================="
echo "[translate:測試時間]: $(date '+%Y-%m-%d %H:%M:%S')"
echo "[translate:測試者]: Product Manager"
echo ""

# [translate:測試計數器]
TOTAL=0
PASSED=0
CRITICAL=0
CRITICAL_FAILED=0

# [translate:測試函數]
test_scenario() {
    local priority=$1
    local category=$2
    local scenario=$3
    local query=$4
    local expect=$5
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$priority" = "🔴" ]; then
        CRITICAL=$((CRITICAL + 1))
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$priority [$category] $scenario"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "👤 [translate:用戶說]："
    echo "   「$query」"
    echo ""
    
    START=$(date +%s%3N)
    RESPONSE=$(curl -s -X POST "$API" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$query\"}")
    END=$(date +%s%3N)
    
    TIME=$((END - START))
    
    MESSAGE=$(echo "$RESPONSE" | jq -r '.response.message // .response // "無回應"' 2>/dev/null || echo "解析錯誤")
    INTENT=$(echo "$RESPONSE" | jq -r '.response.intent // "unknown"' 2>/dev/null || echo "unknown")
    
    echo "🤖 AI [translate:回應] (${TIME}ms)："
    echo "$MESSAGE" | head -10 | sed 's/^/   /'
    echo ""
    
    # [translate:評分標準]
    SCORE=0
    ISSUES=()
    
    # 1. [translate:回應時間]
    if [ $TIME -lt 500 ]; then
        echo "   ✅ [translate:回應速度]：${TIME}ms ([translate:優秀])"
        SCORE=$((SCORE + 1))
    elif [ $TIME -lt 1000 ]; then
        echo "   ✅ [translate:回應速度]：${TIME}ms ([translate:良好])"
        SCORE=$((SCORE + 1))
    else
        echo "   ⚠️  [translate:回應速度]：${TIME}ms ([translate:需優化])"
        ISSUES+=("[translate:回應時間過長]")
    fi
    
    # 2. [translate:回應完整性]
    LENGTH=${#MESSAGE}
    if [ $LENGTH -gt 50 ]; then
        echo "   ✅ [translate:回應長度]：${LENGTH} [translate:字元] ([translate:詳細])"
        SCORE=$((SCORE + 1))
    elif [ $LENGTH -gt 20 ]; then
        echo "   ⚠️  [translate:回應長度]：${LENGTH} [translate:字元] ([translate:簡短])"
    else
        echo "   ❌ [translate:回應長度]：${LENGTH} [translate:字元] ([translate:過短])"
        ISSUES+=("[translate:回應內容不足]")
    fi
    
    # 3. [translate:意圖識別]
    if [[ "$INTENT" != "unknown" && "$INTENT" != "null" && "$INTENT" != "" ]]; then
        echo "   ✅ [translate:意圖識別]：$INTENT"
        SCORE=$((SCORE + 1))
    else
        echo "   ❌ [translate:意圖識別]：[translate:失敗]"
        ISSUES+=("[translate:無法識別用戶意圖]")
    fi
    
    # 4. [translate:期望內容檢查]
    if echo "$MESSAGE" | grep -qi "$expect"; then
        echo "   ✅ [translate:包含關鍵資訊]：$expect"
        SCORE=$((SCORE + 1))
    else
        echo "   ❌ [translate:缺少關鍵資訊]：$expect"
        ISSUES+=("[translate:未提供]「$expect」[translate:相關資訊]")
    fi
    
    # [translate:判定結果]
    echo ""
    if [ $SCORE -ge 3 ]; then
        echo "   ✅ [translate:測試通過] ($SCORE/4)"
        PASSED=$((PASSED + 1))
    else
        echo "   ❌ [translate:測試失敗] ($SCORE/4)"
        if [ "$priority" = "🔴" ]; then
            CRITICAL_FAILED=$((CRITICAL_FAILED + 1))
        fi
        
        if [ ${#ISSUES[@]} -gt 0 ]; then
            echo ""
            echo "   📋 [translate:發現問題]："
            for issue in "${ISSUES[@]}"; do
                echo "      • $issue"
            done
        fi
    fi
    
    echo ""
}

echo "📋 [translate:測試場景清單]"
echo "   🔴 = [translate:核心功能]（[translate:必須通過]）"
echo "   🟡 = [translate:重要功能]（[translate:應該通過]）"
echo "   🟢 = [translate:增強功能]（[translate:期望通過]）"
echo ""
echo "=========================================="
echo ""

# ============================================
# [translate:核心功能測試] 🔴
# ============================================

test_scenario "🔴" "[translate:基礎對話]" "[translate:首次問候]" \
  "你好" \
  "AI助理"

test_scenario "🔴" "[translate:價格查詢]" "[translate:單一房型價格]" \
  "豪華客房多少錢" \
  "3,800"

test_scenario "🔴" "[translate:訂房意圖]" "[translate:簡單訂房]" \
  "我要訂房" \
  "訂房"

test_scenario "🔴" "[translate:設施查詢]" "[translate:基礎設施]" \
  "有游泳池嗎" \
  "游泳池"

# ============================================
# [translate:重要功能測試] 🟡
# ============================================

test_scenario "🟡" "[translate:複雜訂房]" "[translate:多條件訂房]" \
  "我要訂12月24號入住3晚" \
  "12月24"

test_scenario "🟡" "[translate:會員優惠]" "[translate:會員身份識別]" \
  "我是會員，有什麼優惠" \
  "會員"

test_scenario "🟡" "[translate:兒童政策]" "[translate:兒童年齡識別]" \
  "小孩6歲需要收費嗎" \
  "兒童"

test_scenario "🟡" "[translate:政策查詢]" "[translate:取消政策]" \
  "取消訂房的規定" \
  "取消"

# ============================================
# [translate:增強功能測試] 🟢
# ============================================

test_scenario "🟢" "[translate:極限複雜]" "[translate:多條件混合]" \
  "我要訂12月24號入住3晚，我是會員，小孩6歲" \
  "12月"

test_scenario "🟢" "[translate:特殊需求]" "[translate:無障礙設施]" \
  "需要無障礙房間，我爸爸坐輪椅" \
  "無障礙"

test_scenario "🟢" "[translate:英文查詢]" "[translate:國際客戶]" \
  "We need two rooms for Christmas" \
  "room"

test_scenario "🟢" "[translate:房型比較]" "[translate:多房型對比]" \
  "比較豪華客房和行政客房的差別" \
  "豪華"

# ============================================
# [translate:測試總結]
# ============================================

echo "=========================================="
echo "📊 [translate:測試結果總結]"
echo "=========================================="
echo ""

PASS_RATE=$((PASSED * 100 / TOTAL))
CRITICAL_PASS_RATE=0
if [ $CRITICAL -gt 0 ]; then
    CRITICAL_PASS=$(($CRITICAL - $CRITICAL_FAILED))
    CRITICAL_PASS_RATE=$((CRITICAL_PASS * 100 / CRITICAL))
fi

echo "📈 [translate:整體測試]："
echo "   • [translate:總測試數]：$TOTAL"
echo "   • [translate:通過數]：$PASSED"
echo "   • [translate:成功率]：$PASS_RATE%"
echo ""

echo "🔴 [translate:核心功能]（[translate:必須通過]）："
echo "   • [translate:核心測試數]：$CRITICAL"
echo "   • [translate:通過數]：$(($CRITICAL - $CRITICAL_FAILED))"
echo "   • [translate:成功率]：$CRITICAL_PASS_RATE%"
echo ""

# [translate:評級]
if [ $CRITICAL_FAILED -eq 0 ] && [ $PASS_RATE -ge 80 ]; then
    echo "🎉 [translate:評級]：A+ ([translate:優秀])"
    echo "   ✅ [translate:所有核心功能正常]"
    echo "   ✅ [translate:整體表現優異]"
    echo "   ✅ [translate:可以發佈給用戶]"
elif [ $CRITICAL_FAILED -eq 0 ] && [ $PASS_RATE -ge 60 ]; then
    echo "✅ [translate:評級]：B ([translate:良好])"
    echo "   ✅ [translate:核心功能正常]"
    echo "   ⚠️  [translate:部分增強功能需優化]"
    echo "   ✅ [translate:可以發佈，建議持續優化]"
elif [ $CRITICAL_FAILED -le 1 ]; then
    echo "⚠️  [translate:評級]：C ([translate:及格])"
    echo "   ⚠️  [translate:有核心功能問題]"
    echo "   ⚠️  [translate:需要修復後再發佈]"
else
    echo "❌ [translate:評級]：D ([translate:不及格])"
    echo "   ❌ [translate:多個核心功能失敗]"
    echo "   ❌ [translate:不建議發佈]"
fi

echo ""
echo "=========================================="
echo "💡 [translate:產品經理建議]"
echo "=========================================="
echo ""

if [ $CRITICAL_FAILED -eq 0 ]; then
    echo "✅ [translate:優點]："
    echo "   • [translate:核心功能穩定可靠]"
    echo "   • [translate:回應速度優秀]"
    echo "   • [translate:用戶體驗良好]"
    echo ""
fi

if [ $PASS_RATE -lt 80 ]; then
    echo "⚠️  [translate:需要改進]："
    echo "   • [translate:提升增強功能的準確率]"
    echo "   • [translate:優化複雜查詢處理]"
    echo "   • [translate:加強實體提取能力]"
    echo ""
fi

echo "📋 [translate:下一步行動]："
if [ $CRITICAL_FAILED -eq 0 ] && [ $PASS_RATE -ge 80 ]; then
    echo "   1. ✅ [translate:可以交付給用戶測試]"
    echo "   2. 📊 [translate:收集用戶反饋]"
    echo "   3. 📈 [translate:持續監控和優化]"
elif [ $CRITICAL_FAILED -eq 0 ]; then
    echo "   1. 🔧 [translate:優化增強功能]"
    echo "   2. 🧪 [translate:再次測試驗證]"
    echo "   3. ✅ [translate:通過後發佈]"
else
    echo "   1. 🚨 [translate:立即修復核心功能]"
    echo "   2. 🧪 [translate:完整回歸測試]"
    echo "   3. 📋 [translate:重新評估發佈計劃]"
fi

echo ""
echo "=========================================="
echo "[translate:測試完成時間]: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="


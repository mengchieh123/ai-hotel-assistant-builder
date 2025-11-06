#!/bin/bash

echo "🔍 診斷 AI 訂房助理智能程度"
echo "========================================"
echo ""

API="https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat"

# 測試場景
declare -A TEST_CASES=(
    ["基礎問候"]="你好"
    ["簡單價格"]="豪華客房多少錢"
    ["複雜訂房"]="我要訂12月24號入住3晚，我是會員，小孩6歲"
    ["模糊需求"]="我想找個安靜的房間"
    ["比較詢問"]="豪華客房和行政客房有什麼差別"
    ["情境需求"]="我太太懷孕需要柔軟床墊"
    ["多重問題"]="房間有wifi嗎？早餐幾點？可以延遲退房嗎？"
    ["非標準問法"]="最便宜的房要多少小朋友"
)

echo "📋 測試當前 AI 回應質量："
echo ""

TOTAL=0
GOOD=0
POOR=0

for scenario in "${!TEST_CASES[@]}"; do
    query="${TEST_CASES[$scenario]}"
    
    echo "──────────────────────────────────────"
    echo "測試場景：$scenario"
    echo "輸入：$query"
    echo ""
    
    response=$(curl -s -X POST "$API" \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"$query\"}")
    
    message=$(echo "$response" | jq -r '.message' 2>/dev/null)
    intent=$(echo "$response" | jq -r '.intent' 2>/dev/null)
    
    if [ -z "$message" ] || [ "$message" = "null" ]; then
        echo "❌ 無回應或錯誤"
        POOR=$((POOR + 1))
    else
        echo "回應：$message"
        echo "意圖：$intent"
        
        # 評估回應質量
        if echo "$message" | grep -qE "(具體|詳細|明確|針對)" && [ ${#message} -gt 50 ]; then
            echo "✅ 回應質量：優秀"
            GOOD=$((GOOD + 1))
        elif [ ${#message} -gt 20 ]; then
            echo "⚠️  回應質量：一般"
        else
            echo "❌ 回應質量：差"
            POOR=$((POOR + 1))
        fi
    fi
    
    TOTAL=$((TOTAL + 1))
    echo ""
done

echo "========================================"
echo "📊 診斷結果"
echo "========================================"
echo ""
echo "總測試數：$TOTAL"
echo "優秀回應：$GOOD"
echo "問題回應：$POOR"
echo "優秀率：$((GOOD * 100 / TOTAL))%"
echo ""

echo "🔍 問題分析："
echo ""

if [ $POOR -gt 0 ]; then
    echo "❌ 發現的問題："
    echo "   1. 回應過於簡短或模板化"
    echo "   2. 無法理解模糊需求"
    echo "   3. 不能處理多重問題"
    echo "   4. 缺乏個性化建議"
    echo ""
fi

echo "💡 建議改進方向："
echo "   1. ✅ 增強意圖理解（模糊需求識別）"
echo "   2. ✅ 優化回應模板（更自然、個性化）"
echo "   3. ✅ 添加上下文記憶（多輪對話）"
echo "   4. ✅ 實現推薦引擎（智能建議）"
echo "   5. ✅ 支援多問題拆解"
echo ""


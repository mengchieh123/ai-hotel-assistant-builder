#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 訂房流程業務邏輯測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"
API_ENDPOINT="${BASE_URL}/api/ai/chat"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_chat() {
    local test_name="$1"
    local message="$2"
    local expected_keyword="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "測試 ${TOTAL_TESTS}: ${test_name}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📤 發送: ${message}"
    
    response=$(curl -s -X POST "${API_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"${message}\", \"sessionId\": \"test-${TOTAL_TESTS}\"}")
    
    echo "📥 回應:"
    echo "${response}" | jq -r '.message' 2>/dev/null || echo "${response}"
    
    if echo "${response}" | grep -qi "${expected_keyword}"; then
        echo "✅ 通過"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ 失敗 - 未找到: ${expected_keyword}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo ""
echo "🏁 開始測試..."
echo ""

test_chat "問候" "你好" "歡迎"
test_chat "房型查詢" "有什麼房型" "房型"
test_chat "價格查詢" "豪華客房多少錢" "3800"
test_chat "訂房" "我要訂房" "房型"
test_chat "會員" "有會員嗎" "會員"
test_chat "取消" "取消政策" "24小時"
test_chat "兒童" "小孩收費嗎" "6歲"
test_chat "入住" "幾點入住" "15:00"
test_chat "優惠" "有優惠嗎" "優惠"
test_chat "LINE Pay" "可以用LINE Pay嗎" "LINE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "總測試: ${TOTAL_TESTS}"
echo "✅ 通過: ${PASSED_TESTS}"
echo "❌ 失敗: ${FAILED_TESTS}"

if [ ${TOTAL_TESTS} -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "通過率: ${pass_rate}%"
    echo ""
    if [ ${pass_rate} -ge 80 ]; then
        echo "🎉 優秀！"
    elif [ ${pass_rate} -ge 60 ]; then
        echo "⚠️ 良好，需改進"
    else
        echo "❌ 需要優化"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 測試完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""


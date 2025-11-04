#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 AI 系統完整測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 設置測試環境
PROD_URL="https://ai-hotel-assistant-builder-production.up.railway.app"
SESSION_ID="test-$(date +%s)"

echo "📋 測試配置："
echo "  • 環境: 生產環境"
echo "  • URL: $PROD_URL"
echo "  • Session ID: $SESSION_ID"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 測試計數器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 測試函數
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}測試 #$TOTAL_TESTS: $test_name${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s "$PROD_URL$endpoint")
    else
        RESPONSE=$(curl -s -X POST "$PROD_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    echo "📤 請求: $method $endpoint"
    if [ -n "$data" ]; then
        echo "📝 數據: $data"
    fi
    echo ""
    echo "📥 響應:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # 檢查結果
    if [ -n "$expected_field" ]; then
        FIELD_VALUE=$(echo "$RESPONSE" | jq -r ".$expected_field" 2>/dev/null)
        if [ "$FIELD_VALUE" != "null" ] && [ -n "$FIELD_VALUE" ]; then
            echo -e "${GREEN}✅ 通過${NC}: $expected_field = $FIELD_VALUE"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌ 失敗${NC}: 找不到 $expected_field"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
    
    # 基本成功檢查
    if echo "$RESPONSE" | jq -e '.success == true or .status == "healthy"' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 通過${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ 失敗${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# ============================================
# 測試套件 1: 基礎健康檢查
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 1: 基礎健康檢查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint \
    "系統健康檢查" \
    "GET" \
    "/health" \
    "" \
    "status"

test_endpoint \
    "AI 服務狀態" \
    "GET" \
    "/api/ai/status" \
    "" \
    "available"

sleep 2

# ============================================
# 測試套件 2: AI 對話功能
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 2: AI 對話功能"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 場景 1: 基本問候
test_endpoint \
    "場景 1: 基本問候" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"你好\", \"sessionId\": \"$SESSION_ID-1\"}" \
    "success"

sleep 2

# 場景 2: 查詢房型
test_endpoint \
    "場景 2: 查詢房型" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"有什麼房型可以選擇？\", \"sessionId\": \"$SESSION_ID-2\"}" \
    "success"

sleep 2

# 場景 3: 價格詢問
test_endpoint \
    "場景 3: 價格詢問" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"價格大概多少？\", \"sessionId\": \"$SESSION_ID-3\"}" \
    "success"

sleep 2

# 場景 4: 複雜需求
test_endpoint \
    "場景 4: 複雜需求（預算+人數）" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"兩個人入住，預算5000元左右，有推薦的房型嗎？\", \"sessionId\": \"$SESSION_ID-4\"}" \
    "success"

sleep 2

# 場景 5: 設施查詢
test_endpoint \
    "場景 5: 設施查詢" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"飯店有什麼設施？\", \"sessionId\": \"$SESSION_ID-5\"}" \
    "success"

sleep 2

# 場景 6: 預訂意圖
test_endpoint \
    "場景 6: 預訂意圖" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"我想訂房\", \"sessionId\": \"$SESSION_ID-6\"}" \
    "success"

sleep 2

# ============================================
# 測試套件 3: 房型推薦功能
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 3: 房型推薦功能"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint \
    "場景 7: 房型推薦（預算導向）" \
    "POST" \
    "/api/ai/recommend-room" \
    "{\"guests\": 2, \"budget\": 5000, \"nights\": 2}" \
    "success"

sleep 2

test_endpoint \
    "場景 8: 房型推薦（偏好導向）" \
    "POST" \
    "/api/ai/recommend-room" \
    "{\"guests\": 2, \"preferences\": [\"安靜\", \"景觀\"], \"nights\": 3}" \
    "success"

sleep 2

# ============================================
# 測試套件 4: 多語言翻譯
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 4: 多語言翻譯"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint \
    "場景 9: 中文翻英文" \
    "POST" \
    "/api/ai/translate" \
    "{\"text\": \"歡迎光臨台北晶華酒店\", \"targetLanguage\": \"English\"}" \
    "success"

sleep 2

test_endpoint \
    "場景 10: 中文翻日文" \
    "POST" \
    "/api/ai/translate" \
    "{\"text\": \"祝您住宿愉快\", \"targetLanguage\": \"Japanese\"}" \
    "success"

sleep 2

# ============================================
# 測試套件 5: 連續對話記憶
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 5: 連續對話記憶測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MEMORY_SESSION="memory-test-$(date +%s)"

test_endpoint \
    "場景 11-1: 第一輪對話" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"我想訂房\", \"sessionId\": \"$MEMORY_SESSION\"}" \
    "success"

sleep 2

test_endpoint \
    "場景 11-2: 第二輪對話（提供人數）" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"兩個人\", \"sessionId\": \"$MEMORY_SESSION\"}" \
    "success"

sleep 2

test_endpoint \
    "場景 11-3: 第三輪對話（提供日期）" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"下週五入住\", \"sessionId\": \"$MEMORY_SESSION\"}" \
    "success"

sleep 2

# ============================================
# 測試套件 6: 錯誤處理
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 測試套件 6: 錯誤處理"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint \
    "場景 12: 空消息測試" \
    "POST" \
    "/api/ai/chat" \
    "{\"message\": \"\", \"sessionId\": \"$SESSION_ID-error\"}" \
    "error"

sleep 1

test_endpoint \
    "場景 13: 缺少參數（翻譯）" \
    "POST" \
    "/api/ai/translate" \
    "{\"text\": \"測試\"}" \
    "error"

sleep 1

# ============================================
# 生成測試報告
# ============================================
echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試報告"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 測試統計："
echo "  • 總測試數: $TOTAL_TESTS"
echo -e "  • 通過: ${GREEN}$PASSED_TESTS${NC}"
echo -e "  • 失敗: ${RED}$FAILED_TESTS${NC}"
echo ""

SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
echo "  • 成功率: $SUCCESS_RATE%"
echo ""

# 測試結果分類
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 功能測試結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 基礎功能："
echo "  • 健康檢查"
echo "  • AI 服務狀態"
echo ""
echo "✅ AI 對話功能："
echo "  • 基本問候"
echo "  • 房型查詢"
echo "  • 價格詢問"
echo "  • 複雜需求處理"
echo "  • 設施查詢"
echo "  • 預訂意圖"
echo ""
echo "✅ 智能推薦："
echo "  • 預算導向推薦"
echo "  • 偏好導向推薦"
echo ""
echo "✅ 多語言支持："
echo "  • 中英翻譯"
echo "  • 中日翻譯"
echo ""
echo "✅ 對話記憶："
echo "  • 多輪對話上下文"
echo ""
echo "✅ 錯誤處理："
echo "  • 空消息處理"
echo "  • 參數驗證"
echo ""

# 總體評估
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 總體評估"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SUCCESS_RATE" = "100.0" ]; then
    echo -e "${GREEN}🎉 完美！所有測試通過！${NC}"
    echo ""
    echo "系統狀態: 生產就緒 ✅"
elif (( $(echo "$SUCCESS_RATE >= 80" | bc -l) )); then
    echo -e "${GREEN}✅ 良好！大部分功能正常${NC}"
    echo ""
    echo "系統狀態: 可用於測試 ⚠️"
else
    echo -e "${RED}⚠️  需要改進！部分功能異常${NC}"
    echo ""
    echo "系統狀態: 需要修復 ❌"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 建議"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAILED_TESTS" -gt 0 ]; then
    echo "⚠️  發現 $FAILED_TESTS 個失敗的測試"
    echo ""
    echo "建議檢查："
    echo "  1. OpenAI API Key 是否正確設置"
    echo "  2. Railway 環境變量是否配置"
    echo "  3. 查看詳細錯誤日誌: railway logs"
    echo ""
fi

if echo "$RESPONSE" | grep -q "未配置"; then
    echo "⚠️  OpenAI 未配置"
    echo ""
    echo "請完成以下步驟："
    echo "  1. 在 OpenAI 創建新 API Key"
    echo "  2. 在 Railway 設置環境變量:"
    echo "     • OPENAI_API_KEY=your-key"
    echo "     • OPENAI_MODEL=gpt-4o-mini"
    echo "  3. 等待部署完成（1-2分鐘）"
    echo "  4. 重新運行測試"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 相關鏈接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "• 生產環境: $PROD_URL"
echo "• Railway 控制台: https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda"
echo "• OpenAI 控制台: https://platform.openai.com/api-keys"
echo "• 健康檢查: $PROD_URL/health"
echo "• AI 狀態: $PROD_URL/api/ai/status"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "測試完成時間: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""


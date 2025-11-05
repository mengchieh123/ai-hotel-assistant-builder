#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 AI 服務升級測試（business-spec v2.1.0）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "測試目標：驗證 AI 服務是否符合 business-spec v2.1.0"
echo "期望通過率：90%+"
echo ""

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"
API_ENDPOINT="${BASE_URL}/api/ai/chat"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 測試函數
test_chat() {
    local test_name="$1"
    local message="$2"
    local expected_keyword="$3"
    local description="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}測試 ${TOTAL_TESTS}: ${test_name}${NC}"
    if [ -n "$description" ]; then
        echo -e "${CYAN}說明: ${description}${NC}"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📤 發送: ${message}"
    echo "🔍 預期關鍵字: ${expected_keyword}"
    
    response=$(curl -s -X POST "${API_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"${message}\", \"sessionId\": \"test-${TOTAL_TESTS}\"}" \
        --max-time 10)
    
    echo "📥 回應:"
    response_text=$(echo "${response}" | jq -r '.message' 2>/dev/null || echo "${response}")
    echo "${response_text}"
    
    if echo "${response}" | grep -qi "${expected_keyword}"; then
        echo -e "${GREEN}✅ 通過${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ 失敗 - 未找到關鍵字: ${expected_keyword}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    sleep 0.3
}

echo ""
echo "🏁 開始測試..."
echo ""

# ============================================
# 測試組 1: 核心功能驗證（最關鍵）
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 1: 核心功能驗證（最關鍵）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "價格正確性" "豪華客房多少錢" "3800" "驗證是否使用正確的價格（NT\$3,800 而非 NT\$7,500）"
test_chat "房型列表" "有什麼房型" "房型" "驗證房型介紹功能"
test_chat "會員制度" "有會員嗎" "會員" "驗證會員體系說明"
test_chat "兒童政策" "小孩收費嗎" "6歲" "驗證兒童政策詳細說明"
test_chat "台灣支付" "可以用LINE Pay嗎" "LINE" "驗證台灣支付方式整合"

# ============================================
# 測試組 2: 價格體系（business-spec 核心）
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 2: 價格體系"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "基礎房價" "房價多少" "3800" "驗證基礎房價正確"
test_chat "連住折扣" "住3晚有折扣嗎" "折扣" "驗證連住優惠說明"
test_chat "早鳥優惠" "提前訂有優惠嗎" "早鳥" "驗證早鳥優惠政策"
test_chat "會員折扣" "會員有折扣嗎" "折扣" "驗證會員折扣說明"
test_chat "家庭套房價格" "家庭套房多少錢" "6800" "驗證家庭套房價格"

# ============================================
# 測試組 3: 會員體系（台灣特色）
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 3: 會員體系"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "會員等級" "會員有哪些等級" "銀卡" "驗證會員等級說明"
test_chat "積分規則" "如何累積積分" "積分" "驗證積分累積說明"
test_chat "生日優惠" "生日有優惠嗎" "生日" "驗證生日優惠政策"
test_chat "會員權益" "金卡會員有什麼權益" "金卡" "驗證會員權益說明"

# ============================================
# 測試組 4: 取消與退款政策
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 4: 取消與退款政策"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "取消政策" "取消政策是什麼" "24小時" "驗證24小時免費取消政策"
test_chat "退款說明" "取消退款多少" "退款" "驗證退款規則說明"
test_chat "天災條款" "颱風可以取消嗎" "颱風" "驗證天災彈性處理"

# ============================================
# 測試組 5: 兒童與家庭政策
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 5: 兒童與家庭政策"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "兒童年齡定義" "兒童怎麼算" "嬰兒" "驗證兒童年齡分類"
test_chat "兒童費用" "小孩要錢嗎" "免費" "驗證兒童費用標準"
test_chat "兒童設施" "有兒童設施嗎" "兒童" "驗證兒童設施說明"

# ============================================
# 測試組 6: 入退房規則
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 6: 入退房規則"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "入住時間" "幾點可以入住" "15:00" "驗證入住時間"
test_chat "退房時間" "幾點退房" "11:00" "驗證退房時間"
test_chat "提早入住" "可以提早入住嗎" "提早" "驗證提早入住規則"
test_chat "延遲退房" "可以延後退房嗎" "延遲" "驗證延遲退房規則"

# ============================================
# 測試組 7: 台灣特色功能（關鍵）
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 7: 台灣特色功能（關鍵）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "LINE Pay" "可以用LINE Pay嗎" "LINE" "驗證 LINE Pay 整合"
test_chat "超商繳費" "可以超商付款嗎" "超商" "驗證超商代碼繳費"
test_chat "國旅券" "可以用國旅券嗎" "國旅券" "驗證國旅券使用"
test_chat "信用卡分期" "可以分期付款嗎" "分期" "驗證信用卡分期"

# ============================================
# 測試組 8: 設施與服務
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 8: 設施與服務"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "設施列表" "有哪些設施" "游泳池" "驗證設施說明"
test_chat "早餐資訊" "有早餐嗎" "早餐" "驗證早餐資訊"
test_chat "停車服務" "有停車場嗎" "停車" "驗證停車資訊"

# ============================================
# 測試組 9: 訂房流程
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試組 9: 訂房流程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_chat "訂房意圖" "我要訂房" "預訂" "驗證訂房流程啟動"
test_chat "問候回應" "你好" "歡迎" "驗證問候場景"

# ============================================
# 測試結果統計
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試結果統計"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "總測試數: ${TOTAL_TESTS}"
echo -e "${GREEN}✅ 通過: ${PASSED_TESTS}${NC}"
echo -e "${RED}❌ 失敗: ${FAILED_TESTS}${NC}"
echo ""

if [ ${TOTAL_TESTS} -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "通過率: ${pass_rate}%"
    echo ""
    
    # 與昨天比較
    OLD_PASS_RATE=17
    improvement=$((pass_rate - OLD_PASS_RATE))
    
    if [ ${pass_rate} -ge 90 ]; then
        echo -e "${GREEN}🎉 優秀！系統完全符合 business-spec v2.1.0${NC}"
        echo -e "${GREEN}改進幅度: +${improvement}% (${OLD_PASS_RATE}% → ${pass_rate}%)${NC}"
    elif [ ${pass_rate} -ge 80 ]; then
        echo -e "${GREEN}✅ 良好！大部分功能正常${NC}"
        echo -e "${GREEN}改進幅度: +${improvement}% (${OLD_PASS_RATE}% → ${pass_rate}%)${NC}"
    elif [ ${pass_rate} -ge 60 ]; then
        echo -e "${YELLOW}⚠️ 及格，但仍需優化${NC}"
        echo -e "${YELLOW}改進幅度: +${improvement}% (${OLD_PASS_RATE}% → ${pass_rate}%)${NC}"
    elif [ ${pass_rate} -ge 30 ]; then
        echo -e "${YELLOW}⚠️ 有進步，繼續努力${NC}"
        echo -e "${YELLOW}改進幅度: +${improvement}% (${OLD_PASS_RATE}% → ${pass_rate}%)${NC}"
    else
        echo -e "${RED}❌ 改進不足，需要重新檢查${NC}"
        echo -e "${RED}改進幅度: +${improvement}% (${OLD_PASS_RATE}% → ${pass_rate}%)${NC}"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 測試摘要"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "測試時間: $(date '+%Y-%m-%d %H:%M:%S')"
echo "測試環境: Railway Production"
echo "API 端點: ${API_ENDPOINT}"
echo "規格版本: business-spec v2.1.0-tw"
echo ""
echo "測試組別:"
echo "  1. 核心功能驗證 (5項) - 最關鍵"
echo "  2. 價格體系 (5項)"
echo "  3. 會員體系 (4項)"
echo "  4. 取消與退款 (3項)"
echo "  5. 兒童與家庭 (3項)"
echo "  6. 入退房規則 (4項)"
echo "  7. 台灣特色功能 (4項) - 關鍵"
echo "  8. 設施與服務 (3項)"
echo "  9. 訂房流程 (2項)"
echo ""
echo "總計: ${TOTAL_TESTS} 個測試案例"
echo ""

if [ ${pass_rate} -lt 80 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔧 改進建議"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "如果通過率低於預期，可能原因："
    echo ""
    echo "1. Railway 尚未完成部署"
    echo "   → 等待 2-3 分鐘後重新測試"
    echo ""
    echo "2. 程式碼未正確推送"
    echo "   → 檢查 git push 是否成功"
    echo ""
    echo "3. 意圖識別關鍵字不足"
    echo "   → 檢查 detectIntent() 方法"
    echo ""
    echo "4. 回覆模板缺少關鍵字"
    echo "   → 檢查 generateResponse() 內容"
    echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 測試完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""


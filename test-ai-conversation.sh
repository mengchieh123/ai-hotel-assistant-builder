#!/bin/bash

API="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "�� AI 訂房助理對話能力測試"
echo "=========================================="
echo ""

# 測試函數
test_conversation() {
    local number=$1
    local scenario=$2
    local message=$3
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "測試 $number: $scenario"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "👤 用戶: $message"
    echo ""
    
    RESPONSE=$(curl -s -X POST "$API/api/ai/chat" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$message\"}")
    
    if [ $? -eq 0 ] && [ -n "$RESPONSE" ]; then
        INTENT=$(echo "$RESPONSE" | jq -r '.intent' 2>/dev/null)
        MESSAGE=$(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)
        
        echo "🤖 AI 助理 (意圖: $INTENT):"
        echo "$MESSAGE"
        echo ""
        
        # 檢查關鍵字
        if echo "$MESSAGE" | grep -q "3,800"; then
            echo "   ✅ 價格顯示正確 (NT\$3,800)"
        fi
        
        if [ "$INTENT" = "price" ] && echo "$message" | grep -qi "價格\|多少錢"; then
            echo "   ✅ 意圖識別正確"
        elif [ "$INTENT" = "booking" ] && echo "$message" | grep -qi "訂房"; then
            echo "   ✅ 意圖識別正確"
        elif [ "$INTENT" = "facility" ] && echo "$message" | grep -qi "設施"; then
            echo "   ✅ 意圖識別正確"
        fi
    else
        echo "   ❌ 請求失敗"
    fi
    
    echo ""
    sleep 1
}

# 執行對話測試
echo "開始對話測試..."
echo ""

# 1. 價格查詢
test_conversation "1" "價格查詢" "豪華客房多少錢"

# 2. 訂房意圖
test_conversation "2" "訂房意圖" "我想訂房"

# 3. 設施詢問
test_conversation "3" "設施詢問" "飯店有什麼設施"

# 4. 早餐詢問
test_conversation "4" "早餐詢問" "早餐幾點開始"

# 5. 加床詢問
test_conversation "5" "加床詢問" "可以加床嗎"

# 6. 取消政策
test_conversation "6" "取消政策" "訂房可以取消嗎"

# 7. 房型比較
test_conversation "7" "房型比較" "豪華客房和行政客房有什麼差別"

# 8. 促銷優惠
test_conversation "8" "促銷優惠" "現在有什麼優惠嗎"

# 9. 一般問候
test_conversation "9" "一般問候" "你好"

# 10. 複雜查詢
test_conversation "10" "複雜查詢" "我要訂兩晚豪華客房，兩位大人一位小孩，需要加床和早餐"

echo "=========================================="
echo "✅ 對話測試完成"
echo "=========================================="
echo ""
echo "📊 測試統計："
echo "   總測試數: 10 個場景"
echo "   涵蓋意圖: 價格、訂房、設施、政策、問候"
echo ""
echo "🎯 下一步："
echo "   如果對話功能正常，再修復前端測試頁面"


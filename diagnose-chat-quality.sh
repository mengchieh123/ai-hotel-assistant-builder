#!/bin/bash

echo "🔍 AI 對話質量診斷測試"
echo "========================"

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"
SESSION_ID="diagnose-$(date +%s)"

echo "📋 測試配置:"
echo "  • 服務器: $BASE_URL"
echo "  • Session ID: $SESSION_ID"
echo ""

# 測試 1: 基礎理解能力
echo "1. 🧠 基礎理解測試"
echo "-----------------"

basic_tests=(
  "你好"
  "你們酒店在哪裡"
  "有什麼設施"
  "價格多少"
  "如何預訂"
)

for test in "${basic_tests[@]}"; do
  echo "  測試: \"$test\""
  response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$test\", \"sessionId\": \"$SESSION_ID\"}")
  
  success=$(echo "$response" | jq -r '.success')
  reply=$(echo "$response" | jq -r '.reply')
  reply_length=${#reply}
  
  echo "  成功: $success"
  echo "  回應長度: $reply_length"
  echo "  回應內容: $reply"
  
  # 質量評估
  if [ "$success" = "true" ] && [ "$reply_length" -gt 10 ]; then
    if [[ "$reply" == *"酒店"* || "$reply" == *"房"* || "$reply" == *"預訂"* ]]; then
      echo "  ✅ 相關性: 良好"
    else
      echo "  ⚠️  相關性: 可能偏離主題"
    fi
  else
    echo "  ❌ 基礎理解: 失敗"
  fi
  echo ""
done

# 測試 2: 上下文理解
echo ""
echo "2. 🔄 上下文理解測試"
echo "-----------------"

context_tests=(
  "我想訂房"
  "兩個人"
  "住三晚"
  "預算5000元"
  "有海景房嗎"
)

for i in "${!context_tests[@]}"; do
  echo "  第$((i+1))輪: \"${context_tests[i]}\""
  response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"${context_tests[i]}\", \"sessionId\": \"$SESSION_ID\"}")
  
  reply=$(echo "$response" | jq -r '.reply')
  echo "  回應: $reply"
  
  # 檢查上下文連貫性
  if [ $i -gt 0 ]; then
    if [[ "$reply" == *"人"* || "$reply" == *"晚"* || "$reply" == *"預算"* || "$reply" == *"海景"* ]]; then
      echo "  ✅ 上下文: 有記憶"
    else
      echo "  ⚠️  上下文: 可能遺失"
    fi
  fi
  echo ""
done

# 測試 3: 意圖識別
echo ""
echo "3. 🎯 意圖識別測試"
echo "-----------------"

intent_tests=(
  "我想要一個安靜的房間"
  "有適合商務旅客的設施嗎"
  "帶小孩入住有什麼要注意的"
  "可以延遲退房嗎"
  "附近有什麼好吃的"
)

for test in "${intent_tests[@]}"; do
  echo "  意圖測試: \"$test\""
  response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$test\", \"sessionId\": \"$SESSION_ID\"}")
  
  reply=$(echo "$response" | jq -r '.reply')
  echo "  識別回應: $reply"
  
  # 意圖匹配評估
  case "$test" in
    *"安靜"*)
      if [[ "$reply" == *"安靜"* || "$reply" == *"寧靜"* || "$reply" == *"隔音"* ]]; then
        echo "  ✅ 意圖識別: 安靜需求 - 成功"
      else
        echo "  ❌ 意圖識別: 安靜需求 - 失敗"
      fi
      ;;
    *"商務"*)
      if [[ "$reply" == *"商務"* || "$reply" == *"會議"* || "$reply" == *"辦公"* ]]; then
        echo "  ✅ 意圖識別: 商務需求 - 成功"
      else
        echo "  ❌ 意圖識別: 商務需求 - 失敗"
      fi
      ;;
    *"小孩"*)
      if [[ "$reply" == *"小孩"* || "$reply" == *"兒童"* || "$reply" == *"家庭"* ]]; then
        echo "  ✅ 意圖識別: 親子需求 - 成功"
      else
        echo "  ❌ 意圖識別: 親子需求 - 失敗"
      fi
      ;;
    *"退房"*)
      if [[ "$reply" == *"退房"* || "$reply" == *"check out"* || "$reply" == *"延遲"* ]]; then
        echo "  ✅ 意圖識別: 退房需求 - 成功"
      else
        echo "  ❌ 意圖識別: 退房需求 - 失敗"
      fi
      ;;
    *"好吃"*)
      if [[ "$reply" == *"餐廳"* || "$reply" == *"美食"* || "$reply" == *"吃的"* ]]; then
        echo "  ✅ 意圖識別: 餐飲需求 - 成功"
      else
        echo "  ❌ 意圖識別: 餐飲需求 - 失敗"
      fi
      ;;
  esac
  echo ""
done

# 測試 4: 問題解決能力
echo ""
echo "4. 💡 問題解決測試"
echo "-----------------"

problem_tests=(
  "我明天要入住，但預算只有2000元，有什麼推薦"
  "我們有3個大人2個小孩，需要兩間房還是可以住一間"
  "我要辦生日派對，酒店可以協助安排嗎"
  "我的航班很晚到，可以安排接機嗎"
  "對堅果過敏，餐廳要注意什麼"
)

for test in "${problem_tests[@]}"; do
  echo "  問題: \"$test\""
  response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$test\", \"sessionId\": \"$SESSION_ID\"}")
  
  reply=$(echo "$response" | jq -r '.reply')
  echo "  解決方案: $reply"
  
  # 解決方案質量評估
  reply_length=${#reply}
  if [ "$reply_length" -gt 50 ]; then
    echo "  ✅ 詳細度: 充足"
  else
    echo "  ⚠️  詳細度: 不足"
  fi
  
  if [[ "$reply" == *"推薦"* || "$reply" == *"建議"* || "$reply" == *"可以"* || "$reply" == *"安排"* ]]; then
    echo "  ✅ 實用性: 有具體建議"
  else
    echo "  ⚠️  實用性: 建議不明確"
  fi
  echo ""
done

# 測試 5: 邊界案例
echo ""
echo "5. ⚠️  邊界案例測試"
echo "-----------------"

edge_tests=(
  "我不知道要問什麼"
  "隨便推薦"
  "最貴的房間"
  "今天天氣怎麼樣"
  "講個笑話來聽聽"
)

for test in "${edge_tests[@]}"; do
  echo "  邊界測試: \"$test\""
  response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"$test\", \"sessionId\": \"$SESSION_ID\"}")
  
  reply=$(echo "$response" | jq -r '.reply')
  echo "  處理方式: $reply"
  
  # 邊界處理評估
  if [[ "$reply" == *"酒店"* || "$reply" == *"房"* || "$reply" == *"服務"* ]]; then
    echo "  ✅ 主題保持: 良好"
  else
    echo "  ⚠️  主題保持: 偏離"
  fi
  echo ""
done

echo "🎯 診斷總結"
echo "============"
echo "請檢查以上測試結果，特別注意："
echo "• ❌ 標記的失敗項目"
echo "• ⚠️  標記的警告項目"
echo "• 回應的相關性和實用性"

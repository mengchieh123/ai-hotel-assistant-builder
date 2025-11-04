#!/bin/bash

echo "📝 提示詞工程測試"
echo "================="

BASE_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

# 測試不同類型的提示詞
prompt_tests=(
    "你是一個專業的酒店客服，請用專業的語氣回答客戶問題"
    "請用簡潔明了的方式回答，不要太多廢話"
    "請詳細說明每個房型的特色和適合的客戶群"
    "請用親切友好的語氣，像朋友一樣給建議"
    "請專注於酒店相關問題，不要回答無關內容"
)

for prompt in "${prompt_tests[@]}"; do
    echo "提示詞: $prompt"
    echo "問題: 你們有什麼房型？"
    
    response=$(curl -s -X POST "$BASE_URL/api/ai/chat" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$prompt\n\n問題: 你們有什麼房型？\", \"sessionId\": \"prompt-test\"}")
    
    reply=$(echo "$response" | jq -r '.reply')
    echo "回應: $reply"
    echo "長度: ${#reply} 字符"
    echo "---"
done

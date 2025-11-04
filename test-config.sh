#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 檢查 OpenAI 配置狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 測試 AI 狀態端點
echo "1️⃣  測試生產環境 AI 狀態..."
echo ""
RESPONSE=$(curl -s https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/status)

echo "📥 響應："
echo "$RESPONSE" | jq .

# 檢查狀態
AVAILABLE=$(echo "$RESPONSE" | jq -r '.available')

echo ""
if [ "$AVAILABLE" = "true" ]; then
    echo "✅ OpenAI API Key 已正確配置！"
    echo ""
    echo "🎉 系統完全就緒！可以開始測試對話功能。"
    echo ""
    echo "測試對話："
    echo "  curl -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"message\": \"你好\", \"sessionId\": \"test-001\"}'"
    echo ""
elif [ "$AVAILABLE" = "false" ]; then
    echo "⚠️  OpenAI API Key 尚未配置"
    echo ""
    echo "請完成以下步驟："
    echo ""
    echo "1. 訪問 Railway Dashboard："
    echo "   https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda"
    echo ""
    echo "2. 點擊服務 -> Variables 標籤"
    echo ""
    echo "3. 添加環境變量："
    echo "   Name:  OPENAI_API_KEY"
    echo "   Value: sk-proj-YOUR-KEY-HERE"
    echo ""
    echo "   Name:  OPENAI_MODEL"
    echo "   Value: gpt-4o-mini"
    echo ""
    echo "4. 保存後等待 60 秒重新部署"
    echo ""
    echo "5. 重新運行此測試: ./test-config.sh"
    echo ""
else
    echo "❌ 無法獲取狀態"
    echo ""
    echo "請檢查："
    echo "  1. 網絡連接是否正常"
    echo "  2. 生產環境是否部署成功"
    echo "  3. Railway Dashboard 查看部署狀態"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "完成時間: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


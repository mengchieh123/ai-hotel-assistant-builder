#!/bin/bash

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "🔄 等待新部署完成並測試（最多嘗試 6 次）"
echo "============================================"

for i in {1..6}; do
  echo ""
  echo "📊 測試 #$i (等待 15 秒)"
  sleep 15
  
  # 檢查服務版本
  HEALTH=$(curl -s "$RAILWAY_URL/health")
  VERSION=$(echo "$HEALTH" | jq -r '.version // "unknown"')
  UPTIME=$(echo "$HEALTH" | jq -r '.uptime // 0')
  
  echo "   版本: $VERSION"
  echo "   運行時間: ${UPTIME}秒"
  
  # 測試價格
  RESPONSE=$(curl -s -X POST "$RAILWAY_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"豪華客房價格"}')
  
  if echo "$RESPONSE" | grep -q "3,800"; then
    echo ""
    echo "🎉 ✅ 成功！價格已更新到 NT\$3,800"
    echo ""
    echo "完整回應:"
    echo "$RESPONSE" | jq '.message'
    exit 0
  elif echo "$RESPONSE" | grep -q "7,500"; then
    echo "   ⏳ 仍是舊版本 (NT\$7,500)，繼續等待..."
  else
    echo "   ⚠️  無法取得價格資訊"
  fi
done

echo ""
echo "❌ 等待超時，價格仍未更新"
echo "💡 建議檢查 Railway Dashboard 的部署狀態"


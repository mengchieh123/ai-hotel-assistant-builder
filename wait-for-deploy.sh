#!/bin/bash

echo "⏳ 等待 CORS 修復部署完成"
echo "========================"

RAILWAY_URL="https://ai-hotel-assistant-builder-production.up.railway.app"

echo "部署時間: $(date)"
echo "預計等待: 2-3 分鐘"
echo ""

for i in {1..12}; do
    echo "⏰ 等待第 $i 次檢查 (15秒間隔)..."
    sleep 15
    
    # 檢查服務版本
    VERSION=$(curl -s --max-time 5 "$RAILWAY_URL/health" | jq -r '.version' 2>/dev/null)
    
    if [ "$VERSION" = "4.3.0-CORS-FIXED" ]; then
        echo ""
        echo "🎉 ✅ CORS 修復版本已上線!"
        echo "版本: $VERSION"
        echo "時間: $(date)"
        echo ""
        echo "🚀 現在可以測試頁面了!"
        exit 0
    elif [ -n "$VERSION" ]; then
        echo "   當前版本: $VERSION (等待 CORS 修復版本...)"
    else
        echo "   服務部署中..."
    fi
done

echo ""
echo "⚠️  部署可能還在進行中，但可以開始測試了"
echo "訪問: https://psychic-spoon-p4wgg4x6g5vc6vg5-8000.app.github.dev/bulletproof-test.html"

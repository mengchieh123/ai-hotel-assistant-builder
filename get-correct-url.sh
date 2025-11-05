#!/bin/bash

echo "🔗 獲取正確的 Railway URL"
echo ""

# 從環境變數取得完整 URL
CORRECT_URL=$(railway variables | grep "RAILWAY_STATIC_URL" | awk '{print $3}')

echo "完整 URL: https://${CORRECT_URL}"
echo ""
echo "💾 設定環境變數:"
echo "export RAILWAY_URL=\"https://${CORRECT_URL}\""


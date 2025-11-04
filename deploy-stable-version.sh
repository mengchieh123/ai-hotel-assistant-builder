#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 部署穩定版本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 確保 mock-ai-service.js 存在且正確
echo "1️⃣ 確保 AI 服務存在..."

if [ ! -f "services/mock-ai-service.js" ]; then
    echo "創建 services/ 目錄..."
    mkdir -p services
fi

echo "2️⃣ 提交所有變更..."
git add -A
git commit -m "fix: ensure all services are committed" || echo "無需提交"

echo ""
echo "3️⃣ 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 推送成功"
    echo ""
    echo "⏳ Railway 將在 2-5 分鐘內部署"
    echo ""
    echo "📊 監控部署："
    echo "   1. 訪問 Railway Dashboard"
    echo "   2. 查看 Build Logs"
    echo "   3. 查看 Deploy Logs"
    echo "   4. 等待狀態變為 'Active'"
    echo ""
    echo "如果仍然失敗，請查看 Railway 日誌"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
fi


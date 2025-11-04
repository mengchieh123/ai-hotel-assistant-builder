#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 檢查當前服務狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 檢查 Railway 部署日誌
echo "1️⃣  檢查 Railway 部署狀態..."
railway logs --tail 20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  檢查服務健康狀態..."
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/health | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  檢查 AI 狀態端點..."
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/status | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 問題診斷"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "如果仍顯示 OpenAI 錯誤，可能原因："
echo "  1. Railway 使用了緩存的舊代碼"
echo "  2. 環境變量未清除 OPENAI_API_KEY"
echo "  3. 需要手動重啟服務"
echo ""
echo "解決方案："
echo "  A. 在 Railway Dashboard 手動重啟服務"
echo "  B. 或清除 OPENAI_API_KEY 環境變量"
echo ""
echo "執行以下命令清除 OpenAI Key："
echo "  railway variables delete OPENAI_API_KEY"
echo ""


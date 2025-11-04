#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 診斷問題並修復"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣ 檢查本地代碼狀態..."
echo ""

if [ -f "services/mock-ai-service.js" ]; then
    echo "✅ mock-ai-service.js 存在"
    echo "   檢查內容..."
    if grep -q "detectIntent" services/mock-ai-service.js; then
        echo "   ✅ 包含 detectIntent 方法"
    else
        echo "   ❌ 缺少 detectIntent 方法"
    fi
    
    if grep -q "membership" services/mock-ai-service.js; then
        echo "   ✅ 包含會員相關代碼"
    else
        echo "   ❌ 缺少會員相關代碼"
    fi
else
    echo "❌ mock-ai-service.js 不存在"
fi

echo ""
echo "2️⃣ 檢查 Git 狀態..."
git status

echo ""
echo "3️⃣ 檢查是否有未推送的變更..."
git log origin/main..HEAD --oneline

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 問題診斷"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 檢查是否需要推送
UNPUSHED=$(git log origin/main..HEAD --oneline | wc -l)

if [ "$UNPUSHED" -gt 0 ]; then
    echo "⚠️ 發現 ${UNPUSHED} 個未推送的提交"
    echo ""
    echo "解決方案：推送到 GitHub"
    echo "   git push origin main"
    echo ""
elif [ ! -f "services/mock-ai-service.js" ]; then
    echo "⚠️ mock-ai-service.js 文件不存在"
    echo ""
    echo "解決方案：重新創建文件"
    echo ""
else
    echo "⚠️ 代碼可能未正確更新"
    echo ""
    echo "可能原因："
    echo "1. Railway 部署失敗"
    echo "2. 代碼未正確推送"
    echo "3. 文件內容不正確"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 建議操作"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "方案 1: 重新創建並推送 AI 服務"
echo "   執行: bash fix-ai-intent-recognition.sh"
echo ""
echo "方案 2: 檢查 Railway 部署日誌"
echo "   訪問: https://railway.app/dashboard"
echo ""
echo "方案 3: 手動檢查文件"
echo "   cat services/mock-ai-service.js | head -50"
echo ""


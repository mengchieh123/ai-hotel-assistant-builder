#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 Git 狀態並推送"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣ 查看當前狀態..."
git status

echo ""
echo "2️⃣ 暫存所有變更..."
git add .

echo ""
echo "3️⃣ 提交變更..."
git commit -m "feat: Taiwan-optimized business-spec v2.0-tw with complete features"

echo ""
echo "4️⃣ 拉取遠端變更（允許不相關歷史）..."
git pull origin main --allow-unrelated-histories --no-rebase

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️ 有合併衝突，自動解決..."
    
    # 如果有衝突，保留本地版本
    if [ -f "speckit/business-spec.yaml" ]; then
        git checkout --ours speckit/business-spec.yaml
        git add speckit/business-spec.yaml
    fi
    
    echo ""
    echo "繼續合併..."
    git commit --no-edit
fi

echo ""
echo "5️⃣ 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 成功推送！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔗 查看文件："
    echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder/blob/main/speckit/business-spec.yaml"
    echo ""
    echo "📊 台灣優化版特色："
    echo "   • LINE 生態系整合"
    echo "   • 台灣支付方式"
    echo "   • 政府補助整合"
    echo "   • 家庭友善政策"
    echo "   • 天災應變機制"
    echo "   • OTA 平台比較"
    echo ""
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ 推送失敗"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "最後手段 - 強制推送（⚠️ 慎用）："
    echo "   git push origin main --force"
    echo ""
    echo "或聯繫我提供更多協助"
    echo ""
fi


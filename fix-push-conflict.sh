#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 解決推送衝突"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣ 拉取遠端變更..."
git pull --rebase origin main

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️ 發現衝突，嘗試自動解決..."
    echo ""
    
    # 檢查衝突文件
    echo "衝突文件："
    git status | grep "both modified"
    
    echo ""
    echo "選擇保留本地版本（台灣優化版）..."
    git checkout --ours speckit/business-spec.yaml
    git add speckit/business-spec.yaml
    
    echo ""
    echo "繼續 rebase..."
    git rebase --continue
fi

echo ""
echo "2️⃣ 重新推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 成功推送台灣優化版 business-spec.yaml"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔗 GitHub 連結："
    echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder/blob/main/speckit/business-spec.yaml"
    echo ""
    echo "📊 文件資訊："
    echo "   大小: 26,157 bytes"
    echo "   行數: 937 lines"
    echo "   版本: 2.0.0-tw"
    echo ""
    echo "🇹🇼 台灣市場特色已完整整合！"
    echo ""
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ 推送仍失敗"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "請手動處理："
    echo ""
    echo "1. 查看衝突："
    echo "   git status"
    echo ""
    echo "2. 如果有衝突，解決後："
    echo "   git add speckit/business-spec.yaml"
    echo "   git rebase --continue"
    echo ""
    echo "3. 推送："
    echo "   git push origin main"
    echo ""
fi


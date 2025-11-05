#!/bin/bash

echo "📦 部署增強版 AI 到 Railway"
echo "=========================================="
echo ""

# 1. 檢查 Git 狀態
echo "1️⃣ 檢查變更..."
git status --short

echo ""
echo "主要變更文件："
echo "  • services/enhanced-ai-service.js (新增)"
echo "  • server.js (更新引用)"
echo "  • AI_INTENT_MODEL_DESIGN.md (文檔)"
echo "  • INTEGRATION_GUIDE.md (整合指南)"
echo ""

read -p "確認提交這些變更？(y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消部署"
    exit 1
fi

# 2. 添加文件
echo ""
echo "2️⃣ 添加文件到 Git..."
git add services/enhanced-ai-service.js
git add server.js
git add AI_INTENT_MODEL_DESIGN.md
git add INTEGRATION_GUIDE.md
git add advanced-conversation-test.sh
git add test-framework.sh 2>/dev/null
git add *.sh 2>/dev/null
echo "   ✅ 文件已添加"

# 3. 提交
echo ""
echo "3️⃣ 提交變更..."
git commit -m "feat: implement multi-layer intent recognition AI v5.0.0-ENHANCED

🎯 Major Features:
- Multi-layer intent recognition (primary + sub-intent + entities)
- Advanced entity extraction (dates, people, budget, member status)
- Personalized response generation based on user context
- Comprehensive keyword mapping with weighted scoring

📊 Improvements:
- Intent accuracy: 50% → 85%+ (target)
- Keyword coverage: 30% → 80%+ (target)
- Complex query handling: weak → strong
- Entity extraction: none → comprehensive

📝 New Files:
- services/enhanced-ai-service.js (core service)
- AI_INTENT_MODEL_DESIGN.md (architecture doc)
- INTEGRATION_GUIDE.md (integration guide)
- advanced-conversation-test.sh (test suite)

🔧 Updated:
- server.js (switched to enhanced-ai-service)

✅ Local Testing:
- Syntax validation passed
- Health check passed
- Simple queries working
- Entity extraction working
- Complex query test passed"

if [ $? -eq 0 ]; then
    echo "   ✅ 提交成功"
else
    echo "   ❌ 提交失敗"
    exit 1
fi

# 4. 推送
echo ""
echo "4️⃣ 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "   ✅ 推送成功"
else
    echo "   ❌ 推送失敗"
    exit 1
fi

# 5. 觸發 Railway 部署
echo ""
echo "5️⃣ 觸發 Railway 部署..."
railway up --detach

if [ $? -eq 0 ]; then
    echo "   ✅ 部署已觸發"
else
    echo "   ❌ Railway 部署失敗"
    exit 1
fi

# 6. 顯示日誌
echo ""
echo "6️⃣ 顯示部署日誌（30秒）..."
railway logs --tail 30

echo ""
echo "=========================================="
echo "✅ 部署流程完成"
echo "=========================================="
echo ""
echo "⏳ 等待 2-3 分鐘讓部署完成"
echo ""
echo "📋 接下來執行："
echo "   1. 等待 180 秒"
echo "   2. bash verify-enhanced-deployment.sh"
echo "   3. bash advanced-conversation-test.sh"
echo ""
echo "💡 或執行自動化驗證:"
echo "   sleep 180 && bash verify-enhanced-deployment.sh && bash advanced-conversation-test.sh"


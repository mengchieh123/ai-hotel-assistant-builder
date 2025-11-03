#!/bin/bash

echo "🔧 修复 Git 推送冲突..."

# 保存当前更改
echo "1. 保存当前更改..."
git add .

# 拉取远程更改
echo "2. 拉取远程更改..."
if git pull origin main --no-rebase; then
    echo "✅ 拉取成功"
else
    echo "❌ 拉取冲突，尝试其他策略..."
    # 备份当前更改
    git stash
    git pull origin main
    git stash pop
    # 解决冲突
    git add .
fi

# 提交合并
echo "3. 提交合并..."
git commit -m "fix: merge remote changes for Railway deployment"

# 推送
echo "4. 推送到 GitHub..."
if git push origin main; then
    echo "✅ 推送成功！"
    echo ""
    echo "🚀 部署已触发！"
    echo "📍 查看部署进度："
    echo "   GitHub Actions: https://github.com/mengchieh123/ai-hotel-assistant-builder/actions"
    echo "   Railway Dashboard: https://railway.com/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda"
else
    echo "❌ 推送失败，请手动解决冲突"
fi

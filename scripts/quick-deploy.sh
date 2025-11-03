#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 快速部署到 Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 当前分支: $CURRENT_BRANCH"

# 检查未提交的更改
if [[ -n $(git status -s) ]]; then
    echo ""
    echo "📝 检测到未提交的更改："
    git status -s
    echo ""
    read -p "是否提交这些更改？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "输入提交信息: " COMMIT_MSG
        git add .
        git commit -m "$COMMIT_MSG"
        echo "✅ 更改已提交"
    else
        echo "⚠️  跳过提交，将部署现有代码"
    fi
fi

# 推送到 GitHub
echo ""
echo "⬆️  推送到 GitHub..."
git push origin $CURRENT_BRANCH

if [ $? -eq 0 ]; then
    echo "✅ 推送成功"
else
    echo "❌ 推送失败"
    exit 1
fi

# 等待 GitHub Actions
echo ""
echo "⏳ GitHub Actions 将自动触发部署..."
echo "🔗 查看进度: https://github.com/mengchieh123/ai-hotel-assistant-builder/actions"
echo ""
echo "💡 提示: 部署通常需要 2-3 分钟完成"
echo ""

read -p "是否打开 GitHub Actions 页面？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 尝试在浏览器中打开
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://github.com/mengchieh123/ai-hotel-assistant-builder/actions"
    elif command -v open &> /dev/null; then
        open "https://github.com/mengchieh123/ai-hotel-assistant-builder/actions"
    else
        echo "请手动打开: https://github.com/mengchieh123/ai-hotel-assistant-builder/actions"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 部署流程已启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

#!/bin/bash

echo "📦 同步重要文檔到 GitHub"
echo "========================================"
echo ""

# 1️⃣ 檢查當前 Git 狀態
echo "1️⃣ 檢查 Git 狀態..."
git status
echo ""

# 2️⃣ 檢查 GitHub 遠端倉庫
echo "2️⃣ 檢查遠端倉庫..."
git remote -v
echo ""

# 3️⃣ 列出重要文檔
echo "3️⃣ 重要文檔清單："
IMPORTANT_DOCS=(
    "Railway-Deployment-Guide.md"
    "POSTMAN_DETAILED_TEST_GUIDE.md"
    "PM_TEST_GUIDE.md"
    "START_HERE.md"
    "README.md"
)

for doc in "${IMPORTANT_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "   ✅ $doc ($(ls -lh $doc | awk '{print $5}'))"
    else
        echo "   ❌ $doc (不存在)"
    fi
done
echo ""

# 4️⃣ 添加文檔到 Git
echo "4️⃣ 添加文檔到 Git..."
for doc in "${IMPORTANT_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        git add "$doc"
        echo "   ✅ 已添加: $doc"
    fi
done
echo ""

# 5️⃣ 提交變更
echo "5️⃣ 提交變更..."
if git diff --staged --quiet; then
    echo "   ⚠️  沒有需要提交的變更"
else
    git commit -m "docs: 更新測試和部署文檔

- Railway 部署完整指南
- Postman 詳細測試指南
- 產品經理測試指南
- 快速開始文檔"
    echo "   ✅ 已提交"
fi
echo ""

# 6️⃣ 推送到 GitHub
echo "6️⃣ 推送到 GitHub..."
git push origin main
echo ""

# 7️⃣ 驗證 GitHub 上的文件
echo "========================================"
echo "✅ 同步完成！"
echo "========================================"
echo ""
echo "📂 查看 GitHub 上的文檔："
echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder"
echo ""
echo "📋 已同步的重要文檔："
for doc in "${IMPORTANT_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "   • $doc"
    fi
done


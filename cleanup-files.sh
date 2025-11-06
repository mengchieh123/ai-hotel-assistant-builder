#!/bin/bash

echo "🧹 清理無用文件"
echo "========================================"
echo ""

# 列出可能的無用文件
echo "📋 查找可能的無用文件："
echo ""

# 查找所有 zip 文件
echo "1️⃣ ZIP 文件："
find . -name "*.zip" -type f | while read file; do
    size=$(ls -lh "$file" | awk '{print $5}')
    echo "   📦 $file ($size)"
done
echo ""

# 查找測試文件
echo "2️⃣ 測試相關文件："
find . -name "*test*" -o -name "*Test*" -o -name "*TEST*" | grep -v node_modules | grep -v ".git"
echo ""

# 詢問是否刪除
echo "========================================"
echo "🗑️  準備刪除的文件："
echo "========================================"
echo ""

FILES_TO_DELETE=(
    "pm testing packaging.zip"
    "PM_Testing_Package.zip"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "   ❌ $file ($size)"
    fi
done
echo ""

# 執行刪除
echo "🔧 開始刪除..."
for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ 已刪除: $file"
    else
        echo "   ⚠️  文件不存在: $file"
    fi
done

echo ""
echo "========================================"
echo "✅ 清理完成！"
echo "========================================"
echo ""

# 顯示剩餘重要文件
echo "📂 保留的重要文件："
ls -lh *.md *.sh 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'


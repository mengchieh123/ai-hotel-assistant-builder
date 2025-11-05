#!/bin/bash

echo "🧹 清理多餘的測試頁面"
echo "=========================================="
echo ""

# 列出所有測試相關的 HTML 文件
echo "📋 當前測試頁面："
ls -lh *.html | grep -E "test-|demo" | awk '{print "   " $9 " (" $5 ")"}'

echo ""
echo "🎯 保留文件："
echo "   ✅ ultimate-test.html (最完整的測試頁面)"
echo "   ✅ index.html (專案主頁)"
echo ""

echo "🗑️  建議刪除："
TO_DELETE=(
    "test-ai-assistant.html"
    "test-codespaces.html"
    "test-pm.html"
    "test-ai-simple.html"
    "test-standalone.html"
    "test-fixed.html"
    "bulletproof-test.html"
    "product-manager-demo.html"
)

for file in "${TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "   ❌ $file"
    fi
done

echo ""
read -p "確認刪除以上文件？(y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🗑️  開始刪除..."
    
    for file in "${TO_DELETE[@]}"; do
        if [ -f "$file" ]; then
            rm "$file"
            echo "   ✅ 已刪除: $file"
        fi
    done
    
    echo ""
    echo "✅ 清理完成！"
    echo ""
    echo "📁 保留的文件："
    ls -lh *.html 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
    
else
    echo ""
    echo "❌ 取消刪除"
fi


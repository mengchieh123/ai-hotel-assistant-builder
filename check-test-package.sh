#!/bin/bash

echo "🔍 檢查測試包狀態"
echo "=========================================="

# 檢查文件是否存在
if [ -f "PM_Testing_Package.zip" ]; then
    echo "✅ PM_Testing_Package.zip 存在"
    echo "📦 文件大小: $(du -h PM_Testing_Package.zip | cut -f1)"
else
    echo "❌ PM_Testing_Package.zip 不存在"
    echo "🔄 重新創建中..."
    ./create-complete-pm-package.sh
fi

if [ -d "PM_Testing_Package" ]; then
    echo "✅ PM_Testing_Package 文件夾存在"
    echo "📋 內容文件:"
    ls -la PM_Testing_Package/
else
    echo "❌ PM_Testing_Package 文件夾不存在"
fi

echo ""
echo "=========================================="
echo "📥 下載說明:"
echo "1. 在左側文件瀏覽器找到 PM_Testing_Package.zip"
echo "2. 右鍵點擊 → 選擇 Download"
echo "3. 文件將下載到您的電腦"
echo ""
echo "📧 交付方式:"
echo "• 直接發送 ZIP 文件給產品經理"
echo "• 或上傳到共享雲端硬碟"

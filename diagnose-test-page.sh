#!/bin/bash

echo "🔍 診斷測試頁面問題"
echo "=========================================="
echo ""

# 1. 檢查文件是否存在
echo "1️⃣ 檢查文件存在性:"
if [ -f "test-ai-assistant.html" ]; then
    echo "   ✅ test-ai-assistant.html 存在"
    FILE_SIZE=$(ls -lh test-ai-assistant.html | awk '{print $5}')
    echo "   📦 文件大小: $FILE_SIZE"
else
    echo "   ❌ test-ai-assistant.html 不存在"
    echo "   💡 需要重新創建文件"
fi
echo ""

# 2. 檢查文件內容
echo "2️⃣ 檢查文件內容:"
if [ -f "test-ai-assistant.html" ]; then
    LINE_COUNT=$(wc -l < test-ai-assistant.html)
    echo "   📝 行數: $LINE_COUNT"
    
    # 檢查是否是完整的 HTML
    if grep -q "<!DOCTYPE html>" test-ai-assistant.html; then
        echo "   ✅ 包含 DOCTYPE 聲明"
    else
        echo "   ❌ 缺少 DOCTYPE 聲明"
    fi
    
    if grep -q "</html>" test-ai-assistant.html; then
        echo "   ✅ HTML 標籤完整"
    else
        echo "   ❌ HTML 標籤不完整"
    fi
else
    echo "   ⚠️  文件不存在，跳過檢查"
fi
echo ""

# 3. 檢查 Python 是否可用
echo "3️⃣ 檢查 Python 環境:"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ $PYTHON_VERSION"
else
    echo "   ❌ Python3 未安裝"
fi
echo ""

# 4. 檢查端口佔用
echo "4️⃣ 檢查端口 8000:"
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "   ⚠️  端口 8000 已被佔用"
    echo "   正在使用的進程:"
    lsof -i :8000
else
    echo "   ✅ 端口 8000 可用"
fi
echo ""

# 5. 提供解決方案
echo "=========================================="
echo "💡 解決方案:"
echo ""

if [ ! -f "test-ai-assistant.html" ]; then
    echo "方案 A: 重新創建測試頁面"
    echo "   執行: bash recreate-test-page.sh"
    echo ""
fi

echo "方案 B: 使用簡化版本"
echo "   執行: bash create-simple-test.sh"
echo ""

echo "方案 C: 檢查瀏覽器控制台錯誤"
echo "   1. 打開瀏覽器開發者工具 (F12)"
echo "   2. 查看 Console 標籤的錯誤訊息"
echo "   3. 查看 Network 標籤確認 API 請求"


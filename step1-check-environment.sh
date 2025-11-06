#!/bin/bash

echo "🔍 步驟 1：檢查當前環境"
echo "========================================"
echo ""

echo "1️⃣ 檢查 Node.js："
if command -v node &> /dev/null; then
    node --version
    echo "   ✅ Node.js 已安裝"
else
    echo "   ❌ Node.js 未安裝"
    echo "   請先安裝 Node.js：https://nodejs.org/"
    exit 1
fi
echo ""

echo "2️⃣ 檢查 Python3："
if command -v python3 &> /dev/null; then
    python3 --version
    echo "   ✅ Python3 已安裝"
else
    echo "   ❌ Python3 未安裝"
    echo "   安裝方法："
    echo "   Mac: brew install python@3.11"
    echo "   Ubuntu: sudo apt install python3.11"
    exit 1
fi
echo ""

echo "3️⃣ 檢查 pip3："
if command -v pip3 &> /dev/null; then
    pip3 --version
    echo "   ✅ pip3 已安裝"
else
    echo "   ❌ pip3 未安裝"
    exit 1
fi
echo ""

echo "4️⃣ 檢查項目文件："
if [ -f "server.js" ]; then
    echo "   ✅ server.js 存在"
else
    echo "   ❌ server.js 不存在"
    exit 1
fi

if [ -f "package.json" ]; then
    echo "   ✅ package.json 存在"
else
    echo "   ❌ package.json 不存在"
    exit 1
fi

if [ -d "services" ]; then
    echo "   ✅ services/ 目錄存在"
else
    echo "   ❌ services/ 目錄不存在，正在創建..."
    mkdir -p services
fi
echo ""

echo "5️⃣ 檢查 Git 狀態："
git status > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Git 倉庫已初始化"
else
    echo "   ❌ 未初始化 Git 倉庫"
    exit 1
fi
echo ""

echo "========================================"
echo "✅ 環境檢查完成！"
echo "========================================"
echo ""
echo "準備好進行下一步了！"
echo ""
echo "下一步："
echo "   bash step2-install-gpt4all.sh"


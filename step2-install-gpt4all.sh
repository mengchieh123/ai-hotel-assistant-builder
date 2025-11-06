#!/bin/bash

echo "📦 步驟 2：安裝 GPT4All"
echo "========================================"
echo ""

echo "1️⃣ 更新 pip 到最新版本..."
pip3 install --upgrade pip
echo ""

echo "2️⃣ 安裝 GPT4All Python 包..."
echo "   （這可能需要 1-2 分鐘）"
pip3 install gpt4all
echo ""

echo "3️⃣ 驗證 GPT4All 安裝..."
python3 -c "import gpt4all; print('GPT4All 版本:', gpt4all.__version__)" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ GPT4All 安裝成功！"
else
    echo "   ❌ GPT4All 安裝失敗"
    echo ""
    echo "   請嘗試手動安裝："
    echo "   pip3 install gpt4all --user"
    exit 1
fi
echo ""

echo "4️⃣ 測試 GPT4All 基本功能..."
python3 << 'PYTHON'
try:
    from gpt4all import GPT4All
    print("   ✅ GPT4All 模塊導入成功")
    print("   📝 可用模型將在首次使用時自動下載")
except Exception as e:
    print(f"   ❌ 錯誤: {e}")
    exit(1)
PYTHON

if [ $? -ne 0 ]; then
    echo "   ❌ GPT4All 測試失敗"
    exit 1
fi
echo ""

echo "========================================"
echo "✅ GPT4All 安裝完成！"
echo "========================================"
echo ""

echo "📋 安裝信息："
pip3 show gpt4all
echo ""

echo "💡 提示："
echo "   • 模型文件會在首次使用時自動下載"
echo "   • 推薦模型：mistral-7b-openorca.Q4_0.gguf（約 4GB）"
echo "   • 下載位置：~/.cache/gpt4all/"
echo ""

echo "下一步："
echo "   bash step3-create-ai-service.sh"


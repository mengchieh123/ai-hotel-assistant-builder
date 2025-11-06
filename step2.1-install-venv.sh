#!/bin/bash

echo "🔧 步驟 2.1：安裝 python3-venv"
echo "========================================"
echo ""

echo "1️⃣ 安裝 python3-venv 和 python3-full..."
sudo apt update
sudo apt install -y python3.11-venv python3-full
echo ""

echo "2️⃣ 驗證安裝..."
if dpkg -l | grep -q python3.11-venv; then
    echo "   ✅ python3-venv 安裝成功"
else
    echo "   ❌ python3-venv 安裝失敗"
    exit 1
fi
echo ""

echo "3️⃣ 創建虛擬環境..."
python3 -m venv venv-gpt4all
if [ -d "venv-gpt4all" ]; then
    echo "   ✅ 虛擬環境創建成功"
else
    echo "   ❌ 虛擬環境創建失敗"
    exit 1
fi
echo ""

echo "4️⃣ 激活虛擬環境並安裝 GPT4All..."
source venv-gpt4all/bin/activate

echo "   升級 pip..."
pip install --upgrade pip

echo ""
echo "   安裝 GPT4All（這可能需要 1-2 分鐘）..."
pip install gpt4all

echo ""
echo "5️⃣ 驗證 GPT4All 安裝..."
python -c "import gpt4all; print('✅ GPT4All 版本:', gpt4all.__version__)"

echo ""
echo "========================================"
echo "✅ GPT4All 安裝完成！"
echo "========================================"
echo ""

echo "📋 虛擬環境信息："
which python
pip list | grep gpt4all

echo ""
echo "💡 使用說明："
echo "   • 每次使用前需激活虛擬環境："
echo "     source venv-gpt4all/bin/activate"
echo ""
echo "   • 退出虛擬環境："
echo "     deactivate"
echo ""
echo "   • 虛擬環境位置："
echo "     $(pwd)/venv-gpt4all"

echo ""
echo "下一步："
echo "   bash step3-create-ai-service.sh"


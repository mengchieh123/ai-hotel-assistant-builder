#!/bin/bash

echo "🔧 步驟 1.5：安裝 pip3"
echo "========================================"
echo ""

echo "1️⃣ 檢測系統類型..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   系統：Linux"
    
    # 檢查是否為 Debian/Ubuntu
    if command -v apt-get &> /dev/null; then
        echo "   發行版：Debian/Ubuntu"
        echo ""
        echo "2️⃣ 安裝 pip3..."
        sudo apt-get update
        sudo apt-get install -y python3-pip
    elif command -v yum &> /dev/null; then
        echo "   發行版：CentOS/RHEL"
        echo ""
        echo "2️⃣ 安裝 pip3..."
        sudo yum install -y python3-pip
    else
        echo "   ⚠️  未知的 Linux 發行版"
        echo ""
        echo "嘗試使用 get-pip.py..."
        curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
        python3 get-pip.py
        rm get-pip.py
    fi
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   系統：macOS"
    echo ""
    echo "2️⃣ 安裝 pip3..."
    
    # 嘗試使用 brew
    if command -v brew &> /dev/null; then
        brew install python3
    else
        # 使用 get-pip.py
        curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
        python3 get-pip.py
        rm get-pip.py
    fi
else
    echo "   ⚠️  未知的操作系統"
    echo ""
    echo "使用 get-pip.py 安裝..."
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

echo ""
echo "3️⃣ 驗證安裝..."
if command -v pip3 &> /dev/null; then
    pip3 --version
    echo "   ✅ pip3 安裝成功！"
else
    echo "   ❌ pip3 安裝失敗"
    echo ""
    echo "手動安裝方法："
    echo "   curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py"
    echo "   python3 get-pip.py"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ pip3 已就緒！"
echo "========================================"
echo ""
echo "重新執行環境檢查："
echo "   bash step1-check-environment.sh"


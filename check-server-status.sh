#!/bin/bash

echo "🔍 檢查伺服器狀態..."

# 檢查進程
echo "1️⃣ 檢查伺服器進程:"
ps aux | grep "python.*8000" | grep -v grep

# 檢查端口
echo ""
echo "2️⃣ 檢查端口 8000:"
netstat -tuln | grep 8000 || ss -tuln | grep 8000

# 檢查日誌文件
echo ""
echo "3️⃣ 檢查伺服器日誌:"
if [ -f "nohup.out" ]; then
    echo "📄 日誌文件內容:"
    tail -20 nohup.out
else
    echo "❌ 沒有日誌文件"
fi

# 測試本地訪問
echo ""
echo "4️⃣ 測試本地訪問:"
curl -s http://localhost:8000/ > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ 本地訪問成功"
else
    echo "❌ 本地訪問失敗"
fi

# 檢查文件是否存在
echo ""
echo "5️⃣ 檢查測試文件:"
ls -la *.html | head -10

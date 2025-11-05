#!/bin/bash

echo "🚀 啟動 AI 訂房助理測試環境"
echo "=========================================="
echo ""

# 1. 停止可能存在的舊進程
echo "1️⃣ 清理舊進程..."
pkill -f "python.*http.server" 2>/dev/null || true
sleep 1

# 2. 啟動 HTTP 服務器
echo "2️⃣ 啟動 HTTP 服務器..."
python3 -m http.server 8000 > /dev/null 2>&1 &
SERVER_PID=$!

# 3. 等待服務器啟動
echo "3️⃣ 等待服務器啟動..."
sleep 2

# 4. 驗證服務器
if curl -s http://localhost:8000 > /dev/null; then
    echo "   ✅ 服務器啟動成功！"
else
    echo "   ❌ 服務器啟動失敗"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 測試環境已準備完成！"
echo "=========================================="
echo ""
echo "📱 請在瀏覽器中訪問以下任一網址："
echo ""
echo "   完整版: http://localhost:8000/test-ai-assistant.html"
echo "   簡化版: http://localhost:8000/test-ai-simple.html"
echo ""
echo "💡 使用提示："
echo "   - 如果頁面空白，請按 F12 打開開發者工具查看錯誤"
echo "   - 確認 Railway 服務正常運行"
echo "   - 測試完成後執行以下命令停止服務器："
echo ""
echo "🛑 停止服務器："
echo "   kill $SERVER_PID"
echo "   或按 Ctrl+C"
echo ""
echo "📊 實時日誌監控："
echo "   tail -f nohup.out"
echo ""

# 保持腳本運行
echo "服務器進程 ID: $SERVER_PID"
echo "按 Ctrl+C 停止服務器..."
echo ""

# 等待中斷信號
trap "echo ''; echo '🛑 正在停止服務器...'; kill $SERVER_PID 2>/dev/null; echo '✅ 服務器已停止'; exit 0" INT TERM

wait $SERVER_PID


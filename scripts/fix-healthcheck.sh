#!/bin/bash

echo "🔧 修復 Railway 健康檢查問題..."

echo "1. 檢查 server.js 配置..."
if grep -q "0.0.0.0" server.js; then
    echo "✅ 服務器配置正確（監聽 0.0.0.0）"
else
    echo "❌ 需要修復服務器配置"
    # 修復服務器配置
    sed -i 's/app.listen(PORT/app.listen(PORT, "0.0.0.0"/g' server.js
    echo "✅ 已修復服務器配置"
fi

echo "2. 驗證健康檢查端點..."
if grep -q 'app.get.*/health' server.js; then
    echo "✅ 健康檢查端點存在"
else
    echo "❌ 缺少健康檢查端點"
    exit 1
fi

echo "3. 測試本地健康檢查..."
npm start &
SERVER_PID=$!
sleep 5
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ 本地健康檢查通過"
else
    echo "❌ 本地健康檢查失敗"
    kill $SERVER_PID
    exit 1
fi
kill $SERVER_PID

echo "4. 準備重新部署..."
npm run speckit:generate

echo "✅ 修復完成！現在可以重新部署"
echo "🚀 運行: railway deploy"

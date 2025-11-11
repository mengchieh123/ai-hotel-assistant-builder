#!/bin/bash
echo "啟動 AI 訂房助理服務..."
node server.js &
sleep 2

echo "檢查服務是否啟動中..."
lsof -i :8080

if [ $? -eq 0 ]; then
  echo "✅ 服務已成功啟動，監聽端口 8080"
else
  echo "❌ 服務未啟動，請檢查 server.js"
fi

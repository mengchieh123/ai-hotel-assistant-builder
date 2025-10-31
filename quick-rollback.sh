#!/bin/bash
echo "🔄 緊急回滾到穩定版本..."
cp server.js.backup server.js
git add server.js
git commit -m "revert: 緊急回滾到穩定版本"
git push origin main
echo "✅ 已回滾，等待部署..."
sleep 60
echo "🎯 系統已恢復到穩定狀態"

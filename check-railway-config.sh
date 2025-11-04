#!/bin/bash

echo "🔍 檢查 Railway 配置問題"
echo "========================"

# 1. 檢查環境變量
echo "1. 檢查環境變量..."
railway variables list

# 2. 檢查部署設置
echo ""
echo "2. 檢查部署設置..."
echo "如果健康檢查持續失敗，可能需要："
echo "• 在 Railway Dashboard 中調整健康檢查路徑"
echo "• 修改健康檢查超時時間"
echo "• 檢查網絡配置"

# 3. 替代方案：使用 Railway 配置文件
cat > railway.toml << 'TOML'
[service]
build.command = "npm install"
start.command = "npm start"

[service.healthcheck]
path = "/health"
timeout = 30
interval = 15
maxRetries = 3
TOML

echo "✅ 創建 railway.toml 配置文件"
echo "請在 Railway Dashboard 中確認健康檢查設置"

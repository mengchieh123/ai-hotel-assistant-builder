#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Railway 部署验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查 Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI 未安装"
    echo "请运行: npm install -g @railway/cli"
    exit 1
fi

echo "✅ Railway CLI 已安装"

# 获取服务 URL
echo ""
echo "📡 获取服务 URL..."
SERVICE_URL=$(railway status --json 2>/dev/null | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SERVICE_URL" ]; then
    echo "⚠️  无法自动获取 URL，请从 Railway Dashboard 获取"
    echo "   https://railway.app/dashboard"
    read -p "请输入你的 Railway URL: " SERVICE_URL
fi

echo "📍 服务地址: $SERVICE_URL"

# 测试健康检查
echo ""
echo "🧪 测试健康检查..."
if curl -f "$SERVICE_URL/health" 2>/dev/null; then
    echo "✅ 生产环境健康检查通过"
else
    echo "❌ 健康检查失败"
fi

# 测试主端点
echo ""
echo "🌐 测试主端点..."
if curl -f "$SERVICE_URL/" 2>/dev/null; then
    echo "✅ 生产环境主端点正常"
else
    echo "❌ 主端点异常"
fi

# 检查环境变量
echo ""
echo "⚙️  检查环境变量..."
railway variables list 2>/dev/null || echo "⚠️  无法获取环境变量列表"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 部署验证完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

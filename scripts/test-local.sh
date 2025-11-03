#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 本地环境测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 清理并重新安装依赖
echo ""
echo "📦 重新安装依赖..."
rm -rf node_modules package-lock.json
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装成功"

# 运行 npm ci 测试
echo ""
echo "🔨 测试 npm ci（Railway 使用的构建方式）..."
npm ci

if [ $? -ne 0 ]; then
    echo "❌ npm ci 失败"
    exit 1
fi

echo "✅ npm ci 成功"

# 启动服务器
echo ""
echo "🚀 启动服务器..."
npm start &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动（5秒）..."
sleep 5

# 测试端点
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 测试端点"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 健康检查
echo ""
echo "1️⃣  测试 /health"
if curl -f http://localhost:3000/health 2>/dev/null; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 根路由
echo ""
echo "2️⃣  测试 /"
if curl -f http://localhost:3000/ 2>/dev/null; then
    echo "✅ 根路由正常"
else
    echo "❌ 根路由异常"
fi

# API 状态
echo ""
echo "3️⃣  测试 /api/status"
if curl -f http://localhost:3000/api/status 2>/dev/null; then
    echo "✅ API 状态正常"
else
    echo "⚠️  API 状态端点未响应"
fi

# Speckit 验证
echo ""
echo "4️⃣  测试 Speckit 验证"
npm run speckit:validate
if [ $? -eq 0 ]; then
    echo "✅ Speckit 验证通过"
else
    echo "⚠️  Speckit 验证有警告"
fi

# 停止服务器
echo ""
echo "🛑 停止测试服务器..."
kill $SERVER_PID 2>/dev/null || pkill -f "node server.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有本地测试完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

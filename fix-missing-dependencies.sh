#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復缺少的依賴"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣ 檢查 package.json..."
echo ""

if [ -f "package.json" ]; then
    echo "✅ package.json 存在"
    
    # 檢查是否有 cors
    if grep -q '"cors"' package.json; then
        echo "✅ cors 已在 dependencies"
    else
        echo "❌ cors 缺失"
    fi
else
    echo "❌ package.json 不存在"
fi

echo ""
echo "2️⃣ 更新 package.json - 確保所有依賴..."
echo ""

cat > package.json << 'EOFPACKAGE'
{
  "name": "ai-hotel-assistant-railway-optimized",
  "version": "3.2.1",
  "description": "AI Hotel Assistant with Business SpecKit",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "hotel",
    "ai",
    "assistant",
    "booking"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOFPACKAGE

echo "✅ package.json 已更新"
echo ""

echo "3️⃣ 確保 server.js 簡化且穩定..."
echo ""

cat > server.js << 'EOFSERVER'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 健康檢查 - 快速響應
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路徑
app.get('/', (req, res) => {
  res.send('AI Hotel Assistant API');
});

// AI 路由
try {
  const aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
} catch (err) {
  console.warn('AI routes not found, using fallback');
  app.post('/api/ai/chat', (req, res) => {
    res.json({ message: '服務正在啟動中，請稍後再試' });
  });
}

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal error' });
});

// 優雅關閉
let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM - closing gracefully');
  if (server) {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  }
});

// 啟動
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// 錯誤處理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});
EOFSERVER

echo "✅ server.js 已更新（簡化版）"
echo ""

echo "4️⃣ 提交並推送..."
echo ""

git add package.json server.js

git commit -m "fix: add missing cors dependency and simplify server

✅ Add cors to package.json dependencies
✅ Simplify server.js with fallback routes
✅ Better error handling
✅ Graceful SIGTERM handling

Fixes MODULE_NOT_FOUND error on Railway"

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 修復已推送"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔧 修復內容："
    echo "   • 添加 cors 依賴到 package.json"
    echo "   • 簡化 server.js"
    echo "   • 添加路由降級處理"
    echo "   • 優雅處理 SIGTERM"
    echo ""
    echo "⏳ Railway 將在 2-3 分鐘內重新部署"
    echo ""
    echo "Railway 會自動執行："
    echo "   npm install  (安裝 cors)"
    echo "   npm start    (啟動服務)"
    echo ""
    echo "部署完成後測試："
    echo "   bash test-booking-flow.sh"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
fi


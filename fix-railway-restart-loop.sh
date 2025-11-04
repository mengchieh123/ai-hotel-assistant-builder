#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 Railway 重啟循環問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 創建最簡單但穩定的 server.js
echo "1️⃣  創建最小穩定 server.js..."

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

console.log('🚀 啟動服務器...');

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: 'AI Hotel Assistant API',
    version: '2.1.0',
    status: 'running'
  });
});

// 健康檢查 - 最優先最簡單
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// AI 路由 - 安全加載
let aiRoutes = null;
try {
  aiRoutes = require('./routes/ai-routes');
  app.use('/api/ai', aiRoutes);
  console.log('✅ AI 路由已加載');
} catch (error) {
  console.error('⚠️  AI 路由加載失敗:', error.message);
  
  // 提供後備路由
  app.get('/api/ai/status', (req, res) => {
    res.json({ available: false, error: 'AI service not loaded' });
  });
  
  app.post('/api/ai/chat', (req, res) => {
    res.json({ 
      success: false, 
      message: '服務正在啟動中，請稍後再試'
    });
  });
}

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('服務器錯誤:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 啟動服務器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 服務器已啟動');
  console.log('📍 端口: ' + PORT);
  console.log('🔗 健康檢查: http://0.0.0.0:' + PORT + '/health');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('⏹️  收到 SIGTERM，優雅關閉...');
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏹️  收到 SIGINT，優雅關閉...');
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
});

// 未捕獲錯誤
process.on('uncaughtException', (error) => {
  console.error('未捕獲的異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});
EOFSERVER

echo "✅ server.js 已更新（最小穩定版）"

# 確保 package.json 正確
echo ""
echo "2️⃣  檢查 package.json..."

cat > package.json << 'EOFPKG'
{
  "name": "ai-hotel-assistant-builder",
  "version": "2.1.0",
  "description": "AI Hotel Assistant",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOFPKG

echo "✅ package.json 已更新"

# 提交
echo ""
echo "3️⃣  提交修復..."

git add server.js package.json
git commit -m "fix: resolve SIGTERM restart loop

Critical fixes:
✅ Minimal stable server.js
✅ Health check responds immediately
✅ Graceful SIGTERM handling
✅ Safe module loading with fallbacks
✅ Proper error catching

This should stop the restart loop and keep service running."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修復已推送！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待 Railway 部署並穩定（120秒）..."
sleep 120

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 測試服務穩定性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 多次測試健康檢查
echo "健康檢查測試（5次）:"
for i in {1..5}; do
  echo -n "  測試 $i: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://ai-hotel-assistant-builder-production.up.railway.app/health)
  if [ "$STATUS" = "200" ]; then
    echo "✅ HTTP $STATUS"
  else
    echo "❌ HTTP $STATUS"
  fi
  sleep 2
done

echo ""
echo "詳細健康檢查:"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/health | jq .

echo ""
echo "測試 AI 狀態:"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/status | jq .

echo ""
echo "測試對話功能:"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 測試完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "如果仍有問題，檢查 Railway 日誌:"
echo "  railway logs --tail 50"
echo ""


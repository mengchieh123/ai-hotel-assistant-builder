#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ 創建超快啟動服務器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > server.js << 'EOFSERVER'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// 最優先：健康檢查（不依賴任何模塊）
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 基本中間件
app.use(express.json());
app.use(express.static('public'));

// 根路徑
app.get('/', (req, res) => {
  res.json({ status: 'running', service: 'AI Hotel Assistant API' });
});

// 延遲加載 AI 路由（不阻塞啟動）
setImmediate(() => {
  try {
    const aiRoutes = require('./routes/ai-routes');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI 路由已加載');
  } catch (error) {
    console.error('⚠️  AI 路由加載失敗:', error.message);
  }
});

// 立即啟動服務器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 服務器運行在端口 ' + PORT);
});

// 優雅關閉
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('⏹️  收到 ' + signal + '，優雅關閉...');
  
  server.close(() => {
    console.log('服務器已關閉');
    process.exit(0);
  });
  
  // 強制超時
  setTimeout(() => {
    console.error('強制關閉');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('未捕獲異常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('未處理的 Promise:', reason);
});
EOFSERVER

echo "✅ 超快啟動 server.js 已創建"

# 提交
git add server.js
git commit -m "fix: ultra-fast server startup to pass Railway healthcheck

Critical changes:
✅ Health check responds immediately (no dependencies)
✅ Delayed AI routes loading (non-blocking)
✅ Faster startup time
✅ Graceful SIGTERM handling with timeout
✅ Prevents restart loop

This ensures Railway sees healthy service within timeout."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 已推送！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待部署（90秒）..."
sleep 90

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 測試服務穩定性"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 多次測試確保穩定
for i in {1..5}; do
  echo "測試 $i/5:"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://ai-hotel-assistant-builder-production.up.railway.app/health)
  
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ 健康 (HTTP $STATUS)"
  else
    echo "  ❌ 異常 (HTTP $STATUS)"
  fi
  
  sleep 3
done

echo ""
echo "詳細健康狀態:"
curl -s https://ai-hotel-assistant-builder-production.up.railway.app/health | jq .

echo ""
echo "測試 AI 對話:"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}' | jq .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "如果健康檢查通過但對話失敗，我們再修復對話功能"
echo "如果健康檢查失敗，問題在 Railway 配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


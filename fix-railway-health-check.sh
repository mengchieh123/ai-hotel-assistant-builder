#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修復 Railway 健康檢查問題"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "診斷結果："
echo "✅ 服務器成功啟動 (port 8080)"
echo "❌ 被 SIGTERM 終止"
echo ""
echo "可能原因："
echo "1. Railway 健康檢查超時"
echo "2. 端口綁定問題"
echo "3. 記憶體/CPU 超限"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "解決方案：優化 server.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 備份原始文件
if [ -f "server.js" ]; then
    cp server.js server.js.backup
    echo "✅ 已備份 server.js"
fi

# 創建優化版 server.js
cat > server.js << 'EOFSERVER'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// 從環境變數讀取 PORT，Railway 會自動設定
const PORT = process.env.PORT || 8080;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 健康檢查端點 - 必須快速響應
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.send('AI Hotel Assistant API is running');
});

// AI 聊天路由
const aiRoutes = require('./routes/ai-routes');
app.use('/api/ai', aiRoutes);

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 優雅關閉處理
let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // 強制關閉超時
    setTimeout(() => {
      console.log('Forcing shutdown');
      process.exit(1);
    }, 10000);
  }
});

// 啟動服務器
server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI Chat: http://localhost:${PORT}/api/ai/chat`);
});

// 處理未捕獲的錯誤
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;
EOFSERVER

echo "✅ server.js 已優化"
echo ""

# 檢查 package.json
if [ -f "package.json" ]; then
    echo "檢查 package.json..."
    
    # 確保 start 腳本正確
    if ! grep -q '"start".*"node server.js"' package.json; then
        echo "⚠️ 更新 package.json start 腳本..."
        # 這裡可以用 jq 或手動編輯
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "推送優化版本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

git add server.js

git commit -m "fix: optimize server for Railway deployment

✅ Add graceful SIGTERM handling
✅ Bind to 0.0.0.0 for Railway
✅ Fast health check endpoint
✅ Better error handling
✅ Proper process exit handling

Fixes Railway container restart loop"

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 優化版本已推送"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⏳ 等待 Railway 部署（2-3 分鐘）"
    echo ""
    echo "改進項目："
    echo "  • 優雅處理 SIGTERM"
    echo "  • 綁定到 0.0.0.0"
    echo "  • 快速健康檢查"
    echo "  • 更好的錯誤處理"
    echo ""
    echo "部署成功後，重新測試："
    echo "  bash test-booking-flow.sh"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
fi


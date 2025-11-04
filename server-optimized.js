const express = require('express');
const app = express();

// 最簡化的中間件
app.use(express.json({ limit: '1mb' }));

console.log('🚀 啟動優化版服務 - 快速健康檢查');

// 立即響應的健康檢查 - 無任何邏輯
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant'
  });
});

// 根路徑也響應健康檢查
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    service: 'AI Hotel Assistant API'
  });
});

// 簡化的 AI 狀態
app.get('/api/ai/status', (req, res) => {
  res.json({
    available: true,
    message: '服務正常運行'
  });
});

// 簡化的 AI 聊天
app.post('/api/ai/chat', (req, res) => {
  const { message } = req.body;
  
  const reply = message.includes('房型') ? 
    '我們有標準房、豪華房、套房' : 
    '您好！我可以協助預訂和查詢';
  
  res.json({
    success: true,
    reply: reply
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服務運行在端口 ${PORT}`);
});

// 確保快速啟動
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 啟動...');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', v: '3.2' });
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.json({ status: 'running', version: '3.2' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服務器運行在端口 ${PORT}`);
  
  setTimeout(() => {
    try {
      const aiRoutes = require('./routes/ai-routes');
      app.use('/api/ai', aiRoutes);
      console.log('✅ AI 路由已加載');
    } catch (e) {
      console.error('AI 加載失敗:', e.message);
    }
  }, 50);
});

let closing = false;
const shutdown = (signal) => {
  if (closing) return;
  closing = true;
  console.log(`⏹️  ${signal}`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

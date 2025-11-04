const express = require('express');
const app = express();

app.use(express.json());

// 最簡單的健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

app.get('/', (req, res) => res.redirect('/health'));

// 最簡單的 AI 端點
app.post('/api/ai/chat', (req, res) => {
  const msg = (req.body.message || '').toLowerCase();
  
  let response = '🤖 請說「價格」查房價、「房型」看房間、「訂房」開始預訂';
  if (msg.includes('你好')) response = '🏨 歡迎！需要什麼協助？';
  if (msg.includes('價格')) response = '💰 豪華房: NT$7,500-9,500/晚';
  if (msg.includes('房型')) response = '🏨 豪華房/行政房/套房';
  if (msg.includes('訂房')) response = '📅 請提供入住日期';
  
  res.json({ message: response });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// 基本信號處理
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  setTimeout(() => process.exit(0), 1000);
});

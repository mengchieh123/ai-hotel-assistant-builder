const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 提供 public 目錄內靜態檔案服務
app.use(express.static('public'));

// 模擬 AI 聊天回應 API
app.post('/api/ai/chat', (req, res) => {
  const message = req.body.message || '';
  let reply = '您好，有什麼可以幫助您的嗎？';

  if (message.includes('價格')) {
    reply = '標準雙人房價格是2200元每晚。';
  } else if (message.includes('房型')) {
    reply = '我們提供標準雙人房、豪華雙人房和套房。';
  } else if (message.includes('你好')) {
    reply = '您好！歡迎使用AI飯店助理。';
  }

  res.json({ success: true, message: reply });
});

// AI 服務狀態檢查 API
app.get('/api/ai/status', (req, res) => {
  res.json({ available: true });
});

// 啟動伺服器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('服務已啟動，請開啟瀏覽器並訪問 http://localhost:' + PORT);
});

const express = require('express');
const app = express();
const PORT = 8090;

app.use(express.json());

// 导入 chatService
const chatService = require('./services/chatService');

console.log('🔧 检查路由设置...');

// 方法1: 使用 app.use
app.use('/chat', chatService);
console.log('✅ 方法1: app.use(/chat, chatService) 已设置');

// 添加调试中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', method: 'app.use' });
});

app.listen(PORT, () => {
  console.log(`测试服务器运行在端口 ${PORT}`);
  console.log(`测试: curl -X POST http://localhost:${PORT}/chat -d '{"message":"test"}'`);
});

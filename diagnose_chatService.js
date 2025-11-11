const express = require('express');
const router = express.Router();

console.log('1. Express Router 类型:', typeof router);
console.log('2. Router 方法:', Object.keys(router));

// 模拟 chatService 的结构
router.post('/test', (req, res) => {
  res.json({ message: '测试路由工作' });
});

console.log('3. Router 实例检查:');
console.log('   - 是否有 handle:', typeof router.handle === 'function');
console.log('   - 是否有 stack:', Array.isArray(router.stack));

// 检查当前 chatService 文件
try {
  const chatService = require('./services/chatService');
  console.log('4. chatService 导入成功');
  console.log('   - 类型:', typeof chatService);
  console.log('   - 方法:', Object.keys(chatService));
  
  if (chatService && typeof chatService === 'function') {
    console.log('   - 是 Express Router/应用');
  } else if (chatService && chatService.stack) {
    console.log('   - 有路由栈');
  } else {
    console.log('   - 未知结构');
  }
} catch (error) {
  console.log('4. chatService 导入失败:', error.message);
}

const express = require('express');
const app = express();

// CORS 中間件 - 允許跨域請求
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  
  // 處理 OPTIONS 預檢請求
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});
app.use(express.json());

// 健康檢查 - 明確標識新版本
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'AI Hotel Assistant ENHANCED',
    version: '4.0.0-FORCED-DEPLOY',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    features: ['enhanced_dialog', 'context_aware', 'smart_intent'],
    deployment: 'forced-v4-deploy'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: '4.0.0-FORCED-DEPLOY',
    message: 'AI Hotel Assistant with Enhanced Dialog Quality'
  });
});

// 增強版 AI 對話端點
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  console.log('💬 ENHANCED - Received:', message?.substring(0, 50));

  // 智能意圖識別
  let intent = 'general';
  let responseMessage = '';

  if (message && (message.includes('價格') || message.includes('價錢') || message.includes('多少錢') || message.includes('房價'))) {
    intent = 'price';
    responseMessage = `🏨 **2025年全新優惠價** 🎉\n\n` +
      `�� **精選房價**:\n` +
      `• 豪華客房：NT$3,800 - 4,500/晚\n` +
      `• 行政客房：NT$5,200 - 6,800/晚\n` +
      `• 尊榮套房：NT$8,500 - 11,000/晚\n\n` +
      
      `🎯 **會員專屬禮遇**:\n` +
      `• 金卡會員：房價9折 + 免費早餐\n` +
      `• 白金會員：房價85折 + 免費升等\n` +
      `• 鑽石會員：房價8折 + 行政酒廊\n\n` +
      
      `💫 **包含服務**:\n` +
      `✓ 免費WiFi ✓ 健身房使用\n` +
      `✓ 室內泳池 ✓ 迎賓飲品\n` +
      `✓ 每日客房清潔\n\n` +
      
      `請提供入住日期，我為您查詢即時優惠！`;
  } else if (message && (message.includes('訂房') || message.includes('預訂') || message.includes('預約'))) {
    intent = 'booking';
    responseMessage = `📅 **輕鬆訂房四步驟**：\n\n` +
      `1. **選擇日期** - 入住與退房日期\n` +
      `2. **選擇房型** - 依需求推薦合適房型\n` +
      `3. **填寫資料** - 旅客資訊與特殊需求\n` +
      `4. **確認訂單** - 收到確認郵件即完成\n\n` +
      
      `🔒 **訂房保障**：\n` +
      `• 免費取消：入住前48小時\n` +
      `• 最佳價格保證\n` +
      `• 24小時客服支援\n\n` +
      
      `請提供入住日期開始預訂！`;
  } else if (message && (message.includes('設施') || message.includes('設備') || message.includes('服務'))) {
    intent = 'facility';
    responseMessage = `🏊 **飯店設施一覽**：\n\n` +
      `• 24小時健身中心\n` +
      `• 室內恆溫泳池\n` +
      `• 三溫暖與蒸汽室\n` +
      `• 商務中心\n` +
      `• 會議室租借\n` +
      `• 餐廳與酒吧\n` +
      `• 客房服務\n` +
      `• 行李寄存與接送\n\n` +
      
      `需要了解特定設施的詳細資訊嗎？`;
  } else {
    intent = 'greeting';
    responseMessage = `您好！我是飯店AI助理，現在為您提供：\n\n` +
      `• 🏨 最新房價查詢 (豪華客房 NT$3,800起)\n` +
      `• 📅 線上訂房服務\n` +
      `• 🏊 設施介紹\n` +
      `• ❓ 常見問題解答\n\n` +
      
      `請問需要什麼協助？`;
  }

  console.log(`✅ ENHANCED - Responded with intent: ${intent}`);

  res.json({
    message: responseMessage,
    intent: intent,
    timestamp: new Date().toISOString(),
    version: "4.0.0-FORCED-DEPLOY",
    enhanced: true,
    suggestions: ['查看房型', '訂房流程', '會員優惠']
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 =================================');
  console.log('✅ AI Hotel Assistant ENHANCED v4.0.0');
  console.log('✅ FORCED DEPLOYMENT - NT$3,800');
  console.log('✅ Enhanced Dialog Quality');
  console.log('✅ Running on port:', PORT);
  console.log('🚀 =================================');
});

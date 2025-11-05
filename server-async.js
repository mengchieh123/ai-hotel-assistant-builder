const express = require('express');
const path = require('path');

// 導入增強版 AI 服務
console.log('🚀 載入增強版 AI 服務...');
const enhancedAI = require('./services/enhanced-ai-service');
console.log('✅ 增強版 AI 服務載入成功');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件 - 手動實現 CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static('.'));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: '服務運行中',
    version: '5.0.0-ENHANCED-ASYNC',
    timestamp: new Date().toISOString(),
    features: [
      '多層次意圖識別',
      '異步消息處理', 
      '特殊需求處理',
      '團體訂房支援'
    ]
  });
});

// 統一的聊天請求處理函數（異步）
async function handleChatRequest(req, res) {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: '請提供訊息' });
  }
  
  try {
    console.log(`👤 用戶查詢: ${message}`);
    const startTime = Date.now();
    
    // 使用異步處理
    let response;
    if (typeof enhancedAI.processMessage === 'function') {
      response = await enhancedAI.processMessage(message);
    } else {
      // 向後兼容同步版本
      response = enhancedAI.generateResponse(message);
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`🤖 AI 回應 (${processingTime}ms)`);
    
    res.json({ 
      response,
      metadata: {
        processingTime: `${processingTime}ms`,
        version: '5.0.0-ENHANCED-ASYNC',
        timestamp: new Date().toISOString(),
        async: typeof enhancedAI.processMessage === 'function'
      }
    });
  } catch (error) {
    console.error('❌ 處理錯誤:', error);
    res.status(500).json({ 
      error: '服務暫時不可用',
      details: error.message
    });
  }
}

// 聊天端點 - 支持異步處理
app.post('/chat', async (req, res) => {
  await handleChatRequest(req, res);
});

// 兼容舊版 API 路徑
app.post('/api/ai/chat', async (req, res) => {
  await handleChatRequest(req, res);
});

// 增強版功能測試端點
app.get('/test-enhanced', async (req, res) => {
  const testQueries = [
    '無障礙房間需要輪椅',
    '團體訂房15人會議室',
    '聖誕節住4晚兩位大人小孩同行'
  ];
  
  const results = [];
  for (const query of testQueries) {
    try {
      let response;
      if (typeof enhancedAI.processMessage === 'function') {
        response = await enhancedAI.processMessage(query);
      } else {
        response = enhancedAI.generateResponse(query);
      }
      
      results.push({
        query,
        response: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        success: true
      });
    } catch (error) {
      results.push({
        query,
        error: error.message,
        success: false
      });
    }
  }
  
  res.json({
    version: '5.0.0-ENHANCED-ASYNC',
    timestamp: new Date().toISOString(),
    asyncSupported: typeof enhancedAI.processMessage === 'function',
    testResults: results
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: '🏨 飯店 AI 助理 - 增強版 (異步)',
    version: '5.0.0-ENHANCED-ASYNC',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /chat',
      test: 'GET /test-enhanced'
    }
  });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================');
  console.log('🚀 增強版 AI 服務啟動成功 (異步)');
  console.log('📊 版本: 5.0.0-ENHANCED-ASYNC');
  console.log('🌐 端口:', PORT);
  console.log('--------------------------------');
  console.log('📋 可用端點:');
  console.log('   /health         - 健康檢查');
  console.log('   POST /chat      - AI 對話');
  console.log('   /test-enhanced  - 功能測試');
  console.log('================================');
});

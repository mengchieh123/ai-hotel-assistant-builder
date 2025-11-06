const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { SYSTEM_PROMPT } = require('./prompts/system-prompt');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.3.0-COMPLEX-DIALOGUE',
    timestamp: new Date().toISOString()
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: 'AI 訂房助理 API',
    version: '5.3.0-COMPLEX-DIALOGUE',
    endpoints: {
      health: '/health',
      chat: '/chat (POST)'
    }
  });
});

// 聊天端點（支援複雜對話）
app.post('/chat', async (req, res) => {
  try {
    const { message, guestName, checkIn, checkOut, roomType, memberType } = req.body;
    
    // 驗證必填欄位
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: '訊息不能為空' 
      });
    }

    // 構建上下文資訊
    const contextInfo = [];
    if (guestName) contextInfo.push(`姓名：${guestName}`);
    if (checkIn) contextInfo.push(`入住日期：${checkIn}`);
    if (checkOut) contextInfo.push(`退房日期：${checkOut}`);
    if (roomType) contextInfo.push(`偏好房型：${roomType}`);
    if (memberType) contextInfo.push(`會員等級：${memberType}`);

    // 構建完整的 prompt
    const fullPrompt = contextInfo.length > 0
      ? `客戶資訊：\n${contextInfo.join('\n')}\n\n客戶問題：\n${message}\n\n請根據系統指引，提供完整、結構化的回答。`
      : `客戶問題：\n${message}\n\n請根據系統指引，提供完整、結構化的回答。`;

    console.log('📝 處理請求:', {
      guestName,
      messageLength: message.length,
      hasContext: contextInfo.length > 0
    });

    // 呼叫 Ollama API
    const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        system: SYSTEM_PROMPT,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1500,
          num_predict: 1500
        }
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API 錯誤: ${ollamaResponse.status}`);
    }

    const data = await ollamaResponse.json();
    const aiResponse = data.response || '';

    console.log('✅ AI 回應長度:', aiResponse.length);

    // 回傳結構化回應
    res.json({
      success: true,
      response: aiResponse,
      metadata: {
        guestName: guestName || null,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        roomType: roomType || null,
        memberType: memberType || null,
        responseLength: aiResponse.length
      },
      version: '5.3.0-COMPLEX-DIALOGUE',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
    res.status(500).json({ 
      success: false,
      error: '處理請求時發生錯誤',
      details: error.message
    });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏨 AI 訂房助理伺服器');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`版本: 5.3.0-COMPLEX-DIALOGUE`);
  console.log(`埠號: ${PORT}`);
  console.log(`狀態: ✅ 運行中`);
  console.log(`時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;

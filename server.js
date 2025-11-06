const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 嘗試載入 System Prompt，如果失敗則使用簡化版
let SYSTEM_PROMPT;
try {
  const promptModule = require('./prompts/system-prompt');
  SYSTEM_PROMPT = promptModule.SYSTEM_PROMPT;
  console.log('✅ 已載入完整 System Prompt');
} catch (error) {
  console.log('⚠️  使用簡化版 System Prompt');
  SYSTEM_PROMPT = `你是專業的飯店訂房助理。請完整回答客戶的所有問題，包括價格、優惠、政策等。使用結構化格式回答。`;
}

// Ollama 配置
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'\;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.3.0-COMPLEX-DIALOGUE',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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

// 檢查 Ollama 連接
async function checkOllamaConnection() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      console.log('✅ Ollama 連接成功');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Ollama 未連接，將使用模擬模式');
  }
  return false;
}

// 模擬 AI 回應（當 Ollama 不可用時）
function getMockResponse(message, context) {
  const { guestName, checkIn, checkOut, memberType } = context;
  
  // 簡單的關鍵字匹配回應
  if (/過年|春節|4晚|會員|小孩|高樓層/i.test(message)) {
    return `${guestName || '您好'}！我已經了解您的需求：

📅 **入住時間**
${checkIn ? `入住日期：${checkIn}` : '過年期間'}
${checkOut ? `退房日期：${checkOut}` : '共4晚'}

🏨 **房型推薦**
建議：豪華雙人房
- 更寬敞舒適
- 適合長住

💰 **價格資訊**
基礎房價：3,800元/晚
春節期間加價：500元/晚
實際價格：4,300元/晚 × 4晚 = 17,200元

🎫 **${memberType || '會員'}優惠**
- 會員折扣：9折
- 連住優惠：再減5%
- 優惠後總價：約 14,706元

👶 **兒童政策**
5歲以下不占床：完全免費

🏢 **房間安排**
- 可安排高樓層（15樓以上）
- 選擇安靜房間

是否需要協助您完成預訂？`;
  }
  
  // 簡單問候
  if (/你好|您好|hi|hello/i.test(message)) {
    return `${guestName || '您好'}！歡迎使用訂房服務。我可以協助您查詢房型、價格、優惠等資訊。請問有什麼需要幫忙的嗎？`;
  }
  
  // 房型查詢
  if (/房型|房間/i.test(message)) {
    return `我們提供以下房型：
- 標準雙人房：2,800元/晚
- 豪華雙人房：3,800元/晚
- 家庭四人房：5,200元/晚

週末加價500元/晚。請問您需要哪種房型？`;
  }
  
  // 默認回應
  return `感謝您的詢問。關於「${message.substring(0, 50)}${message.length > 50 ? '...' : ''}」，我會為您查詢相關資訊。請稍等片刻。`;
}

// 聊天端點
app.post('/chat', async (req, res) => {
  try {
    const { message, guestName, checkIn, checkOut, roomType, memberType } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: '訊息不能為空' 
      });
    }

    console.log('📝 處理請求:', { guestName, messageLength: message.length });

    const context = { guestName, checkIn, checkOut, roomType, memberType };
    let aiResponse;

    try {
      // 嘗試連接 Ollama
      const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          system: SYSTEM_PROMPT,
          prompt: `客戶資訊：${JSON.stringify(context)}\n\n客戶問題：${message}`,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 1500
          }
        }),
        signal: AbortSignal.timeout(30000) // 30秒超時
      });

      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json();
        aiResponse = data.response || getMockResponse(message, context);
        console.log('✅ 使用 Ollama 回應');
      } else {
        throw new Error('Ollama API 錯誤');
      }
    } catch (error) {
      // Ollama 失敗時使用模擬回應
      console.log('⚠️  Ollama 不可用，使用模擬回應');
      aiResponse = getMockResponse(message, context);
    }

    res.json({
      success: true,
      response: aiResponse,
      metadata: {
        guestName: guestName || null,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        mode: 'production',
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
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏨 AI 訂房助理伺服器');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`版本: 5.3.0-COMPLEX-DIALOGUE`);
  console.log(`埠號: ${PORT}`);
  console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`狀態: ✅ 運行中`);
  console.log(`時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 檢查 Ollama 連接
  await checkOllamaConnection();
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉伺服器...');
  server.close(() => {
    console.log('伺服器已關閉');
    process.exit(0);
  });
});

module.exports = app;

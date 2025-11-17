const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // 確保已安裝 node-fetch 或使用全域fetch
const app = express();
const PORT = process.env.PORT || 8080;

// 中間件設定
app.use(cors());
app.use(express.json());

// 初始化 n8n 服務
class N8NIntegrationService {
  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL;
    this.apiKey = process.env.N8N_API_KEY;
    this.enabled = !!process.env.N8N_WEBHOOK_URL;
  }

  async sendBookingConfirmation(bookingData) {
    if (!this.enabled) {
      console.log('🔕 n8n 整合未啟用，跳過發送訂房確認');
      return null;
    }

    try {
      console.log('📤 發送訂房確認到 n8n:', bookingData.orderNumber);

      const payload = {
        action: 'booking_confirmation',
        sessionId: bookingData.sessionId,
        orderNumber: bookingData.orderNumber,
        roomType: bookingData.roomType,
        roomCount: bookingData.roomCount,
        adults: bookingData.adults,
        children: bookingData.children,
        childAge: bookingData.childAge,
        nights: bookingData.nights,
        basePrice: bookingData.basePrice,
        finalPrice: bookingData.finalPrice,
        contactPerson: bookingData.contactPerson,
        checkInDate: bookingData.checkInDate,
        includesBreakfast: bookingData.includesBreakfast,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      const response = await fetch(`${this.baseUrl}/webhook/hotel-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`n8n 響應錯誤: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ n8n 訂房確認發送成功');
      return result;

    } catch (error) {
      console.error('❌ n8n 訂房確認發送失敗:', error.message);
      return null;
    }
  }

  async logCustomerInquiry(sessionId, userMessage, botResponse, intent) {
    if (!this.enabled) {
      return null;
    }

    try {
      const payload = {
        action: 'customer_inquiry',
        sessionId,
        userMessage,
        botResponse: botResponse.reply,
        intent: intent || 'unknown',
        step: botResponse.nextStep,
        timestamp: new Date().toISOString(),
        source: 'ai_hotel_assistant'
      };

      // Promise 不等待響應，避免阻塞
      fetch(`${this.baseUrl}/webhook/customer-inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error('❌ n8n 客戶查詢記錄失敗:', error.message);
      });
    } catch (error) {
      console.error('❌ n8n 客戶查詢記錄錯誤:', error.message);
    }
  }
}
const n8nService = new N8NIntegrationService();

// 匯入 webhook 路由
const webhookRouter = require('./routes/webhook');
app.use('/api', webhookRouter);

// 會話存儲
const sessions = new Map();

// 用戶會話建立/調用
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      step: 'welcome',
      data: {},
      context: {},
      conversationHistory: [],
      lastActivity: Date.now()
    });
  }
  return sessions.get(sessionId);
}

// 訊息清理函數
function cleanInputMessage(message) {
  if (!message) return '';
  let cleaned = message
    .replace(/\[translate:\s*|\]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || message;
}

// 健康檢查路由
app.get('/health', (req, res) => {
  console.log('✅ 健康檢查請求收到');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    message: '服務正常運行中'
  });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

// 以下省略... (保持你之前完整的對話處理與路由邏輯)

// 聊天訊息處理主路由
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

  if (!message) {
    return res.status(400).json({ error: '訊息不能為空' });
  }

  try {
    const session = getOrCreateSession(sessionId);
    session.lastActivity = Date.now();
    session.sessionId = sessionId;

    const response = processMessage(message, session);

    if (response && response.nextStep) {
      session.step = response.nextStep;
    }

    res.json({
      reply: response.reply,
      sessionId,
      step: session.step,
      timestamp: new Date().toISOString(),
      n8nEnabled: n8nService.enabled
    });

  } catch (error) {
    console.error('❌ 處理訊息時發生錯誤:', error);
    res.status(500).json({
      reply: '抱歉，處理您的請求時發生錯誤。請稍後再試或聯繫客服。',
      sessionId: sessionId || 'unknown',
      error: true
    });
  }
});

// 404 未匹配路由處理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '端點不存在',
    availableEndpoints: [
      'POST /api/chat',
      'POST /chat',
      'GET /api/session/:sessionId',
      'POST /api/session/:sessionId/reset',
      'GET /health',
      'GET /api/health'
    ]
  });
});

// 啟動伺服器並監聽
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 飯店客服機器人已啟動`);
  console.log(`📍 服務端口: ${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
  console.log(`🔗 n8n 整合: ${n8nService.enabled ? '已啟用' : '未啟用'}`);
  console.log(`💾 會話管理: 自動清理機制已啟用`);
});

// 優雅關機
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 信號，開始關機...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 信號，開始關機...');
  server.close(() => {
    console.log('✅ 伺服器已關閉');
    process.exit(0);
  });
});

// 全局未捕獲異常和 Promise 拒絕保護
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲異常:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未捕獲 Promise 拒絕:', reason);
  process.exit(1);
});

module.exports = app;


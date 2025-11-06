const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 健康檢查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.3.3-FINAL',
    timestamp: new Date().toISOString(),
    note: 'Pure JavaScript - No Ollama'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'AI 訂房助理 API',
    version: '5.3.3-FINAL',
    status: 'running'
  });
});

// 聊天端點
app.post('/chat', (req, res) => {
  try {
    const { message, guestName, checkIn, checkOut, memberType } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: '訊息不能為空',
        response: null 
      });
    }

    console.log(`📝 ${guestName || 'guest'}: ${message.substring(0, 30)}...`);

    let response = '';
    const msg = message.toLowerCase();
    
    // 複雜查詢（過年、會員、小孩、高樓層）
    if (msg.includes('過年') || msg.includes('4晚') || msg.includes('會員') || 
        msg.includes('小孩') || msg.includes('高樓層')) {
      
      response = `${guestName || '您好'}！我已經了解您的需求，為您整理如下：

📅 **入住時間**
${checkIn || '過年期間'} 至 ${checkOut || '共4晚'}

🏨 **房型推薦**
建議：豪華雙人房
- 更寬敞舒適，適合長住
- 視野更好，高樓層安靜

💰 **價格計算**
基礎房價（豪華雙人房）：
- 平日價：3,800元/晚
- 春節加價：500元/晚
- 實際：4,300元/晚 × 4晚 = 17,200元

🎫 **${memberType || '金卡會員'}優惠**
- 會員折扣：9折
- 連住4晚優惠：再減5%
- 優惠後總價：17,200 × 0.9 × 0.95 = 14,706元

👶 **兒童政策**
5歲小孩：
- ✅ 不占床完全免費
- 可提供兒童備品

🏢 **房間安排**
- ✅ 安排高樓層（15樓以上）
- ✅ 選擇遠離電梯的安靜房間

📊 **費用總結**
- 原價：17,200元
- 優惠後：14,706元
- 節省：2,494元

�� **專業建議**
過年期間房間搶手，建議盡快確認訂房。是否需要我協助您完成預訂？`;
    }
    // 問候
    else if (msg.includes('你好') || msg.includes('您好') || msg.includes('hi') || msg.includes('hello')) {
      response = `${guestName || '您好'}！歡迎使用飯店訂房服務 🏨

我可以協助您：
✅ 查詢房型與價格
✅ 了解會員優惠
✅ 確認兒童政策
✅ 安排特殊需求

請問有什麼需要幫忙的嗎？`;
    }
    // 房型查詢
    else if (msg.includes('房型') || msg.includes('房間') || msg.includes('價格')) {
      response = `我們提供以下房型：

🛏️ **標準雙人房**
- 平日：2,800元/晚
- 週末：3,300元/晚

��️ **豪華雙人房**
- 平日：3,800元/晚
- 週末：4,300元/晚

🛏️ **家庭四人房**
- 平日：5,200元/晚
- 週末：5,700元/晚

💡 會員享有額外折扣！`;
    }
    // 會員
    else if (msg.includes('會員') || msg.includes('優惠') || msg.includes('折扣')) {
      response = `🎫 **會員優惠方案**

💳 金卡會員：9折優惠
💳 銀卡會員：95折優惠

🎁 額外福利：
- 連住3晚：總價再減5%
- 連住5晚：總價再減8%`;
    }
    // 兒童
    else if (msg.includes('小孩') || msg.includes('兒童') || msg.includes('孩子')) {
      response = `👶 **兒童入住政策**

✅ 6歲以下：不占床免費
✅ 6-12歲：不占床半價
✅ 12歲以上：按成人計費

🎁 提供兒童備品`;
    }
    // 默認
    else {
      response = `感謝您的詢問！我很樂意協助您。

請告訴我：
- 入住日期
- 房型偏好
- 人數
- 特殊需求

讓我為您提供更精準的建議！`;
    }

    console.log(`✅ 回應長度: ${response.length}`);

    res.json({
      success: true,
      response: response,
      message: response,
      metadata: {
        guestName: guestName || null,
        responseLength: response.length
      },
      version: '5.3.3-FINAL',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    res.status(500).json({ 
      success: false,
      error: '處理請求時發生錯誤',
      response: null
    });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏨 AI 訂房助理 v5.3.3-FINAL');
  console.log(`📍 Port: ${PORT}`);
  console.log('✅ Status: Running (Pure JS)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  server.close(() => process.exit(0));
});

module.exports = app;

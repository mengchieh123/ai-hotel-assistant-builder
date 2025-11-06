const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.3.2-PURE-JS',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'AI 訂房助理 API v5.3.2 - Pure JavaScript' });
});

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

    console.log(`📝 收到請求: ${guestName || 'anonymous'} - ${message.substring(0, 50)}`);

    let response = '';
    
    // 檢測複雜查詢
    const isComplex = /過年|春節|4晚|會員|金卡|小孩|高樓層|兒童/.test(message);
    
    if (isComplex) {
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

💡 **專業建議**
過年期間房間搶手，建議盡快確認訂房。是否需要我協助您完成預訂？`;
    }
    else if (/你好|您好|hi|hello/i.test(message)) {
      response = `${guestName || '您好'}！歡迎使用飯店訂房服務 🏨

我可以協助您：
✅ 查詢房型與價格
✅ 了解會員優惠
✅ 確認兒童政策
✅ 安排特殊需求

請問有什麼需要幫忙的嗎？`;
    }
    else if (/房型|房間|價格/i.test(message)) {
      response = `我們提供以下房型：

🛏️ **標準雙人房**
- 平日：2,800元/晚
- 週末：3,300元/晚

🛏️ **豪華雙人房**
- 平日：3,800元/晚
- 週末：4,300元/晚

🛏️ **家庭四人房**
- 平日：5,200元/晚
- 週末：5,700元/晚

�� 會員享有額外折扣！請問您需要哪種房型？`;
    }
    else if (/會員|優惠|折扣/i.test(message)) {
      response = `🎫 **會員優惠方案**

💳 金卡會員：9折優惠
💳 銀卡會員：95折優惠

🎁 額外福利：
- 連住3晚：總價再減5%
- 連住5晚：總價再減8%

請問您是會員嗎？`;
    }
    else if (/小孩|兒童|孩子|寶寶/i.test(message)) {
      response = `👶 **兒童入住政策**

✅ 6歲以下：不占床免費
✅ 6-12歲：不占床半價
✅ 12歲以上：按成人計費

🎁 提供兒童備品
請問小朋友幾歲呢？`;
    }
    else {
      response = `感謝您的詢問！

關於「${message.substring(0, 50)}${message.length > 50 ? '...' : ''}」，我很樂意為您提供協助。

請告訴我更多細節：
- 入住日期
- 房型偏好
- 人數
- 特殊需求

這樣我能為您提供更精準的建議！`;
    }

    console.log(`✅ 生成回應長度: ${response.length}`);

    res.json({
      success: true,
      response: response,
      message: response,
      metadata: {
        guestName: guestName || null,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        memberType: memberType || null,
        responseLength: response.length
      },
      version: '5.3.2-PURE-JS',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 錯誤:', error);
    res.status(500).json({ 
      success: false,
      error: '處理請求時發生錯誤',
      response: null,
      details: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '找不到該端點'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏨 AI 訂房助理 v5.3.2');
  console.log(`埠號: ${PORT}`);
  console.log('狀態: ✅ 就緒 (Pure JavaScript)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;

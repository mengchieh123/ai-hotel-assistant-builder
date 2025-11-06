const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 從日期或訊息中計算入住晚數
function calculateNights(checkIn, checkOut, message) {
  if (checkIn && checkOut) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffTime = endDate.getTime() - startDate.getTime();
    const nights = Math.round(diffTime / (1000 * 3600 * 24));
    return nights > 0 ? nights : 1;
  }

  const nightMatch = message.match(/(\d+)[天晚]/);
  if (nightMatch) {
    const n = parseInt(nightMatch[1], 10);
    return n > 0 ? n : 1;
  }

  return 1;
}

// 價格計算
function calculatePrice(nights, memberType, specialDate) {
  const basePrice = 3800;
  const holidaySurcharge = specialDate ? 500 : 0;
  const totalBasePrice = (basePrice + holidaySurcharge) * nights;

  let discountRate = 1;
  if (memberType === '金卡會員') discountRate = 0.9;
  else if (memberType === '銀卡會員') discountRate = 0.95;

  const discountedPrice = Math.round(totalBasePrice * discountRate);

  return { basePrice, holidaySurcharge, totalBasePrice, discountRate, discountedPrice };
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.4.2-FINAL',
    timestamp: new Date().toISOString()
  });
});

app.post('/chat', (req, res) => {
  try {
    const { message, guestName, checkIn, checkOut, memberType, specialRequest } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: '訊息不能為空',
        response: null
      });
    }

    const isSpecialDate = /聖誕節|12月25日/.test(message);
    const nights = calculateNights(checkIn, checkOut, message);
    const pricing = calculatePrice(nights, memberType, isSpecialDate);

    const responseLines = [];

    responseLines.push(`${guestName || '您好'}，感謝您的訂房需求。`);
    responseLines.push(`您預計入住 ${nights} 晚（${checkIn || '未指定起始日期'} 至 ${checkOut || '未指定結束日期'}）。`);
    if (isSpecialDate) {
      responseLines.push(`包含聖誕節加價每晚 ${pricing.holidaySurcharge} 元。`);
    }
    responseLines.push(`基礎房價為 ${pricing.basePrice} 元/晚，總計 ${pricing.totalBasePrice} 元。`);
    responseLines.push(`會員等級：${memberType || '非會員'}，享有折扣 ${(1 - pricing.discountRate) * 100}% ，折後價格為 ${pricing.discountedPrice} 元。`);
    if (specialRequest && specialRequest.trim() !== '') {
      responseLines.push(`特殊要求：${specialRequest}。`);
    }
    responseLines.push('兒童政策：6歲以下不占床免費，6-12歲不占床半價。');
    responseLines.push('房間安排：可安排高樓層安靜房間。');
    responseLines.push('如需更多協助，請隨時告知！');

    const response = responseLines.join('\n');

    res.json({
      success: true,
      response,
      version: '5.4.2-FINAL',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('處理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '處理請求時發生錯誤',
      response: null,
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI 訂房助理服務運行於端口 ${PORT}，版本 5.4.2-FINAL`);
});

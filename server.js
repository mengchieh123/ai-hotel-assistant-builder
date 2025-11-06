const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.4.0-DETAILED-RESPONSE',
    timestamp: new Date().toISOString()
  });
});

function calculatePrice(checkIn, checkOut, memberType, specialDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  let nights = 4;
  if (checkIn && checkOut) {
    nights = Math.round((new Date(checkOut) - new Date(checkIn)) / oneDay);
  }
  const basePrice = 3800;
  const holidaySurcharge = specialDate ? 500 : 0;
  const totalBasePrice = (basePrice + holidaySurcharge) * nights;
  let discount = 1;
  if (memberType === '金卡會員') discount = 0.9;
  else if (memberType === '銀卡會員') discount = 0.95;
  const discountedPrice = Math.round(totalBasePrice * discount);
  return {
    nights,
    basePrice,
    holidaySurcharge,
    totalBasePrice,
    discountRate: discount,
    discountedPrice
  };
}

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
    const calc = calculatePrice(checkIn, checkOut, memberType, isSpecialDate);

    const responseLines = [];

    responseLines.push(`${guestName || '您好'}，感謝您的訂房需求。`);
    responseLines.push(`您預計入住 ${calc.nights} 晚，基礎房價為 ${calc.basePrice} 元/晚，${isSpecialDate ? '包含聖誕節加價 ' + calc.holidaySurcharge + ' 元/晚，' : ''}總計 ${calc.totalBasePrice} 元。`);
    responseLines.push(`會員 ${memberType || '非會員'}，享有折扣 ${((1 - calc.discountRate) * 100).toFixed(0)}%，優惠後價格為 ${calc.discountedPrice} 元。`);

    if (specialRequest && specialRequest.trim() !== '') {
      responseLines.push(`特殊要求：${specialRequest}。`);
    }

    responseLines.push('兒童政策：6歲以下不占床免費，6-12歲不占床半價。');
    responseLines.push('房間安排：可安排高樓層安靜房間。');
    responseLines.push('如需進一步協助，請隨時告知！');

    const response = responseLines.join('\n');

    res.json({
      success: true,
      response,
      version: '5.4.0-DETAILED-RESPONSE',
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
  console.log(`AI 訂房助理服務運行於端口 ${PORT}，版本 v5.4.0-DETAILED-RESPONSE`);
});

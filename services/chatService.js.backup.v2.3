const pricingService = require('./pricingService');
const memberService = require('./memberService');

async function handleChat(data) {
  const { message, guestName, checkIn, checkOut, memberType, specialRequest } = data;

  if (!message || message.trim() === '') {
    return {
      success: false,
      error: '訊息不能為空',
      response: null
    };
  }

  const isSpecialDate = /聖誕節|12月25日/.test(message);
  const nights = pricingService.calculateNights(checkIn, checkOut);
  const pricing = pricingService.calculatePrice(nights, memberService.getMemberLevel(memberType), isSpecialDate);

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

  return {
    success: true,
    response: responseLines.join('\n'),
    version: '5.4.2-FINAL',
    timestamp: new Date().toISOString()
  };
}

module.exports = { handleChat };

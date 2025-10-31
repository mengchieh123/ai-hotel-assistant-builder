const fs = require('fs');

const serverPath = './server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 完全替換對話處理邏輯 - 簡化版
const newHandler = `
app.post('/api/assistant/chat', (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const lowerMessage = message.toLowerCase();

    // 1. 會員折扣識別 - 簡化邏輯
    if (lowerMessage.includes('會員') || lowerMessage.includes('折扣') || lowerMessage.includes('優惠')) {
      return res.json({
        success: true,
        reply: "🎯 **會員優惠資訊**\\n\\n⭐ 普通會員 - 5% 折扣\\n⭐ 黃金會員 - 10% 折扣\\n⭐ 白金會員 - 15% 折扣\\n\\n💡 立即加入會員享受專屬優惠！",
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "membership_info",
        hotel: "台北晶華酒店"
      });
    }
    
    // 2. 促銷活動識別 - 簡化邏輯
    if (lowerMessage.includes('促銷') || lowerMessage.includes('早鳥') || lowerMessage.includes('特惠')) {
      return res.json({
        success: true,
        reply: "🎉 **促銷活動資訊**\\n\\n🔥 早鳥優惠 - 15% off (提前30天預訂)\\n🔥 連住優惠 - 10% off (連續3晚以上)\\n🔥 季節特惠 - 20% off\\n\\n📞 詳情請洽訂房組！",
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "promotion_info", 
        hotel: "台北晶華酒店"
      });
    }

    // 3. 房型查詢
    if (lowerMessage.includes('房型') || lowerMessage.includes('房價')) {
      return res.json({
        success: true,
        reply: "🏨 **房型與價格**\\n\\n⭐ 豪華客房 - 3800元/晚\\n⭐ 行政套房 - 6800元/晚\\n⭐ 家庭套房 - 8800元/晚\\n💡 需要查詢空房嗎？",
        session_id: session_id || 'session_' + Date.now(), 
        timestamp: new Date().toISOString(),
        response_type: "room_info",
        hotel: "台北晶華酒店"
      });
    }

    // 4. 默認回復
    return res.json({
      success: true,
      reply: "👋 **您好！歡迎光臨台北晶華酒店**\\n\\n我是AI酒店助理，可為您提供：\\n• 🏨 房型與價格查詢\\n• 🎯 會員優惠資訊\\n• 🎉 促銷活動詳情\\n\\n請告訴我您想了解什麼？",
      session_id: session_id || 'session_' + Date.now(),
      timestamp: new Date().toISOString(),
      response_type: "hotel_assistant",
      hotel: "台北晶華酒店"
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: '伺服器錯誤'
    });
  }
});
`;

// 替換現有路由
if (content.includes("app.post('/api/assistant/chat'")) {
  const start = content.indexOf("app.post('/api/assistant/chat'");
  const nextRoute = content.indexOf("app.post(", start + 10);
  const end = nextRoute > start ? nextRoute : content.length;
  
  content = content.substring(0, start) + newHandler + content.substring(end);
}

fs.writeFileSync(serverPath, content);
console.log('✅ 演示版修復完成！');

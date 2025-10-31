const fs = require('fs');

const serverPath = './server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 正確的功能識別邏輯
const correctLogic = `app.post('/api/assistant/chat', (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '請輸入詢問內容'
      });
    }

    console.log('💬 用戶詢問:', message);
    
    // [AI-AUTO] 功能意圖識別
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('會員') || lowerMessage.includes('折扣') || lowerMessage.includes('優惠') || lowerMessage.includes('積分')) {
      const reply = "🎯 **會員權益資訊**\\n\\n⭐ **普通會員**\\n   • 折扣: 5%\\n   • 權益: 積分累積、會員專屬價格\\n\\n🌟 **黃金會員**\\n   • 折扣: 10%\\n   • 權益: 專屬客服、房型升級機會、提早入住\\n\\n💡 請聯繫客服升級會員等級！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: 'membership_info'
      });
    }
    
    if (lowerMessage.includes('促銷') || lowerMessage.includes('優惠') || lowerMessage.includes('活動') || lowerMessage.includes('早鳥') || lowerMessage.includes('連住')) {
      const reply = "🎉 **當前促銷活動**\\n\\n🔥 **早鳥優惠**\\n   • 折扣: 15%\\n   • 條件: 提前7天預訂\\n\\n🔥 **連住優惠**\\n   • 折扣: 10%\\n   • 條件: 連續入住3晚以上\\n\\n💡 預訂時告知促銷名稱即可享受優惠！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: 'promotion_info'
      });
    }
    
    // 原有對話邏輯
    console.log('🤖 AI Chat on port', 8080, ':', message);
    res.json({
      success: true,
      reply: "👋 **您好！歡迎光臨台北晶華酒店**\\n\\n我是您的AI酒店助理，可以為您提供：\\n\\n• 🏨 房型介紹與價格查詢\\n• 🏊 設施服務詳細說明\\n• 🍽️ 餐廳預約與菜單資訊\\n• 📅 訂房協助與空房查詢\\n• 📍 交通指引與位置資訊\\n\\n請告訴我您想了解什麼？例如：「我想訂房」或「有什麼設施？」",
      session_id: session_id || 'session_' + Date.now(),
      timestamp: new Date().toISOString(),
      response_type: 'hotel_assistant',
      hotel: '台北晶華酒店'
    });
    
  } catch (error) {
    console.error('❌ 對話處理錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務暫時不可用',
      timestamp: new Date().toISOString()
    });
  }
});`;

// 找到並替換整個對話處理函數
const chatHandlerRegex = /app\.post\('\/api\/assistant\/chat'[^}]+}/s;

if (chatHandlerRegex.test(content)) {
  content = content.replace(chatHandlerRegex, correctLogic);
  fs.writeFileSync(serverPath, content);
  console.log('✅ server.js 修復完成！');
} else {
  console.log('❌ 找不到對話處理函數，使用備用方案');
  
  // 備用方案：在文件末尾添加新函數
  const backupHandler = `

// [AI-AUTO] 修復版對話處理
${correctLogic}
`;
  content += backupHandler;
  fs.writeFileSync(serverPath, content);
  console.log('✅ 使用備用方案修復完成！');
}

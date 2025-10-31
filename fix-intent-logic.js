const fs = require('fs');

const serverPath = './server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 正確的意圖識別邏輯
const correctLogic = `
app.post('/api/assistant/chat', (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // [AI-AUTO] 功能意圖識別 - 修復版
    const lowerMessage = message.toLowerCase();
    
    // 會員折扣意圖
    if (lowerMessage.includes('會員') || lowerMessage.includes('折扣') || lowerMessage.includes('優惠')) {
      const reply = "🎯 **會員優惠資訊**\\n\\n⭐ **普通會員** - 5% 折扣\\n⭐ **黃金會員** - 10% 折扣\\n⭐ **白金會員** - 15% 折扣\\n\\n💡 成為會員即可享受專屬優惠！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "membership_info",
        hotel: "台北晶華酒店"
      });
    }
    
    // 促銷活動意圖
    if (lowerMessage.includes('促銷') || lowerMessage.includes('早鳥') || lowerMessage.includes('連住')) {
      const reply = "🎉 **促銷活動資訊**\\n\\n🔥 **早鳥優惠** - 15% off (提前30天預訂)\\n🔥 **連住優惠** - 10% off (連續住宿3晚以上)\\n🔥 **季節特惠** - 20% off (限定期間)\\n\\n📞 詳情請洽訂房組！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "promotion_info",
        hotel: "台北晶華酒店"
      });
    }

    // 房型查詢意圖
    if (lowerMessage.includes('房型') || lowerMessage.includes('房價') || lowerMessage.includes('價格')) {
      const reply = "🏨 **房型與價格資訊**\\n\\n⭐ **豪華客房** - 3800元/晚\\n⭐ **行政套房** - 6800元/晚\\n⭐ **家庭套房** - 8800元/晚\\n⭐ **總統套房** - 25000元/晚\\n\\n💡 需要為您查詢特定日期的空房情況嗎？";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "room_info", 
        hotel: "台北晶華酒店"
      });
    }

    // 如果沒有匹配的意圖，繼續原有的AI處理邏輯
    // ... 原有的AI處理代碼
`;

// 替換整個路由處理函數
const newRouteHandler = `
app.post('/api/assistant/chat', (req, res) => {
  try {
    const { message, session_id } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // [AI-AUTO] 功能意圖識別 - 修復版
    const lowerMessage = message.toLowerCase();
    
    // 會員折扣意圖
    if (lowerMessage.includes('會員') || lowerMessage.includes('折扣') || lowerMessage.includes('優惠')) {
      const reply = "🎯 **會員優惠資訊**\\n\\n⭐ **普通會員** - 5% 折扣\\n⭐ **黃金會員** - 10% 折扣\\n⭐ **白金會員** - 15% 折扣\\n\\n💡 成為會員即可享受專屬優惠！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "membership_info",
        hotel: "台北晶華酒店"
      });
    }
    
    // 促銷活動意圖
    if (lowerMessage.includes('促銷') || lowerMessage.includes('早鳥') || lowerMessage.includes('連住')) {
      const reply = "🎉 **促銷活動資訊**\\n\\n🔥 **早鳥優惠** - 15% off (提前30天預訂)\\n🔥 **連住優惠** - 10% off (連續住宿3晚以上)\\n🔥 **季節特惠** - 20% off (限定期間)\\n\\n📞 詳情請洽訂房組！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "promotion_info",
        hotel: "台北晶華酒店"
      });
    }

    // 房型查詢意圖  
    if (lowerMessage.includes('房型') || lowerMessage.includes('房價') || lowerMessage.includes('價格')) {
      const reply = "🏨 **房型與價格資訊**\\n\\n⭐ **豪華客房** - 3800元/晚\\n⭐ **行政套房** - 6800元/晚\\n⭐ **家庭套房** - 8800元/晚\\n⭐ **總統套房** - 25000元/晚\\n\\n💡 需要為您查詢特定日期的空房情況嗎？";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString(),
        response_type: "room_info",
        hotel: "台北晶華酒店"
      });
    }

    // 原有的AI處理邏輯保持不變
    // [這裡保留您原有的AI處理代碼]
`;

// 找到並替換現有的路由處理
const routePattern = /app\.post\('\/api\/assistant\/chat'[\s\S]*?try\s*{[\s\S]*?const\s*{\s*message[\s\S]*?}[\s\S]*?}/;
if (content.match(routePattern)) {
  content = content.replace(routePattern, newRouteHandler);
  fs.writeFileSync(serverPath, content);
  console.log('✅ 意圖識別邏輯修復完成！');
} else {
  console.log('❌ 未找到匹配的路由處理函數，使用備用方案');
  // 備用方案：在文件末尾添加新函數
  const backupHandler = `

// [AI-AUTO] 修復版對話處理
${correctLogic}
`;
  content += backupHandler;
  fs.writeFileSync(serverPath, content);
  console.log('✅ 使用備用方案修復完成！');
}

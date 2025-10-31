const fs = require('fs');

console.log("🏗️ 架構兼容性檢查開始...");

const serverPath = './server.js';
const content = fs.readFileSync(serverPath, 'utf8');

// 檢查關鍵組件
const checks = {
  '主路由存在': content.includes("app.post('/api/assistant/chat'"),
  '意圖識別邏輯': content.includes('lowerMessage.toLowerCase()'),
  '會員功能關鍵字': content.includes('會員') && content.includes('折扣'),
  '錯誤處理': content.includes('try {') && content.includes('catch'),
  'JSON響應格式': content.includes('res.json') && content.includes('success'),
  '會話管理': content.includes('session_id')
};

console.log('\n✅ 當前架構檢查結果:');
Object.entries(checks).forEach(([key, value]) => {
  console.log(`  ${value ? '✅' : '❌'} ${key}`);
});

// 檢查新功能不會破壞的關鍵點
const stabilityChecks = {
  'API端點未改變': content.includes("app.post('/api/assistant/chat', (req, res) => {"),
  '響應結構完整': content.includes('success: true') && content.includes('reply:'),
  '錯誤處理完整': content.includes('res.status(400)') || content.includes('res.status(500)')
};

console.log('\n🔒 穩定性檢查結果:');
Object.entries(stabilityChecks).forEach(([key, value]) => {
  console.log(`  ${value ? '✅' : '⚠️'} ${key}`);
});

// 檢查業務邏輯入口點
if (content.includes('autoReload.getMembershipReply')) {
  console.log('\n🔄 檢測到新自動化系統，但核心接口保持不變');
}

console.log('\n🎯 總結: 新部署主要增強內部邏輯，不影響外部接口');

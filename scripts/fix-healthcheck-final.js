const fs = require('fs');

console.log('🔧 修復健康檢查問題...\n');

// 讀取當前 server.js
const serverCode = fs.readFileSync('server.js', 'utf8');

// 檢查健康檢查端點
if (serverCode.includes("app.get('/health'")) {
    console.log('✅ 健康檢查端點存在');
} else {
    console.log('❌ 健康檢查端點不存在，添加中...');
    const newCode = serverCode.replace(
        "app.get('/', (req, res) => {",
        "app.get('/health', (req, res) => {\n  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });\n});\n\napp.get('/', (req, res) => {"
    );
    fs.writeFileSync('server.js', newCode);
    console.log('✅ 已添加健康檢查端點');
}

// 確保服務器監聽正確的端口和地址
if (serverCode.includes("0.0.0.0")) {
    console.log('✅ 服務器監聽 0.0.0.0');
} else {
    console.log('❌ 需要修復監聽地址');
    const newCode = serverCode.replace(
        "app.listen(PORT, () => {",
        "app.listen(PORT, '0.0.0.0', () => {"
    );
    fs.writeFileSync('server.js', newCode);
    console.log('✅ 已修復監聽地址');
}

console.log('\n📋 修復完成！');

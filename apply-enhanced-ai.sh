#!/bin/bash

echo "🔧 應用增強版 AI 服務到 server.js"
echo "=========================================="
echo ""

# 1. 備份當前 server.js
echo "1️⃣ 備份 server.js..."
cp server.js server.js.backup.integration.$(date +%Y%m%d-%H%M%S)
echo "   ✅ 備份完成"

# 2. 檢查當前引用
echo ""
echo "2️⃣ 檢查當前 AI 服務引用..."
if grep -q "mock-ai-service" server.js; then
    echo "   📝 當前使用: mock-ai-service"
    echo "   🔄 準備更新為: enhanced-ai-service"
    
    # 執行替換
    sed -i.bak "s|require('./services/mock-ai-service')|require('./services/enhanced-ai-service')|g" server.js
    sed -i.bak 's|require("./services/mock-ai-service")|require("./services/enhanced-ai-service")|g' server.js
    
    # 清理備份文件
    rm -f server.js.bak
    
    echo "   ✅ 已更新引用"
elif grep -q "enhanced-ai-service" server.js; then
    echo "   ✅ 已經使用 enhanced-ai-service，無需更新"
else
    echo "   ⚠️  未找到標準 AI 服務引用"
    echo "   請手動檢查 server.js"
fi

# 3. 驗證修改
echo ""
echo "3️⃣ 驗證修改..."
echo "   當前 AI 服務引用："
grep "require.*ai.*service" server.js | head -5

# 4. 語法檢查
echo ""
echo "4️⃣ JavaScript 語法檢查..."
node -c server.js
if [ $? -eq 0 ]; then
    echo "   ✅ server.js 語法正確"
else
    echo "   ❌ server.js 語法錯誤，請檢查"
    exit 1
fi

node -c services/enhanced-ai-service.js
if [ $? -eq 0 ]; then
    echo "   ✅ enhanced-ai-service.js 語法正確"
else
    echo "   ❌ enhanced-ai-service.js 語法錯誤，請檢查"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 應用完成"
echo "=========================================="
echo ""
echo "📋 查看變更："
echo "   git diff server.js"
echo ""
echo "🧪 本地測試："
echo "   node server.js"
echo ""
echo "🚀 部署："
echo "   bash deploy-enhanced.sh"


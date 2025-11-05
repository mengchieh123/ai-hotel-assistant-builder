#!/bin/bash

echo "🔧 自動添加 CORS 支持"
echo "=========================================="
echo ""

# 1. 備份原文件
echo "1️⃣ 備份 server.js..."
cp server.js server.js.backup.$(date +%Y%m%d-%H%M%S)
echo "   ✅ 備份完成"

# 2. 檢查是否已有 CORS
if grep -q "Access-Control-Allow-Origin" server.js; then
    echo ""
    echo "✅ CORS 已存在，無需添加"
    exit 0
fi

# 3. 在 app 定義後、第一個路由前添加 CORS
echo ""
echo "2️⃣ 添加 CORS 中間件..."

# 找到 const app = express() 或類似行，在其後插入 CORS
sed -i '/const app = express()/a\
\
// CORS 中間件 - 允許跨域請求\
app.use((req, res, next) => {\
  res.header("Access-Control-Allow-Origin", "*");\
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");\
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");\
  \
  // 處理 OPTIONS 預檢請求\
  if (req.method === "OPTIONS") {\
    return res.sendStatus(200);\
  }\
  \
  next();\
});' server.js

if [ $? -eq 0 ]; then
    echo "   ✅ CORS 中間件已添加"
else
    echo "   ⚠️  自動添加失敗，請手動添加"
    exit 1
fi

# 4. 驗證修改
echo ""
echo "3️⃣ 驗證修改..."
if grep -q "Access-Control-Allow-Origin" server.js; then
    echo "   ✅ CORS 代碼已確認存在"
    echo ""
    echo "預覽添加的代碼："
    grep -A 10 "CORS 中間件" server.js | head -12
else
    echo "   ❌ 驗證失敗"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ CORS 支持已添加"
echo "=========================================="
echo ""
echo "📋 下一步："
echo "1. 檢查修改: git diff server.js"
echo "2. 部署更新: bash correct-deploy.sh"
echo "3. 等待 2-3 分鐘"
echo "4. 重新測試前端頁面"


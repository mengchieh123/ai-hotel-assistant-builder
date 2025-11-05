#!/bin/bash

echo "🔧 添加 CORS 支持到 server.js"
echo "=========================================="
echo ""

# 檢查 server.js 是否已有 CORS
if grep -q "Access-Control-Allow-Origin" server.js; then
    echo "✅ server.js 已包含 CORS 設定"
else
    echo "📝 正在添加 CORS 支持..."
    
    # 創建備份
    cp server.js server.js.backup
    
    # 在所有響應中添加 CORS 頭部
    # 找到 app.get('/health' 之前添加 CORS 中間件
    
    cat > cors-middleware.txt << 'CORSMID'

// CORS 中間件 - 允許跨域請求
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  
  // 處理 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
CORSMID

    echo ""
    echo "請手動執行以下步驟："
    echo ""
    echo "1. 打開 server.js"
    echo "2. 在 'app.get('/health'' 之前添加以下代碼："
    echo ""
    cat cors-middleware.txt
    echo ""
    echo "3. 保存並執行部署："
    echo "   bash correct-deploy.sh"
fi


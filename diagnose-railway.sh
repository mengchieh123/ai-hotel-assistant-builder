#!/bin/bash

echo "🔍 Railway 服務診斷"
echo "===================="

# 檢查服務狀態
echo ""
echo "1️⃣ 服務狀態:"
railway status

# 檢查環境變數
echo ""
echo "2️⃣ 環境變數:"
railway variables | grep -E "PORT|URL"

# 查看最近日誌
echo ""
echo "3️⃣ 最近日誌 (最後 20 行):"
railway logs --tail 20

# 檢查進程
echo ""
echo "4️⃣ 運行中的進程:"
railway ps


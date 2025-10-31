#!/bin/bash
echo "🚀 安全部署流程開始..."

# 1. 備份當前版本
echo "📦 備份當前 server.js..."
cp server.js server.js.backup

# 2. 檢查業務規格文件是否存在
if [ ! -f "business_speckit.yaml" ]; then
  echo "📄 創建業務規格文件..."
  cat > business_speckit.yaml << 'BUSINESS_EOF'
name: "hotel_assistant"
version: "2.0.0"

business_rules:
  membership:
    levels:
      - name: "普通會員"
        discount: 5
      - name: "黃金會員"  
        discount: 10
      - name: "白金會員"
        discount: 15
      - name: "鑽石會員"
        discount: 20
        benefits:
          - "免費機場接送"
          - "私人管家服務"

  promotions:
    campaigns:
      - name: "早鳥優惠"
        discount: 15
        conditions: "提前30天預訂"
      - name: "週末特惠"
        discount: 25
        conditions: "週五至週日入住"
BUSINESS_EOF
fi

# 3. 安裝必要依賴
echo "📚 安裝依賴..."
npm install chokidar yaml

# 4. 部署
echo "🚀 開始部署..."
git add .
git commit -m "feat: 增強業務規格支持和安全部署"
git push origin main

echo "🕐 部署中，等待90秒..."
sleep 90

# 5. 驗證部署
echo "✅ 部署完成，驗證新功能..."
./pre-deployment-test.sh

echo ""
echo "🎯 測試鑽石會員新功能:"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "鑽石會員有什麼特別服務？"}' | jq -r '.reply'

echo ""
echo "🔧 如果出現問題，運行: ./quick-rollback.sh"

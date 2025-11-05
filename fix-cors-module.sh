#!/bin/bash

echo "🔧 修復 CORS 模組缺失問題"
echo "=========================================="
echo ""

# 1. 檢查 package.json
echo "1️⃣ 檢查 package.json..."
if [ -f "package.json" ]; then
    echo "   ✅ package.json 存在"
    
    # 檢查是否包含 cors
    if grep -q '"cors"' package.json; then
        echo "   ✅ package.json 已包含 cors"
    else
        echo "   ❌ package.json 缺少 cors 依賴"
        echo "   正在添加..."
        
        # 使用 npm 添加 cors
        npm install cors --save
        
        if [ $? -eq 0 ]; then
            echo "   ✅ cors 已添加到 package.json"
        else
            echo "   ❌ 添加失敗"
            exit 1
        fi
    fi
else
    echo "   ❌ package.json 不存在，正在創建..."
    npm init -y
    npm install cors express --save
fi

# 2. 驗證 package.json 內容
echo ""
echo "2️⃣ 驗證 package.json 依賴..."
cat package.json | jq '.dependencies'

# 3. 確保 package-lock.json 存在
echo ""
echo "3️⃣ 確保 package-lock.json 已更新..."
npm install

# 4. 提交變更
echo ""
echo "4️⃣ 提交變更到 Git..."
git add package.json package-lock.json
git commit -m "fix: add cors dependency to package.json

- Added cors module to dependencies
- Updated package-lock.json
- Fixes MODULE_NOT_FOUND error in Railway deployment"

if [ $? -eq 0 ]; then
    echo "   ✅ 提交成功"
else
    echo "   ⚠️  可能沒有變更需要提交"
fi

# 5. 推送到 GitHub
echo ""
echo "5️⃣ 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "   ✅ 推送成功"
else
    echo "   ❌ 推送失敗"
    exit 1
fi

# 6. 觸發 Railway 部署
echo ""
echo "6️⃣ 觸發 Railway 重新部署..."
railway up --detach

if [ $? -eq 0 ]; then
    echo "   ✅ 部署已觸發"
else
    echo "   ❌ Railway 部署失敗"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 修復完成"
echo "=========================================="
echo ""
echo "⏳ 等待 2-3 分鐘後驗證："
echo "   bash smart-verify.sh"
echo ""
echo "或手動檢查："
echo "   railway logs --tail 30"


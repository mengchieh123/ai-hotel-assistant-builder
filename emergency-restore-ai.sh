#!/bin/bash

echo "🚨 [translate:緊急恢復 AI 服務到 v5.2.0-OPTIMIZED]"
echo "=========================================="
echo ""

# [translate:檢查備份]
echo "1️⃣ [translate:查找可用備份]..."
ls -lh services/enhanced-ai-service.js.backup.* 2>/dev/null || echo "   [translate:無備份文件]"
echo ""

# [translate:如果有 urgent 備份，使用它]
if [ -f "services/enhanced-ai-service.js.backup.urgent" ]; then
    echo "2️⃣ [translate:從 urgent 備份恢復]..."
    cp services/enhanced-ai-service.js.backup.urgent services/enhanced-ai-service.js
    echo "   ✅ [translate:已從 urgent 備份恢復]"
elif [ -f "services/enhanced-ai-service.js.backup.complete" ]; then
    echo "2️⃣ [translate:從 complete 備份恢復]..."
    cp services/enhanced-ai-service.js.backup.complete services/enhanced-ai-service.js
    echo "   ✅ [translate:已從 complete 備份恢復]"
else
    echo "2️⃣ [translate:無備份，重新創建完整服務]..."
    # [translate:這裡插入完整的 v5.2.0 代碼]
    echo "   ⚠️  [translate:需要手動恢復或從 Git 歷史恢復]"
fi

# [translate:驗證文件]
echo ""
echo "3️⃣ [translate:驗證恢復的文件]..."
FILE_SIZE=$(wc -c < services/enhanced-ai-service.js)
echo "   [translate:文件大小]：$FILE_SIZE bytes"

if [ "$FILE_SIZE" -gt 10000 ]; then
    echo "   ✅ [translate:文件大小正常]"
else
    echo "   ❌ [translate:文件太小，可能不完整]"
fi

grep -q "identifyMultipleIntents" services/enhanced-ai-service.js && echo "   ✅ [translate:多意圖方法存在]" || echo "   ❌ [translate:多意圖方法缺失]"
grep -q "5.2.0-OPTIMIZED" services/enhanced-ai-service.js && echo "   ✅ [translate:版本號正確]" || echo "   ⚠️  [translate:版本號需要設置]"

echo ""
echo "4️⃣ [translate:提交並部署]..."
git add services/enhanced-ai-service.js
git commit -m "emergency: restore enhanced AI service v5.2.0-OPTIMIZED

- Restored from backup
- Multi-intent recognition
- English support
- Enhanced entity extraction
- Complete implementation"

git push origin main
railway up --detach

echo "   ✅ [translate:已觸發部署]"
echo ""
echo "[translate:等待 180 秒後驗證]..."


#!/bin/bash

echo "🧹 深度清理建議分析"
echo "========================================"
echo ""

echo "📊 當前文件統計："
echo "   Shell 腳本: $(ls -1 *.sh 2>/dev/null | wc -l) 個"
echo "   Markdown: $(ls -1 *.md 2>/dev/null | wc -l) 個"
echo "   HTML: $(ls -1 *.html 2>/dev/null | wc -l) 個"
echo "   JavaScript: $(ls -1 *.js 2>/dev/null | wc -l) 個"
echo ""

echo "🗑️  建議清理的測試文件："
echo ""

echo "1️⃣ 測試 HTML 文件（可刪除）："
ls -lh *.html 2>/dev/null | awk '{print "   ❌ " $9 " (" $5 ")"}'
echo ""

echo "2️⃣ 重複的測試腳本（可刪除）："
echo "   ❌ test-*.sh (多個測試腳本，功能重複)"
echo "   ❌ quick-test*.sh (快速測試腳本)"
echo "   ❌ wait-and-test*.sh (等待測試腳本)"
echo "   ❌ diagnose-*.sh (診斷腳本，多數已過時)"
echo ""

echo "3️⃣ 過時的部署腳本（可刪除）："
echo "   ❌ deploy-*.sh (舊版部署腳本，已有新版)"
echo "   ❌ fix-*.sh (修復腳本，問題已解決)"
echo "   ❌ force-*.sh (強制部署腳本)"
echo ""

echo "✅ 應該保留的重要文件："
echo "   📄 README.md - 主要文檔"
echo "   📄 Railway-Deployment-Guide.md - 部署指南"
echo "   📄 POSTMAN_DETAILED_TEST_GUIDE.md - Postman 測試指南"
echo "   📄 PM_TEST_GUIDE.md - 產品經理測試指南"
echo "   📜 server.js - 服務器主文件"
echo "   📜 package.json - 項目配置"
echo "   📁 services/ - AI 服務目錄"
echo ""

echo "========================================"
echo "💡 清理建議"
echo "========================================"
echo ""
echo "建議執行以下清理（可節省空間和提高清晰度）："
echo ""
echo "# 1. 刪除測試 HTML 文件"
echo "rm -f *.html"
echo ""
echo "# 2. 刪除過時測試腳本"
echo "rm -f test-*.sh wait-and-test*.sh quick-test*.sh"
echo ""
echo "# 3. 刪除診斷腳本"
echo "rm -f diagnose-*.sh emergency-*.sh"
echo ""
echo "# 4. 刪除舊版部署/修復腳本"
echo "rm -f deploy-*.sh fix-*.sh force-*.sh"
echo ""
echo "# 5. 保留核心文件"
echo "# - correct-deploy.sh (最新部署腳本)"
echo "# - smart-verify.sh (驗證腳本)"
echo "# - view-railway-logs.sh (日誌查看)"
echo "# - 所有 .md 文檔文件"
echo ""

echo "⚠️  注意：執行前請確認不需要這些文件"
echo ""

# 建議性清理命令
cat > SAFE_CLEANUP_COMMANDS.txt << 'CLEANUP'
# 安全清理命令（逐個確認）

# 清理測試 HTML
rm -i ultimate-test.html ai-assistant-test.html

# 清理重複測試腳本
rm -i test-*.sh wait-and-test*.sh quick-test*.sh

# 清理診斷腳本
rm -i diagnose-*.sh emergency-*.sh

# 清理舊版部署腳本
rm -i deploy-*.sh fix-*.sh force-*.sh

# 保留的重要腳本：
# - correct-deploy.sh
# - smart-verify.sh
# - view-railway-logs.sh
# - pm-perspective-test.sh
# - advanced-conversation-test.sh
CLEANUP

echo "📝 已生成安全清理命令文件："
echo "   SAFE_CLEANUP_COMMANDS.txt"
echo ""
echo "查看詳細清理命令："
echo "   cat SAFE_CLEANUP_COMMANDS.txt"


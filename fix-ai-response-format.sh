#!/bin/bash

echo "🔧 [translate:修復 AI 服務響應格式]"

# [translate:備份現有服務]
cp services/enhanced-ai-service.js services/enhanced-ai-service.js.backup.format

# [translate:檢查當前 processMessage 方法]
echo "[translate:當前響應格式]:"
grep -A10 "return {" services/enhanced-ai-service.js | head -15

echo ""
echo "[translate:建議修改為標準格式，確保包含]:"
echo "  - message: [translate:AI 生成的回應]"
echo "  - intent: [translate:識別的意圖]"
echo "  - entities: [translate:提取的實體]"
echo "  - timestamp: [translate:時間戳]"
echo "  - version: [translate:版本號]"


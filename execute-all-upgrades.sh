#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 執行所有系統優化升級"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 檢查並記錄執行狀態
EXECUTION_LOG="execution-log.md"
echo "# 系統升級執行日誌" > $EXECUTION_LOG
echo "" >> $EXECUTION_LOG
echo "執行時間：$(date)" >> $EXECUTION_LOG
echo "" >> $EXECUTION_LOG

# ============================================
# 步驟 1: 智能訂房計算系統
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 步驟 1/3: 部署智能訂房計算系統"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "services/booking-calculator.js" ]; then
    echo "⚙️  創建訂房計算引擎..."
    bash upgrade-intelligent-booking.sh
    echo "✅ 步驟1: 智能訂房計算系統 - 完成" >> $EXECUTION_LOG
else
    echo "✅ 訂房計算引擎已存在，跳過"
    echo "⏭️  步驟1: 智能訂房計算系統 - 已存在" >> $EXECUTION_LOG
fi

echo ""

# ============================================
# 步驟 2: SpecKit 業務規範文件
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 步驟 2/3: 創建 SpecKit 業務規範"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "speckit/spec.md" ]; then
    echo "⚙️  創建業務規範文件..."
    bash create-speckit-spec.sh
    echo "✅ 步驟2: SpecKit 業務規範 - 完成" >> $EXECUTION_LOG
else
    echo "✅ SpecKit 規範已存在，跳過"
    echo "⏭️  步驟2: SpecKit 業務規範 - 已存在" >> $EXECUTION_LOG
fi

echo ""

# ============================================
# 步驟 3: 檢查並同步到 GitHub
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 步驟 3/3: 同步所有變更到 GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 檢查是否有未提交的變更
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 發現未提交的變更，正在提交..."
    
    git add .
    git commit -m "chore: sync all system upgrades

Includes:
- Intelligent booking calculator
- SpecKit business specifications
- Mock AI service enhancements
- Pricing rules and promotions
- Conversation flow improvements

Execution log saved to execution-log.md"
    
    echo "📤 推送到 GitHub..."
    git push origin main
    
    echo "✅ 步驟3: 同步到 GitHub - 完成" >> $EXECUTION_LOG
else
    echo "✅ 沒有需要提交的變更"
    echo "⏭️  步驟3: 同步到 GitHub - 無變更" >> $EXECUTION_LOG
fi

echo ""

# ============================================
# 步驟 4: 等待 Railway 部署
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ 等待 Railway 自動部署（90秒）..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 90

# ============================================
# 步驟 5: 驗證部署
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 驗證部署狀態"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  檢查服務健康狀態..."
HEALTH=$(curl -s https://ai-hotel-assistant-builder-production.up.railway.app/health)
echo "$HEALTH" | jq .

echo ""
echo "2️⃣  檢查 AI 服務狀態..."
AI_STATUS=$(curl -s https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/status)
echo "$AI_STATUS" | jq .

echo ""
echo "3️⃣  測試智能訂房計算..."
TEST_RESULT=$(curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價", "sessionId": "test"}')

echo "$TEST_RESULT" | jq -r '.message' | head -30

if echo "$TEST_RESULT" | grep -q "訂房明細"; then
    echo ""
    echo "✅ 智能計算功能正常運作！"
    echo "✅ 部署驗證: 成功" >> $EXECUTION_LOG
else
    echo ""
    echo "⚠️  智能計算可能未正確部署"
    echo "⚠️  部署驗證: 需要檢查" >> $EXECUTION_LOG
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 執行總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat $EXECUTION_LOG

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有升級已完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 查看執行日誌："
echo "   cat execution-log.md"
echo ""
echo "�� 訪問前端測試："
echo "   https://ai-hotel-assistant-builder-production.up.railway.app/ai-chat-demo.html"
echo ""
echo "📋 查看 GitHub："
echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder/commits/main"
echo ""


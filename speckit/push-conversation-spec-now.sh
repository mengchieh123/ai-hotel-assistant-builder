#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 立即推送 conversation-spec.yaml"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 確保目錄存在
mkdir -p speckit

# 2. 創建文件
echo "📝 創建 conversation-spec.yaml..."

cat > speckit/conversation-spec.yaml << 'EOFSPEC'
name: hotel-ai-conversation-system
version: 1.0.0
description: 飯店 AI 助手對話系統規格書
last_updated: 2025-11-04

# ============================================
# 對話場景定義
# ============================================
conversation_scenarios:
  
  # 1. 問候
  greeting:
    triggers: ["你好", "hi", "hello"]
    response: |
      您好！👋 我是台北晶華酒店的智能助手
      
      我可以協助您：
      🏨 查看房型和價格
      💰 計算訂房費用
      💎 了解會員權益
      🎉 查詢優惠活動
      
      請問今天想了解什麼呢？

  # 2. 房型查詢
  room_inquiry:
    triggers: ["房型", "房型介紹", "房間"]
    response: |
      🏨 **房型介紹**
      
      1. 豪華客房 - NT$ 8,800/晚
      2. 行政客房 - NT$ 12,800/晚（含早餐）
      3. 套房 - NT$ 18,800/晚（含早餐）
      4. 總統套房 - NT$ 38,800/晚（含早餐）
      
      💎 長住優惠：3晚95折、5晚9折、7晚85折

  # 3. 早餐資訊
  breakfast_inquiry:
    triggers: ["早餐", "加購早餐"]
    response: |
      🍳 **早餐資訊**
      
      ✅ 含早餐：行政客房、套房、總統套房
      ❌ 需加購：豪華客房（NT$ 650/人/天）
      
      🕐 供應時間：06:30-10:30
      📍 用餐地點：栢麗廳（2樓）

  # 4. 兒童政策
  child_policy:
    triggers: ["小孩", "兒童", "兒童收費"]
    response: |
      👶 **兒童收費**
      
      • 0-6歲：免費（不佔床）
      • 7-12歲：NT$ 800/晚（加床）
      • 13歲以上：NT$ 1,200/晚（加床）

  # 5. 優惠活動
  promotions_inquiry:
    triggers: ["優惠", "折扣", "促銷", "活動", "優惠專案"]
    response: |
      🎉 **優惠活動**
      
      🐦 早鳥：30天前預訂享8折
      🏠 連住：3晚95折、5晚9折、7晚85折
      🎓 學生：憑學生證85折
      👴 銀髮：65歲以上85折

  # 6. 會員制度
  membership_inquiry:
    triggers: ["會員", "會員制度", "會員權益"]
    response: |
      💎 **會員制度**
      
      銀卡：10晚或NT$15,000 → 5%折扣
      金卡：30晚或NT$45,000 → 8%折扣
      白金：60晚或NT$90,000 → 12%折扣

  # 7. 取消政策
  cancellation_policy:
    triggers: ["取消", "退訂", "退房"]
    response: |
      📋 **取消政策**
      
      ✅ 24小時前：免費取消
      ⚠️ 12小時前：退50%
      ❌ 12小時內：不可退款

  # 8. 設施查詢
  facilities_inquiry:
    triggers: ["設施", "服務", "游泳池", "健身房"]
    response: |
      🏨 **設施服務**
      
      🏊 游泳池（06:00-22:00）
      💪 健身房（24小時）
      🍽️ 餐廳（粵菜、鐵板燒、自助餐）
      🅿️ 免費停車

  # 9. 位置交通
  location_inquiry:
    triggers: ["位置", "地址", "交通"]
    response: |
      📍 **位置交通**
      
      🏢 台北市中山區中山北路二段41號
      🚇 捷運中山站步行3分鐘
      ✈️ 松山機場15分鐘

  # 10. 入退房時間
  checkin_time:
    triggers: ["入住時間", "退房時間"]
    response: |
      ⏰ **入退房時間**
      
      入住：15:00起
      退房：11:00前
      
      💎 金卡以上：12:00入住、13:00退房

# ============================================
# 多輪訂房流程
# ============================================
booking_flow:
  stage_1_greeting:
    trigger: ["我想訂房", "訂房", "預訂"]
    response: |
      好的！讓我幫您安排訂房 😊
      請告訴我：房型、天數、人數
  
  stage_2_collect:
    entities_needed:
      - roomType: "房型（豪華/行政/套房/總統）"
      - nights: "天數"
      - adults: "人數"
  
  stage_3_calculate:
    action: "計算總價並顯示明細"

# ============================================
# 實體提取
# ============================================
entity_extraction:
  roomType:
    patterns:
      - /豪華/ → deluxe
      - /行政/ → executive
      - /套房/ → suite
      - /總統/ → presidential
  
  nights:
    pattern: /(\d+)(晚|天)/
  
  adults:
    pattern: /(\d+)(大人|成人|位)/

# ============================================
# 性能指標
# ============================================
performance:
  intent_accuracy: 95%
  response_time: 500ms
  completion_rate: 85%
EOFSPEC

echo "✅ 文件已創建"

# 3. 檢查文件
if [ -f "speckit/conversation-spec.yaml" ]; then
    echo "✅ 文件存在：speckit/conversation-spec.yaml"
    echo "   大小：$(wc -c < speckit/conversation-spec.yaml) bytes"
else
    echo "❌ 文件創建失敗"
    exit 1
fi

# 4. Git 操作
echo ""
echo "📤 推送到 GitHub..."

# 確保在正確的分支
git branch

# 添加文件
git add speckit/conversation-spec.yaml

# 檢查狀態
echo ""
echo "📊 Git 狀態："
git status

# 提交
git commit -m "feat: add conversation-spec.yaml for AI chat system

✅ Defines 10 conversation scenarios
✅ Multi-turn booking flow
✅ Entity extraction patterns
✅ Performance targets

Location: speckit/conversation-spec.yaml"

# 推送
echo ""
echo "🚀 推送中..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 推送成功！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔗 GitHub 連結："
    echo "   https://github.com/mengchieh123/ai-hotel-assistant-builder/blob/main/speckit/conversation-spec.yaml"
    echo ""
    echo "📂 SpecKit 完整結構："
    echo "   speckit/"
    echo "   ├── business-spec.yaml"
    echo "   ├── conversation-spec.yaml  ← 新增"
    echo "   ├── README.md"
    echo "   ├── ARCHITECTURE.md"
    echo "   └── IMPLEMENTATION_PLAN.md"
    echo ""
    echo "💡 下一步："
    echo "   1. 前往 GitHub 確認文件"
    echo "   2. 查看文件內容"
    echo "   3. 根據 spec 實現對話邏輯"
    echo ""
else
    echo ""
    echo "❌ 推送失敗，請檢查錯誤訊息"
    echo ""
    echo "可能原因："
    echo "   • Git 認證問題"
    echo "   • 網路連線問題"
    echo "   • 分支權限問題"
    echo ""
    echo "手動推送指令："
    echo "   git add speckit/conversation-spec.yaml"
    echo "   git commit -m 'feat: add conversation-spec.yaml'"
    echo "   git push origin main"
    echo ""
fi


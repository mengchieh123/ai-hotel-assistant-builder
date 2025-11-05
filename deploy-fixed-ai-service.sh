#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 部署修復版 AI 服務"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "當前狀態："
echo "❌ 價格：NT\$ 7,500（舊版）"
echo "✅ 目標：NT\$ 3,800（business-spec v2.1.0）"
echo ""

echo "1️⃣ 檢查本地文件..."
if [ -f "services/mock-ai-service.js" ]; then
    echo "   ✅ services/mock-ai-service.js 存在"
    # 檢查是否包含正確價格
    if grep -q "3,800\|3800" services/mock-ai-service.js; then
        echo "   ✅ 文件包含正確價格 (NT\$ 3,800)"
        FILE_CORRECT=1
    else
        echo "   ❌ 文件仍是舊版價格"
        FILE_CORRECT=0
    fi
else
    echo "   ❌ services/mock-ai-service.js 不存在"
    FILE_CORRECT=0
fi

if [ $FILE_CORRECT -eq 0 ]; then
    echo ""
    echo "2️⃣ 創建符合 business-spec v2.1.0 的 AI 服務..."
    
    mkdir -p services
    
    cat > services/mock-ai-service.js << 'EOFAI'
// Mock AI Service v2.1.0-tw
// 符合 business-spec.yaml v2.1.0

class MockAIService {
  constructor() {
    this.sessionStore = new Map();
  }

  detectIntent(message) {
    const msg = message.toLowerCase().trim();
    
    if (/^(你好|嗨|哈囉|hi|hello)/.test(msg)) return 'greeting';
    if (/房型|房間種類|有什麼房|有哪些房/.test(msg)) return 'room_types';
    if (/價格|多少錢|房價|費用/.test(msg)) return 'price';
    if (/訂房|預訂|預約|我要訂/.test(msg)) return 'booking';
    if (/會員|積分|點數|等級/.test(msg)) return 'membership';
    if (/取消|退款|改期/.test(msg)) return 'cancellation';
    if (/小孩|兒童|嬰兒|幼兒/.test(msg)) return 'children';
    if (/入住|退房|幾點/.test(msg)) return 'checkin';
    if (/優惠|折扣|促銷/.test(msg)) return 'promotions';
    if (/付款|支付|pay|LINE.*Pay|超商/.test(msg)) return 'payment';
    if (/設施|設備|服務|游泳池/.test(msg)) return 'facilities';
    if (/早餐/.test(msg)) return 'breakfast';
    if (/停車/.test(msg)) return 'parking';
    if (/交通|怎麼去/.test(msg)) return 'transportation';
    if (/國旅券|振興券/.test(msg)) return 'taiwan_subsidy';
    
    return 'unknown';
  }

  generateResponse(intent) {
    const responses = {
      greeting: `🏨 歡迎光臨！我是您的訂房助理。

我可以協助您：
• 查詢房型與價格
• 了解會員制度與優惠
• 預訂房間
• 取消政策說明
• 兒童政策與家庭優惠
• 付款方式（LINE Pay、超商繳費等）

請問需要什麼協助？`,

      room_types: `🏨 **房型介紹**

**豪華客房** - NT$ 3,800/晚
• 2位大人 + 最多2位兒童（12歲以下）
• 房內最多3人（含加床）

**行政客房** - NT$ 4,800/晚
• 2位大人 + 最多2位兒童
• 含早餐、迎賓飲料

**家庭套房** - NT$ 6,800/晚
• 2大2小標準配置
• 含早餐、兒童設施

**總統套房** - NT$ 12,800/晚
• 4位大人
• 頂級禮遇、含早餐`,

      price: `💰 **房價資訊**

**基礎房價**
• 豪華客房：NT$ 3,800/晚
• 行政客房：NT$ 4,800/晚
• 家庭套房：NT$ 6,800/晚
• 總統套房：NT$ 12,800/晚

**連住優惠**
• 2晚：95折
• 3-4晚：90折
• 5-6晚：85折
• 7晚以上：80折

**早鳥優惠**
• 30天前：85折
• 60天前：80折
• 90天前：75折

**會員折扣**
• 銀卡：5%
• 金卡：8%
• 白金：12%

**官網直訂最優惠，比OTA便宜5-10%！**`,

      booking: `📅 **開始預訂**

請提供：
1. 入住日期（例：12/25）
2. 退房日期（例：12/27）
3. 房型選擇
4. 入住人數（大人+小孩）

我會為您計算總價！`,

      membership: `💎 **會員制度**

**普通會員** - 註冊即可
• 每NT$100=1點

**銀卡會員**
• 條件：入住5晚 或 消費NT$10,000
• 折扣：5%
• 權益：提前入住、延遲退房

**金卡會員**
• 條件：入住15晚 或 消費NT$30,000
• 折扣：8%
• 權益：12:00入住、免費升等

**白金會員**
• 條件：入住30晚 或 消費NT$60,000
• 折扣：12%
• 權益：保證升等、機場接送

**生日優惠：當月入住享85折** 🎂`,

      cancellation: `❌ **取消政策**

**免費取消**
• 入住前24小時（含）
• 全額退款

**部分退款**
• 入住前12-24小時
• 退款50%

**不可退款**
• 入住前12小時內

**天災條款**
• 颱風/地震可彈性處理`,

      children: `👶 **兒童政策**

**費用標準**
• 0-3歲：免費（提供嬰兒床）
• 4-6歲：免費（與大人同床）
• 7-12歲：NT$ 500/晚（含早餐）
• 13歲以上：NT$ 800/晚

**兒童設施**
• 兒童遊戲室（免費）
• 兒童戲水池
• 嬰兒床、澡盆（免費借用）`,

      checkin: `🏨 **入退房時間**

**標準時間**
• 入住：15:00
• 退房：11:00

**會員禮遇**
• 銀卡：提前1小時、延遲1小時
• 金卡：12:00入住、13:00退房
• 白金：保證12:00入住、14:00退房

**提早入住**
• 14:00後免費（視房況）

**延遲退房**
• 延遲1小時免費（視房況）`,

      promotions: `🎉 **優惠活動**

**連住優惠**
• 2晚：95折
• 3-4晚：90折
• 7晚以上：80折

**早鳥優惠**
• 30天前：85折
• 60天前：80折

**官網直訂**
• 比OTA便宜5-10%

**生日優惠** 🎂
• 當月入住：85折

**會員折扣**
• 銀卡：5% | 金卡：8% | 白金：12%

**國旅券**
• 最高折抵NT$1,000/房/晚`,

      payment: `💳 **付款方式**

**線上支付**
• LINE Pay（享3%回饋）✨
• 街口支付（享2%回饋）
• 信用卡、Apple Pay

**超商繳費** 🏪
• 7-11、全家、萊爾富、OK
• 3天內完成

**分期付款**
• 滿NT$3,000：3期免息
• 滿NT$6,000：6期免息

**發票開立**
• 電子發票（可存載具）
• 三聯式發票（提供統編）`,

      taiwan_subsidy: `🇹🇼 **政府補助**

**國旅券**
• 最高折抵：NT$1,000/房/晚
• 使用限制：僅限官網訂房
• 核銷方式：入住時出示

**振興券**
• 可線上或現場使用

**安心旅遊補助**
• 每房每晚最高NT$1,000`,

      facilities: `🏊 **飯店設施**

• 室內游泳池
• 健身房（24小時）
• 兒童遊戲室
• 商務中心
• 免費 WiFi
• 停車場（免費）`,

      breakfast: `🍳 **早餐資訊**

• 供應時間：06:30-10:00
• 成人：NT$ 450/人/天
• 兒童（7-12歲）：NT$ 250/人/天
• 6歲以下：免費

**包含早餐房型**
• 行政客房、家庭套房、總統套房`,

      parking: `🚗 **停車資訊**

• 免費停車場
• 24小時開放
• 室內停車位
• 電動車充電設施`,

      transportation: `🚌 **交通資訊**

**機場接送**
• 白金會員：免費1趟

**大眾運輸**
• 捷運步行5分鐘

**自駕**
• 免費停車場`,

      unknown: `🤖 我可以協助您：查詢房價、房型介紹、優惠活動、協助訂房。請告訴我您需要什麼幫助？`
    };

    return {
      message: responses[intent] || responses.unknown,
      intent,
      timestamp: new Date().toISOString()
    };
  }

  async processMessage(message, sessionId = 'default') {
    try {
      const intent = this.detectIntent(message);
      const response = this.generateResponse(intent);
      
      this.sessionStore.set(sessionId, {
        lastIntent: intent,
        lastMessage: message,
        timestamp: new Date().toISOString()
      });
      
      return response;
    } catch (error) {
      console.error('AI Service Error:', error);
      return {
        message: '❌ 系統錯誤',
        intent: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new MockAIService();
EOFAI

    echo "   ✅ mock-ai-service.js 已創建"
else
    echo ""
    echo "2️⃣ 本地文件已是正確版本"
fi

echo ""
echo "3️⃣ 確保 routes/ai-routes.js 正確..."
cat > routes/ai-routes.js << 'EOFROUTES'
const express = require('express');
const router = express.Router();
const aiService = require('../services/mock-ai-service');

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少訊息內容' 
      });
    }
    
    const response = await aiService.processMessage(message, sessionId || 'default');
    
    res.json({
      success: true,
      message: response.message,
      intent: response.intent,
      timestamp: response.timestamp
    });
    
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      success: false, 
      message: '處理錯誤: ' + error.message 
    });
  }
});

module.exports = router;
EOFROUTES

echo "   ✅ ai-routes.js 已更新"

echo ""
echo "4️⃣ 提交並推送..."
git add services/mock-ai-service.js routes/ai-routes.js

git commit -m "fix: deploy business-spec v2.1.0 compliant AI service

Critical fixes:
✅ Price: NT\$3,800 (was NT\$7,500)
✅ 15 intent types
✅ Taiwan features: LINE Pay, 超商, 國旅券
✅ Membership: 銀卡/金卡/白金
✅ Children: 0-6歲免費
✅ All responses match business-spec v2.1.0

Target: 17% → 90%+ test pass rate"

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ 修復已推送到 GitHub"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "⏳ Railway 將在 2-3 分鐘內自動部署新版本"
    echo ""
    echo "等待部署完成後，執行快速驗證："
    echo "   bash quick-test.sh"
    echo ""
    echo "或執行完整測試："
    echo "   bash test-ai-service-upgraded.sh"
    echo ""
else
    echo ""
    echo "❌ 推送失敗"
    echo ""
    echo "請檢查："
    echo "1. Git 配置是否正確"
    echo "2. 是否有權限推送"
    echo "3. 網路連接是否正常"
    echo ""
fi


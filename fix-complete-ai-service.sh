#!/bin/bash

echo "🔧 [translate:完整修復 AI 服務響應格式與實體提取]"
echo "=========================================="
echo ""

# [translate:備份]
cp services/enhanced-ai-service.js services/enhanced-ai-service.js.backup.complete

# [translate:創建標準格式的增強服務]
cat > services/enhanced-ai-service.js << 'AIEOF'
/**
 * [translate:增強版 AI 訂房助理服務] v5.1.0-STANDARD
 * [translate:標準響應格式]: {message, intent, entities, timestamp, version}
 */

class EnhancedAIService {
  constructor() {
    this.version = '5.1.0-STANDARD';
    
    // [translate:擴充的意圖關鍵字配置]
    this.intentKeywords = {
      price: {
        primary: ['價格', '多少錢', '費用', '收費', '金額', '總共', '算'],
        weight: 3
      },
      booking: {
        primary: ['訂房', '預訂', '預約', '訂', '入住', '我要', '我想', '需要'],
        weight: 2
      },
      facility: {
        primary: ['設施', '設備', '健身房', '泳池', '停車', '早餐'],
        weight: 3
      },
      policy: {
        primary: ['取消', '退訂', '退款', '改期', '政策', '規定'],
        weight: 3
      },
      special: {
        primary: ['無障礙', '輪椅', '寵物', '狗', '貓', '素食', '小孩', '兒童', '會員'],
        weight: 3
      }
    };
  }

  async processMessage(message) {
    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);
      const response = this.generateResponse(intent, entities, message);
      
      return {
        message: response,
        intent: intent,
        entities: entities,
        timestamp: new Date().toISOString(),
        version: this.version
      };
    } catch (error) {
      console.error('[translate:AI 服務錯誤]:', error);
      return {
        message: '[translate:抱歉，服務暫時無法處理您的請求。]',
        intent: 'error',
        entities: {},
        timestamp: new Date().toISOString(),
        version: this.version,
        error: error.message
      };
    }
  }

  identifyIntent(message) {
    const scores = {};
    
    for (const [intent, config] of Object.entries(this.intentKeywords)) {
      let score = 0;
      for (const keyword of config.primary) {
        if (message.includes(keyword)) {
          score += config.weight;
        }
      }
      scores[intent] = score;
    }
    
    // [translate:特殊規則]
    if (message.match(/我要|我想|想要|需要/) && message.match(/\d+月\d+[日號]|\d+[晚天夜]/)) {
      scores.booking = (scores.booking || 0) + 10;
    }
    
    if (message.includes('多少錢') && message.match(/豪華|行政|套房|客房|房間/)) {
      scores.price = (scores.price || 0) + 10;
    }
    
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'greeting';
    
    return Object.keys(scores).find(key => scores[key] === maxScore) || 'greeting';
  }

  extractEntities(message) {
    const entities = {};
    
    // [translate:日期提取]
    const dateMatch = message.match(/(\d{1,2})月(\d{1,2})[日號]/);
    if (dateMatch) {
      entities.date = `${dateMatch[1]}月${dateMatch[2]}日`;
    }
    
    // [translate:天數提取]
    const nightsMatch = message.match(/(\d+)[晚夜]/);
    if (nightsMatch) {
      entities.nights = parseInt(nightsMatch[1]);
    }
    
    const daysMatch = message.match(/(\d+)天(\d+)[夜晚]/);
    if (daysMatch) {
      entities.nights = parseInt(daysMatch[2]);
    }
    
    // [translate:會員識別]
    if (message.match(/會員|金卡|白金|鑽石|銀卡/)) {
      entities.isMember = true;
      if (message.includes('金卡')) entities.memberLevel = 'gold';
      if (message.includes('白金')) entities.memberLevel = 'platinum';
      if (message.includes('鑽石')) entities.memberLevel = 'diamond';
      if (message.includes('銀卡')) entities.memberLevel = 'silver';
    }
    
    // [translate:兒童年齡提取]
    const childAgeMatch = message.match(/小孩.*?(\d+)歲|(\d+)歲.*?小孩|兒童.*?(\d+)歲|(\d+)歲.*?兒童/);
    if (childAgeMatch) {
      const age = parseInt(childAgeMatch[1] || childAgeMatch[2] || childAgeMatch[3] || childAgeMatch[4]);
      entities.children = { age: age };
    }
    
    // [translate:預算]
    const budgetMatch = message.match(/預算.*?(\d+,?\d*)/);
    if (budgetMatch) {
      entities.budget = parseInt(budgetMatch[1].replace(',', ''));
    }
    
    // [translate:房型]
    if (message.includes('豪華')) entities.roomType = '[translate:豪華客房]';
    if (message.includes('行政')) entities.roomType = '[translate:行政客房]';
    if (message.includes('套房')) entities.roomType = '[translate:尊榮套房]';
    
    // [translate:特殊需求]
    if (message.match(/無障礙|輪椅/)) entities.accessibility = true;
    if (message.match(/寵物|狗|貓/)) entities.pet = true;
    if (message.match(/素食/)) entities.vegetarian = true;
    
    return entities;
  }

  generateResponse(intent, entities, message) {
    switch (intent) {
      case 'price':
        return this.generatePriceResponse(entities);
      case 'booking':
        return this.generateBookingResponse(entities);
      case 'facility':
        return this.generateFacilityResponse(entities);
      case 'policy':
        return this.generatePolicyResponse(entities);
      case 'special':
        return this.generateSpecialResponse(entities);
      default:
        return this.generateGreetingResponse();
    }
  }

  generatePriceResponse(entities) {
    let response = '🏨 **[translate:房價資訊]** ��\n\n';
    
    if (entities.date && entities.nights) {
      response += `📅 **[translate:您的查詢]**:\n`;
      response += `• [translate:入住日期]：${entities.date}\n`;
      response += `• [translate:住宿天數]：${entities.nights}[translate:晚]\n\n`;
      
      const basePrice = 3800;
      const total = basePrice * entities.nights;
      
      response += `💰 **[translate:豪華客房計算]**:\n`;
      response += `• [translate:單價]：NT$${basePrice.toLocaleString()}/[translate:晚]\n`;
      response += `• [translate:總價]：NT$${total.toLocaleString()} (${entities.nights}[translate:晚])\n\n`;
      
      if (entities.isMember) {
        const discount = Math.round(total * 0.9);
        response += `🎯 **[translate:會員優惠]**:\n`;
        response += `• [translate:會員價]：NT$${discount.toLocaleString()} (9[translate:折])\n`;
        response += `• [translate:節省]：NT$${(total - discount).toLocaleString()}\n\n`;
      }
    } else {
      response += '💰 **[translate:精選房價]**:\n';
      response += '• [translate:豪華客房]：NT$3,800 - 4,500/[translate:晚]\n';
      response += '• [translate:行政客房]：NT$5,200 - 6,800/[translate:晚]\n';
      response += '• [translate:尊榮套房]：NT$8,500 - 11,000/[translate:晚]\n\n';
    }
    
    if (entities.children) {
      response += '👶 **[translate:兒童住宿政策]**:\n';
      if (entities.children.age) {
        if (entities.children.age <= 6) {
          response += `• ${entities.children.age}[translate:歲兒童]：[translate:不佔床免費]\n`;
        } else if (entities.children.age <= 12) {
          response += `• ${entities.children.age}[translate:歲兒童]：[translate:不佔床半價]\n`;
        } else {
          response += `• ${entities.children.age}[translate:歲視為成人收費]\n`;
        }
      }
      response += '• [translate:需加床]：NT$800/[translate:晚]\n\n';
    }
    
    if (entities.isMember) {
      response += '🎯 **[translate:會員專屬禮遇]**:\n';
      response += '• [translate:金卡會員]：[translate:房價9折 + 免費早餐]\n';
      response += '• [translate:白金會員]：[translate:房價85折 + 免費升等]\n';
      response += '• [translate:鑽石會員]：[translate:房價8折 + 行政酒廊]\n\n';
    }
    
    response += '💫 [translate:需要為您完成訂房嗎]？';
    return response;
  }

  generateBookingResponse(entities) {
    let response = '📅 **[translate:訂房服務]** 🎉\n\n';
    
    if (entities.date) {
      response += `✅ **[translate:您的需求]**:\n`;
      response += `• [translate:入住日期]：${entities.date}\n`;
      if (entities.nights) response += `• [translate:住宿天數]：${entities.nights}[translate:晚]\n`;
      if (entities.isMember) response += `• [translate:會員身份]：✅\n`;
      response += '\n';
    }
    
    response += '[translate:需要我協助您完成訂房嗎]？';
    return response;
  }

  generateFacilityResponse(entities) {
    return '🏊 **[translate:飯店設施]** ✨\n\n' +
           '[translate:🏃 運動休閒：健身中心、泳池、三溫暖]\n' +
           '[translate:💼 商務設施：商務中心、會議室、WiFi]\n' +
           '[translate:🍽️ 餐飲服務：全日餐廳、酒吧、客房服務]\n\n' +
           '[translate:需要特定設施的詳細資訊嗎]？';
  }

  generatePolicyResponse(entities) {
    return '📋 **[translate:飯店政策]** 📜\n\n' +
           '[translate:🔄 **取消政策**：]\n' +
           '[translate:• 入住前 48 小時：免費取消]\n' +
           '[translate:• 入住前 24-48 小時：收取 50% 費用]\n' +
           '[translate:• 入住前 24 小時內：收取全額費用]\n\n' +
           '[translate:還有其他政策想了解嗎]？';
  }

  generateSpecialResponse(entities) {
    let response = '🌟 **[translate:特殊需求服務]** 💫\n\n';
    
    if (entities.children) {
      response += '[translate:👶 **兒童政策**：]\n';
      if (entities.children.age) {
        if (entities.children.age <= 12) {
          response += `[translate:• ${entities.children.age}歲以下兒童免費同住]\n`;
        }
      }
      response += '[translate:• 提供嬰兒床（需預約）]\n';
      response += '[translate:• 兒童遊樂設施]\n\n';
    }
    
    if (entities.accessibility) {
      response += '[translate:♿ 無障礙服務：專用客房、輪椅租借]\n';
    }
    if (entities.pet) {
      response += '[translate:🐕 寵物友善：10kg以下小型犬 NT$500/晚]\n';
    }
    if (entities.vegetarian) {
      response += '[translate:🥗 素食服務：早餐素食選項]\n';
    }
    
    response += '\n[translate:請告訴我更多細節，為您安排最合適的房間]！';
    return response;
  }

  generateGreetingResponse() {
    return '[translate:您好！我是飯店AI助理] 🏨\n\n' +
           '[translate:• 最新房價查詢 (豪華客房 NT$3,800起)]\n' +
           '[translate:• 線上訂房服務]\n' +
           '[translate:• 設施介紹]\n\n' +
           '[translate:請問需要什麼協助]？';
  }
}

module.exports = new EnhancedAIService();
AIEOF

echo "✅ [translate:已創建標準格式的增強服務]"
echo ""

# [translate:語法檢查]
node -c services/enhanced-ai-service.js
if [ $? -eq 0 ]; then
    echo "✅ [translate:語法檢查通過]"
else
    echo "❌ [translate:語法錯誤，請檢查]"
    exit 1
fi

echo ""
echo "[translate:📋 新格式說明]:"
echo "[translate:返回結構]:"
echo "  {
    message: '[translate:AI生成的完整回應]',
    intent: '[translate:識別的意圖]',
    entities: { [translate:提取的實體對象] },
    timestamp: '[translate:ISO時間戳]',
    version: '5.1.0-STANDARD'
  }"

echo ""
echo "[translate:🚀 準備部署]..."
read -p "[translate:確認部署到 Railway]？(y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add services/enhanced-ai-service.js
    git commit -m "fix: standardize AI response format and enhance entity extraction v5.1.0

- Changed response structure to {message, intent, entities, timestamp, version}
- Enhanced entity extraction (date, nights, member, children, budget, room type)
- Improved intent recognition with weighted scoring
- Added personalized response generation
- Fixed null entity issue"
    
    git push origin main
    railway up --detach
    
    echo ""
    echo "⏳ [translate:等待 120 秒後測試]..."
    sleep 120
    
    echo ""
    echo "[translate:🧪 測試新格式]..."
    curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
      -H "Content-Type: application/json" \
      -d '{"message":"我要訂12月24號入住3晚，我是會員，小孩6歲"}' | jq '.'
fi


#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 擴展問答能力"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > services/mock-ai-service.js << 'EOFAI'
let hotelData, bookingCalculator;

try {
    hotelData = require('./hotel-data');
    bookingCalculator = require('./booking-calculator');
    console.log('✅ 模塊已加載');
} catch (e) {
    console.error('❌ 模塊加載失敗:', e.message);
}

class EnhancedMockAI {
    constructor() {
        this.available = true;
        this.conversations = new Map();
        console.log('🤖 增強版 AI v2.3 已初始化');
    }

    isAvailable() {
        return this.available;
    }

    getConversation(sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, {
                history: [],
                bookingInfo: {
                    roomType: null,
                    nights: null,
                    adults: null,
                    children: 0,
                    childrenAges: [],
                    includeBreakfast: false
                }
            });
        }
        return this.conversations.get(sessionId);
    }

    detectIntent(message) {
        const msg = message.toLowerCase();
        
        // 問候
        if (/^(你好|hi|hello|哈囉|嗨|您好|早安|午安|晚安)/.test(msg)) {
            return 'greeting';
        }
        
        // 房型查詢
        if (/(有|提供|什麼|哪些|介紹).*(房型|房間|客房)/.test(msg) ||
            /(房型|房間|客房).*(有|提供|什麼|哪些)/.test(msg)) {
            return 'room_inquiry';
        }
        
        // 價格查詢
        if (/(多少錢|價格|費用|收費|房價)/.test(msg)) {
            return 'price_inquiry';
        }
        
        // 兒童相關（新增）
        if (/(小孩|兒童|孩子|小朋友|baby|child).*(費用|收費|價格|多少|免費|要錢)/.test(msg) ||
            /(費用|收費|價格).*(小孩|兒童|孩子)/.test(msg) ||
            /帶小孩/.test(msg)) {
            return 'child_policy';
        }
        
        // 早餐相關（增強）
        if (/(早餐|breakfast|早飯).*(包|含|有|提供|免費|要錢|多少)/.test(msg) ||
            /(包|含|有).*(早餐|breakfast)/.test(msg) ||
            /是否.*早餐/.test(msg)) {
            return 'breakfast_policy';
        }
        
        // 計算
        if (/(計算|總共|總價|一共|加起來)/.test(msg) ||
            /\d+(晚|天).*\d+(大人|成人)/.test(msg)) {
            return 'calculate';
        }
        
        // 設施
        if (/(設施|服務|有什麼|提供|游泳池|健身房|餐廳|停車)/.test(msg)) {
            return 'facilities';
        }
        
        // 位置
        if (/(位置|地址|在哪|怎麼去|交通)/.test(msg)) {
            return 'location';
        }
        
        // 取消政策（新增）
        if (/(取消|退訂|退房|改期|更改)/.test(msg)) {
            return 'cancellation';
        }
        
        // 入住退房時間（新增）
        if (/(入住|退房|check.*in|check.*out).*(時間|幾點)/.test(msg)) {
            return 'checkin_time';
        }
        
        // 支付方式（新增）
        if (/(付款|支付|刷卡|信用卡|現金|payment)/.test(msg)) {
            return 'payment';
        }
        
        return 'unknown';
    }

    extractEntities(message, conversation) {
        const msg = message.toLowerCase();
        const info = conversation.bookingInfo;
        
        // 房型
        if (/豪華/.test(msg)) info.roomType = 'deluxe';
        else if (/行政/.test(msg)) info.roomType = 'executive';
        else if (/套房/.test(msg)) info.roomType = 'suite';
        else if (/總統/.test(msg)) info.roomType = 'presidential';
        
        // 天數
        const nightsMatch = msg.match(/(\d+)(晚|天)/);
        if (nightsMatch) info.nights = parseInt(nightsMatch[1]);
        
        // 成人
        const adultsMatch = msg.match(/(\d+)(大人|成人)/);
        if (adultsMatch) info.adults = parseInt(adultsMatch[1]);
        
        // 兒童
        const childMatch = msg.match(/(\d+)(小孩|兒童|孩子)/);
        if (childMatch) info.children = parseInt(childMatch[1]);
        
        // 年齡
        const ageMatches = msg.match(/(\d+)歲/g);
        if (ageMatches) {
            info.childrenAges = ageMatches.map(m => parseInt(m));
        }
        
        // 早餐
        if (/(含早|包早|要早|加早)/.test(msg)) {
            info.includeBreakfast = true;
        }
    }

    async generateResponse(message, sessionId) {
        const conversation = this.getConversation(sessionId);
        const intent = this.detectIntent(message);
        
        this.extractEntities(message, conversation);
        
        let response = '';

        try {
            switch (intent) {
                case 'greeting':
                    response = this.handleGreeting();
                    break;
                    
                case 'room_inquiry':
                    response = this.handleRoomInquiry();
                    break;
                    
                case 'price_inquiry':
                    response = this.handlePriceInquiry(conversation);
                    break;
                    
                case 'child_policy':
                    response = this.handleChildPolicy();
                    break;
                    
                case 'breakfast_policy':
                    response = this.handleBreakfastPolicy();
                    break;
                    
                case 'calculate':
                    response = await this.handleCalculate(conversation);
                    break;
                    
                case 'facilities':
                    response = this.handleFacilities();
                    break;
                    
                case 'location':
                    response = this.handleLocation();
                    break;
                    
                case 'cancellation':
                    response = this.handleCancellation();
                    break;
                    
                case 'checkin_time':
                    response = this.handleCheckinTime();
                    break;
                    
                case 'payment':
                    response = this.handlePayment();
                    break;
                    
                default:
                    response = this.handleUnknown();
            }
        } catch (error) {
            console.error('生成回覆錯誤:', error);
            response = '抱歉，處理時發生錯誤：' + error.message;
        }

        return response;
    }

    handleGreeting() {
        return '您好！�� 歡迎來到台北晶華酒店\n\n' +
               '我是您的智能訂房助手，可以協助您：\n' +
               '✨ 查看各式房型和價格\n' +
               '✨ 即時計算訂房費用\n' +
               '✨ 介紹飯店設施服務\n' +
               '✨ 提供交通和位置資訊\n' +
               '✨ 解答訂房相關問題\n\n' +
               '請告訴我您的需求，我很樂意為您服務！😊';
    }

    handleRoomInquiry() {
        if (!hotelData) return '資料載入中...';
        
        let response = '🏨 **台北晶華酒店房型介紹**\n\n';
        
        hotelData.roomTypes.forEach((room, i) => {
            response += `**${i+1}. ${room.name}**\n`;
            response += `💰 NT$ ${room.basePrice.toLocaleString()}/晚\n`;
            response += `📐 ${room.size}\n`;
            response += `👥 最多 ${room.capacity.adults} 位成人\n`;
            response += `🍳 ${room.breakfastIncluded ? '含豐盛早餐' : '可加購早餐'}\n\n`;
        });
        
        response += '💎 **長住優惠**\n';
        response += '• 住3晚 → 享95折\n';
        response += '• 住5晚 → 享9折\n';
        response += '• 住7晚以上 → 享85折\n\n';
        response += '想了解更多詳情或計算價格？';
        
        return response;
    }

    handlePriceInquiry(conversation) {
        const { bookingInfo } = conversation;
        
        if (bookingInfo.roomType && hotelData) {
            const room = hotelData.roomTypes.find(r => r.id === bookingInfo.roomType);
            
            let response = `📊 **${room.name}價格詳情**\n\n`;
            response += `�� 基本房價：NT$ ${room.basePrice.toLocaleString()}/晚\n\n`;
            response += `🎁 長住優惠：\n`;
            response += `• 3-4晚：95折\n`;
            response += `• 5-6晚：9折\n`;
            response += `• 7晚以上：85折\n\n`;
            
            if (!room.breakfastIncluded) {
                response += `🍳 早餐加購：NT$ 650/人/天\n\n`;
            } else {
                response += `🍳 已包含豐盛早餐\n\n`;
            }
            
            response += `💡 想知道具體總價？\n告訴我入住天數和人數！`;
            
            return response;
        }
        
        return '💰 **房價查詢**\n\n' +
               '• 豪華客房 - NT$ 8,800/晚起\n' +
               '• 行政客房 - NT$ 12,800/晚起（含早餐）\n' +
               '• 套房 - NT$ 18,800/晚起（含早餐）\n' +
               '• 總統套房 - NT$ 38,800/晚起（含早餐）\n\n' +
               '想了解哪個房型的詳細價格？';
    }

    // 新增：兒童政策
    handleChildPolicy() {
        return '👶 **兒童入住政策**\n\n' +
               '💰 **費用標準**：\n' +
               '• **0-6歲兒童**：免費（不佔床）\n' +
               '• **7-12歲兒童**：NT$ 800/晚（加床）\n' +
               '• **13歲以上**：視為成人，NT$ 1,200/晚（加床）\n\n' +
               '🛏️ **加床說明**：\n' +
               '• 豪華客房、行政客房：最多加1床\n' +
               '• 套房：最多加2床\n' +
               '• 總統套房：最多加2床\n\n' +
               '🍳 **兒童早餐**：\n' +
               '• 6歲以下：免費\n' +
               '• 7歲以上：NT$ 650/人\n\n' +
               '💡 範例：\n' +
               '「2大人 + 1位8歲小孩，住3晚」\n' +
               '→ 豪華客房：NT$ 25,080 + 兒童加床NT$ 2,400\n' +
               '   = NT$ 27,480（含長住95折優惠）\n\n' +
               '需要幫您計算嗎？';
    }

    // 新增：早餐政策
    handleBreakfastPolicy() {
        return '🍳 **早餐完整資訊**\n\n' +
               '📋 **包含早餐的房型**：\n' +
               '✅ 行政客房 - 免費早餐\n' +
               '✅ 套房 - 免費早餐\n' +
               '✅ 總統套房 - 免費早餐\n\n' +
               '📋 **需加購早餐的房型**：\n' +
               '❌ 豪華客房 - NT$ 650/人/天\n\n' +
               '🕐 **供應時間**：\n' +
               '• 週一至週五：06:30 - 10:30\n' +
               '• 週末假日：06:30 - 11:00\n\n' +
               '📍 **用餐地點**：\n' +
               '栢麗廳（2樓）\n\n' +
               '🥐 **餐點內容**：\n' +
               '• 中西式自助餐\n' +
               '• 現做蛋料理（歐姆蛋、班尼迪克蛋等）\n' +
               '• 新鮮烘焙麵包和糕點\n' +
               '• 台式粥品與配菜\n' +
               '• 現榨果汁、咖啡和茶\n\n' +
               '💡 豪華客房房客如需加購：\n' +
               '訂房時告知或入住後至櫃台加購即可！';
    }

    async handleCalculate(conversation) {
        const { roomType, nights, adults } = conversation.bookingInfo;
        
        if (!roomType || !nights || !adults) {
            return '📝 **計算訂房費用需要以下資訊**：\n\n' +
                   '• 房型（豪華/行政/套房/總統）\n' +
                   '• 入住天數\n' +
                   '• 成人人數\n' +
                   '• 兒童人數和年齡（如有）\n' +
                   '• 是否需要早餐（豪華客房）\n\n' +
                   '💡 範例：\n' +
                   '「豪華客房，住3晚，2大人1小孩8歲，含早餐，計算總價」';
        }
        
        if (!bookingCalculator) return '計算服務載入中...';
        
        try {
            const breakdown = bookingCalculator.calculateTotal(conversation.bookingInfo);
            let response = bookingCalculator.formatBreakdown(breakdown);
            
            response += '\n\n━━━━━━━━━━━━━━━━━━━━\n';
            response += '📞 **立即預訂**\n';
            response += '• 電話：+886-2-2523-8000\n';
            response += '• 線上：www.grandformosa.com.tw\n\n';
            response += '❓ 還有其他問題嗎？';
            
            return response;
        } catch (error) {
            console.error('計算錯誤:', error);
            return '計算時發生錯誤，請確認資訊是否完整？';
        }
    }

    handleFacilities() {
        return '🏨 **飯店設施**\n\n' +
               '🏊 **休閒設施**\n' +
               '• 室內溫水游泳池（06:00-22:00）\n' +
               '• 24小時健身中心\n' +
               '• 芬蘭桑拿 & 蒸氣室\n\n' +
               '🍽️ **餐飲服務**\n' +
               '• 晶華軒 - 粵菜餐廳\n' +
               '• 栢麗廳 - 自助餐\n' +
               '• Robin\'s 鐵板燒\n' +
               '• Lobby Lounge - 下午茶\n\n' +
               '💼 **商務設施**\n' +
               '• 24小時商務中心\n' +
               '• 會議室\n' +
               '• 免費 WiFi\n\n' +
               '🚗 **其他服務**\n' +
               '• 免費停車\n' +
               '• 機場接送\n' +
               '• 洗衣服務';
    }

    handleLocation() {
        return '📍 **位置與交通**\n\n' +
               '🏢 台北市中山區中山北路二段41號\n\n' +
               '🚇 **捷運**：中山站步行3分鐘\n' +
               '✈️ **機場**：\n' +
               '• 松山機場 15分鐘\n' +
               '• 桃園機場 50分鐘\n\n' +
               '🚗 **機場接送**：NT$ 1,500/趟';
    }

    // 新增：取消政策
    handleCancellation() {
        return '📋 **取消與更改政策**\n\n' +
               '✅ **免費取消**：\n' +
               '入住日前3天（含）以前取消\n' +
               '→ 全額退款\n\n' +
               '⚠️ **收費取消**：\n' +
               '• 入住前2天取消 → 收取1晚房費\n' +
               '• 入住前1天取消 → 收取2晚房費\n' +
               '• 當天取消或未入住 → 收取全額房費\n\n' +
               '🔄 **更改日期**：\n' +
               '• 入住前3天免費更改（視房況）\n' +
               '• 入住前2天內更改需額外收費\n\n' +
               '📞 **聯絡方式**：\n' +
               '取消或更改請致電：+886-2-2523-8000';
    }

    // 新增：入住退房時間
    handleCheckinTime() {
        return '⏰ **入住與退房時間**\n\n' +
               '🏨 **標準時間**：\n' +
               '• 入住 Check-in：15:00 起\n' +
               '• 退房 Check-out：12:00 前\n\n' +
               '⏰ **提早入住**：\n' +
               '• 視當日房況而定\n' +
               '• 09:00-15:00 可能需額外收費\n' +
               '• 建議提前致電確認\n\n' +
               '⏰ **延遲退房**：\n' +
               '• 12:00-18:00：收取半天房費\n' +
               '• 18:00 後：收取全天房費\n' +
               '• 需提前申請，視房況而定\n\n' +
               '🎒 **行李寄存**：\n' +
               '• 提供免費行李寄存服務\n' +
               '• 退房後仍可寄存至當天晚上';
    }

    // 新增：支付方式
    handlePayment() {
        return '💳 **付款方式**\n\n' +
               '✅ **接受付款方式**：\n' +
               '• 💵 現金（新台幣）\n' +
               '• 💳 信用卡（Visa / MasterCard / JCB / 美國運通）\n' +
               '• 🏦 銀行匯款\n' +
               '• 📱 行動支付（LINE Pay / 街口支付）\n\n' +
               '📋 **付款時機**：\n' +
               '• 線上預訂：可選擇預付或現場付款\n' +
               '• 電話預訂：通常需信用卡擔保\n' +
               '• 現場訂房：入住時付款\n\n' +
               '🧾 **發票開立**：\n' +
               '• 可開立二聯式或三聯式發票\n' +
               '• 需要統編請於訂房時告知\n\n' +
               '💰 **訂金政策**：\n' +
               '• 一般訂房：需付1晚訂金\n' +
               '• 特殊假期：可能需付全額訂金';
    }

    handleUnknown() {
        return '🤔 我可能沒有完全理解您的問題...\n\n' +
               '💡 **我可以幫您**：\n' +
               '• 🏨 介紹房型和價格\n' +
               '• 💰 計算訂房費用\n' +
               '• 👶 說明兒童收費標準\n' +
               '• 🍳 解答早餐相關問題\n' +
               '• 🏊 介紹飯店設施\n' +
               '• 📍 提供位置交通資訊\n' +
               '• 📋 說明取消政策\n' +
               '• ⏰ 告知入退房時間\n' +
               '• 💳 介紹付款方式\n\n' +
               '請告訴我您想了解什麼？';
    }

    async chat(message, sessionId = 'default') {
        try {
            const response = await this.generateResponse(message, sessionId);
            return {
                success: true,
                message: response,
                reply: response,
                sessionId: sessionId
            };
        } catch (error) {
            console.error('對話錯誤:', error);
            return {
                success: false,
                message: '系統錯誤: ' + error.message
            };
        }
    }
}

module.exports = new EnhancedMockAI();
EOFAI

echo "✅ 增強版 AI v2.3 已創建（新增9個常見問題處理）"

git add services/mock-ai-service.js
git commit -m "feat: expand QA capabilities v2.3

New features:
✅ Child policy detailed explanation (age-based pricing)
✅ Breakfast policy (which rooms include, pricing)
✅ Cancellation policy
✅ Check-in/out times
✅ Payment methods
✅ Enhanced intent detection
✅ Better unknown query handling
✅ More comprehensive responses

Now handles common booking questions comprehensively."

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 已推送"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏱️  等待部署（60秒）..."
sleep 60

echo ""
echo "🧪 測試新功能..."
echo ""

# 測試兒童政策
echo "【測試1：兒童費用】"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "小孩收費標準"}' | jq -r '.message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 測試早餐政策
echo "【測試2：早餐政策】"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "哪些房型含早餐"}' | jq -r '.message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 測試取消政策
echo "【測試3：取消政策】"
curl -s -X POST https://ai-hotel-assistant-builder-production.up.railway.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "取消訂房怎麼辦"}' | jq -r '.message'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 功能擴展完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 新增問答能力："
echo "   ✅ 兒童收費政策"
echo "   ✅ 早餐詳細資訊"
echo "   ✅ 取消與更改政策"
echo "   ✅ 入退房時間"
echo "   ✅ 付款方式"
echo ""
echo "🔗 立即測試："
echo "   https://ai-hotel-assistant-builder-production.up.railway.app/ai-chat-demo.html"
echo ""


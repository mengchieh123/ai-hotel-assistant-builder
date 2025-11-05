/**
 * 增強版 AI 服務 - 多層次意圖識別
 */

class EnhancedAIService {
  constructor() {
    this.intentPatterns = {
      // 第一層：基礎意圖
      price: [/價格|價錢|多少錢|預算|優惠|打折/, /NT\$\d+/],
      facility: [/設施|設備|泳池|健身房|餐廳|停車/],
      greeting: [/你好|您好|嗨|hello|hi/],
      
      // 第二層：進階意圖
      special_need: [
        /輪椅|無障礙|扶手|寵物|素食|嬰兒床|浴缸|小型犬|特殊需求/,
        /小孩|兒童|\d+歲|幼兒/
      ],
      group_booking: [
        /團體|公司|員工旅遊|\d+人|\d+間|雙人房|會議室/,
        /團體優惠|公司訂房/
      ],
      long_stay: [
        /長期|一個月|月租|分期|每週|床單|發票|書桌|網路/,
        /\d+天\d+夜|\d+天|\d+夜/
      ],
      policy: [
        /取消|改期|期限|颱風|免費取消|費用|加錢|政策/,
        /可以取消嗎|能改期嗎/
      ],
      special_event: [
        /生日|慶祝|佈置|蛋糕|花|驚喜|紀念日/,
        /女朋友|男朋友|太太|先生/
      ],
      transport: [
        /機場|接送|行李|寄放|退房|桃園|高鐵|車站/,
        /幾點|時間|費用/
      ]
    };
  }

  /**
   * 多層次意圖識別
   */
  detectIntent(query) {
    const lowerQuery = query.toLowerCase();
    const detectedIntents = [];
    
    // 檢查所有意圖模式
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuery)) {
          detectedIntents.push(intent);
          break;
        }
      }
    }
    
    // 優先級排序
    return this.prioritizeIntents([...new Set(detectedIntents)]);
  }

  /**
   * 意圖優先級排序
   */
  prioritizeIntents(intents) {
    const priorityOrder = [
      'special_need', 'group_booking', 'long_stay', 
      'policy', 'special_event', 'transport',
      'price', 'facility', 'greeting'
    ];
    
    return intents.sort((a, b) => 
      priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
    );
  }

  /**
   * 生成智能回應
   */
  generateResponse(query) {
    const intents = this.detectIntent(query);
    const primaryIntent = intents[0] || 'greeting';
    
    console.log(`🎯 檢測到意圖: ${intents.join(', ')}`);
    
    switch (primaryIntent) {
      case 'special_need':
        return this.generateSpecialNeedResponse(query, intents);
      case 'group_booking':
        return this.generateGroupBookingResponse(query);
      case 'long_stay':
        return this.generateLongStayResponse(query);
      case 'policy':
        return this.generatePolicyResponse(query);
      case 'special_event':
        return this.generateSpecialEventResponse(query);
      case 'transport':
        return this.generateTransportResponse(query);
      case 'price':
        return this.generatePriceResponse(query);
      case 'facility':
        return this.generateFacilityResponse(query);
      default:
        return this.generateGreetingResponse();
    }
  }

  /**
   * 特殊需求回應
   */
  generateSpecialNeedResponse(query, intents) {
    let response = '♿ **特殊需求服務**\n\n';
    
    if (query.includes('輪椅') || query.includes('無障礙')) {
      response += '🏥 **無障礙設施**：\n';
      response += '• 專用無障礙客房（設有扶手、寬敞空間）\n';
      response += '• 輪椅通行全館（電梯直達各樓層）\n';
      response += '• 無障礙停車位（距離入口最近）\n';
      response += '• 浴室防滑設備與緊急呼叫鈴\n\n';
    }
    
    if (query.includes('寵物') || query.includes('小型犬')) {
      response += '🐾 **寵物同行政策**：\n';
      response += '• 接受小型寵物（15公斤以下）\n';
      response += '• 清潔費：NT$500/晚\n';
      response += '• 提供寵物床、食碗\n';
      response += '• 需出示疫苗證明\n\n';
    }
    
    if (query.includes('小孩') || query.includes('兒童')) {
      response += '👶 **兒童政策**：\n';
      response += '• 12歲以下兒童免費同住\n';
      response += '• 提供嬰兒床（需預約）\n';
      response += '• 兒童遊樂設施\n';
      response += '• 兒童餐點服務\n\n';
    }
    
    response += '請告訴我更多細節，為您安排最合適的房間！';
    return response;
  }

  /**
   * 團體訂房回應
   */
  generateGroupBookingResponse(query) {
    return `👥 **團體訂房優惠**：\n\n` +
           `• 5間以上房型享9折優惠\n` +
           `• 免費會議室使用2小時\n` +
           `• 團體早餐優惠價\n` +
           `• 專屬接待服務\n\n` +
           `請提供詳細人數和日期，為您計算最優惠方案！`;
  }

  /**
   * 長期住宿回應
   */
  generateLongStayResponse(query) {
    return `�� **長期住宿方案**：\n\n` +
           `• 月租優惠：75折起\n` +
           `• 每週免費客房清潔\n` +
           `• 提供發票與報帳單據\n` +
           `• 專屬商務設施使用\n\n` +
           `我們致力於滿足每位客人的特殊需求！`;
  }

  /**
   * 政策查詢回應
   */
  generatePolicyResponse(query) {
    return `📋 **訂房政策說明**：\n\n` +
           `• 免費取消：入住前3天\n` +
           `• 改期服務：入住前1天免費\n` +
           `• 颱風天：依照政府公告免費取消\n` +
           `• 詳細政策請參考官網\n\n` +
           `需要了解特定政策的詳細資訊嗎？`;
  }

  /**
   * 特殊活動回應
   */
  generateSpecialEventResponse(query) {
    return `🎉 **特殊活動安排**：\n\n` +
           `• 生日佈置服務：NT$1,200起\n` +
           `• 蛋糕準備：多種口味選擇\n` +
           `• 鮮花佈置：浪漫氛圍\n` +
           `• 餐廳推薦：特色燭光晚餐\n\n` +
           `請告訴我慶祝的日期和人數！`;
  }

  /**
   * 交通服務回應
   */
  generateTransportResponse(query) {
    return `🚗 **交通服務資訊**：\n\n` +
           `• 機場接送：NT$800/趟\n` +
           `• 行李寄存：免費（入住前/退房後）\n` +
           `• 延遲退房：視房況安排\n` +
           `• 停車服務：免費停車位\n\n` +
           `需要預約接送服務嗎？`;
  }

  /**
   * 價格查詢回應
   */
  generatePriceResponse(query) {
    return `🏨 **2025年全新優惠價** 🎉\n\n` +
           `💰 **精選房價**：\n` +
           `• 豪華客房：NT$3,800 - 4,500/晚\n` +
           `• 行政客房：NT$5,200 - 6,800/晚\n` +
           `• 尊榮套房：NT$8,500 - 11,000/晚\n\n` +
           `🎯 **會員專屬禮遇**：\n` +
           `• 金卡會員：房價9折 + 免費早餐\n` +
           `• 白金會員：房價85折 + 免費升等\n` +
           `• 鑽石會員：房價8折 + 行政酒廊\n\n` +
           `請提供入住日期，為您查詢即時優惠！`;
  }

  /**
   * 設施查詢回應
   */
  generateFacilityResponse(query) {
    return `🏊 **飯店設施一覽**：\n\n` +
           `• 24小時健身中心\n` +
           `• 室內恆溫泳池\n` +
           `• 三溫暖與蒸汽室\n` +
           `• 商務中心\n` +
           `• 會議室租借\n` +
           `• 餐廳與酒吧\n` +
           `• 客房服務\n` +
           `• 行李寄存與接送\n\n` +
           `需要了解特定設施的詳細資訊嗎？`;
  }

  /**
   * 問候回應生成
   */
  generateGreetingResponse() {
    return `您好！我是飯店AI助理，現在為您提供：\n\n• 🏨 最新房價查詢 (豪華客房 NT$3,800起)\n• 📅 線上訂房服務\n• 🏊 設施介紹\n• ❓ 常見問題解答\n\n請問需要什麼協助？`;
  }
}

module.exports = new EnhancedAIService();

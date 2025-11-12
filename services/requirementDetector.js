// services/requirementDetector.js

class RequirementDetector {
  // 主要解析方法，整合所有需求抽取
  static async detectAllRequirements(message) {
    try {
      const mlIntents = await this.mlIntentRecognition(message);
      const { childrenCount, seniorCount } = this.extractChildrenAndSeniors(message);
      const symbolAnalysis = this.analyzeSymbolUsage(message);
      const accessibility = this.detectAccessibilityNeeds(message);
      const dietary = this.detectDietaryNeeds(message);
      const special = this.detectSpecialNeeds(message);
      const sentiment = this.analyzeSentiment(message);

      return {
        // 符號使用分析
        symbolUsage: symbolAnalysis,
        
        // 無障礙需求
        accessibility: accessibility,
        
        // 飲食需求
        dietary: dietary,
        
        // 特殊需求
        special: special,
        
        // 意圖識別
        intent: mlIntents,
        
        // 人員統計
        demographics: {
          childrenCount,
          seniorCount,
          totalSpecialNeeds: childrenCount + seniorCount
        },
        
        // 情感分析
        sentiment: sentiment,
        
        // 總體評估
        summary: this.generateSummary({
          symbolUsage: symbolAnalysis,
          accessibility,
          dietary,
          special,
          childrenCount,
          seniorCount,
          sentiment
        })
      };
    } catch (error) {
      console.error('❌ 需求檢測錯誤:', error);
      return this.getFallbackResponse();
    }
  }

  // 符號使用分析
  static analyzeSymbolUsage(message) {
    const symbols = message.match(/[.!?,;:!！？，；：]/g) || [];
    const density = symbols.length / message.length;
    
    let level = 'low';
    if (density > 0.1) level = 'high';
    else if (density > 0.05) level = 'medium';

    return {
      count: symbols.length,
      density: Math.round(density * 1000) / 1000,
      level: level,
      hasMultipleExclamation: /!{2,}/.test(message),
      hasMultipleQuestion: /\?{2,}/.test(message)
    };
  }

  // 無障礙需求檢測
  static detectAccessibilityNeeds(message) {
    const accessibilityKeywords = {
      wheelchair: ['轮椅', '行動不便', '輪椅通道'],
      ramp: ['坡道', '斜坡'],
      facility: ['无障碍设施', '無障礙設施', '无障碍卫生间'],
      handrail: ['扶手', '栏杆']
    };

    const detectedTypes = [];
    let urgency = 'normal';
    
    for (const [type, keywords] of Object.entries(accessibilityKeywords)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        detectedTypes.push(type);
      }
    }

    if (/(紧急|急需|马上|立刻)/i.test(message)) {
      urgency = 'urgent';
    }

    return {
      required: detectedTypes.length > 0,
      types: detectedTypes,
      urgency: urgency,
      description: detectedTypes.length > 0 ? 
        `檢測到無障礙需求: ${detectedTypes.join(', ')}` : 
        '無特殊無障礙需求'
    };
  }

  // 飲食需求檢測
  static detectDietaryNeeds(message) {
    const vegetarianTypes = {
      vegan: { keywords: ['全素', 'vegan', '純素'], strict: true },
      vegetarian: { keywords: ['蛋奶素', 'vegetarian', '素食'], strict: false },
      lacto: { keywords: ['奶素', 'lacto'], strict: false },
      ovo: { keywords: ['蛋素', 'ovo'], strict: false }
    };

    let detectedType = null;
    let strictness = 'normal';

    for (const [type, data] of Object.entries(vegetarianTypes)) {
      if (data.keywords.some(keyword => message.includes(keyword))) {
        detectedType = type;
        strictness = data.strict ? 'strict' : 'normal';
        break;
      }
    }

    // 過敏原檢測
    const allergens = {
      peanut: ['花生', 'peanut'],
      seafood: ['海鲜', '海鮮', '魚', '虾', '蟹'],
      gluten: ['麸质', '麵筋', 'gluten'],
      dairy: ['牛奶', '乳制品', '乳糖']
    };

    const detectedAllergies = [];
    for (const [allergen, keywords] of Object.entries(allergens)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        detectedAllergies.push(allergen);
      }
    }

    return {
      vegetarian: {
        required: !!detectedType,
        type: detectedType,
        strictness: strictness
      },
      allergies: {
        required: detectedAllergies.length > 0,
        types: detectedAllergies,
        count: detectedAllergies.length
      },
      religious: this.detectReligiousNeeds(message)
    };
  }

  // 特殊需求檢測
  static detectSpecialNeeds(message) {
    return {
      medical: this.detectMedicalNeeds(message),
      religious: this.detectReligiousNeeds(message),
      family: this.detectFamilyNeeds(message)
    };
  }

  // 醫療需求檢測
  static detectMedicalNeeds(message) {
    const medicalConditions = {
      diabetes: ['糖尿病', '血糖'],
      hypertension: ['高血压', '血壓高'],
      asthma: ['哮喘', '氣喘'],
      heart: ['心脏病', '心臟病']
    };

    const detectedConditions = [];
    for (const [condition, keywords] of Object.entries(medicalConditions)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        detectedConditions.push(condition);
      }
    }

    return {
      required: detectedConditions.length > 0,
      conditions: detectedConditions,
      urgency: /(紧急|急需)/i.test(message) ? 'urgent' : 'normal'
    };
  }

  // 宗教需求檢測
  static detectReligiousNeeds(message) {
    if (/清真|穆斯林|halal/i.test(message)) return 'halal';
    if (/犹太|kosher/i.test(message)) return 'kosher';
    if (/佛教|素食/i.test(message)) return 'buddhist';
    return null;
  }

  // 家庭需求檢測
  static detectFamilyNeeds(message) {
    const { childrenCount, seniorCount } = this.extractChildrenAndSeniors(message);
    
    return {
      hasChildren: childrenCount > 0,
      hasSeniors: seniorCount > 0,
      childrenCount,
      seniorCount,
      requiresFamilyRoom: childrenCount > 0 || seniorCount > 0
    };
  }

  // 模擬機器學習意圖識別
  static async mlIntentRecognition(message) {
    const intents = [];
    
    if (message.match(/(预订|订房|预约|reservation|book)/)) {
      intents.push('booking');
    }
    if (message.match(/(查询|了解|价格|多少钱|price|cost)/)) {
      intents.push('inquiry');
    }
    if (message.match(/(取消|cancel)/)) {
      intents.push('cancellation');
    }
    if (message.match(/(会员|优惠|折扣|member|discount)/)) {
      intents.push('membership');
    }

    return intents.length > 0 ? intents : ['general_inquiry'];
  }

  // 小孩與老人數量解析
  static extractChildrenAndSeniors(message) {
    let childrenCount = 0;
    let seniorCount = 0;

    // 多種格式匹配
    const childrenPatterns = [
      /(\d+)\s*个?小孩/,
      /(\d+)\s*个?孩子/,
      /(\d+)\s*个?儿童/,
      /(\d+)\s*children/,
      /(\d+)\s*kids/
    ];

    const seniorPatterns = [
      /(\d+)\s*个?老人/,
      /(\d+)\s*个?长者/,
      /(\d+)\s*个?老年人/,
      /(\d+)\s*seniors/,
      /(\d+)\s*elders/
    ];

    for (const pattern of childrenPatterns) {
      const match = message.match(pattern);
      if (match) {
        childrenCount = parseInt(match[1], 10);
        break;
      }
    }

    for (const pattern of seniorPatterns) {
      const match = message.match(pattern);
      if (match) {
        seniorCount = parseInt(match[1], 10);
        break;
      }
    }

    return { childrenCount, seniorCount };
  }

  // 情感分析
  static analyzeSentiment(message) {
    const positiveWords = ['好', '赞', '满意', '喜欢', '不错', '优秀', '很好', '太棒了'];
    const negativeWords = ['差', '抱怨', '不满', '失望', '糟糕', '不好', '讨厌', '问题'];

    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
      if (message.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
      if (message.includes(word)) negativeCount++;
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // 生成總結
  static generateSummary(data) {
    const points = [];
    
    if (data.accessibility.required) {
      points.push(`無障礙需求: ${data.accessibility.types.join(', ')}`);
    }
    
    if (data.dietary.vegetarian.required) {
      points.push(`${data.dietary.vegetarian.type}飲食需求`);
    }
    
    if (data.dietary.allergies.required) {
      points.push(`過敏原: ${data.dietary.allergies.types.join(', ')}`);
    }
    
    if (data.demographics.childrenCount > 0) {
      points.push(`兒童: ${data.demographics.childrenCount}位`);
    }
    
    if (data.demographics.seniorCount > 0) {
      points.push(`長者: ${data.demographics.seniorCount}位`);
    }

    return {
      hasSpecialRequirements: points.length > 0,
      requirementCount: points.length,
      mainPoints: points,
      priority: data.accessibility.urgency === 'urgent' ? 'high' : 'normal'
    };
  }

  // 備用響應
  static getFallbackResponse() {
    return {
      symbolUsage: { count: 0, density: 0, level: 'low', hasMultipleExclamation: false, hasMultipleQuestion: false },
      accessibility: { required: false, types: [], urgency: 'normal', description: '無特殊無障礙需求' },
      dietary: {
        vegetarian: { required: false, type: null, strictness: 'normal' },
        allergies: { required: false, types: [], count: 0 }
      },
      special: {
        medical: { required: false, conditions: [], urgency: 'normal' },
        religious: null,
        family: { hasChildren: false, hasSeniors: false, childrenCount: 0, seniorCount: 0, requiresFamilyRoom: false }
      },
      intent: ['general_inquiry'],
      demographics: { childrenCount: 0, seniorCount: 0, totalSpecialNeeds: 0 },
      sentiment: 'neutral',
      summary: {
        hasSpecialRequirements: false,
        requirementCount: 0,
        mainPoints: [],
        priority: 'normal'
      }
    };
  }
}

module.exports = RequirementDetector;

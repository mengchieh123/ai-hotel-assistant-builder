// services/requirementDetector.js

class RequirementDetector {
  // 主要解析方法，整合所有需求抽取
  static async detectAllRequirements(message) {
    const mlIntents = await this.mlIntentRecognition(message);
    const { childrenCount, seniorCount } = this.extractChildrenAndSeniors(message);

    return {
      symbolCount: {
        count: (message.match(/[.!?,;:!！？，；：]/g) || []).length,
        level: this.analyzeSymbolDensity(message)
      },
      accessible: {
        required: /(无障碍|残障|轮椅|行动不便|残疾人|无障碍设施|坡道|扶手)/i.test(message),
        urgency: this.detectAccessibilityUrgency(message),
        type: this.detectAccessibilityType(message)
      },
      vegetarian: {
        required: /(素食|不吃肉|蔬菜|素食主义|全素|蛋奶素| vegan|vegetarian)/i.test(message),
        type: this.detectVegetarianType(message),
        strictness: this.detectDietStrictness(message)
      },
      special: {
        allergy: this.detectAllergies(message),
        religious: this.detectReligiousNeeds(message),
        medical: this.detectMedicalNeeds(message)
      },
      intent: mlIntents,
      childrenCount,
      seniorCount,
      sentiment: this.analyzeSentiment(message)
    };
  }

  // 模擬機器學習意圖識別
  static async mlIntentRecognition(message) {
    if (message.match(/(预订|订房|预约)/)) return ['booking'];
    if (message.match(/(查询|了解|价格)/)) return ['inquiry'];
    return ['general_inquiry'];
  }

  // 小孩與老人數量解析
  static extractChildrenAndSeniors(message) {
    const childrenMatch = message.match(/(\d+)\s*个?小孩/);
    const childrenCount = childrenMatch ? parseInt(childrenMatch[1], 10) : 0;

    const seniorMatch = message.match(/(\d+)\s*个?老人/);
    const seniorCount = seniorMatch ? parseInt(seniorMatch[1], 10) : 0;

    return { childrenCount, seniorCount };
  }

  static analyzeSymbolDensity(message) {
    const density = (message.match(/[.!?,;:!！？，；：]/g) || []).length / message.length;
    if (density > 0.1) return 'high';
    if (density > 0.05) return 'medium';
    return 'low';
  }

  static detectAccessibilityUrgency(message) {
    if (/(紧急|急需|马上|立刻)/i.test(message)) return 'urgent';
    return 'normal';
  }

  static detectAccessibilityType(message) {
    const types = ['轮椅', '坡道', '无障碍设施', '扶手'];
    for (const type of types) {
      if (new RegExp(type, 'i').test(message)) return type;
    }
    return null;
  }

  static detectVegetarianType(message) {
    if (/(全素|vegan)/i.test(message)) return 'vegan';
    if (/(蛋奶素|vegetarian)/i.test(message)) return 'vegetarian';
    return null;
  }

  static detectDietStrictness(message) {
    if (/(严格|严禁)/i.test(message)) return 'strict';
    return 'normal';
  }

  static detectAllergies(message) {
    const allergies = [];
    if (/花生/i.test(message)) allergies.push('peanut');
    if (/海鲜|海產/i.test(message)) allergies.push('seafood');
    return allergies.length > 0 ? allergies : null;
  }

  static detectReligiousNeeds(message) {
    if (/清真|穆斯林/i.test(message)) return 'halal';
    if (/犹太/i.test(message)) return 'kosher';
    return null;
  }

  static detectMedicalNeeds(message) {
    if (/糖尿病/i.test(message)) return 'diabetes';
    if (/高血压/i.test(message)) return 'hypertension';
    return null;
  }

  static analyzeSentiment(message) {
    if (/(好|赞|满意|喜欢)/i.test(message)) return 'positive';
    if (/(差|抱怨|不满|失望)/i.test(message)) return 'negative';
    return 'neutral';
  }
}

module.exports = RequirementDetector;

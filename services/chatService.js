const express = require('express');
const router = express.Router();

// 模擬外部機器學習意圖識別服務
async function mlIntentRecognition(message) {
  // 模擬異步 API 呼叫，自行替換為實際 ML 服務接口
  // 返回意圖清單示例
  if (message.match(/(预订|订房|预约)/)) return ['booking'];
  if (message.match(/(查询|了解|价格)/)) return ['inquiry'];
  // ...更多判斷
  return ['general_inquiry'];
}

class RequirementDetector {
  static async detectAllRequirements(message) {
    const mlIntents = await mlIntentRecognition(message);

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
      sentiment: this.analyzeSentiment(message)
    };
  }

  // 其他輔助方法保持不變，省略...

  static analyzeSymbolDensity(message) {
    const density = (message.match(/[.!?,;:!！？，；：]/g) || []).length / message.length;
    if (density > 0.1) return 'high';
    if (density > 0.05) return 'medium';
    return 'low';
  }

  static detectAccessibilityUrgency(message) {
    // 範例實作（具體實作依需求調整）
    if (/(紧急|急需|马上|立刻)/i.test(message)) return 'urgent';
    return 'normal';
  }

  static detectAccessibilityType(message) {
    // 範例實作
    const types = ['轮椅', '坡道', '无障碍设施', '扶手'];
    for (const type of types) {
      if (new RegExp(type, 'i').test(message)) return type;
    }
    return null;
  }

  static detectVegetarianType(message) {
    // 範例判斷
    if (/(全素|vegan)/i.test(message)) return 'vegan';
    if (/(蛋奶素|vegetarian)/i.test(message)) return 'vegetarian';
    return null;
  }

  static detectDietStrictness(message) {
    // 範例判斷
    if (/(严格|严禁)/i.test(message)) return 'strict';
    return 'normal';
  }

  static detectAllergies(message) {
    // 假設偵測花生、海鮮過敏
    const allergies = [];
    if (/花生/i.test(message)) allergies.push('peanut');
    if (/海鲜|海產/i.test(message)) allergies.push('seafood');
    return allergies.length > 0 ? allergies : null;
  }

  static detectReligiousNeeds(message) {
    // 範例判斷
    if (/清真|穆斯林/i.test(message)) return 'halal';
    if (/犹太/i.test(message)) return 'kosher';
    return null;
  }

  static detectMedicalNeeds(message) {
    // 範例判斷
    if (/糖尿病/i.test(message)) return 'diabetes';
    if (/高血压/i.test(message)) return 'hypertension';
    return null;
  }

  static analyzeSentiment(message) {
    // 簡單正向/負向判斷示例
    if (/(好|赞|满意|喜欢)/i.test(message)) return 'positive';
    if (/(差|抱怨|不满|失望)/i.test(message)) return 'negative';
    return 'neutral';
  }
}

class ResponseGenerator {
  static generateResponse(message, requirements) {
    // 此處是占位範例，請依具體需求編寫回覆邏輯
    let mainResponse = "感謝您的詢問，我們會盡快處理您的需求。";
    let specialNeeds = [];
    let followUp = [];

    if (requirements.accessible.required) {
      specialNeeds.push('無障礙需求');
    }
    if (requirements.vegetarian.required) {
      specialNeeds.push('素食需求');
    }
    if (requirements.special.allergy && requirements.special.allergy.length > 0) {
      specialNeeds.push(`過敏原：${requirements.special.allergy.join(', ')}`);
    }

    if (requirements.intent.includes('booking')) {
      mainResponse = "請提供入住日期和房型，我們協助您完成預訂。";
    } else if (requirements.intent.includes('inquiry')) {
      mainResponse = "請問您想了解哪些服務或價格資訊？";
    }

    // 假如符號密度高，提示分句清楚
    if (requirements.symbolCount.level === 'high') {
      followUp.push("您的訊息較長，請確認是否需要分段說明。");
    }

    return {
      fullResponse: [mainResponse, specialNeeds.join('; ')].filter(Boolean).join('\n'),
      mainResponse,
      specialNeeds,
      followUp,
      metadata: {
        requirementsDetected: Object.keys(requirements),
        priority: requirements.accessible.urgency === 'urgent' ? 'high' : 'normal'
      }
    };
  }
}

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        error: '消息不能为空',
        suggestion: '请提供您的查询或需求'
      });
    }

    console.log('收到消息:', message);

    const requirements = await RequirementDetector.detectAllRequirements(message);
    console.log('检测到需求:', JSON.stringify(requirements, null, 2));

    const response = ResponseGenerator.generateResponse(message, requirements);

    console.log('Chat Request:', {
      sessionId,
      message,
      requirementsDetected: response.metadata.requirementsDetected,
      priority: response.metadata.priority
    });

    res.json({
      success: true,
      response: response.fullResponse,
      detailedResponse: {
        main: response.mainResponse,
        specialNeeds: response.specialNeeds,
        followUpQuestions: response.followUp
      },
      requirements: {
        symbolCount: requirements.symbolCount.count,
        accessible: requirements.accessible.required,
        vegetarian: requirements.vegetarian.required,
        allergies: requirements.special.allergy,
        urgent: requirements.accessible.urgency === 'urgent'
      },
      metadata: {
        ...response.metadata,
        timestamp: new Date().toISOString(),
        sessionId
      }
    });

  } catch (error) {
    console.error('Chat service error:', error);
    res.status(500).json({
      error: '处理您的请求时出现错误',
      suggestion: '请稍后重试或联系客服'
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '3.0',
    timestamp: new Date().toISOString(),
    features: [
      'symbol_count_detection',
      'accessibility_need_detection',
      'vegetarian_detection',
      'allergy_detection',
      'religious_diet_detection',
      'medical_diet_detection',
      'sentiment_analysis',
      'intent_recognition (ML integration)'
    ]
  });
});

module.exports = router;

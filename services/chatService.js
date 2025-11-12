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

  // 其它函式保持不變，略...

  static analyzeSymbolDensity(message) {
    const density = (message.match(/[.!?,;:!！？，；：]/g) || []).length / message.length;
    if (density > 0.1) return 'high';
    if (density > 0.05) return 'medium';
    return 'low';
  }
  // ...略，保留原本所有方法...
}

// ResponseGenerator 保持不變，直接用之前版本

class ResponseGenerator {
  // ...同您先前版本，无改动...
}

// 入口 POST /chat 路由
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

    // 异步调用高级需求检测，整合 ML 意图识别
    const requirements = await RequirementDetector.detectAllRequirements(message);
    console.log('检测到需求:', JSON.stringify(requirements, null, 2));

    // 生成响应
    const response = ResponseGenerator.generateResponse(message, requirements);

    // 日志记录
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

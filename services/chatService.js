const express = require('express');
const router = express.Router();

// ==================== 新增：智能問答服務 ====================
class QAService {
  static handleQuestion(message, sessionData = {}) {
    const lowerMessage = message.toLowerCase();
    
    // 價格相關問題
    if (/價格|價錢|多少錢|費用|房價|報價/.test(lowerMessage)) {
      return `💰 價格資訊：\n` +
             `• 標準雙人房：2,200 TWD/晚\n` +
             `• 豪華雙人房：2,800 TWD/晚\n` +
             `• 套房：4,500 TWD/晚\n` +
             `• 以上價格已含服務費及稅金\n` +
             `• 會員可享額外折扣`;
    }
    
    // 兒童相關問題
    if (/小孩|兒童|孩子|小朋友|加價|加床|嬰兒/.test(lowerMessage)) {
      return `👶 兒童政策：\n` +
             `• 6歲以下兒童：免費（不佔床）\n` +
             `• 6-12歲兒童：每人每晚加收 300 TWD\n` +
             `• 加嬰兒床：免費提供\n` +
             `• 加床服務：500 TWD/晚\n` +
             `• 家庭房：可容納 2大2小`;
    }
    
    // 老人優惠問題
    if (/老人|長者|長輩|優惠|折扣|敬老/.test(lowerMessage)) {
      return `👴 長者優惠：\n` +
             `• 65歲以上長者：房價 9 折優惠\n` +
             `• 需出示身份證明文件\n` +
             `• 可與會員折扣合併使用`;
    }
    
    // 早餐問題
    if (/早餐|餐點|用餐|吃飯/.test(lowerMessage)) {
      return `🍽️ 早餐資訊：\n` +
             `• 供應時間：06:30-10:00\n` +
             `• 成人：300 TWD/位\n` +
             `• 兒童：150 TWD/位\n` +
             `• 白金會員：免費享用`;
    }
    
    // 停車問題
    if (/停車|車位|泊車/.test(lowerMessage)) {
      return `🅿️ 停車資訊：\n` +
             `• 免費停車位\n` +
             `• 地下停車場\n` +
             `• 先到先得\n` +
             `• 電動車充電站`;
    }
    
    // 取消政策
    if (/取消|退訂|退款|退房/.test(lowerMessage)) {
      return `📝 取消政策：\n` +
             `• 入住前3天：全額退款\n` +
             `• 入住前1天：退款80%\n` +
             `• 當天取消：退款50%\n` +
             `• 不可抗力因素：特殊處理`;
    }
    
    // 會員問題
    if (/會員|會員卡|會員資格|積分/.test(lowerMessage)) {
      return `🎫 會員制度：\n` +
             `• 銀卡會員：房價9折 + 免費早餐\n` +
             `• 金卡會員：房價85折 + 延遲退房\n` +
             `• 白金會員：房價8折 + 專屬管家\n` +
             `• 消費累積積分，可兌換免費住宿`;
    }
    
    // 設施問題
    if (/設施|設備|游泳池|健身房|溫泉/.test(lowerMessage)) {
      return `🏊 酒店設施：\n` +
             `• 室外游泳池：07:00-22:00\n` +
             `• 健身房：24小時開放\n` +
             `• SPA溫泉：需預約\n` +
             `• 商務中心：09:00-18:00`;
    }
    
    // 寵物問題
    if (/寵物|狗|貓|帶寵物/.test(lowerMessage)) {
      return `🐾 寵物政策：\n` +
             `• 允許攜帶小型寵物\n` +
             `• 清潔費：500 TWD/晚\n` +
             `• 需自備寵物用品\n` +
             `• 公共區域需使用寵物推車`;
    }
    
    // 無障礙設施
    if (/無障礙|輪椅|殘障|行動不便/.test(lowerMessage)) {
      return `♿ 無障礙設施：\n` +
             `• 無障礙客房\n` +
             `• 輪椅通道\n` +
             `• 專用停車位\n` +
             `• 緊急呼叫系統`;
    }
    
    return null;
  }
}

// ==================== 原有功能保持不變 ====================

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

  // 其他輔助方法保持不變
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

class ResponseGenerator {
  static generateResponse(message, requirements) {
    // 先檢查智能問答
    const qaAnswer = QAService.handleQuestion(message);
    if (qaAnswer) {
      return {
        fullResponse: qaAnswer,
        mainResponse: qaAnswer,
        specialNeeds: [],
        followUp: ['請問還有其他問題嗎？'],
        metadata: {
          requirementsDetected: ['qa_service'],
          priority: 'normal',
          responseType: 'qa'
        }
      };
    }

    // 原有邏輯保持不變
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
        priority: requirements.accessible.urgency === 'urgent' ? 'high' : 'normal',
        responseType: 'requirement_based'
      }
    };
  }
}

// ==================== 路由處理保持不變 ====================

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
      priority: response.metadata.priority,
      responseType: response.metadata.responseType
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
    version: '3.1', // 版本更新
    timestamp: new Date().toISOString(),
    features: [
      'symbol_count_detection',
      'accessibility_need_detection', 
      'vegetarian_detection',
      'allergy_detection',
      'religious_diet_detection',
      'medical_diet_detection',
      'sentiment_analysis',
      'intent_recognition (ML integration)',
      'smart_qa_service' // 新增功能
    ]
  });
});

module.exports = router;

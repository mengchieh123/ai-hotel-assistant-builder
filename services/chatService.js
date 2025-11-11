// services/chatService.js v3.0 - 完整特殊需求处理版本
const express = require('express');
const router = express.Router();

// 高级需求检测系统
class RequirementDetector {
  static detectAllRequirements(message) {
    return {
      // 符号数量检测
      symbolCount: {
        count: (message.match(/[.!?,;:!！？，；：]/g) || []).length,
        level: this.analyzeSymbolDensity(message)
      },
      
      // 无障碍需求检测
      accessible: {
        required: /(无障碍|残障|轮椅|行动不便|残疾人|无障碍设施|坡道|扶手)/i.test(message),
        urgency: this.detectAccessibilityUrgency(message),
        type: this.detectAccessibilityType(message)
      },
      
      // 素食需求检测  
      vegetarian: {
        required: /(素食|不吃肉|蔬菜|素食主义|全素|蛋奶素| vegan|vegetarian|荤食不吃)/i.test(message),
        type: this.detectVegetarianType(message),
        strictness: this.detectDietStrictness(message)
      },
      
      // 其他特殊需求
      special: {
        allergy: this.detectAllergies(message),
        religious: this.detectReligiousNeeds(message),
        medical: this.detectMedicalNeeds(message)
      },
      
      // 用户意图分析
      intent: this.detectUserIntent(message),
      
      // 情感分析
      sentiment: this.analyzeSentiment(message)
    };
  }

  static analyzeSymbolDensity(message) {
    const density = (message.match(/[.!?,;:!！？，；：]/g) || []).length / message.length;
    if (density > 0.1) return 'high';
    if (density > 0.05) return 'medium';
    return 'low';
  }

  static detectAccessibilityUrgency(message) {
    if (/(急需|立刻|马上|紧急|必须).*(轮椅|无障碍)/i.test(message)) return 'urgent';
    if (/(需要|要求|希望).*(无障碍)/i.test(message)) return 'standard';
    return 'informational';
  }

  static detectAccessibilityType(message) {
    const types = [];
    if (/轮椅/i.test(message)) types.push('wheelchair');
    if (/视觉|盲人|视障/i.test(message)) types.push('visual');
    if (/听觉|聋哑|听障/i.test(message)) types.push('hearing');
    if (/行动不便|老年人/i.test(message)) types.push('mobility');
    return types.length > 0 ? types : ['general'];
  }

  static detectVegetarianType(message) {
    if (/(全素|严格素食|vegan)/i.test(message)) return 'vegan';
    if (/(蛋奶素|vegetarian)/i.test(message)) return 'lacto_ovo';
    if (/佛教|斋食/i.test(message)) return 'buddhist';
    return 'general_vegetarian';
  }

  static detectDietStrictness(message) {
    if (/(严格|绝对|完全不能|禁忌)/i.test(message)) return 'strict';
    if (/(尽量|偏好|喜欢)/i.test(message)) return 'moderate';
    return 'flexible';
  }

  static detectAllergies(message) {
    const allergies = [];
    const allergyKeywords = {
      nuts: /坚果|花生|almond|walnut|nut/i,
      seafood: /海鲜|鱼|虾|蟹|seafood|fish/i,
      gluten: /麸质|面粉|gluten|wheat/i,
      dairy: /奶制品|牛奶|乳糖|dairy|milk|cheese/i
    };
    
    for (const [allergy, pattern] of Object.entries(allergyKeywords)) {
      if (pattern.test(message)) allergies.push(allergy);
    }
    return allergies;
  }

  static detectReligiousNeeds(message) {
    if (/清真|halal|穆斯林|回民/i.test(message)) return 'halal';
    if (/犹太|kosher|犹太教/i.test(message)) return 'kosher';
    if (/佛教|斋戒|素食/i.test(message)) return 'buddhist';
    return null;
  }

  static detectMedicalNeeds(message) {
    if (/(糖尿病|血糖)/i.test(message)) return 'diabetic';
    if (/(高血压|低钠)/i.test(message)) return 'low_sodium';
    if (/(肾病|低蛋白)/i.test(message)) return 'low_protein';
    return null;
  }

  static detectUserIntent(message) {
    const intents = [];
    if (/(预订|预定|订房|预约)/i.test(message)) intents.push('booking');
    if (/(查询|了解|想知道|价格)/i.test(message)) intents.push('inquiry');
    if (/(取消|退订)/i.test(message)) intents.push('cancellation');
    if (/(服务|设施|提供)/i.test(message)) intents.push('service_info');
    if (/(投诉|意见|不满意)/i.test(message)) intents.push('complaint');
    return intents.length > 0 ? intents : ['general_inquiry'];
  }

  static analyzeSentiment(message) {
    const positive = /(谢谢|感谢|很好|不错|满意|喜欢)/i.test(message);
    const negative = /(不满|糟糕|失望|生气|投诉)/i.test(message);
    const urgent = /(紧急|急需|立刻|马上)/i.test(message);
    
    if (urgent) return 'urgent';
    if (negative) return 'negative';
    if (positive) return 'positive';
    return 'neutral';
  }
}

// 智能响应生成器
class ResponseGenerator {
  static generateResponse(userMessage, requirements) {
    const baseResponse = this.generateBaseResponse(requirements.intent);
    const specialNeedsResponse = this.generateSpecialNeedsResponse(requirements);
    const followUpQuestions = this.generateFollowUpQuestions(requirements);
    
    return {
      mainResponse: baseResponse,
      specialNeeds: specialNeedsResponse,
      followUp: followUpQuestions,
      fullResponse: this.assembleFullResponse(baseResponse, specialNeedsResponse, followUpQuestions),
      metadata: {
        requirementsDetected: this.countDetectedRequirements(requirements),
        priority: this.determinePriority(requirements),
        suggestedActions: this.suggestActions(requirements)
      }
    };
  }

  static generateBaseResponse(intent) {
    const baseResponses = {
      booking: "感谢您选择我们酒店！我可以协助您完成预订。",
      inquiry: "很高兴为您提供信息！请问您想了解什么？",
      cancellation: "我可以协助您处理取消预订的事宜。",
      service_info: "我们提供多种服务和设施，很高兴为您介绍。",
      complaint: "很抱歉给您带来不便，我会尽力协助解决问题。",
      general_inquiry: "您好！请问需要什么服务？例如订房、查询价格、取消订单等等。"
    };
    
    return baseResponses[intent[0]] || baseResponses.general_inquiry;
  }

  static generateSpecialNeedsResponse(requirements) {
    const responses = [];
    
    // 符号数量响应
    if (requirements.symbolCount.count > 0) {
      responses.push(`注意到您使用了${requirements.symbolCount.count}个标点符号，表达很清晰。`);
    }
    
    // 无障碍需求响应
    if (requirements.accessible.required) {
      let accessibleResponse = "我们提供完善的无障碍设施";
      if (requirements.accessible.type.includes('wheelchair')) {
        accessibleResponse += "，包括轮椅通道、无障碍客房和专用卫生间";
      }
      if (requirements.accessible.urgency === 'urgent') {
        accessibleResponse += "。我们可以立即为您安排！";
      } else {
        accessibleResponse += "，可以为您特别安排。";
      }
      responses.push(accessibleResponse);
    }
    
    // 素食需求响应
    if (requirements.vegetarian.required) {
      const vegType = {
        vegan: "严格全素",
        lacto_ovo: "蛋奶素",
        buddhist: "佛教斋食",
        general_vegetarian: "素食"
      }[requirements.vegetarian.type];
      
      let vegResponse = `我们为${vegType}客人提供专门的餐饮选择`;
      if (requirements.vegetarian.strictness === 'strict') {
        vegResponse += "，并确保完全无交叉污染";
      }
      responses.push(vegResponse + "。");
    }
    
    // 过敏需求响应
    if (requirements.special.allergy.length > 0) {
      const allergyNames = {
        nuts: "坚果", seafood: "海鲜", gluten: "麸质", dairy: "奶制品"
      };
      const allergies = requirements.special.allergy.map(a => allergyNames[a]).join('、');
      responses.push(`已记录您的${allergies}过敏需求，厨房会特别注意。`);
    }
    
    return responses;
  }

  static generateFollowUpQuestions(requirements) {
    const questions = [];
    
    if (requirements.accessible.required && !requirements.accessible.type.includes('wheelchair')) {
      questions.push("请问您需要什么具体的无障碍设施？如轮椅通道、视觉辅助等");
    }
    
    if (requirements.vegetarian.required && requirements.vegetarian.type === 'general_vegetarian') {
      questions.push("您偏好哪种素食？全素、蛋奶素或其他特定要求？");
    }
    
    if (requirements.special.allergy.length > 0) {
      questions.push("除了已提到的过敏原，还有其他需要避免的食物吗？");
    }
    
    if (requirements.intent.includes('booking') && this.countDetectedRequirements(requirements) > 0) {
      questions.push("需要我为您查找符合这些需求的可用客房吗？");
    }
    
    return questions;
  }

  static assembleFullResponse(base, specialNeeds, followUp) {
    let fullResponse = base;
    
    if (specialNeeds.length > 0) {
      fullResponse += " " + specialNeeds.join(" ");
    }
    
    if (followUp.length > 0) {
      fullResponse += " " + followUp.join(" ");
    }
    
    return fullResponse;
  }

  static countDetectedRequirements(requirements) {
    let count = 0;
    if (requirements.symbolCount.count > 0) count++;
    if (requirements.accessible.required) count++;
    if (requirements.vegetarian.required) count++;
    if (requirements.special.allergy.length > 0) count++;
    if (requirements.special.religious) count++;
    if (requirements.special.medical) count++;
    return count;
  }

  static determinePriority(requirements) {
    if (requirements.accessible.urgency === 'urgent') return 'high';
    if (requirements.sentiment === 'urgent' || requirements.sentiment === 'negative') return 'high';
    if (this.countDetectedRequirements(requirements) > 2) return 'medium';
    return 'normal';
  }

  static suggestActions(requirements) {
    const actions = [];
    if (requirements.accessible.required) actions.push('assign_accessible_room');
    if (requirements.vegetarian.required) actions.push('note_dietary_restriction');
    if (requirements.special.allergy.length > 0) actions.push('flag_allergies');
    if (requirements.intent.includes('booking')) actions.push('check_availability');
    return actions;
  }
}

// 主聊天服务
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
    
    // 检测所有需求
    const requirements = RequirementDetector.detectAllRequirements(message);
    console.log('检测到需求:', JSON.stringify(requirements, null, 2));
    
    // 生成智能响应
    const response = ResponseGenerator.generateResponse(message, requirements);
    
    // 记录日志
    console.log('Chat Request:', {
      sessionId,
      message,
      requirementsDetected: response.metadata.requirementsDetected,
      priority: response.metadata.priority
    });

    // 返回完整响应
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
        sessionId: sessionId
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

// 健康检查端点
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
      'intent_recognition'
    ]
  });
});

module.exports = router;

// intentModules/ModularIntentClassifier.js
const IntentModules = require('./intentModules');

class ModularIntentClassifier {
  static classify(message) {
    const results = {
      intents: [],
      entities: [],
      module: null,
      confidence: 0,
      suggestedSteps: [],
      primaryIntent: null
    };

    const lowerMessage = message.toLowerCase();
    const originalMessage = message;
    
    console.log(`🔍 開始意圖分析: "${message}"`);
    
    // 檢查每個模組
    const moduleScores = {};
    
    Object.entries(IntentModules).forEach(([moduleKey, module]) => {
      const score = this.scoreModule(module, lowerMessage, originalMessage);
      moduleScores[moduleKey] = score;
      console.log(`   📊 ${module.name} 模組得分: ${score}`);
    });

    // 找出得分最高的模組
    const bestModuleKey = Object.keys(moduleScores).reduce((a, b) => 
      moduleScores[a] > moduleScores[b] ? a : b
    );

    const bestModule = IntentModules[bestModuleKey];
    const moduleScore = moduleScores[bestModuleKey];

    console.log(`   🎯 最佳模組: ${bestModule.name} (信心度: ${moduleScore})`);

    if (moduleScore > 0.3) {
      results.module = bestModule.name;
      results.confidence = moduleScore;
      
      // 獲取該模組的具體意圖
      const intentResults = this.extractModuleIntents(bestModule, lowerMessage, originalMessage);
      results.intents = intentResults.intents;
      results.entities = intentResults.entities;
      results.suggestedSteps = intentResults.suggestedSteps;
      results.primaryIntent = intentResults.primaryIntent;
      
      console.log(`   🎯 識別意圖: ${results.intents.join(', ')}`);
      console.log(`   🔍 提取實體:`, results.entities);
    } else {
      console.log(`   ⚠️  未找到明確模組，使用通用意圖`);
    }

    // 如果沒有明確意圖，歸類為一般詢問
    if (results.intents.length === 0) {
      results.intents = ['general_inquiry'];
      results.module = 'general';
      results.primaryIntent = 'general_inquiry';
    }

    return results;
  }

  static scoreModule(module, lowerMessage, originalMessage) {
    let totalScore = 0;
    let matchCount = 0;

    Object.values(module.patterns).forEach(intent => {
      intent.patterns.forEach(pattern => {
        if (lowerMessage.includes(pattern.toLowerCase())) {
          totalScore += intent.weight;
          matchCount++;
        }
      });
    });

    // 實體匹配加分
    Object.values(module.entities || {}).forEach(entityConfig => {
      entityConfig.patterns.forEach(patternConfig => {
        const regex = new RegExp(patternConfig.regex);
        if (regex.test(originalMessage)) {
          totalScore += 0.2;
          matchCount++;
        }
      });
    });

    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  static extractModuleIntents(module, lowerMessage, originalMessage) {
    const results = {
      intents: [],
      entities: [],
      suggestedSteps: [],
      primaryIntent: null
    };

    let highestScore = 0;
    let primaryIntent = null;

    Object.entries(module.patterns).forEach(([intentKey, intentConfig]) => {
      let intentScore = 0;
      
      intentConfig.patterns.forEach(pattern => {
        if (lowerMessage.includes(pattern.toLowerCase())) {
          intentScore += intentConfig.weight;
        }
      });

      if (intentScore > 0.3) {
        results.intents.push(intentKey);
        results.suggestedSteps.push(...intentConfig.nextSteps);
        
        // 更新主要意圖
        if (intentScore > highestScore) {
          highestScore = intentScore;
          primaryIntent = intentKey;
        }
        
        // 提取實體
        intentConfig.entities.forEach(entityType => {
          const entities = this.extractEntities(module, entityType, originalMessage);
          results.entities.push(...entities);
        });
      }
    });

    results.primaryIntent = primaryIntent;
    return results;
  }

  static extractEntities(module, entityType, message) {
    const entities = [];
    const entityConfig = module.entities[entityType];

    if (entityConfig) {
      entityConfig.patterns.forEach(patternConfig => {
        const regex = new RegExp(patternConfig.regex);
        const matches = message.match(regex);
        
        if (matches) {
          entities.push({
            entity: entityType,
            value: patternConfig.value || matches[0],
            type: patternConfig.type,
            confidence: 0.9
          });
        }
      });
    }

    return entities;
  }

  // 獲取模組專屬回應
  static getModuleResponse(moduleName, intentKey, responseType = 'success') {
    const module = Object.values(IntentModules).find(m => m.name === moduleName);
    if (module && module.patterns[intentKey]) {
      return module.patterns[intentKey].responses[responseType] || 
             module.patterns[intentKey].responses.fallback;
    }
    return null;
  }

  // 獲取建議的下一步驟
  static getSuggestedSteps(moduleName, intentKey) {
    const module = Object.values(IntentModules).find(m => m.name === moduleName);
    if (module && module.patterns[intentKey]) {
      return module.patterns[intentKey].nextSteps;
    }
    return [];
  }
}

module.exports = ModularIntentClassifier;

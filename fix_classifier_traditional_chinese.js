const fs = require('fs');

let content = fs.readFileSync('./intentModules/ModularIntentClassifier.js', 'utf8');

// 更新 calculateModuleScore 方法以支援多語言關鍵詞
const updatedContent = content.replace(/calculateModuleScore\\(message, moduleConfig\\) {[^}]+}/, `calculateModuleScore(message, moduleConfig) {
    let score = 0;
    const keywords = moduleConfig.keywords;
    
    // 檢查英文關鍵詞
    if (keywords.en) {
      keywords.en.forEach(keyword => {
        if (message.toLowerCase().includes(keyword.toLowerCase())) {
          score += 0.9;
        }
      });
    }
    
    // 檢查繁體中文關鍵詞
    if (keywords['zh-tw']) {
      keywords['zh-tw'].forEach(keyword => {
        if (message.includes(keyword)) {
          score += 0.9;
        }
      });
    }
    
    return score;
  }`);

// 更新 extractIntent 方法以支援多語言
const finalContent = updatedContent.replace(/extractIntent\\(message, intentsConfig\\) {[^}]+}/, `extractIntent(message, intentsConfig) {
    const detectedIntents = [];
    
    for (const [intent, config] of Object.entries(intentsConfig)) {
      let intentScore = 0;
      
      // 檢查英文關鍵詞
      if (config.keywords && config.keywords.en) {
        config.keywords.en.forEach(keyword => {
          if (message.toLowerCase().includes(keyword.toLowerCase())) {
            intentScore += 0.9;
          }
        });
      }
      
      // 檢查繁體中文關鍵詞
      if (config.keywords && config.keywords['zh-tw']) {
        config.keywords['zh-tw'].forEach(keyword => {
          if (message.includes(keyword)) {
            intentScore += 0.9;
          }
        });
      }
      
      if (intentScore > 0) {
        detectedIntents.push({
          intent: intent,
          score: intentScore,
          nextSteps: config.nextSteps || []
        });
      }
    }
    
    // 按分數排序並返回最高分的意圖
    detectedIntents.sort((a, b) => b.score - a.score);
    return detectedIntents[0] || null;
  }`);

fs.writeFileSync('./intentModules/ModularIntentClassifier.js', finalContent);
console.log('✅ 已更新分類器支援繁體中文關鍵詞');

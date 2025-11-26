const fs = require('fs');

// 讀取 server.js
let content = fs.readFileSync('server.js', 'utf8');

// 在 updateSession 方法中添加模組化支援
const oldUpdateSession = `updateSession(sessionId, message, intents, entities) {
  const session = this.getSession(sessionId);
  
  // 更新對話歷史
  session.conversationHistory.push({ 
    message, 
    intents, 
    entities,
    timestamp: new Date().toISOString(),
    step: session.currentStep
  });

  // 限制歷史長度
  if (session.conversationHistory.length > 50) {
    session.conversationHistory = session.conversationHistory.slice(-50);
  }

  // 分析情感
  session.sentiment = this.analyzeSentiment(message);

  // 更新用戶類型
  this.updateUserType(session, message);

  // 提取實體資訊
  this.extractEntities(session, message, entities);

  // 智能狀態推進
  this.advanceConversationState(session, intents, message);
  
  return session;
}`;

const newUpdateSession = `updateSession(sessionId, message, intents, entities) {
  const session = this.getSession(sessionId);
  
  // 更新對話歷史
  session.conversationHistory.push({ 
    message, 
    intents, 
    entities,
    timestamp: new Date().toISOString(),
    step: session.currentStep
  });

  // 限制歷史長度
  if (session.conversationHistory.length > 50) {
    session.conversationHistory = session.conversationHistory.slice(-50);
  }

  // 分析情感
  session.sentiment = this.analyzeSentiment(message);

  // 更新用戶類型
  this.updateUserType(session, message);

  // 提取實體資訊
  this.extractEntities(session, message, entities);

  // ==================== 新增：模組化意圖分析 ====================
  // 使用模組化意圖分類獲取更精準的意圖分析
  try {
    const modularResult = ModularIntentClassifier.classify(message);
    session.lastModularAnalysis = modularResult; // 保存模組分析結果
    
    console.log(\`🔍 模組化分析結果:\`, {
      module: modularResult.module,
      primaryIntent: modularResult.primaryIntent,
      confidence: modularResult.confidence,
      suggestedSteps: modularResult.suggestedSteps
    });
    
    // 如果有模組建議的步驟，優先使用模組化狀態推進
    if (modularResult.suggestedSteps && modularResult.suggestedSteps.length > 0) {
      session.currentStep = modularResult.suggestedSteps[0];
      console.log(\`🔄 模組建議步驟: \${modularResult.suggestedSteps[0]}\`);
    } else {
      // 否則使用原有的狀態推進邏輯
      this.advanceConversationState(session, intents, message);
    }
  } catch (error) {
    console.error('❌ 模組化分析失敗，使用傳統方法:', error);
    // 模組化分析失敗時回退到傳統方法
    this.advanceConversationState(session, intents, message);
  }
  // ==================== 模組化分析結束 ====================
  
  return session;
}`;

// 替換內容
content = content.replace(oldUpdateSession, newUpdateSession);

// 寫回檔案
fs.writeFileSync('server.js', content);
console.log('✅ updateSession 方法已成功添加模組化支援');

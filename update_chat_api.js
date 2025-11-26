const fs = require('fs');

// 讀取 server.js
let content = fs.readFileSync('server.js', 'utf8');

// 找到聊天 API 路由並添加模組化分析
const chatAPIPattern = /app\\.post\\('\\/api\\/chat', async \\(req, res\\) => {[\\s\\S]*?res\\.json\\(finalResponse\\);\\s+} catch \\(error\\) {[\\s\\S]*?}\\s+}\\);/;

const oldChatAPI = content.match(chatAPIPattern)[0];

// 在傳統意圖分析後添加模組化分析
const newChatAPI = oldChatAPI.replace(
  '// 分析意圖和實體',
  \`// 分析意圖和實體
    const intents = EnhancedIntentClassifier.classify(message);
    const entities = EnhancedIntentClassifier.extractEntities(message);
    
    // ==================== 新增：模組化意圖分析 ====================
    const modularResult = ModularIntentClassifier.classify(message);
    console.log(\\\`🎯 模組化分析:\\\`, {
      module: modularResult.module,
      primaryIntent: modularResult.primaryIntent,
      confidence: modularResult.confidence,
      suggestedSteps: modularResult.suggestedSteps
    });
    // ==================== 模組化分析結束 ====================\`
).replace(
  'console.log(\\\`🎯 識別意圖:\\\`, intents);',
  \`console.log(\\\`🎯 傳統意圖:\\\`, intents);
    console.log(\\\`🔍 提取實體:\\\`, entities);\`
).replace(
  \`const finalResponse = {
      success: true,
      reply: response.reply,
      sessionId,
      step: response.step || session.currentStep,
      userType: session.userType,
      intents: intents,
      entities: entities,
      options: response.options || ['開始訂房', '價格查詢', '餐廳推薦', '會員服務', '附近景點'],
      timestamp: new Date().toISOString(),
      sentiment: session.sentiment
    };\`,
  \`const finalResponse = {
      success: true,
      reply: response.reply,
      sessionId,
      step: response.step || session.currentStep,
      userType: session.userType,
      intents: intents,
      entities: entities,
      // ==================== 新增：模組化分析結果 ====================
      modularAnalysis: {
        module: modularResult.module,
        primaryIntent: modularResult.primaryIntent,
        confidence: modularResult.confidence,
        suggestedSteps: modularResult.suggestedSteps
      },
      isModularResponse: response.isModular || false,
      // ==================== 模組化分析結果結束 ====================
      options: response.options || ['開始訂房', '價格查詢', '餐廳推薦', '會員服務', '附近景點'],
      timestamp: new Date().toISOString(),
      sentiment: session.sentiment
    };\`
).replace(
  \`console.log(\\\`✅ 回應生成完成:\\\`, {
      sessionId: finalResponse.sessionId,
      step: finalResponse.step,
      userType: finalResponse.userType,
      intents: finalResponse.intents
    });\`,
  \`console.log(\\\`✅ 回應生成完成:\\\`, {
      sessionId: finalResponse.sessionId,
      step: finalResponse.step,
      userType: finalResponse.userType,
      intents: finalResponse.intents,
      module: finalResponse.modularAnalysis.module,
      isModular: finalResponse.isModularResponse
    });\`
);

// 替換內容
content = content.replace(chatAPIPattern, newChatAPI);

// 寫回檔案
fs.writeFileSync('server.js', content);
console.log('✅ 聊天 API 路由已成功更新為模組化版本');

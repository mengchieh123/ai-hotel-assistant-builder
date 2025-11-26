const fs = require('fs');

// 讀取 server.js
let content = fs.readFileSync('server.js', 'utf8');

// 在 generateResponse 方法開頭添加模組化回應邏輯
const oldGenerateResponse = `static generateResponse(intents, session, message, entities) {
  const manager = new EnhancedSessionManager();`;

const newGenerateResponse = `static generateResponse(intents, session, message, entities) {
  const manager = new EnhancedSessionManager();
  
  // ==================== 新增：模組化回應優先處理 ====================
  // 檢查是否有模組化分析結果且信心度足夠高
  if (session.lastModularAnalysis && session.lastModularAnalysis.confidence > 0.5) {
    const modularResult = session.lastModularAnalysis;
    const moduleResponse = this.generateModularResponse(modularResult, session, message);
    if (moduleResponse) {
      console.log(\`🎯 使用模組化回應: \${modularResult.module}.\${modularResult.primaryIntent}\`);
      return moduleResponse;
    }
  }
  // ==================== 模組化回應處理結束 ====================`;

// 替換內容
content = content.replace(oldGenerateResponse, newGenerateResponse);

// 在 IntelligentResponseGenerator 類別末尾添加新方法
const classEndMarker = `  static generateFacilitiesOverview(session) {
    let facilities = \\`• 室外泳池 (07:00-22:00)\\n• 健身房 (24小時)\\n• SPA中心 (10:00-21:00)\\n• 商務中心 (08:00-20:00)\\n\\`;
    if (session.userType === 'family') {
      facilities += \\`• 親子遊戲區 (09:00-18:00)\\n• 兒童泳池 (09:00-17:00)\\n\\`;
    }
    facilities += \\`💡 輸入「設施介紹」查看詳情\\`;
    return facilities;
  }
}`;

const newMethods = `  static generateFacilitiesOverview(session) {
    let facilities = \\`• 室外泳池 (07:00-22:00)\\n• 健身房 (24小時)\\n• SPA中心 (10:00-21:00)\\n• 商務中心 (08:00-20:00)\\n\\`;
    if (session.userType === 'family') {
      facilities += \\`• 親子遊戲區 (09:00-18:00)\\n• 兒童泳池 (09:00-17:00)\\n\\`;
    }
    facilities += \\`💡 輸入「設施介紹」查看詳情\\`;
    return facilities;
  }

  // ==================== 新增：模組化回應生成器 ====================
  static generateModularResponse(modularResult, session, message) {
    const { module, primaryIntent, confidence } = modularResult;
    
    // 只有信心度高的模組分析才使用模組化回應
    if (confidence > 0.6) {
      const moduleResponse = ModularIntentClassifier.getModuleResponse(module, primaryIntent);
      if (moduleResponse) {
        console.log(\`🎯 使用模組化回應: \${module}.\${primaryIntent} (信心度: \${confidence})\`);
        
        return {
          reply: moduleResponse,
          step: session.currentStep,
          options: this.generateModuleOptions(module),
          isModular: true // 標記為模組化回應
        };
      }
    }
    
    return null;
  }

  // ==================== 新增：模組專屬選項生成 ====================
  static generateModuleOptions(module) {
    const optionMap = {
      'booking': ['開始訂房', '查詢空房', '修改訂單', '價格查詢', '取消訂房'],
      'member': ['會員登入', '會員權益', '積分查詢', '註冊會員', '會員優惠'],
      'inquiry': ['設施介紹', '餐廳推薦', '周邊景點', '交通資訊', '價格查詢'],
      'service': ['預約接送', '加購早餐', '特殊需求', '其他服務', '設施預約'],
      'general': ['開始訂房', '會員服務', '設施介紹', '餐廳推薦', '周邊景點']
    };

    return optionMap[module] || optionMap.general;
  }
}`;

// 替換內容
content = content.replace(classEndMarker, newMethods);

// 寫回檔案
fs.writeFileSync('server.js', content);
console.log('✅ IntelligentResponseGenerator 已成功添加模組化回應方法');

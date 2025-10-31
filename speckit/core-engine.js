const fs = require('fs');
const path = require('path');

class AISpecEngine {
  constructor() {
    this.specPath = path.join(__dirname, '..', 'business_speckit.yaml');
    this.generatedDir = path.join(__dirname, '..', 'generated');
  }

  async processSpecification() {
    try {
      console.log('🚀 開始 AI 自動開發流程...');
      const spec = this.loadSpecification();
      console.log('✅ 規格文件讀取成功');
      
      const features = this.analyzeFeatures(spec);
      console.log('📋 識別功能:', features);
      
      const generatedCode = this.generateCode(features, spec);
      this.writeGeneratedCode(generatedCode);
      this.updateDialogueLogic();
      
      console.log('🎉 AI 自動開發完成！');
      return {
        success: true,
        generatedFiles: Object.keys(generatedCode).length,
        features: features
      };
    } catch (error) {
      console.error('❌ AI 開發失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  loadSpecification() {
    if (!fs.existsSync(this.specPath)) {
      throw new Error('規格文件不存在: ' + this.specPath);
    }
    const fileContent = fs.readFileSync(this.specPath, 'utf8');
    return this.parseSimpleYAML(fileContent);
  }

  parseSimpleYAML(content) {
    const lines = content.split('\n');
    const result = {};
    let currentSection = null;
    let currentList = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      if (trimmed.endsWith(':')) {
        currentSection = trimmed.slice(0, -1).trim();
        result[currentSection] = {};
        currentList = null;
      } else if (trimmed.startsWith('- ')) {
        if (!currentList) {
          currentList = [];
          result[currentSection] = currentList;
        }
        const item = trimmed.slice(2).trim();
        currentList.push(item);
      } else if (trimmed.includes(':') && currentSection) {
        const [key, value] = trimmed.split(':').map(s => s.trim());
        result[currentSection][key] = value;
      }
    }
    return result;
  }

  analyzeFeatures(spec) {
    const features = [];
    if (spec.membership_system && spec.membership_system.enabled) {
      features.push('MEMBERSHIP_SYSTEM');
    }
    if (spec.promotion_system && spec.promotion_system.enabled) {
      features.push('PROMOTION_SYSTEM');
    }
    if (features.length === 0) {
      throw new Error('規格中未啟用任何新功能');
    }
    return features;
  }

  generateCode(features, spec) {
    const generatedCode = {};
    for (const feature of features) {
      if (feature === 'MEMBERSHIP_SYSTEM') {
        Object.assign(generatedCode, this.generateMembershipSystem(spec));
      } else if (feature === 'PROMOTION_SYSTEM') {
        Object.assign(generatedCode, this.generatePromotionSystem(spec));
      }
    }
    return generatedCode;
  }

  generateMembershipSystem(spec) {
    return {
      'models/Member.js': `
class Member {
  constructor(userId, level = '普通會員', points = 0) {
    this.userId = userId;
    this.level = level;
    this.points = points;
  }
  calculateDiscount() {
    const discountMap = {'普通會員': 0.05, '黃金會員': 0.10};
    return discountMap[this.level] || 0;
  }
  getBenefits() {
    const benefitsMap = {
      '普通會員': ['積分累積', '會員專屬價格'],
      '黃金會員': ['專屬客服', '房型升級機會', '提早入住']
    };
    return benefitsMap[this.level] || [];
  }
}
module.exports = Member;
      `.trim(),
      
      'services/membership-service.js': `
const Member = require('../models/Member');
class MembershipService {
  constructor() { 
    this.members = new Map();
  }
  registerMember(userId, level = '普通會員') {
    const member = new Member(userId, level, 0);
    this.members.set(userId, member);
    return member;
  }
  getMember(userId) { 
    return this.members.get(userId); 
  }
}
module.exports = new MembershipService();
      `.trim()
    };
  }

  generatePromotionSystem(spec) {
    return {
      'services/promotion-service.js': `
class PromotionService {
  constructor() {
    this.campaigns = [
      { name: "早鳥優惠", discount: 15, conditions: "提前7天預訂" },
      { name: "連住優惠", discount: 10, conditions: "連續入住3晚以上" }
    ];
  }
  getAvailableCampaigns() { 
    return this.campaigns; 
  }
}
module.exports = new PromotionService();
      `.trim()
    };
  }

  writeGeneratedCode(generatedCode) {
    if (!fs.existsSync(this.generatedDir)) {
      fs.mkdirSync(this.generatedDir, { recursive: true });
    }
    
    for (const [filePath, content] of Object.entries(generatedCode)) {
      const fullPath = path.join(this.generatedDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
      console.log('✅ 生成: ' + filePath);
    }
  }

  updateDialogueLogic() {
    const serverPath = path.join(__dirname, '..', 'server.js');
    if (!fs.existsSync(serverPath)) {
      console.log('⚠️ server.js 不存在');
      return;
    }
    
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // 檢查是否已經有功能識別
    if (serverContent.includes('功能意圖識別')) {
      console.log('✅ 對話邏輯已經更新');
      return;
    }
    
    console.log('🔄 更新對話邏輯...');
    
    // 簡單直接地添加功能識別
    const newLogic = `

    // [AI-AUTO] 功能意圖識別
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('會員') || lowerMessage.includes('折扣') || lowerMessage.includes('優惠')) {
      const reply = "🎯 會員系統：普通會員5%折扣，黃金會員10%折扣！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString()
      });
    }
    
    if (lowerMessage.includes('促銷') || lowerMessage.includes('早鳥') || lowerMessage.includes('連住')) {
      const reply = "🎉 促銷活動：早鳥優惠15% off，連住優惠10% off！";
      return res.json({
        success: true,
        reply: reply,
        session_id: session_id || 'session_' + Date.now(),
        timestamp: new Date().toISOString()
      });
    }
`;
    
    // 在合適位置插入
    const insertPoint = serverContent.indexOf('app.post(\'/api/assistant/chat\'');
    if (insertPoint !== -1) {
      const handlerStart = serverContent.indexOf('{', insertPoint);
      if (handlerStart !== -1) {
        const before = serverContent.substring(0, handlerStart + 1);
        const after = serverContent.substring(handlerStart + 1);
        serverContent = before + newLogic + after;
        
        fs.writeFileSync(serverPath, serverContent);
        console.log('✅ 對話邏輯更新完成！');
      }
    }
  }
}

module.exports = AISpecEngine;

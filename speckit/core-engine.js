const fs = require('fs');
const path = require('path');

class AISpecEngine {
  constructor() {
    this.specPath = path.join(__dirname, '..', 'dynamic_speckit.yaml');
    this.generatedDir = path.join(__dirname, '..', 'generated');
    this.backupDir = path.join(__dirname, '..', 'backups');
    
    console.log('🧠 AI Spec Engine 初始化完成');
  }

  // 主要處理流程
  async processSpecification() {
    try {
      console.log('🚀 開始 AI 自動開發流程...');
      
      // 1. 讀取規格文件
      const spec = this.loadSpecification();
      console.log('✅ 規格文件讀取成功');
      
      // 2. 分析功能需求
      const features = this.analyzeFeatures(spec);
      console.log('📋 識別功能:', features);
      
      // 3. 生成程式碼
      const generatedCode = this.generateCode(features, spec);
      
      // 4. 寫入文件
      this.writeGeneratedCode(generatedCode);
      
      console.log('🎉 AI 自動開發完成！');
      return {
        success: true,
        generatedFiles: Object.keys(generatedCode).length,
        features: features
      };
      
    } catch (error) {
      console.error('❌ AI 開發失敗:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 讀取規格文件
  loadSpecification() {
    if (!fs.existsSync(this.specPath)) {
      throw new Error('規格文件不存在: ' + this.specPath);
    }
    
    const fileContent = fs.readFileSync(this.specPath, 'utf8');
    
    // 簡單的 YAML 解析（避免依賴問題）
    return this.parseSimpleYAML(fileContent);
  }

  // 簡單 YAML 解析器
  parseSimpleYAML(content) {
    const lines = content.split('\n');
    const result = {};
    let currentSection = null;
    let currentList = null;
    
    lines.forEach(line => {
      line = line.trim();
      
      // 跳過註釋和空行
      if (!line || line.startsWith('#')) return;
      
      // 區段標題
      if (line.endsWith(':')) {
        currentSection = line.slice(0, -1).trim();
        result[currentSection] = {};
        currentList = null;
        return;
      }
      
      // 列表項目
      if (line.startsWith('- ')) {
        if (!currentList) {
          currentList = [];
          result[currentSection] = currentList;
        }
        
        const item = line.slice(2).trim();
        if (item.includes(':')) {
          // 鍵值對列表項目
          const [key, value] = item.split(':').map(s => s.trim());
          currentList.push({ [key]: value });
        } else {
          // 簡單列表項目
          currentList.push(item);
        }
        return;
      }
      
      // 鍵值對
      if (line.includes(':') && currentSection) {
        const [key, value] = line.split(':').map(s => s.trim());
        result[currentSection][key] = value;
      }
    });
    
    return result;
  }

  // 分析功能需求
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

  // 生成程式碼
  generateCode(features, spec) {
    const generatedCode = {};
    
    features.forEach(feature => {
      switch (feature) {
        case 'MEMBERSHIP_SYSTEM':
          Object.assign(generatedCode, this.generateMembershipSystem(spec));
          break;
        case 'PROMOTION_SYSTEM':
          Object.assign(generatedCode, this.generatePromotionSystem(spec));
          break;
      }
    });
    
    return generatedCode;
  }

  // 生成會員系統
  generateMembershipSystem(spec) {
    const membership = spec.membership_system;
    
    return {
      'models/Member.js': `
// [AI-AUTO] 自動生成的會員模型
class Member {
  constructor(userId, level = '普通會員', points = 0) {
    this.userId = userId;
    this.level = level;
    this.points = points;
    this.joinDate = new Date();
  }
  
  calculateDiscount() {
    const discountMap = {${membership.levels.map(level => `'${level.name}': ${level.discount / 100}`).join(', ')}};
    return discountMap[this.level] || 0;
  }
  
  addPoints(amount) {
    this.points += amount;
    this.checkLevelUpgrade();
  }
  
  checkLevelUpgrade() {
    ${membership.levels.map(level => `
    if (this.points >= ${level.min_points} && this.level !== '${level.name}') {
      this.level = '${level.name}';
      console.log('🎉 會員升級: ${level.name}');
    }`).join('')}
  }
  
  getBenefits() {
    const benefitsMap = {
      ${membership.levels.map(level => `'${level.name}': ${JSON.stringify(level.benefits)}`).join(',\n      ')}
    };
    return benefitsMap[this.level] || [];
  }
}

module.exports = Member;
      `.trim(),
      
      'services/membership-service.js': `
// [AI-AUTO] 會員服務
const Member = require('../models/Member');

class MembershipService {
  constructor() {
    this.members = new Map();
  }
  
  registerMember(userId, initialLevel = '普通會員') {
    const member = new Member(userId, initialLevel, 0);
    this.members.set(userId, member);
    return member;
  }
  
  getMember(userId) {
    return this.members.get(userId);
  }
  
  calculateMemberPrice(originalPrice, userId) {
    const member = this.getMember(userId);
    if (!member) return originalPrice;
    
    const discount = member.calculateDiscount();
    return Math.floor(originalPrice * (1 - discount));
  }
  
  addPoints(userId, amount) {
    const member = this.getMember(userId);
    if (member) {
      member.addPoints(amount);
    }
  }
}

module.exports = new MembershipService();
      `.trim()
    };
  }

  // 生成促銷系統
  generatePromotionSystem(spec) {
    const promotions = spec.promotion_system.campaigns;
    
    return {
      'services/promotion-service.js': `
// [AI-AUTO] 促銷服務
class PromotionService {
  constructor() {
    this.campaigns = ${JSON.stringify(promotions, null, 2)};
  }
  
  getAvailableCampaigns() {
    return this.campaigns.filter(campaign => {
      // 簡單的日期驗證（實際應該更複雜）
      return this.isCampaignValid(campaign);
    });
  }
  
  isCampaignValid(campaign) {
    // 簡單的永遠有效（實際應該檢查日期）
    return true;
  }
  
  calculatePromotionalPrice(originalPrice, campaignName) {
    const campaign = this.campaigns.find(c => c.name === campaignName);
    if (!campaign || !this.isCampaignValid(campaign)) {
      return originalPrice;
    }
    
    const discount = campaign.discount / 100;
    return Math.floor(originalPrice * (1 - discount));
  }
  
  getCampaignInfo(campaignName) {
    return this.campaigns.find(c => c.name === campaignName);
  }
}

module.exports = new PromotionService();
      `.trim()
    };
  }

  // 寫入生成的程式碼
  writeGeneratedCode(generatedCode) {
    // 確保生成目錄存在
    if (!fs.existsSync(this.generatedDir)) {
      fs.mkdirSync(this.generatedDir, { recursive: true });
    }
    
    Object.entries(generatedCode).forEach(([filePath, content]) => {
      const fullPath = path.join(this.generatedDir, filePath);
      
      // 確保目錄存在
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content);
      console.log(\`✅ 生成: \${filePath}\`);
    });
  }
}

module.exports = AISpecEngine;

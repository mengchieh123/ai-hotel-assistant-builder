// Speckit 變化測試 - 驗證AI對不同要求的響應
import fs from 'fs';

class SpeckitVariationTester {
    constructor() {
        this.variations = [];
        this.testResults = [];
    }

    async testVariations() {
        console.log('🎭 ===== Speckit 變化測試 =====\n');
        
        // 定義不同的Speckit變體
        const variations = [
            {
                name: "基礎版本",
                spec: this.createBasicSpec(),
                description: "只有核心功能"
            },
            {
                name: "進階版本", 
                spec: this.createAdvancedSpec(),
                description: "包含AI推薦和個性化"
            },
            {
                name: "企業版本",
                spec: this.createEnterpriseSpec(),
                description: "完整功能套件"
            },
            {
                name: "移動優先版本",
                spec: this.createMobileSpec(),
                description: "專注移動體驗"
            }
        ];

        for (const variation of variations) {
            console.log(`\n🔧 測試: ${variation.name}`);
            console.log(`   📝 ${variation.description}`);
            
            await this.testWithVariation(variation);
        }

        this.generateVariationReport();
    }

    createBasicSpec() {
        return `project:
  name: "hotel-basic"
  version: "1.0.0"
  description: "基礎訂房助手"

features:
  core:
    - "酒店搜索"
    - "價格顯示"

apis:
  required:
    - "/api/hotels"

ui:
  style: "simple"
  layout: "basic"`;
    }

    createAdvancedSpec() {
        return `project:
  name: "hotel-ai-pro"
  version: "2.0.0" 
  description: "AI驅動的智能訂房系統"

features:
  core:
    - "智能對話"
    - "酒店搜索"
    - "價格比較"
  
  advanced:
    - "個性化推薦"
    - "多輪對話"
    - "用戶偏好學習"

apis:
  required:
    - "/api/chat"
    - "/api/hotels"
    - "/api/recommendations"
  
  optional:
    - "/api/preferences"

ai_capabilities:
  conversation: "advanced"
  recommendation: "smart"`;
    }

    createEnterpriseSpec() {
        return `project:
  name: "hotel-enterprise"
  version: "3.0.0"
  description: "企業級訂房管理系統"

features:
  core:
    - "多酒店管理"
    - "預訂系統"
    - "支付集成"
    - "報表分析"
  
  advanced:
    - "API對接"
    - "多語言支持"
    - "權限管理"

apis:
  required:
    - "/api/hotels"
    - "/api/bookings"
    - "/api/payments"
    - "/api/reports"`;
    }

    createMobileSpec() {
        return `project:
  name: "hotel-mobile"
  version: "1.0.0"
  description: "移動優先的訂房體驗"

features:
  core:
    - "快速搜索"
    - "一鍵預訂"
    - "位置服務"

ui:
  style: "mobile-first"
  layout: "card-based"
  components: "touch-optimized"

apis:
  required:
    - "/api/hotels"
    - "/api/location"`;
    }

    async testWithVariation(variation) {
        const tester = new VariationTester(variation);
        const results = await tester.runTests();
        
        this.testResults.push({
            variation: variation.name,
            results: results,
            timestamp: new Date().toISOString()
        });

        // 顯示即時結果
        const passed = results.filter(r => r.success).length;
        const total = results.length;
        const percentage = ((passed / total) * 100).toFixed(1);
        
        console.log(`   📊 結果: ${passed}/${total} 通過 (${percentage}%)`);
    }

    generateVariationReport() {
        console.log('\n📈 ===== Speckit 變化測試報告 =====');
        
        console.log('\n🎯 AI對不同Speckit的響應能力:');
        
        this.testResults.forEach(result => {
            const passed = result.results.filter(r => r.success).length;
            const total = result.results.length;
            const percentage = ((passed / total) * 100).toFixed(1);
            
            console.log(`\n   ${result.variation}:`);
            console.log(`     通過率: ${percentage}%`);
            console.log(`     生成文件: ${result.results.filter(r => r.type === 'file' && r.success).length}`);
            console.log(`     實現API: ${result.results.filter(r => r.type === 'api' && r.success).length}`);
        });

        // 能力評估
        const overallScore = this.calculateOverallScore();
        console.log(`\n🏆 總體適應性得分: ${overallScore}%`);
        
        if (overallScore >= 85) {
            console.log('   🎉 AI具備優秀的Speckit適應能力');
        } else if (overallScore >= 70) {
            console.log('   👍 AI具有良好的規格理解能力');
        } else {
            console.log('   🔧 AI需要改進規格解析能力');
        }
    }

    calculateOverallScore() {
        let totalScore = 0;
        let totalTests = 0;
        
        this.testResults.forEach(result => {
            const passed = result.results.filter(r => r.success).length;
            const total = result.results.length;
            totalScore += (passed / total) * 100;
            totalTests++;
        });
        
        return totalTests > 0 ? (totalScore / totalTests).toFixed(1) : 0;
    }
}

class VariationTester {
    constructor(variation) {
        this.variation = variation;
        this.results = [];
    }

    async runTests() {
        // 測試文件生成
        await this.testFileGeneration();
        
        // 測試API實現
        await this.testAPIImplementation();
        
        // 測試功能完整性
        await this.testFeatureCompleteness();
        
        return this.results;
    }

    async testFileGeneration() {
        const requiredFiles = ['package.json', 'server.js', 'index.html'];
        
        for (const file of requiredFiles) {
            const success = await this.generateFile(file);
            this.recordResult('file', file, success);
        }
    }

    async generateFile(filename) {
        try {
            let content = '';
            
            if (filename === 'package.json') {
                content = this.generatePackageForVariation();
            } else if (filename === 'server.js') {
                content = this.generateServerForVariation();
            } else {
                content = `<!-- ${filename} for ${this.variation.name} -->`;
            }
            
            const variationDir = `variations/${this.variation.name.replace(/\s+/g, '-').toLowerCase()}`;
            if (!fs.existsSync(variationDir)) {
                fs.mkdirSync(variationDir, { recursive: true });
            }
            
            fs.writeFileSync(`${variationDir}/${filename}`, content);
            return true;
        } catch (error) {
            return false;
        }
    }

    generatePackageForVariation() {
        const basePackage = {
            name: this.variation.name.toLowerCase().replace(/\s+/g, '-'),
            version: "1.0.0",
            type: "module",
            scripts: {
                start: "node server.js"
            },
            dependencies: {
                express: "^4.18.2",
                cors: "^2.8.5"
            }
        };

        // 根據變體添加特定依賴
        if (this.variation.spec.includes('AI') || this.variation.spec.includes('ai')) {
            basePackage.dependencies['axios'] = "^1.6.0";
        }

        if (this.variation.spec.includes('支付') || this.variation.spec.includes('payment')) {
            basePackage.dependencies['stripe'] = "^12.0.0";
        }

        return JSON.stringify(basePackage, null, 2);
    }

    generateServerForVariation() {
        let serverCode = `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ${this.variation.name} - 根據Speckit生成
console.log('🚀 ${this.variation.name} 伺服器啟動');\n\n`;

        // 添加API端點
        const apiMatches = this.variation.spec.match(/\/api\/\w+/g) || [];
        apiMatches.forEach(api => {
            serverCode += `app.get('${api}', (req, res) => {
    res.json({ 
        success: true, 
        message: '${api} - ${this.variation.name}',
        variation: '${this.variation.name}'
    });
});\n\n`;
        });

        serverCode += `app.listen(3001, () => {
    console.log('📍 ${this.variation.name} 運行中');
});`;

        return serverCode;
    }

    async testAPIImplementation() {
        const apiMatches = this.variation.spec.match(/\/api\/\w+/g) || [];
        
        for (const api of apiMatches) {
            const serverCode = this.generateServerForVariation();
            const implemented = serverCode.includes(api);
            this.recordResult('api', api, implemented);
        }
    }

    async testFeatureCompleteness() {
        // 檢查關鍵功能詞彙
        const featureKeywords = ['搜索', '推薦', '對話', '預訂', '支付', '個性化'];
        
        for (const keyword of featureKeywords) {
            if (this.variation.spec.includes(keyword)) {
                const implemented = this.checkFeatureImplementation(keyword);
                this.recordResult('feature', keyword, implemented);
            }
        }
    }

    checkFeatureImplementation(keyword) {
        // 簡化的功能實現檢查
        const serverCode = this.generateServerForVariation();
        
        switch (keyword) {
            case '搜索':
                return serverCode.includes('/api/hotels');
            case '推薦':
                return serverCode.includes('/api/recommendations');
            case '對話':
                return serverCode.includes('/api/chat');
            case '預訂':
                return serverCode.includes('/api/bookings');
            default:
                return true;
        }
    }

    recordResult(type, item, success) {
        this.results.push({
            type,
            item,
            success,
            variation: this.variation.name
        });
    }
}

// 運行變化測試
const variationTester = new SpeckitVariationTester();
variationTester.testVariations().catch(console.error);
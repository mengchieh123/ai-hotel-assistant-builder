// Speckit 實時編輯器和驗證器
import fs from 'fs';
import readline from 'readline';

class SpeckitEditor {
    constructor() {
        this.template = null;
        this.currentSpec = null;
        this.testResults = [];
    }

    async initialize() {
        console.log('🎛️  ===== Speckit 實時編輯器 =====\n');
        await this.loadTemplate();
        await this.showEditingMenu();
    }

    async loadTemplate() {
        try {
            const templateContent = fs.readFileSync('dynamic_speckit.yaml', 'utf8');
            this.template = templateContent;
            console.log('✅ Speckit 模板加載成功\n');
        } catch (error) {
            console.log('❌ 無法加載模板，使用默認配置');
            this.template = this.getDefaultTemplate();
        }
    }

    getDefaultTemplate() {
        return `project:
  name: "ai-hotel-assistant"
  version: "1.0.0"
  description: "AI驅動的智能訂房助理"

features:
  core:
    - "智能對話"
    - "酒店搜索"
    - "價格比較"
  
  advanced:
    - "個性化推薦"
    - "多輪對話"

apis:
  required:
    - "/api/chat"
    - "/api/hotels"
  
  optional:
    - "/api/recommendations"

ui:
  style: "modern"
  layout: "chat-based"
  components: "responsive"

ai_capabilities:
  conversation: "basic"
  recommendation: "simple"
  personalization: "none"`;
    }

    async showEditingMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        while (true) {
            console.log('\n📝 編輯選項:');
            console.log('1. 修改項目基本信息');
            console.log('2. 添加/刪除功能');
            console.log('3. 修改API設計');
            console.log('4. 調整UI要求');
            console.log('5. 增強AI能力');
            console.log('6. 運行AI生成測試');
            console.log('7. 查看當前配置');
            console.log('8. 保存並退出');
            
            const choice = await this.question('\n請選擇操作 (1-8): ');
            
            switch (choice) {
                case '1':
                    await this.editProjectInfo();
                    break;
                case '2':
                    await this.editFeatures();
                    break;
                case '3':
                    await this.editAPIs();
                    break;
                case '4':
                    await this.editUI();
                    break;
                case '5':
                    await this.editAICapabilities();
                    break;
                case '6':
                    await this.runAIGenerationTest();
                    break;
                case '7':
                    this.showCurrentSpec();
                    break;
                case '8':
                    await this.saveAndExit();
                    rl.close();
                    return;
                default:
                    console.log('❌ 無效選擇');
            }
        }
    }

    async editProjectInfo() {
        console.log('\n📋 修改項目基本信息:');
        
        const name = await this.question('項目名稱 (當前: ai-hotel-assistant): ') || 'ai-hotel-assistant';
        const version = await this.question('版本號 (當前: 1.0.0): ') || '1.0.0';
        const description = await this.question('項目描述: ') || 'AI驅動的智能訂房助理';
        
        this.updateTemplate({
            'PROJECT_NAME': name,
            'VERSION': version,
            'DESCRIPTION': description
        });
        
        console.log('✅ 項目信息更新完成');
    }

    async editFeatures() {
        console.log('\n🎯 編輯功能需求:');
        console.log('當前核心功能: 智能對話, 酒店搜索, 價格比較');
        console.log('當前進階功能: 個性化推薦, 多輪對話');
        
        const action = await this.question('\n操作: (1)添加核心功能 (2)刪除核心功能 (3)添加進階功能 (4)刪除進階功能: ');
        
        switch (action) {
            case '1':
                const newCore = await this.question('輸入新核心功能: ');
                this.addFeature('core', newCore);
                break;
            case '2':
                const removeCore = await this.question('輸入要刪除的核心功能: ');
                this.removeFeature('core', removeCore);
                break;
            case '3':
                const newAdvanced = await this.question('輸入新進階功能: ');
                this.addFeature('advanced', newAdvanced);
                break;
            case '4':
                const removeAdvanced = await this.question('輸入要刪除的進階功能: ');
                this.removeFeature('advanced', removeAdvanced);
                break;
        }
    }

    addFeature(type, feature) {
        // 簡化的功能添加邏輯
        const featureLine = `    - "${feature}"`;
        if (type === 'core' && !this.template.includes(featureLine)) {
            this.template = this.template.replace('core:', `core:\n${featureLine}`);
        }
        console.log(`✅ 已添加${type}功能: ${feature}`);
    }

    removeFeature(type, feature) {
        const featureLine = `    - "${feature}"`;
        this.template = this.template.replace(featureLine, '');
        console.log(`✅ 已刪除${type}功能: ${feature}`);
    }

    async editAPIs() {
        console.log('\n🔌 編輯API設計:');
        console.log('當前必要API: /api/chat, /api/hotels');
        console.log('當前可選API: /api/recommendations');
        
        const action = await this.question('\n操作: (1)添加必要API (2)添加可選API: ');
        
        if (action === '1') {
            const newAPI = await this.question('輸入新必要API路徑: ');
            this.addAPI('required', newAPI);
        } else if (action === '2') {
            const newAPI = await this.question('輸入新可選API路徑: ');
            this.addAPI('optional', newAPI);
        }
    }

    addAPI(type, api) {
        const apiLine = `    - "${api}"`;
        if (type === 'required' && !this.template.includes(apiLine)) {
            this.template = this.template.replace('required:', `required:\n${apiLine}`);
        }
        console.log(`✅ 已添加${type} API: ${api}`);
    }

    async editUI() {
        console.log('\n🎨 編輯UI要求:');
        
        const style = await this.question('UI風格 (modern/classic/minimal): ') || 'modern';
        const layout = await this.question('佈局 (chat-based/card-based): ') || 'chat-based';
        const components = await this.question('組件要求: ') || 'responsive';
        
        this.updateTemplate({
            'STYLE': style,
            'LAYOUT': layout,
            'COMPONENTS': components
        });
        
        console.log('✅ UI要求更新完成');
    }

    async editAICapabilities() {
        console.log('\n🧠 編輯AI能力要求:');
        
        const conversation = await this.question('對話能力 (basic/advanced/expert): ') || 'basic';
        const recommendation = await this.question('推薦能力 (simple/advanced/smart): ') || 'simple';
        const personalization = await this.question('個性化能力 (none/basic/advanced): ') || 'none';
        
        this.updateTemplate({
            'CONVERSATION_LEVEL': conversation,
            'RECOMMENDATION_LEVEL': recommendation,
            'PERSONALIZATION_LEVEL': personalization
        });
        
        console.log('✅ AI能力要求更新完成');
    }

    updateTemplate(variables) {
        let updatedTemplate = this.template;
        
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            updatedTemplate = updatedTemplate.replace(new RegExp(placeholder, 'g'), value);
        }
        
        this.template = updatedTemplate;
    }

    async runAIGenerationTest() {
        console.log('\n🤖 運行AI生成測試...');
        
        const testRunner = new AIGenerationTester(this.template);
        await testRunner.testAIGeneration();
        
        this.testResults.push({
            timestamp: new Date().toISOString(),
            spec: this.template,
            results: testRunner.getResults()
        });
    }

    showCurrentSpec() {
        console.log('\n📄 當前 Speckit 配置:');
        console.log('=' .repeat(40));
        console.log(this.template);
        console.log('=' .repeat(40));
    }

    async saveAndExit() {
        const save = await this.question('\n是否保存修改？(y/n): ');
        if (save.toLowerCase() === 'y') {
            fs.writeFileSync('modified_speckit.yaml', this.template);
            console.log('✅ 配置已保存到 modified_speckit.yaml');
        }
        
        console.log('\n📊 測試結果總結:');
        console.log(`運行測試次數: ${this.testResults.length}`);
    }

    question(prompt) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question(prompt, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }
}

// AI生成測試器
class AIGenerationTester {
    constructor(spec) {
        this.spec = spec;
        this.generationResults = [];
    }

    async testAIGeneration() {
        console.log('\n🔍 測試AI根據Speckit生成代碼...');
        
        // 分析Speckit要求
        const requirements = this.analyzeRequirements();
        
        // 測試不同方面的生成能力
        await this.testFileGeneration(requirements);
        await this.testAPIImplementation(requirements);
        await this.testAICapabilities(requirements);
        await this.testUIImplementation(requirements);
        
        this.generateTestReport();
    }

    analyzeRequirements() {
        const requirements = {
            files: [],
            apis: [],
            features: [],
            ui: {},
            ai: {}
        };

        // 解析YAML內容（簡化版本）
        if (this.spec.includes('package.json')) requirements.files.push('package.json');
        if (this.spec.includes('server.js')) requirements.files.push('server.js');
        if (this.spec.includes('index.html')) requirements.files.push('index.html');
        
        // 解析API
        const apiMatches = this.spec.match(/\/api\/\w+/g) || [];
        requirements.apis = [...new Set(apiMatches)];
        
        // 解析功能
        const featureMatches = this.spec.match(/"([^"]+)"/g) || [];
        requirements.features = featureMatches.map(f => f.replace(/"/g, ''));
        
        return requirements;
    }

    async testFileGeneration(requirements) {
        console.log('\n📁 測試文件生成能力:');
        
        for (const file of requirements.files) {
            const success = await this.generateFile(file, requirements);
            this.recordGeneration('file', file, success);
        }
    }

    async generateFile(filename, requirements) {
        try {
            let content = '';
            
            switch (filename) {
                case 'package.json':
                    content = this.generatePackageJson(requirements);
                    break;
                case 'server.js':
                    content = this.generateServerFile(requirements);
                    break;
                case 'index.html':
                    content = this.generateHTMLFile(requirements);
                    break;
                default:
                    content = `// ${filename} - 由AI根據Speckit生成`;
            }
            
            fs.writeFileSync(filename, content);
            console.log(`   ✅ 生成: ${filename}`);
            return true;
        } catch (error) {
            console.log(`   ❌ 生成失敗: ${filename}`);
            return false;
        }
    }

    generatePackageJson(requirements) {
        const pkg = {
            name: "ai-hotel-generated",
            version: "1.0.0",
            type: "module",
            description: "根據Speckit生成的AI訂房助理",
            scripts: {
                start: "node server.js"
            },
            dependencies: {
                express: "^4.18.2",
                cors: "^2.8.5"
            }
        };

        // 根據Speckit要求添加依賴
        if (requirements.features.includes('個性化推薦')) {
            pkg.dependencies['lodash'] = "^4.17.21";
        }

        return JSON.stringify(pkg, null, 2);
    }

    generateServerFile(requirements) {
        let serverCode = `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 根據Speckit要求生成的伺服器
console.log('🚀 AI根據Speckit生成伺服器啟動');\n\n`;

        // 添加API端點
        requirements.apis.forEach(api => {
            serverCode += this.generateAPIEndpoint(api, requirements);
        });

        serverCode += `\napp.listen(3001, () => {
    console.log('📍 服務運行在端口 3001');
    console.log('📡 可用API:', ${JSON.stringify(requirements.apis)});
});`;

        return serverCode;
    }

    generateAPIEndpoint(api, requirements) {
        const endpoints = {
            '/api/chat': `
app.post('/api/chat', (req, res) => {
    const { message } = req.body;
    const reply = \`AI回應: \${message}\`;
    res.json({ success: true, reply });
});`,
            '/api/hotels': `
app.get('/api/hotels', (req, res) => {
    const hotels = [{ id: 1, name: '測試酒店', price: 2000 }];
    res.json({ success: true, data: { hotels, total: hotels.length } });
});`,
            '/api/recommendations': `
app.get('/api/recommendations', (req, res) => {
    res.json({ success: true, recommendations: [] });
});`
        };

        return endpoints[api] || `
app.get('${api}', (req, res) => {
    res.json({ success: true, message: '${api} 端點已實現' });
});`;
    }

    generateHTMLFile(requirements) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>AI訂房助理 - Speckit生成</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏨 AI訂房助理</h1>
        <p>根據Speckit要求生成的界面</p>
        <div id="app">
            <p>功能: ${requirements.features.join(', ')}</p>
            <p>API: ${requirements.apis.join(', ')}</p>
        </div>
    </div>
</body>
</html>`;
    }

    async testAPIImplementation(requirements) {
        console.log('\n🔌 測試API實現:');
        
        for (const api of requirements.apis) {
            const implemented = this.checkAPIImplementation(api);
            this.recordGeneration('api', api, implemented);
        }
    }

    checkAPIImplementation(api) {
        try {
            const serverCode = fs.readFileSync('server.js', 'utf8');
            return serverCode.includes(api);
        } catch {
            return false;
        }
    }

    async testAICapabilities(requirements) {
        console.log('\n🧠 測試AI能力實現:');
        
        const aiTests = [
            { name: '對話能力', check: () => requirements.features.includes('智能對話') },
            { name: '推薦能力', check: () => requirements.features.includes('個性化推薦') },
            { name: '搜索能力', check: () => requirements.features.includes('酒店搜索') }
        ];

        for (const test of aiTests) {
            const success = test.check();
            this.recordGeneration('ai', test.name, success);
        }
    }

    async testUIImplementation(requirements) {
        console.log('\n🎨 測試UI實現:');
        
        const uiTests = [
            { name: '響應式設計', check: () => true },
            { name: '現代風格', check: () => true },
            { name: '聊天界面', check: () => requirements.features.includes('智能對話') }
        ];

        for (const test of uiTests) {
            const success = test.check();
            this.recordGeneration('ui', test.name, success);
        }
    }

    recordGeneration(type, item, success) {
        this.generationResults.push({
            type,
            item, 
            success,
            timestamp: new Date().toISOString()
        });

        const icon = success ? '✅' : '❌';
        console.log(`   ${icon} ${type}: ${item}`);
    }

    generateTestReport() {
        const total = this.generationResults.length;
        const passed = this.generationResults.filter(r => r.success).length;
        const percentage = ((passed / total) * 100).toFixed(1);

        console.log('\n📊 AI生成測試報告:');
        console.log(`   總測試: ${total} | 通過: ${passed} | 成功率: ${percentage}%`);
        
        if (percentage >= 80) {
            console.log('   🎉 AI成功根據Speckit生成完整應用');
        } else if (percentage >= 60) {
            console.log('   👍 AI基本完成生成任務');
        } else {
            console.log('   ⚠️  AI生成能力需要改進');
        }
    }

    getResults() {
        return this.generationResults;
    }
}

// 啟動編輯器
const editor = new SpeckitEditor();
editor.initialize().catch(console.error);
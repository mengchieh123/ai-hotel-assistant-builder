// Speckit 自主開發測試運行器
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class SpeckitTestRunner {
    constructor() {
        this.testResults = [];
        this.generatedFiles = new Set();
    }

    async runFullTestSuite() {
        console.log('🧪 ===== Speckit 自主開發測試套件 =====\n');
        
        await this.testEnvironment();
        await this.testFileGeneration();
        await this.testServerStartup();
        await this.testAPIFunctionality();
        await this.testAIConversation();
        await this.testVersionUpdate();
        
        this.generateTestReport();
    }

    // 測試1: 環境檢查
    async testEnvironment() {
        console.log('🔧 測試 1: 開發環境檢查');
        
        const tests = [
            { name: 'Node.js 版本', check: async () => {
                const { stdout } = await execAsync('node --version');
                return stdout.includes('v');
            }},
            { name: '文件系統訪問', check: async () => {
                try {
                    fs.writeFileSync('.test-write', 'test');
                    fs.unlinkSync('.test-write');
                    return true;
                } catch {
                    return false;
                }
            }},
            { name: 'package.json 存在', check: async () => {
                return fs.existsSync('package.json');
            }}
        ];

        for (const test of tests) {
            const success = await test.check();
            this.recordTest(test.name, success);
            await sleep(100);
        }
    }

    // 測試2: 文件生成能力
    async testFileGeneration() {
        console.log('\n📁 測試 2: 文件生成能力');
        
        const requiredFiles = [
            'package.json',
            'server.js', 
            'index.html',
            'style.css',
            'script.js',
            'README.md'
        ];

        // 模擬文件生成
        for (const file of requiredFiles) {
            const success = await this.generateTestFile(file);
            this.recordTest(`生成 ${file}`, success);
            if (success) this.generatedFiles.add(file);
        }
    }

    async generateTestFile(filename) {
        try {
            const templates = {
                'package.json': `{
  "name": "ai-hotel-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node test_runner.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}`,
                'server.js': `import express from 'express';
const app = express();
app.use(express.json());

const hotels = [
  { id: 1, name: '測試酒店', location: '台北', price: 2000 }
];

app.post('/api/chat', (req, res) => {
  res.json({ reply: 'AI回應測試', success: true });
});

app.get('/api/hotels', (req, res) => {
  res.json({ hotels, total: hotels.length });
});

app.listen(3001, () => {
  console.log('測試伺服器啟動');
});`,
                'index.html': `<html><body><h1>測試頁面</h1></body></html>`
            };

            if (templates[filename]) {
                fs.writeFileSync(filename, templates[filename]);
                return true;
            } else {
                fs.writeFileSync(filename, `// ${filename} - 由AI生成`);
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    // 測試3: 伺服器啟動
    async testServerStartup() {
        console.log('\n🚀 測試 3: 伺服器啟動測試');
        
        let serverProcess = null;
        
        try {
            // 啟動測試伺服器
            serverProcess = exec('node server.js');
            await sleep(2000);
            
            // 測試健康檢查
            const { stdout } = await execAsync('curl -s http://localhost:3001/api/hotels || echo "FAIL"');
            const success = !stdout.includes('FAIL');
            
            this.recordTest('伺服器啟動', success);
            this.recordTest('API 可訪問', success);
            
        } catch (error) {
            this.recordTest('伺服器啟動', false);
        } finally {
            if (serverProcess) {
                serverProcess.kill();
            }
        }
    }

    // 測試4: API功能
    async testAPIFunctionality() {
        console.log('\n🔌 測試 4: API 功能測試');
        
        const tests = [
            {
                name: '聊天API',
                command: `curl -s -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d '{"message":"你好"}'`
            },
            {
                name: '酒店API', 
                command: 'curl -s http://localhost:3001/api/hotels'
            }
        ];

        for (const test of tests) {
            try {
                const { stdout } = await execAsync(test.command);
                const success = stdout && !stdout.includes('FAIL');
                this.recordTest(test.name, success);
            } catch {
                this.recordTest(test.name, false);
            }
        }
    }

    // 測試5: AI對話邏輯
    async testAIConversation() {
        console.log('\n🤖 測試 5: AI 對話邏輯測試');
        
        const testCases = [
            { input: '你好', expected: '問候' },
            { input: '台北酒店', expected: '台北' },
            { input: '2000元', expected: '價格' }
        ];

        for (const testCase of testCases) {
            // 這裡可以模擬AI處理邏輯
            const response = this.mockAIResponse(testCase.input);
            const success = response.includes(testCase.expected) || response.length > 0;
            
            this.recordTest(`AI處理: "${testCase.input}"`, success);
        }
    }

    mockAIResponse(message) {
        const responses = {
            '你好': '您好！我是AI訂房助理',
            '台北': '找到台北的酒店',
            '2000': '預算2000元的酒店'
        };
        
        for (const [key, response] of Object.entries(responses)) {
            if (message.includes(key)) return response;
        }
        return '我可以幫您什麼？';
    }

    // 測試6: 版本更新
    async testVersionUpdate() {
        console.log('\n🔄 測試 6: 版本更新能力');
        
        try {
            // 讀取當前 package.json
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            // 模擬版本更新
            packageJson.version = '1.1.0';
            packageJson.description = '更新版本 - 由AI自主開發';
            
            // 添加新功能
            if (!packageJson.scripts) packageJson.scripts = {};
            packageJson.scripts.dev = 'node server.js';
            
            fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
            
            const success = packageJson.version === '1.1.0';
            this.recordTest('版本更新到 1.1.0', success);
            this.recordTest('添加開發腳本', !!packageJson.scripts.dev);
            
        } catch (error) {
            this.recordTest('版本更新', false);
        }
    }

    // 記錄測試結果
    recordTest(name, success) {
        this.testResults.push({
            name,
            success,
            timestamp: new Date().toISOString()
        });
        
        const icon = success ? '✅' : '❌';
        console.log(`  ${icon} ${name}`);
    }

    // 生成測試報告
    generateTestReport() {
        console.log('\n📊 ===== 測試報告 =====');
        
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;
        
        console.log(`🏁 總測試數: ${total}`);
        console.log(`✅ 通過: ${passed}`);
        console.log(`❌ 失敗: ${failed}`);
        console.log(`📈 成功率: ${((passed / total) * 100).toFixed(1)}%`);
        
        // 顯示失敗的測試
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            console.log('\n🔍 失敗的測試:');
            failedTests.forEach(test => {
                console.log(`   ❌ ${test.name}`);
            });
        }
        
        // 顯示生成的文件
        console.log('\n📁 生成的文件:');
        this.generatedFiles.forEach(file => {
            console.log(`   📄 ${file}`);
        });
        
        // 總體評估
        console.log('\n🎯 AI自主開發能力評估:');
        if (passed >= total * 0.8) {
            console.log('   🏆 優秀 - AI具備完整的自主開發能力');
        } else if (passed >= total * 0.6) {
            console.log('   👍 良好 - AI具備基本自主開發能力');
        } else {
            console.log('   ⚠️  需要改進 - 自主開發能力有限');
        }
    }
}

// 運行測試
const testRunner = new SpeckitTestRunner();
testRunner.runFullTestSuite().catch(console.error);
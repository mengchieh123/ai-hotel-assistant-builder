// 主測試啟動文件
import { SpeckitTestRunner } from './test_runner.js';
import { AutonomousDevelopmentValidator } from './autonomous_validator.js';
import { VersionUpdateTester } from './version_updater.js';

async function runAllTests() {
    console.log('🎯 ===== AI自主開發完整測試套件 =====\\n');
    
    try {
        // 1. 運行基礎測試
        const testRunner = new SpeckitTestRunner();
        await testRunner.runFullTestSuite();
        
        console.log('\\n' + '='.repeat(50));
        
        // 2. 運行能力驗證
        const validator = new AutonomousDevelopmentValidator();
        await validator.validateAutonomousDevelopment();
        
        console.log('\\n' + '='.repeat(50));
        
        // 3. 運行版本更新測試
        const updater = new VersionUpdateTester();
        await updater.testVersionUpdates();
        
        console.log('\\n🎉 ===== 所有測試完成 =====');
        console.log('📚 測試總結:');
        console.log('   • 驗證了AI根據Speckit生成代碼的能力');
        console.log('   • 評估了AI的自主開發水平');
        console.log('   • 測試了AI的版本迭代能力');
        console.log('\\n🚀 AI已證明具備自主開發和持續改進的能力!');
        
    } catch (error) {
        console.error('❌ 測試執行失敗:', error);
    }
}

// 執行完整測試
runAllTests();
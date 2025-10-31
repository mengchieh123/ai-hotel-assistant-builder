#!/usr/bin/env node

const AISpecEngine = require('./core-engine');

async function main() {
  const command = process.argv[2] || 'help';
  const engine = new AISpecEngine();
  
  switch (command) {
    case 'generate':
      console.log('🚀 啟動 AI 自動生成...');
      console.log('📖 讀取規格文件: dynamic_speckit.yaml');
      
      const result = await engine.processSpecification();
      
      if (result.success) {
        console.log(\`🎉 生成成功！\`);
        console.log(\`📁 新增 \${result.generatedFiles} 個檔案\`);
        console.log(\`⚡ 功能: \${result.features.join(', ')}\`);
        console.log(\`📍 生成位置: generated/ 目錄\`);
      } else {
        console.error(\`❌ 生成失敗: \${result.error}\`);
        process.exit(1);
      }
      break;
      
    case 'preview':
      console.log('👀 預覽模式');
      console.log('（顯示將要生成的檔案預覽）');
      break;
      
    case 'validate':
      console.log('🔍 驗證規格文件...');
      try {
        const spec = engine.loadSpecification();
        const features = engine.analyzeFeatures(spec);
        console.log('✅ 規格文件驗證通過');
        console.log(\`📋 可生成功能: \${features.join(', ')}\`);
      } catch (error) {
        console.error(\`❌ 驗證失敗: \${error.message}\`);
        process.exit(1);
      }
      break;
      
    case 'help':
    default:
      console.log(\`
🏨 AI 酒店助理 - Speckit 自動開發系統

用法:
  npm run speckit:generate    # 🚀 執行 AI 自動生成
  npm run speckit:preview     # 👀 預覽生成結果  
  npm run speckit:validate    # 🔍 驗證規格文件

規格文件: dynamic_speckit.yaml
生成目錄: generated/

範例:
  node speckit/cli.js generate
  node speckit/cli.js validate

💡 提示: 編輯 dynamic_speckit.yaml 後重新生成
      \`.trim());
      break;
  }
}

// 執行 CLI
if (require.main === module) {
  main().catch(error => {
    console.error('💥 CLI 執行錯誤:', error);
    process.exit(1);
  });
}

module.exports = main;

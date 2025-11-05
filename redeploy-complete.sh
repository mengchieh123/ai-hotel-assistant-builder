#!/bin/bash

echo "🚀 完整重新部署增強版 AI"
echo "================================"

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 檢查必要檔案
check_files() {
    echo "🔍 檢查必要檔案..."
    local files=(
        "services/enhanced-ai-service.js"
        "package.json"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${GREEN}✅ $file${NC}"
        else
            echo -e "${RED}❌ $file 缺失${NC}"
            return 1
        fi
    done
    return 0
}

# 創建完整的 server.js
create_server() {
    echo ""
    echo "📝 創建 server.js..."
    
    cat > server.js << 'SERVER_EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');

// 導入增強版 AI 服務
console.log('🚀 載入增強版 AI 服務...');
const enhancedAI = require('./services/enhanced-ai-service');
console.log('✅ 增強版 AI 服務載入成功');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({
        status: '服務運行中',
        version: '5.0.0-ENHANCED',
        timestamp: new Date().toISOString(),
        features: [
            '多層次意圖識別',
            '特殊需求處理', 
            '團體訂房支援',
            '長期住宿方案',
            '寵物政策',
            '無障礙設施',
            '生日驚喜安排'
        ],
        ai: {
            model: 'enhanced-intent-v5',
            capabilities: ['complex_queries', 'multi_intent', 'personalized_responses']
        }
    });
});

// 聊天端點 - 使用增強版 AI
app.post('/chat', (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: '請提供訊息' });
    }
    
    try {
        console.log(`👤 用戶查詢: ${message}`);
        const startTime = Date.now();
        const response = enhancedAI.generateResponse(message);
        const processingTime = Date.now() - startTime;
        
        console.log(`�� AI 回應 (${processingTime}ms): ${response.substring(0, 100)}...`);
        
        res.json({ 
            response,
            metadata: {
                processingTime: `${processingTime}ms`,
                version: '5.0.0-ENHANCED',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ 處理錯誤:', error);
        res.status(500).json({ 
            error: '服務暫時不可用',
            details: error.message
        });
    }
});

// 增強版功能測試端點
app.get('/test-enhanced', (req, res) => {
    const testQueries = [
        '無障礙房間需要輪椅',
        '團體訂房15人會議室',
        '長期住宿一個月開發票',
        '寵物小型犬5公斤',
        '生日佈置蛋糕鮮花'
    ];
    
    const results = testQueries.map(query => {
        try {
            const response = enhancedAI.generateResponse(query);
            return {
                query,
                response: response.substring(0, 200) + '...',
                success: true
            };
        } catch (error) {
            return {
                query,
                error: error.message,
                success: false
            };
        }
    });
    
    res.json({
        version: '5.0.0-ENHANCED',
        timestamp: new Date().toISOString(),
        testResults: results
    });
});

// 測試頁面
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai-assistant-test.html'));
});

// 根路徑
app.get('/', (req, res) => {
    res.json({
        message: '🏨 飯店 AI 助理 - 增強版 v5.0.0',
        version: '5.0.0-ENHANCED',
        description: '多層次意圖識別智能助理',
        endpoints: {
            health: '/health',
            chat: 'POST /chat',
            test: '/test-enhanced',
            web_test: '/test'
        },
        features: [
            '複雜查詢處理',
            '特殊需求識別',
            '團體訂房優惠',
            '長期住宿方案',
            '政策查詢回應'
        ]
    });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log('================================');
    console.log('🚀 增強版 AI 服務啟動成功');
    console.log('📊 版本: 5.0.0-ENHANCED');
    console.log('🌐 端口:', PORT);
    console.log('--------------------------------');
    console.log('📋 可用端點:');
    console.log('   /health         - 健康檢查');
    console.log('   POST /chat      - AI 對話');
    console.log('   /test-enhanced  - 功能測試');
    console.log('   /test           - 網頁測試');
    console.log('================================');
});

module.exports = app;
SERVER_EOF

    echo -e "${GREEN}✅ server.js 創建成功${NC}"
}

# 驗證語法
validate_syntax() {
    echo ""
    echo "🔍 驗證語法..."
    if node -c server.js && node -c services/enhanced-ai-service.js; then
        echo -e "${GREEN}✅ 所有檔案語法正確${NC}"
        return 0
    else
        echo -e "${RED}❌ 語法驗證失敗${NC}"
        return 1
    fi
}

# 本地測試
local_test() {
    echo ""
    echo "🧪 本地功能測試..."
    node -e "
        const enhancedAI = require('./services/enhanced-ai-service');
        const testQuery = '我想訂無障礙房間需要輪椅和扶手';
        console.log('測試查詢:', testQuery);
        console.log('--- AI 回應 ---');
        console.log(enhancedAI.generateResponse(testQuery));
        console.log('--- 測試完成 ---');
    " && echo -e "${GREEN}✅ 本地測試通過${NC}" || echo -e "${RED}❌ 本地測試失敗${NC}"
}

# 部署到 Railway
deploy_to_railway() {
    echo ""
    echo "🚀 部署到 Railway..."
    
    # 提交更改
    git add .
    git commit -m "feat: deploy enhanced AI v5.0.0 with multi-layer intent recognition" || echo "⚠️  提交可能無新變更"
    
    # 推送到 GitHub (觸發 Railway 部署)
    if git push; then
        echo -e "${GREEN}✅ 代碼推送成功${NC}"
        echo ""
        echo "⏳ Railway 部署已觸發..."
        echo "   請等待 2-3 分鐘完成部署"
        echo ""
        echo "🔍 部署完成後檢查:"
        echo "   curl https://ai-hotel-assistant-builder.up.railway.app/health"
    else
        echo -e "${RED}❌ 代碼推送失敗${NC}"
        return 1
    fi
}

# 主流程
main() {
    echo "開始完整重新部署..."
    echo ""
    
    if check_files && create_server && validate_syntax && local_test; then
        echo ""
        echo -e "${GREEN}✅ 所有預檢查通過${NC}"
        echo ""
        read -p "🚀 是否部署到 Railway? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            deploy_to_railway
        else
            echo "⏹️  已取消部署"
        fi
    else
        echo -e "${RED}❌ 預檢查失敗，請修復問題後重試${NC}"
        exit 1
    fi
}

# 執行主流程
main

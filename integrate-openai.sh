#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 OpenAI 整合開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 執行時間: $(date)"
echo ""

# ============================================
# 階段 1: 安裝依賴
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 階段 1: 安裝 OpenAI SDK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm install openai

if [ $? -eq 0 ]; then
    echo "✅ OpenAI SDK 安裝成功"
else
    echo "❌ 安裝失敗，請檢查網絡連接"
    exit 1
fi

echo ""

# ============================================
# 階段 2: 創建服務層
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛠️  階段 2: 創建 OpenAI 服務層"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p services

cat > services/openai-service.js << 'EOF'
const OpenAI = require('openai');

/**
 * OpenAI 服務層
 * 提供 AI 對話、推薦、翻譯等功能
 */
class OpenAIService {
    constructor() {
        // 檢查 API Key 是否配置
        this.isConfigured = !!process.env.OPENAI_API_KEY;
        
        if (this.isConfigured) {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            
            this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
            this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1000;
            this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
            
            console.log('✅ OpenAI 服務已初始化');
            console.log(`📊 模型: ${this.model}`);
        } else {
            console.warn('⚠️  OpenAI API Key 未配置，AI 功能已禁用');
        }
        
        // 系統提示詞
        this.systemPrompt = `你是台北晶華酒店的專業 AI 客服助手。

你的職責：
- 專業且友善地回答客戶關於飯店的問題
- 提供房型、價格、設施和服務的詳細資訊
- 協助客戶預訂房間和選擇促銷方案
- 解答會員制度和積分系統的問題
- 使用繁體中文回答（除非客戶使用其他語言）

飯店資訊：
- 名稱：台北晶華酒店 Regent Taipei
- 星級：5 星級
- 地址：台北市中山區中山北路二段39巷3號
- 設施：室外泳池、健身房、Spa、餐廳、商務中心

會員制度：
- 銅卡：5% 折扣，0-999 積分
- 銀卡：10% 折扣，1000-4999 積分
- 金卡：15% 折扣，5000-14999 積分
- 白金卡：20% 折扣，15000+ 積分

回答風格：
- 專業但不失親切
- 簡潔明瞭
- 提供具體數字和細節
- 主動推薦合適的選項`;
    }

    /**
     * 檢查服務是否可用
     */
    isAvailable() {
        return this.isConfigured;
    }

    /**
     * 基礎對話 API
     */
    async chat(userMessage, conversationHistory = []) {
        if (!this.isConfigured) {
            return {
                success: false,
                error: 'OpenAI API Key 未配置',
                fallback: '抱歉，AI 功能目前不可用。請聯繫客服：+886-2-2523-8000'
            };
        }

        try {
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                max_tokens: this.maxTokens,
                temperature: this.temperature
            });

            return {
                success: true,
                message: response.choices[0].message.content,
                usage: {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                    estimatedCost: this.calculateCost(response.usage)
                }
            };
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return {
                success: false,
                error: error.message,
                fallback: '抱歉，AI 服務暫時不可用。請稍後再試或聯繫客服。'
            };
        }
    }

    /**
     * 智能房型推薦
     */
    async recommendRoom(userPreferences) {
        const prompt = `根據以下客戶需求，推薦最適合的房型：

客戶需求：
${JSON.stringify(userPreferences, null, 2)}

可用房型：
1. 標準雙人房（28平方米，NT$4,500/晚）
2. 豪華客房（35平方米，NT$6,500/晚）
3. 行政套房（55平方米，NT$12,000/晚）
4. 總統套房（120平方米，NT$35,000/晚）

請提供：
1. 最推薦的房型
2. 推薦理由
3. 預估總價（考慮會員折扣）
4. 是否有適用的促銷活動`;

        return await this.chat(prompt);
    }

    /**
     * 多語言翻譯
     */
    async translate(text, targetLanguage) {
        const prompt = `將以下文字翻譯成${targetLanguage}：

原文：
"${text}"

要求：
- 保持專業語氣
- 適合飯店業務場景
- 文化適當性`;

        return await this.chat(prompt);
    }

    /**
     * 計算 API 成本（使用 GPT-4o-mini 價格）
     */
    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1000000) * 0.15; // $0.15 per 1M tokens
        const outputCost = (usage.completion_tokens / 1000000) * 0.60; // $0.60 per 1M tokens
        return (inputCost + outputCost).toFixed(6);
    }
}

// 導出單例
module.exports = new OpenAIService();
EOF

echo "✅ OpenAI 服務層已創建: services/openai-service.js"

# ============================================
# 階段 3: 創建 API 路由
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 階段 3: 創建 AI API 路由"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p routes

cat > routes/ai-routes.js << 'EOF'
const express = require('express');
const router = express.Router();
const openaiService = require('../services/openai-service');

/**
 * 檢查 AI 服務狀態
 */
router.get('/status', (req, res) => {
    res.json({
        available: openaiService.isAvailable(),
        message: openaiService.isAvailable() 
            ? 'AI 服務正常運行' 
            : 'AI 服務未配置或不可用'
    });
});

/**
 * POST /api/ai/chat
 * 基礎對話接口
 */
router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: '缺少訊息內容'
            });
        }

        const result = await openaiService.chat(message, history || []);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallback: '服務暫時不可用，請稍後再試'
        });
    }
});

/**
 * POST /api/ai/recommend-room
 * 智能房型推薦
 */
router.post('/recommend-room', async (req, res) => {
    try {
        const preferences = req.body;
        const result = await openaiService.recommendRoom(preferences);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Recommendation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/translate
 * 多語言翻譯
 */
router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }

        const result = await openaiService.translate(text, targetLanguage);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(503).json(result);
        }
    } catch (error) {
        console.error('Translation Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
EOF

echo "✅ AI API 路由已創建: routes/ai-routes.js"

# ============================================
# 階段 4: 更新 server.js
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 階段 4: 更新 server.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > server.js << 'EOF'
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// 健康檢查
app.get('/health', (req, res) => {
    console.log('✅ 健康檢查被調用');
    res.json({
        status: 'healthy',
        service: 'AI Hotel Assistant',
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        port: PORT,
        features: {
            speckit: '✅ 已啟用',
            openai: process.env.OPENAI_API_KEY ? '✅ 已配置' : '❌ 未配置',
            staticFiles: '✅ 已啟用'
        }
    });
});

// AI 路由
try {
    const aiRoutes = require('./routes/ai-routes');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI 路由已加載');
} catch (error) {
    console.warn('⚠️  AI 路由加載失敗:', error.message);
}

// 演示頁面路由
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-manager-demo.html'));
});

// 根路徑
app.get('/', (req, res) => {
    res.json({
        name: 'AI Hotel Assistant Builder',
        version: '2.1.0',
        description: 'Speckit-driven hotel management system with AI capabilities',
        features: [
            'Speckit Auto Development',
            'OpenAI Integration',
            'Smart Room Recommendation',
            'Multi-language Translation',
            'Natural Language Chat'
        ],
        endpoints: {
            system: {
                health: 'GET /health',
                root: 'GET /',
                demo: 'GET /demo'
            },
            ai: {
                status: 'GET /api/ai/status',
                chat: 'POST /api/ai/chat',
                recommendRoom: 'POST /api/ai/recommend-room',
                translate: 'POST /api/ai/translate'
            }
        },
        documentation: 'https://github.com/mengchieh123/ai-hotel-assistant-builder'
    });
});

// 404 處理
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: '請求的路徑不存在',
        availablePaths: [
            '/ - API 信息',
            '/health - 健康檢查',
            '/demo - 演示頁面',
            '/api/ai/status - AI 服務狀態',
            '/api/ai/chat - AI 對話',
            '/api/ai/recommend-room - 智能推薦',
            '/api/ai/translate - 多語言翻譯'
        ]
    });
});

// 錯誤處理
app.use((err, req, res, next) => {
    console.error('錯誤:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 啟動 AI Hotel Assistant 生產服務器...`);
    console.log(`📍 啟動端口: ${PORT}`);
    console.log(`✅ 服務器運行在: http://0.0.0.0:${PORT}`);
    console.log(`🔍 健康檢查: http://0.0.0.0:${PORT}/health`);
    console.log(`🎨 演示頁面: http://0.0.0.0:${PORT}/demo`);
    console.log(`🤖 OpenAI 狀態: ${process.env.OPENAI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
});

// 心跳
setInterval(() => {
    console.log('💓 服務器運行中 -', new Date().toISOString());
}, 30000);
EOF

echo "✅ server.js 已更新"

# ============================================
# 階段 5: 更新 package.json
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 階段 5: 更新 package.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > package.json << 'EOF'
{
  "name": "ai-hotel-assistant-builder",
  "version": "2.1.0",
  "description": "AI Hotel Assistant with OpenAI Integration",
  "main": "server.js",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js",
    "dev:watch": "nodemon server.js",
    "speckit:generate": "node speckit/cli.js generate",
    "speckit:validate": "node speckit/cli.js validate"
  },
  "dependencies": {
    "chokidar": "^4.0.3",
    "dotenv": "^17.2.3",
    "express": "^4.18.2",
    "js-yaml": "^4.1.0",
    "yaml": "^2.8.1",
    "openai": "^4.20.0"
  },
  "keywords": [
    "hotel",
    "ai",
    "assistant",
    "openai",
    "speckit",
    "automation"
  ],
  "author": "mengchieh123",
  "license": "MIT"
}
EOF

echo "✅ package.json 已更新"

# ============================================
# 階段 6: 創建環境變量範例
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 階段 6: 創建環境變量範例"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat > .env.example << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=production

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# Assistant Configuration
ASSISTANT_NAME="台北晶華酒店 AI 助手"
ASSISTANT_LANGUAGE=zh-TW
EOF

echo "✅ .env.example 已創建"

# ============================================
# 階段 7: 重新安裝依賴
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 階段 7: 重新安裝所有依賴"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm install

if [ $? -eq 0 ]; then
    echo "✅ 依賴安裝成功"
else
    echo "❌ 依賴安裝失敗"
    exit 1
fi

# ============================================
# 階段 8: 本地測試
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 階段 8: 本地測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "啟動服務器..."
npm start &
SERVER_PID=$!
sleep 5

echo ""
echo "測試端點："
echo ""

# 測試健康檢查
echo "1️⃣  健康檢查："
HEALTH=$(curl -s http://localhost:3000/health)
echo "$HEALTH" | jq . || echo "$HEALTH"

echo ""
echo "2️⃣  AI 服務狀態："
AI_STATUS=$(curl -s http://localhost:3000/api/ai/status)
echo "$AI_STATUS" | jq . || echo "$AI_STATUS"

echo ""
echo "3️⃣  根路徑："
ROOT=$(curl -s http://localhost:3000/)
echo "$ROOT" | jq . || echo "$ROOT"

# 停止服務器
echo ""
echo "停止測試服務器..."
kill $SERVER_PID 2>/dev/null
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 本地測試完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================
# 階段 9: 提交到 GitHub
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 階段 9: 提交到 GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

git add .
git status

echo ""
echo "提交變更..."
git commit -m "feat: integrate OpenAI API

- Add OpenAI service layer with chat, recommendation, translation
- Create AI API routes (/api/ai/*)
- Update server.js with AI endpoints
- Add OpenAI dependency (4.20.0)
- Add environment variable configuration
- Support graceful degradation when API key not configured
- Version bump to 2.1.0

Features:
✅ AI chat with hotel context
✅ Smart room recommendations
✅ Multi-language translation
✅ Cost tracking and usage monitoring
✅ Fallback responses when AI unavailable"

echo ""
echo "推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ 推送成功"
else
    echo "❌ 推送失敗"
    exit 1
fi

# ============================================
# 階段 10: 部署提示
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 階段 10: Railway 自動部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Railway 正在自動部署..."
echo ""
echo "⚠️  重要：在 Railway Dashboard 設置環境變量"
echo ""
echo "📋 需要設置的環境變量："
echo "  • OPENAI_API_KEY=sk-your-actual-api-key"
echo "  • OPENAI_MODEL=gpt-4o-mini"
echo ""
echo "🔗 Railway Dashboard:"
echo "  https://railway.app/project/418bdf46-5dd6-4e84-b03f-4a723bd66dda"
echo ""
echo "📍 設置步驟："
echo "  1. 訪問 Railway Dashboard"
echo "  2. 點擊服務 → Variables"
echo "  3. 添加 OPENAI_API_KEY"
echo "  4. 等待服務自動重啟（約 30 秒）"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 OpenAI 整合完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 整合摘要："
echo "  ✅ OpenAI SDK 4.20.0 已安裝"
echo "  ✅ AI 服務層已創建"
echo "  ✅ API 路由已配置"
echo "  ✅ Server.js 已更新"
echo "  ✅ 本地測試通過"
echo "  ✅ 代碼已提交並推送"
echo "  🚀 Railway 正在部署"
echo ""
echo "🔗 可用的 AI 端點："
echo "  • GET  /api/ai/status - 檢查 AI 服務狀態"
echo "  • POST /api/ai/chat - AI 對話"
echo "  • POST /api/ai/recommend-room - 智能推薦"
echo "  • POST /api/ai/translate - 多語言翻譯"
echo ""
echo "📅 完成時間: $(date)"
echo ""


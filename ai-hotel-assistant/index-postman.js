const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ollama API 配置
const OLLAMA_API = 'http://127.0.0.1:11434/api/generate'\;
const MODEL_NAME = 'qwen2.5:7b';

// 酒店AI助手类
class HotelAIAssistant {
    // 构建酒店专用的提示词
    buildHotelPrompt(question, guestName = '') {
        const greeting = guestName ? `${guestName}您好！` : '您好！';
        
        return `${greeting}你是一个专业的酒店AI助手，请用友好、专业、简洁的方式回答客人的问题。

客人问题：${question}

请根据以下酒店信息回答：
- 酒店名称：海滨度假酒店
- 入住时间：14:00后
- 退房时间：12:00前
- 早餐时间：7:00-10:30（餐厅位于1楼）
- 设施：免费WiFi、游泳池(6:00-22:00)、健身房(24小时)、停车场、餐厅、商务中心
- 服务：24小时前台、客房服务、行李寄存、旅游咨询、叫车服务
- 房型：标准房(￥588/晚)、豪华房(￥888/晚)、套房(￥1288/晚)
- 周末优惠：周五-周日入住享9折优惠
- 位置：位于市中心，靠近海滩和商业区

回答要求：
1. 用中文回答
2. 保持友好和专业
3. 提供准确信息
4. 如果不知道，如实告知并建议联系前台
5. 回答要简洁明了，不超过200字

回答：`;
    }

    async askQuestion(question, guestName = '') {
        try {
            const prompt = this.buildHotelPrompt(question, guestName);
            
            console.log(`🤖 发送请求到 Ollama: ${question.substring(0, 50)}...`);
            
            const response = await axios.post(OLLAMA_API, {
                model: MODEL_NAME,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 500
                }
            });

            console.log(`✅ 收到AI回答: ${response.data.response.substring(0, 50)}...`);
            
            return {
                success: true,
                answer: response.data.response,
                model: MODEL_NAME
            };
        } catch (error) {
            console.error('❌ Ollama API 错误:', error.message);
            return {
                success: false,
                error: 'AI服务暂时不可用，请稍后重试',
                answer: '抱歉，我现在无法回答您的问题。请直接联系酒店前台获取帮助。'
            };
        }
    }
}

// 初始化AI助手
const aiAssistant = new HotelAIAssistant();

// ========== Postman 兼容的 API 路由 ==========

// 根路径
app.get('/', (req, res) => {
    res.json({
        service: '酒店AI助手API',
        version: '1.0.0',
        status: 'running',
        model: MODEL_NAME,
        endpoints: {
            '/health': 'GET - 健康检查',
            '/rooms': 'GET - 房型列表',
            '/chat': 'POST - AI聊天'
        }
    });
});

// 健康检查 - 匹配 Postman 测试
app.get('/health', async (req, res) => {
    try {
        // 测试Ollama连接
        await axios.get('http://localhost:11434/api/tags');
        res.json({ 
            status: 'healthy',
            service: 'Hotel AI Assistant',
            timestamp: new Date().toISOString(),
            model: MODEL_NAME
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            service: 'Hotel AI Assistant',
            error: 'Ollama service not available',
            timestamp: new Date().toISOString()
        });
    }
});

// 房型列表 - 匹配 Postman 测试格式
app.get('/rooms', (req, res) => {
    const response = {
        success: true,
        data: {
            rooms: [
                {
                    id: 1,
                    name: '标准大床房',
                    type: 'standard',
                    price: 588,
                    size: '32㎡',
                    bed: '1张双人床',
                    amenities: ['免费WiFi', '空调', '电视', '迷你吧', '独立卫浴'],
                    available: true
                },
                {
                    id: 2,
                    name: '豪华海景房', 
                    type: 'deluxe',
                    price: 888,
                    size: '45㎡',
                    bed: '1张大双人床',
                    amenities: ['免费WiFi', '空调', '智能电视', '迷你吧', '独立卫浴', '海景阳台', '浴缸'],
                    available: true
                },
                {
                    id: 3,
                    name: '行政套房',
                    type: 'suite', 
                    price: 1288,
                    size: '68㎡',
                    bed: '1张特大双人床',
                    amenities: ['免费WiFi', '空调', '智能电视', '豪华迷你吧', '独立卫浴', '海景阳台', '按摩浴缸', '客厅', '办公区'],
                    available: true
                }
            ]
        },
        timestamp: new Date().toISOString()
    };
    res.json(response);
});

// AI聊天接口 - 匹配 Postman 测试格式
app.post('/chat', async (req, res) => {
    try {
        const { message, guestName } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        console.log(`📝 收到聊天消息: ${message}`, guestName ? `来自: ${guestName}` : '');
        
        const result = await aiAssistant.askQuestion(message, guestName);
        
        // 构建符合 Postman 测试的响应格式
        const response = {
            success: true,
            data: {
                message: message,
                response: result.answer,
                guestName: guestName || 'Guest',
                model: MODEL_NAME
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ 服务器错误:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// 静态文件服务
app.use(express.static('public'));

// 404 处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: {
            'GET /': 'API information',
            'GET /health': 'Health check',
            'GET /rooms': 'Room list', 
            'POST /chat': 'AI chat'
        }
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n🏨 酒店AI助手服务运行在 http://localhost:${PORT}`);
    console.log(`📚 Postman 兼容接口:`);
    console.log(`   GET  /health  - 健康检查`);
    console.log(`   GET  /rooms   - 房型列表`);
    console.log(`   POST /chat    - AI聊天`);
    console.log(`\n💡 使用的AI模型: ${MODEL_NAME}`);
    console.log(`🔗 准备进行 Postman 测试!`);
});

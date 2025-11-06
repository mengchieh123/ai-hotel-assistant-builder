const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ollama API 配置
const OLLAMA_API = 'http://127.0.0.1:11434/api/generate'\;
const MODEL = 'qwen2.5:7b';

// 調用 Ollama API
async function callOllama(prompt) {
    try {
        const response = await fetch(OLLAMA_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 300
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API 錯誤: ${response.status}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Ollama API 錯誤:', error);
        throw error;
    }
}

// 聊天接口
app.post('/api/chat', async (req, res) => {
    try {
        const { message, guestName, roomType, checkIn, checkOut } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: '需要提供訊息內容' });
        }

        // 構建飯店助手的提示詞
        let systemPrompt = `你是一個專業的飯店訂房助理，負責協助客戶：
- 查詢房間類型和價格
- 預訂和修改訂單
- 回答設施和服務問題
- 處理入住/退房事宜
- 特殊需求安排

請用專業、友善、簡潔的繁體中文回答（3-5句話）。`;

        let contextInfo = '';
        if (guestName) contextInfo += `\n客戶姓名: ${guestName}`;
        if (roomType) contextInfo += `\n房型: ${roomType}`;
        if (checkIn) contextInfo += `\n入住日期: ${checkIn}`;
        if (checkOut) contextInfo += `\n退房日期: ${checkOut}`;

        const fullPrompt = `${systemPrompt}${contextInfo}\n\n客戶問題: ${message}\n\n助理回答:`;

        const aiResponse = await callOllama(fullPrompt);

        res.json({
            success: true,
            response: aiResponse.trim(),
            model: MODEL,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('聊天錯誤:', error);
        res.status(500).json({ 
            success: false, 
            error: '生成回覆失敗，請確保 Ollama 服務正在運行' 
        });
    }
});

// 健康檢查
app.get('/api/health', async (req, res) => {
    try {
        // 檢查 Ollama 是否可用
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        const data = await response.json();
        
        res.json({ 
            status: 'ok',
            ollamaConnected: true,
            models: data.models?.map(m => m.name) || [],
            currentModel: MODEL,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'error',
            ollamaConnected: false,
            error: 'Ollama 服務未運行，請執行: ollama serve &',
            timestamp: new Date().toISOString()
        });
    }
});

// 取得可用房型列表（示例）
app.get('/api/rooms', (req, res) => {
    const rooms = [
        {
            id: 1,
            name: '標準雙人房',
            price: 2800,
            capacity: 2,
            features: ['免費WiFi', '液晶電視', '迷你吧']
        },
        {
            id: 2,
            name: '豪華雙人房',
            price: 3800,
            capacity: 2,
            features: ['免費WiFi', '55吋電視', '迷你吧', '景觀陽台']
        },
        {
            id: 3,
            name: '家庭四人房',
            price: 5200,
            capacity: 4,
            features: ['免費WiFi', '兩張雙人床', '客廳區', '廚房設備']
        }
    ];
    
    res.json({ success: true, rooms });
});

// 啟動服務
app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏨 AI 飯店助理服務已啟動');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 服務端口: ${PORT}`);
    console.log(`🔗 健康檢查: http://localhost:${PORT}/api/health`);
    console.log(`💬 聊天接口: POST http://localhost:${PORT}/api/chat`);
    console.log(`🏠 房型列表: GET http://localhost:${PORT}/api/rooms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  確保 Ollama 服務正在運行: ollama serve &');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

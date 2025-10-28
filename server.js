// 最簡單的伺服器 - 保證可以運行
import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// 提供靜態文件
app.use(express.static('.'));

// 簡單的 HTML 頁面
const htmlPage = `
<!DOCTYPE html>
<html>
<head>
    <title>AI訂房助理</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .chat-container {
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #2d3748;
            text-align: center;
        }
        .messages {
            height: 400px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            overflow-y: auto;
            background: #f7fafc;
        }
        .input-area {
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 25px;
            font-size: 16px;
        }
        button {
            padding: 12px 25px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #5a6fd8;
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 10px;
        }
        .user-message {
            background: #667eea;
            color: white;
            text-align: right;
        }
        .ai-message {
            background: white;
            border: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <h1>🏨 AI訂房助理</h1>
        <div id="messages" class="messages">
            <div class="message ai-message">
                <strong>🤖 AI助理：</strong> 您好！我是AI訂房助理，請告訴我您想去哪裡？
            </div>
        </div>
        <div class="input-area">
            <input type="text" id="userInput" placeholder="輸入您的需求，例如：我想找台北的飯店...">
            <button onclick="sendMessage()">發送</button>
        </div>
    </div>

    <script>
        function sendMessage() {
            const input = document.getElementById('userInput');
            const message = input.value.trim();
            const messagesDiv = document.getElementById('messages');
            
            if (!message) return;
            
            // 顯示用戶消息
            messagesDiv.innerHTML += \`
                <div class="message user-message">
                    <strong>👤 您：</strong> \${message}
                </div>
            \`;
            
            // 簡單的AI邏輯
            let reply = '';
            if (message.includes('你好') || message.includes('嗨')) {
                reply = '您好！我可以幫您尋找合適的住宿。請告訴我您想去哪裡？';
            } else if (message.includes('台北')) {
                reply = '🔍 找到台北的酒店：<br>• 台北花園大酒店 - 2200元/晚<br>• 信義區精品旅店 - 3200元/晚<br>• 西門町設計旅館 - 1500元/晚';
            } else if (message.includes('預算')) {
                reply = '💰 請告訴我您的具體預算範圍？';
            } else {
                reply = '🤔 請告訴我：<br>• 想去哪裡？<br>• 什麼時候？<br>• 有幾位旅客？<br>• 預算多少？';
            }
            
            // 顯示AI回覆
            setTimeout(() => {
                messagesDiv.innerHTML += \`
                    <div class="message ai-message">
                        <strong>🤖 AI助理：</strong> \${reply}
                    </div>
                \`;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 1000);
            
            input.value = '';
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        // 回車發送
        document.getElementById('userInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlPage);
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ 
        status: '🟢 運行正常', 
        message: 'AI訂房助理服務已啟動',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log('🎉 ==========================');
    console.log('🚀 AI訂房助理啟動成功！');
    console.log(\`📍 訪問地址: http://localhost:\${PORT}\`);
    console.log(\`❤️  健康檢查: http://localhost:\${PORT}/health\`);
    console.log('==========================');
});
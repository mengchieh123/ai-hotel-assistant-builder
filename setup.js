// setup.js - 一鍵設置腳本
import fs from 'fs';

console.log('🎯 開始設置 AI 訂房助理項目...\n');

// 1. 創建 package.json
const packageJson = {
  name: "ai-hotel-assistant",
  version: "1.0.0", 
  type: "module",
  description: "AI訂房助理 - 一鍵生成",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "node server.js"
  },
  dependencies: {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ 創建 package.json');

// 2. 創建伺服器文件
const serverCode = `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 酒店數據
const hotels = [
  {
    id: 1,
    name: '台北花園大酒店',
    location: '台北車站',
    price: 2200,
    rating: 4.5
  },
  {
    id: 2, 
    name: '信義區精品旅店',
    location: '信義區',
    price: 3200,
    rating: 4.8
  }
];

// AI 對話函數
function aiResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('你好') || lowerMsg.includes('嗨')) {
    return '🏨 您好！我是AI訂房助理！\\\\n請告訴我您想去哪裡？';
  }
  
  if (lowerMsg.includes('台北')) {
    return \`🔍 找到 2 間台北酒店：\\\\n1. 台北花園大酒店 - 2200元\\\\n2. 信義區精品旅店 - 3200元\`;
  }
  
  return '🤔 請告訴我您想去哪裡？預算多少？';
}

// API 路由
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  const reply = aiResponse(message);
  
  res.json({
    success: true,
    reply: reply
  });
});

app.get('/api/hotels', (req, res) => {
  res.json({
    hotels: hotels,
    total: hotels.length
  });
});

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/index.html');
});

app.listen(PORT, () => {
  console.log('🚀 伺服器啟動在 http://localhost:' + PORT);
});`;

fs.writeFileSync('server.js', serverCode);
console.log('✅ 創建 server.js');

// 3. 創建前端文件
const htmlCode = `<!DOCTYPE html>
<html>
<head>
    <title>AI訂房助理</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f0f2f5;
        }
        .chat-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .messages {
            height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
        }
        .input-area {
            display: flex;
            gap: 10px;
        }
        input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <h1>🏨 AI訂房助理</h1>
        <div id="messages" class="messages">
            <div>🤖 您好！請問您想去哪裡？</div>
        </div>
        <div class="input-area">
            <input type="text" id="userInput" placeholder="輸入您的需求...">
            <button onclick="sendMessage()">發送</button>
        </div>
    </div>

    <script>
        async function sendMessage() {
            const input = document.getElementById('userInput');
            const message = input.value;
            
            if (!message) return;
            
            // 顯示用戶消息
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML += \`<div>👤 \${message}</div>\`;
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                messagesDiv.innerHTML += \`<div>🤖 \${data.reply}</div>\`;
                
            } catch (error) {
                messagesDiv.innerHTML += '<div>❌ 發送失敗</div>';
            }
            
            input.value = '';
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    </script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlCode);
console.log('✅ 創建 index.html');

console.log('\n🎉 項目設置完成！');
console.log('📦 依賴會自動安裝...');
console.log('🚀 等待幾秒後點擊 "Server" 面板中的啟動按鈕');
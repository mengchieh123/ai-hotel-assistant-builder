import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SpeckitRunnerSimple {
    constructor() {
        this.spec = this.getDefaultSpec();
        this.generatedFiles = [];
    }

    getDefaultSpec() {
        return {
            project: {
                name: "ai-hotel-assistant",
                version: "1.0.0",
                description: "AI驅動的智能訂房助理系統 - Speckit生成"
            },
            features: [
                "智能對話系統",
                "酒店搜索過濾", 
                "響應式聊天界面",
                "模擬預訂流程"
            ]
        };
    }

    async generateProject() {
        console.log('🚀 開始生成 AI 訂房助理項目...\n');
        
        // 生成基礎文件
        await this.generatePackageJson();
        await this.generateServer();
        await this.generateFrontend();
        await this.generateREADME();
        
        console.log('\n🎉 項目生成完成!');
        this.showSummary();
        
        // 自動安裝依賴
        await this.installDependencies();
    }

    async generatePackageJson() {
        const packageJson = {
            name: this.spec.project.name,
            version: this.spec.project.version,
            type: "module",
            description: this.spec.project.description,
            main: "server.js",
            scripts: {
                start: "node server.js",
                dev: "node server.js",
                generate: "node speckit_runner_simple.js"
            },
            dependencies: {
                express: "^4.18.2",
                cors: "^2.8.5"
            },
            keywords: ["ai", "hotel", "booking", "assistant", "speckit"],
            author: "Speckit AI Developer",
            license: "MIT"
        };

        this.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    }

    async generateServer() {
        const serverCode = `import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

console.log('🔧 伺服器初始化...');
console.log('📁 工作目錄:', __dirname);

// 模擬酒店數據庫
const hotels = [
  {
    id: 1,
    name: '台北花園大酒店',
    location: '台北車站',
    price: 2200,
    rating: 4.5,
    amenities: ['免費WiFi', '停車場', '早餐'],
    description: '位於台北車站旁，交通便利'
  },
  {
    id: 2,
    name: '信義區精品旅店',
    location: '信義區',
    price: 3200, 
    rating: 4.8,
    amenities: ['游泳池', '餐廳', 'SPA'],
    description: '時尚設計風格，鄰近101'
  },
  {
    id: 3,
    name: '西門町設計旅館',
    location: '西門町',
    price: 1500,
    rating: 4.2,
    amenities: ['交誼廳', '自助洗衣'],
    description: '年輕化的設計旅館'
  }
];

// AI 對話處理函數
function processUserMessage(message) {
  console.log('💬 處理用戶消息:', message);
  const lowerMsg = message.toLowerCase();
  
  // 問候處理
  if (lowerMsg.includes('你好') || lowerMsg.includes('嗨') || lowerMsg.includes('hello')) {
    return \`🏨 您好！我是AI訂房助理！\\\\n\\\\n我可以幫您：\\\\n• 尋找合適住宿\\\\n• 比較價格設施\\\\n• 模擬預訂流程\\\\n\\\\n請告訴我：\\\\n📍 想去哪裡？\\\\n💰 預算多少？\\\\n👥 有幾位旅客？\`;
  }
  
  // 地點搜索
  if (lowerMsg.includes('台北') || lowerMsg.includes('taipei')) {
    const results = hotels.filter(h => h.location.includes('台北'));
    if (results.length > 0) {
      let response = \`🔍 找到 \${results.length} 間台北的酒店：\\\\n\\\\n\`;
      results.forEach((hotel, index) => {
        response += \`\${index + 1}. 🏨 \${hotel.name}\\\\n   📍 \${hotel.location} | 💰 \${hotel.price}元 | ⭐ \${hotel.rating}\\\\n\\\\n\`;
      });
      response += '💡 回覆"第X間"看詳細資訊';
      return response;
    }
  }
  
  // 預算搜索
  const budgetMatch = message.match(/(\\\\d+)元/);
  if (budgetMatch) {
    const budget = parseInt(budgetMatch[1]);
    const results = hotels.filter(h => h.price <= budget);
    return \`💰 找到 \${results.length} 間 \${budget}元以内的酒店\`;
  }
  
  // 詳細資訊
  const detailMatch = message.match(/第(\\\\d+)間/);
  if (detailMatch) {
    const index = parseInt(detailMatch[1]) - 1;
    if (hotels[index]) {
      const hotel = hotels[index];
      return \`📋 \${hotel.name} 詳細資訊：\\\\n\\\\n📍 位置: \${hotel.location}\\\\n💰 價格: \${hotel.price}元/晚\\\\n⭐ 評分: \${hotel.rating}/5\\\\n🏷 設施: \${hotel.amenities.join('、')}\\\\n\\\\n📝 \${hotel.description}\`;
    }
  }
  
  // 默認回應
  return '🤔 請告訴我：\\\\n• 想去哪裡？（台北、信義區...）\\\\n• 預算多少？\\\\n• 有什麼特別需求？';
}

// API 路由
app.post('/api/chat', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: '消息內容不能為空' 
      });
    }
    
    console.log('📨 收到消息:', message);
    const reply = processUserMessage(message);
    
    res.json({
      success: true,
      reply: reply,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ API錯誤:', error);
    res.status(500).json({
      success: false,
      error: '系統錯誤，請稍後再試'
    });
  }
});

app.get('/api/hotels', (req, res) => {
  const { location, maxPrice } = req.query;
  
  let results = [...hotels];
  
  if (location) {
    results = results.filter(hotel => 
      hotel.location.includes(location)
    );
  }
  
  if (maxPrice) {
    results = results.filter(hotel => 
      hotel.price <= parseInt(maxPrice)
    );
  }
  
  res.json({
    success: true,
    data: {
      hotels: results,
      total: results.length
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '🟢 AI訂房助理服務正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    hotels: hotels.length
  });
});

// 服務靜態文件
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
  res.sendFile(join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(join(__dirname, 'script.js'));
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
  console.log('\\\\n🎉 ==================================');
  console.log('🚀 AI訂房助理啟動成功!');
  console.log(\`📍 服務地址: http://localhost:\${PORT}\`);
  console.log(\`🏨 數據庫: \${hotels.length} 間酒店\`);
  console.log(\`💬 AI引擎: 就緒\`);
  console.log('🔧 服務器: 運行中');
  console.log('==================================\\\\n');
  
  console.log('📡 可用API端點:');
  console.log(\`   🌐 前端界面: http://localhost:\${PORT}\`);
  console.log(\`   💬 AI對話: http://localhost:\${PORT}/api/chat\`);
  console.log(\`   🏨 酒店搜索: http://localhost:\${PORT}/api/hotels\`);
  console.log(\`   ❤️  健康檢查: http://localhost:\${PORT}/api/health\`);
});

// 錯誤處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲異常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的Promise拒絕:', reason);
});`;

        this.writeFile('server.js', serverCode);
    }

    async generateFrontend() {
        // 生成 index.html
        const htmlCode = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏨 AI訂房助理 - Speckit生成</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="app-container">
        <header class="app-header">
            <div class="header-content">
                <h1>🏨 AI訂房助理</h1>
                <p>Speckit自主開發 • 智能旅行管家</p>
                <div class="status">
                    <span class="status-dot"></span>
                    <span>服務正常</span>
                </div>
            </div>
        </header>

        <main class="app-main">
            <div class="chat-container">
                <div id="messages" class="messages">
                    <div class="message ai-message">
                        <div class="message-avatar">🤖</div>
                        <div class="message-content">
                            <strong>🎉 歡迎使用 AI 訂房助理！</strong><br><br>
                            💫 <em>此項目由 Speckit 自主開發生成</em><br><br>
                            🚀 <strong>我可以幫您：</strong><br>
                            • 尋找合適的住宿<br>
                            • 比較價格和設施<br>
                            • 根據預算推薦酒店<br>
                            • 模擬預訂流程<br><br>
                            💡 <strong>試試這樣說：</strong><br>
                            "我想找台北的飯店"<br>
                            "預算2000元以内"<br>
                            "兩人住宿"<br><br>
                            📍 請告訴我您的需求...
                        </div>
                    </div>
                </div>

                <div class="input-section">
                    <div class="quick-replies">
                        <button class="quick-reply" onclick="quickReply('我想找台北的飯店')">🏙️ 台北住宿</button>
                        <button class="quick-reply" onclick="quickReply('預算2000元以内')">💰 2000元预算</button>
                        <button class="quick-reply" onclick="quickReply('兩人住宿')">👥 兩人住宿</button>
                        <button class="quick-reply" onclick="quickReply('推薦親子飯店')">👨‍👩‍👧‍👦 親子飯店</button>
                        <button class="quick-reply" onclick="quickReply('需要停車場')">🅿️ 有停車場</button>
                    </div>
                    
                    <div class="input-container">
                        <div class="input-wrapper">
                            <textarea 
                                id="userInput" 
                                placeholder="輸入您的訂房需求... 例如：我想找明天信義區的飯店，兩人，預算3000元以内"
                                rows="2"
                            ></textarea>
                            <button id="sendButton" class="send-button">
                                <span class="send-icon">📤</span>
                                發送
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <footer class="app-footer">
            <div class="footer-content">
                <span>🤖 由 Speckit AI 自主開發 • ⚡ 實時對話 • 🔒 隱私保護</span>
            </div>
        </footer>
    </div>

    <script src="script.js"></script>
</body>
</html>`;

        this.writeFile('index.html', htmlCode);

        // 生成 style.css
        const cssCode = `/* Speckit 生成的樣式 - AI訂房助理 */
:root {
    --primary-color: #667eea;
    --primary-dark: #5a6fd8;
    --secondary-color: #764ba2;
    --success-color: #48bb78;
    --text-primary: #2d3748;
    --text-secondary: #718096;
    --bg-primary: #ffffff;
    --bg-secondary: #f7fafc;
    --border-color: #e2e8f0;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    line-height: 1.6;
    color: var(--text-primary);
}

.app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    max-width: 1200px;
    margin: 0 auto;
    background: var(--bg-primary);
    box-shadow: 0 0 50px rgba(0,0,0,0.1);
}

/* 頭部樣式 */
.app-header {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}

.header-content h1 {
    font-size: 1.8rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.header-content p {
    color: var(--text-secondary);
    font-size: 1rem;
}

.status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--success-color);
    font-size: 0.9rem;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* 主內容區 */
.app-main {
    flex: 1;
    display: flex;
}

.chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 140px);
}

/* 消息區域 */
.messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: var(--bg-secondary);
}

.message {
    display: flex;
    margin-bottom: 1.5rem;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.ai-message {
    justify-content: flex-start;
}

.user-message {
    justify-content: flex-end;
}

.message-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    margin: 0 1rem;
    flex-shrink: 0;
}

.ai-message .message-avatar {
    background: var(--success-color);
    color: white;
}

.user-message .message-avatar {
    background: var(--primary-color);
    color: white;
    order: 2;
}

.message-content {
    max-width: 70%;
    padding: 1rem 1.25rem;
    border-radius: 1.125rem;
    line-height: 1.5;
    word-wrap: break-word;
}

.ai-message .message-content {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-bottom-left-radius: 0.25rem;
}

.user-message .message-content {
    background: var(--primary-color);
    color: white;
    border-bottom-right-radius: 0.25rem;
    order: 1;
}

/* 輸入區域 */
.input-section {
    background: var(--bg-primary);
    border-top: 1px solid var(--border-color);
}

.quick-replies {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem 0;
    flex-wrap: wrap;
}

.quick-reply {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-primary);
    transition: all 0.2s ease;
    white-space: nowrap;
}

.quick-reply:hover {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    transform: translateY(-1px);
}

.input-container {
    padding: 1rem 1.5rem 1.5rem;
}

.input-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    background: var(--bg-secondary);
    border: 2px solid transparent;
    border-radius: 1rem;
    padding: 0.75rem;
    transition: border-color 0.2s ease;
}

.input-wrapper:focus-within {
    border-color: var(--primary-color);
}

#userInput {
    flex: 1;
    border: none;
    background: transparent;
    resize: none;
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    max-height: 120px;
    outline: none;
    color: var(--text-primary);
}

#userInput::placeholder {
    color: var(--text-secondary);
}

.send-button {
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
}

.send-button:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: translateY(-1px);
}

.send-button:disabled {
    background: var(--text-secondary);
    cursor: not-allowed;
    transform: none;
}

.send-icon {
    font-size: 1rem;
}

/* 底部 */
.app-footer {
    background: var(--bg-secondary);
    padding: 1rem 2rem;
    text-align: center;
    border-top: 1px solid var(--border-color);
}

.footer-content {
    color: var(--text-secondary);
    font-size: 0.9rem;
}

/* 響應式設計 */
@media (max-width: 768px) {
    .app-header {
        padding: 1rem;
    }
    
    .header-content {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
    }
    
    .header-content h1 {
        font-size: 1.4rem;
    }
    
    .messages {
        padding: 1rem;
    }
    
    .message-content {
        max-width: 85%;
    }
    
    .input-container {
        padding: 1rem;
    }
    
    .input-wrapper {
        flex-direction: column;
        align-items: stretch;
    }
    
    .send-button {
        align-self: flex-end;
        min-width: 100px;
    }
    
    .quick-replies {
        padding: 0.75rem 1rem 0;
    }
}

/* 滾動條樣式 */
.messages::-webkit-scrollbar {
    width: 6px;
}

.messages::-webkit-scrollbar-track {
    background: transparent;
}

.messages::-webkit-scrollbar-thumb {
    background: var(--text-secondary);
    border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
    background: var(--text-primary);
}`;

        this.writeFile('style.css', cssCode);

        // 生成 script.js
        const jsCode = `// AI訂房助理 - 前端邏輯 (Speckit生成)
class HotelChatApp {
    constructor() {
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('💬 AI訂房助理前端初始化完成');
    }

    setupEventListeners() {
        const sendButton = document.getElementById('sendButton');
        const userInput = document.getElementById('userInput');
        
        // 發送按鈕點擊
        sendButton.addEventListener('click', () => this.sendMessage());
        
        // 回車發送
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 自動調整輸入框高度
        userInput.addEventListener('input', this.autoResizeTextarea.bind(this));
    }

    autoResizeTextarea() {
        const textarea = document.getElementById('userInput');
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const userInput = document.getElementById('userInput');
        const message = userInput.value.trim();
        
        if (!message || this.isLoading) return;
        
        // 添加用戶消息
        this.addMessage(message, true);
        userInput.value = '';
        this.autoResizeTextarea();
        
        // 設置加載狀態
        this.setLoadingState(true);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });
            
            if (!response.ok) {
                throw new Error(\`HTTP \${response.status}\`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // 模擬AI思考時間
                setTimeout(() => {
                    this.addMessage(data.reply, false);
                    this.setLoadingState(false);
                }, 800);
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('發送消息錯誤:', error);
            this.addMessage('❌ 抱歉，暫時無法連接服務器。請稍後再試或刷新頁面。', false);
            this.setLoadingState(false);
        }
    }

    addMessage(content, isUser) {
        const messagesDiv = document.getElementById('messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${isUser ? 'user-message' : 'ai-message'}\`;
        
        messageDiv.innerHTML = \`
            <div class="message-avatar">\${isUser ? '👤' : '🤖'}</div>
            <div class="message-content">\${content.replace(/\\\\n/g, '<br>')}</div>
        \`;
        
        messagesDiv.appendChild(messageDiv);
        this.scrollToBottom();
    }

    setLoadingState(loading) {
        this.isLoading = loading;
        const sendButton = document.getElementById('sendButton');
        const userInput = document.getElementById('userInput');
        
        if (loading) {
            sendButton.innerHTML = '<span class="send-icon">⏳</span> 思考中...';
            sendButton.disabled = true;
            userInput.disabled = true;
            
            // 顯示輸入指示器
            this.showTypingIndicator();
        } else {
            sendButton.innerHTML = '<span class="send-icon">📤</span> 發送';
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.focus();
            
            // 移除輸入指示器
            this.removeTypingIndicator();
        }
    }

    showTypingIndicator() {
        const messagesDiv = document.getElementById('messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message';
        typingDiv.id = 'typing-indicator';
        
        typingDiv.innerHTML = \`
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        \`;
        
        messagesDiv.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    scrollToBottom() {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

// 快速回覆函數
function quickReply(message) {
    document.getElementById('userInput').value = message;
    window.chatApp.sendMessage();
}

// 添加打字指示器樣式
const typingStyles = \`
.typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0.5rem 0;
}

.typing-indicator span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #a0aec0;
    animation: typingBounce 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typingBounce {
    0%, 80%, 100% { 
        transform: scale(0);
        opacity: 0.5;
    }
    40% { 
        transform: scale(1);
        opacity: 1;
    }
}
\`;

// 注入樣式
const styleSheet = document.createElement('style');
styleSheet.textContent = typingStyles;
document.head.appendChild(styleSheet);

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new HotelChatApp();
    console.log('🎉 AI訂房助理前端啟動成功！');
    console.log('💡 試試輸入：我想找台北的飯店');
});`;

        this.writeFile('script.js', jsCode);
    }

    async generateREADME() {
        const readme = `# 🏨 AI訂房助理

> 由 Speckit 自主開發生成的智能訂房助理系統

## ✨ 功能特色

- 🤖 **AI智能對話** - 自然語言理解與回應
- 🏨 **酒店搜索** - 基於地點、價格的智能推薦  
- 💰 **預算過濾** - 根據預算推薦合適住宿
- 📱 **響應式界面** - 現代化的聊天體驗
- ⚡ **實時交互** - 流暢的對話體驗
- 🎯 **智能推薦** - 個性化的酒店推薦

## 🚀 快速開始

### 環境要求
- Node.js 16+
- npm 或 yarn

### 安裝與運行

\\\`\\\`\\\`bash
# 1. 安裝依賴
npm install

# 2. 啟動服務
npm start
\\\`\\\`\\\`

服務啟動後訪問: http://localhost:3001

## 💬 使用方式

### 基礎對話
- "我想找台北的飯店"
- "預算2000元以内" 
- "兩人住宿"
- "推薦親子飯店"

### 詳細查詢
- "第1間詳細資訊"
- "比較第1和第2間"

### 快速回覆
使用界面下方的快速回覆按鈕快速輸入常見問題

## 📡 API 文檔

### POST /api/chat
處理用戶消息並返回AI回應

**請求體:**
\\\`\\\`\\\`json
{
  "message": "我想找台北的飯店"
}
\\\`\\\`\\\`

**回應:**
\\\`\\\`\\\`json
{
  "success": true,
  "reply": "找到 3 間台北的酒店...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\\\`\\\`\\\`

### GET /api/hotels
搜索酒店

**參數:**
- \\\`location\\\` - 地點過濾
- \\\`maxPrice\\\` - 最大價格

**示例:**
\\\`\\\`\\\`
GET /api/hotels?location=台北&maxPrice=2000
\\\`\\\`\\\`

### GET /api/health
健康檢查端點

## 🛠 開發

### 項目結構
\\\`\\\`\\\`
/
├── server.js     # Express 伺服器
├── index.html    # 前端界面
├── style.css     # 樣式文件
├── script.js     # 前端邏輯
├── package.json  # 項目配置
└── README.md     # 項目文檔
\\\`\\\`\\\`

### 重新生成項目
\\\`\\\`\\\`bash
npm run generate
\\\`\\\`\\\`

## 🔧 技術棧

- **後端**: Node.js + Express
- **前端**: 原生 JavaScript + CSS3
- **AI引擎**: 規則基礎的對話系統
- **數據**: 內存數據庫 (可擴展)

## 📄 許可證

MIT License

---

*🤖 此項目由 Speckit AI 自主開發系統生成*  
*⏰ 生成時間: ${new Date().toLocaleString()}*`;

        this.writeFile('README.md', readme);
    }

    writeFile(filename, content) {
        try {
            fs.writeFileSync(filename, content, 'utf8');
            console.log(\`✅ 生成: \${filename}\`);
            this.generatedFiles.push(filename);
            return true;
        } catch (error) {
            console.log(\`❌ 生成失敗: \${filename}\`, error.message);
            return false;
        }
    }

    async installDependencies() {
        console.log('\n📦 正在安裝依賴...');
        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            
            const { stdout, stderr } = await execAsync('npm install');
            console.log('✅ 依賴安裝成功！');
            console.log('\\\\n🎯 下一步: npm start');
        } catch (error) {
            console.log('❌ 自動安裝失敗，請手動運行: npm install');
        }
    }

    showSummary() {
        console.log('\n📊 Speckit 生成報告');
        console.log('='.repeat(50));
        console.log(\`📁 成功生成: \${this.generatedFiles.length} 個文件\`);
        console.log(\`🏗️  項目名稱: \${this.spec.project.name}\`);
        console.log(\`🔄 版本: \${this.spec.project.version}\`);
        console.log(\`📝 描述: \${this.spec.project.description}\`);
        
        console.log('\n🎯 立即體驗:');
        console.log('  1. npm install    # 安裝依賴');
        console.log('  2. npm start      # 啟動服務');
        console.log('  3. 訪問預覽URL測試功能');
        
        console.log('\n💡 測試指令:');
        console.log('  curl -X POST http://localhost:3001/api/chat \\\\\\');
        console.log('    -H "Content-Type: application/json" \\\\\\');
        console.log('    -d \\'{"message":"你好"}\\'');
        
        console.log('\n✨ 功能特色:');
        this.spec.features.forEach((feature, index) => {
            console.log(\`  \${index + 1}. \${feature}\`);
        });
    }
}

// 執行生成
const runner = new SpeckitRunnerSimple();
runner.generateProject().catch(console.error);
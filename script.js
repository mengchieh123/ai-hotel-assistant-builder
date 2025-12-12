// AI訂房助理 - 前端邏輯
class HotelBookingAssistant {
  constructor() {
    this.conversationHistory = [];
    this.isLoading = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setWelcomeTime();
    this.loadConversationHistory();
    console.log("🏨 AI訂房助理前端初始化完成");
  }

  setupEventListeners() {
    // 發送按鈕
    const sendButton = document.getElementById("sendButton");
    // 假設您的 HTML 中按鈕 ID 命名為 'send-button' 而非 'sendButton'
    // 請根據您的 HTML 實際 ID 調整此處
    const actualSendButton = document.getElementById("sendButton") || document.getElementById("send-button");
    if (actualSendButton) {
        actualSendButton.addEventListener("click", () => this.sendMessage());
    }

    // 輸入框回車發送
    const userInput = document.getElementById("userInput");
    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 輸入框自動調整高度
    userInput.addEventListener("input", this.autoResizeTextarea.bind(this));

    // 快速回覆按鈕
    const quickReplies = document.querySelectorAll(".quick-reply");
    quickReplies.forEach((button) => {
      button.addEventListener("click", (e) => {
        const message = e.target.getAttribute("data-message");
        this.handleQuickReply(message);
      });
    });

    // 粘貼事件處理
    userInput.addEventListener("paste", (e) => {
      setTimeout(() => this.autoResizeTextarea(), 0);
    });

    // 頁面卸載前保存歷史
    window.addEventListener("beforeunload", () => {
      this.saveConversationHistory();
    });
  }

  setWelcomeTime() {
    const welcomeTime = document.getElementById("welcomeTime");
    if (welcomeTime) {
      welcomeTime.textContent = this.formatTime(new Date());
    }
  }

  autoResizeTextarea() {
    const textarea = document.getElementById("userInput");
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  async sendMessage() {
    const userInput = document.getElementById("userInput");
    const message = userInput.value.trim();

    if (!message || this.isLoading) return;

    // 添加用戶消息
    this.addMessage(message, true);
    userInput.value = "";
    this.autoResizeTextarea();

    // 禁用輸入
    this.setLoadingState(true);

    try {
      const response = await this.sendToAI(message);
      this.addMessage(response, false);

      // 更新對話歷史
      this.updateConversationHistory(message, response);
    } catch (error) {
      console.error("發送消息錯誤:", error);
      this.addMessage("抱歉，暫時無法連接服務，請稍後再試。", false);
    } finally {
      this.setLoadingState(false);
    }
  }

  async sendToAI(message) {
    // 🎯 修正：移除 Git 衝突標記，並使用本地後端服務的絕對路徑
    const API_URL = "http://localhost:3000/chat"; 
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        history: this.conversationHistory,
      }),
    });

    if (!response.ok) {
        // 如果連線到本地失敗，提供更明確的錯誤資訊
      throw new Error(`HTTP error! status: ${response.status}. 請確認後端服務 (Node.js) 正在 http://localhost:3000 運行。`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "API返回錯誤");
    }

    return data.reply;
  }

  addMessage(content, isUser = false) {
    const messagesContainer = document.getElementById("messagesContainer");
    const welcomeMessage = document.querySelector(".welcome-message");

    // 如果是第一條用戶消息，隱藏歡迎消息
    if (isUser && welcomeMessage && this.conversationHistory.length === 0) {
      welcomeMessage.style.display = "none";
    }

    // 移除正在輸入指示器
    this.removeTypingIndicator();

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "ai-message"}`;

    messageDiv.innerHTML = `
            <div class="message-avatar">${isUser ? "👤" : "🤖"}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessage(content)}</div>
                <div class="message-time">${this.formatTime(new Date())}</div>
            </div>
        `;

    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();

    // 如果是AI消息，顯示輸入指示器
    if (!isUser) {
      this.showTypingIndicator();
      setTimeout(() => {
        this.removeTypingIndicator();
        this.scrollToBottom();
      }, 1000);
    }
  }

  formatMessage(content) {
    // 簡單的Markdown樣式格式化
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>")
      .replace(/•\s*(.*?)(?=<br>|$)/g, "• <strong>$1</strong>")
      .replace(
        /(📍|💰|⭐|🎯|🏷|📝|👥|📅|🔍|✅|🎉|💡|🤔)/g,
        '<span class="emoji">$1</span>'
      );
  }

  formatTime(date) {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById("messagesContainer");
    const typingTemplate = document.getElementById("typingTemplate");
    const typingIndicator = typingTemplate.content.cloneNode(true);

    messagesContainer.appendChild(typingIndicator);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const typingMessage = document.querySelector(".typing-message");
    if (typingMessage) {
      typingMessage.remove();
    }
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById("messagesContainer");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  setLoadingState(loading) {
    this.isLoading = loading;
    const sendButton = document.getElementById("sendButton") || document.getElementById("send-button");
    const userInput = document.getElementById("userInput");

    if (loading) {
      sendButton.innerHTML = '<span class="send-icon">⏳</span> 發送中...';
      sendButton.disabled = true;
      userInput.disabled = true;
    } else {
      sendButton.innerHTML = '<span class="send-icon">📤</span> 發送';
      sendButton.disabled = false;
      userInput.disabled = false;
      userInput.focus();
    }
  }

  handleQuickReply(message) {
    document.getElementById("userInput").value = message;
    this.sendMessage();
  }

  updateConversationHistory(userMessage, aiReply) {
    this.conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiReply }
    );

    // 保持歷史記錄在合理範圍内
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    this.saveConversationHistory();
  }

  saveConversationHistory() {
    try {
      localStorage.setItem(
        "hotelAssistantHistory",
        JSON.stringify(this.conversationHistory)
      );
    } catch (error) {
      console.warn("無法保存對話歷史:", error);
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem("hotelAssistantHistory");
      if (saved) {
        this.conversationHistory = JSON.parse(saved);

        // 如果存在歷史記錄，隱藏歡迎消息
        if (this.conversationHistory.length > 0) {
          const welcomeMessage = document.querySelector(".welcome-message");
          if (welcomeMessage) {
            welcomeMessage.style.display = "none";
          }

          // 重新顯示歷史消息
          this.conversationHistory.forEach((msg, index) => {
            if (index % 2 === 0) {
              // 用戶消息
              this.addMessage(msg.content, true);
            } else {
              // AI消息
              this.addMessage(msg.content, false);
            }
          });
        }
      }
    } catch (error) {
      console.warn("無法加載對話歷史:", error);
    }
  }
}

// 添加一些工具樣式
const additionalStyles = `
.emoji {
    font-style: normal;
}

.message-text strong {
    color: inherit;
}

.message-text em {
    opacity: 0.8;
    font-style: italic;
}

/* 自定義滾動條美化 */
.messages-container {
    scrollbar-width: thin;
    scrollbar-color: var(--text-light) transparent;
}

/* 選擇文字樣式 */
::selection {
    background: rgba(102, 126, 234, 0.2);
}

/* 聚焦樣式 */
#userInput:focus {
    outline: none;
}
`;

// 注入額外樣式
const styleSheet = document.createElement("style");
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// 初始化應用
document.addEventListener("DOMContentLoaded", () => {
  window.hotelAssistant = new HotelBookingAssistant();

  // 添加全局錯誤處理
  window.addEventListener("error", (e) => {
    console.error("全局錯誤:", e.error);
  });

  // 顯示初始化信息
  setTimeout(() => {
    console.log("🎉 AI訂房助理啟動成功!");
    console.log('💬 試試輸入: "我想找台北的飯店"');
    console.log('💰 或: "預算2000元以内的住宿"');
  }, 1000);
});

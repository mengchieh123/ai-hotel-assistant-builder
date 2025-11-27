// server.js - AI 訂房助理 Web API

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');
require('dotenv').config(); // 加載 .env 檔案中的環境變數

// 引入 Anthropic SDK (假設您已安裝: npm install @anthropic-ai/sdk)
// const Anthropic = require('@anthropic-ai/sdk');
// const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); 

// --- 1. 載入規格檔案 (從 YAML 載入) ---
const CLAUDE_TOOLS = yaml.load(fs.readFileSync('claude-tools-spec.yaml', 'utf8')).tools;
const BUSINESS_RULES = yaml.load(fs.readFileSync('business-specs.yaml', 'utf8'));

// --- 2. 模擬工具執行函數 (在您的伺服器上運行) ---
const TOOL_FUNCTIONS = {
    book_room: (args) => {
        const rules = BUSINESS_RULES.core_business_rules;
        console.log(`[TOOL EXEC] 正在處理訂房: ${JSON.stringify(args)}`);
        // 這裡未來會呼叫真實的訂房 API
        return {
            status: "success",
            order_id: `WEB-TPE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            message: `訂房成功。房型: ${args.room_type}，入住時間: ${rules.入住時間}。`
        };
    },
    retrieve_member_benefits: (args) => {
        const member_info = BUSINESS_RULES.member_rules[args.member_id];
        console.log(`[TOOL EXEC] 查詢會員權益: ${args.member_id}`);
        if (member_info) {
             return { status: "success", benefits: member_info };
        } else {
             return { status: "failure", message: `查無會員 ID: ${args.member_id}` };
        }
    },
    search_attractions_and_facilities: (args) => {
        console.log(`[TOOL EXEC] 查詢設施: ${args.query_type}`);
        const results = args.query_type === '設施' 
            ? ["豪華室內泳池", "24H 健身房", "頂樓空中花園"]
            : ["歷史博物館", "城市購物中心", "港灣夜市"];
        return { status: "success", results: results };
    }
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware 設置
app.use(cors({ origin: '*' })); // 允許所有來源 (開發階段)
app.use(express.json());       // 解析 POST 請求中的 JSON 數據

// --- 3. 模擬 Claude 響應函數 (將來會替換為真實 API 呼叫) ---
function simulateClaudeResponse(userMessage, tools) {
    // 這裡的判斷邏輯與您終端機版本相同，用於模擬 Claude 的決策
    if (/(訂房|預訂|房型)/.test(userMessage)) {
        return {
            type: "tool_call",
            tool_calls: [{
                id: "call_01",
                name: "book_room",
                arguments: {
                    check_in_date: "2026-03-01", check_out_date: "2026-03-03",
                    room_type: "豪華雙人房", guest_count: 2, member_id: "金卡會員"
                }
            }]
        };
    } 
    // ... 其他判斷邏輯略，這裡我們只演示訂房
    else {
        return { type: "text", text: "您好！我是小智，請給我您的需求。" };
    }
}


// --- 4. 主要 /chat 路由 (API 核心) ---
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).send({ error: 'Message field is required.' });
    }

    try {
        // 步驟 A: 模擬第一次呼叫 Claude (傳入工具定義)
        const claudeDecision = simulateClaudeResponse(userMessage, CLAUDE_TOOLS);

        if (claudeDecision.type === "tool_call") {
            const toolCall = claudeDecision.tool_calls[0];
            
            // 步驟 B: 執行伺服器上的實際工具函數
            const toolFunction = TOOL_FUNCTIONS[toolCall.name];
            if (!toolFunction) {
                return res.status(500).send({ error: `Tool not implemented: ${toolCall.name}` });
            }
            
            const toolResult = toolFunction(toolCall.arguments);

            // 步驟 C: 將工具結果作為上下文回傳給 Claude (這裡仍然是模擬回覆)
            let finalResponseText;
            if (toolCall.name === 'book_room') {
                finalResponseText = `✅ 訂房成功！訂單編號: ${toolResult.order_id}。您的房型已確認。`;
            } else {
                 finalResponseText = JSON.stringify(toolResult); // 簡化處理
            }
            
            // 實際項目中：這裡要執行第二次 Claude API 呼叫

            return res.json({ 
                response: finalResponseText,
                tool_used: toolCall.name 
            });

        } else {
            // 步驟 D: Claude 直接回覆文本
            return res.json({ response: claudeDecision.text });
        }
        
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});


// 啟動服務器
app.listen(PORT, () => {
    console.log(`\n🎉 Web API 服務器已啟動: http://localhost:${PORT}`);
    console.log(`API Endpoint: POST http://localhost:${PORT}/chat`);
});

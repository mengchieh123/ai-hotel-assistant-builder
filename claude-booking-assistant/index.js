// index.js (終端機版本 - 演示 Tool Use 流程)

const fs = require('fs');
const yaml = require('js-yaml');
const readline = require('readline');

// --- 1. 載入規格檔案 ---
const CLAUDE_TOOLS = yaml.load(fs.readFileSync('claude-tools-spec.yaml', 'utf8')).tools;
const BUSINESS_RULES = yaml.load(fs.readFileSync('business-specs.yaml', 'utf8'));

console.log("--- 🤖 AI 訂房助理終端機演示 ---");
console.log("✅ 載入工具規格數量:", CLAUDE_TOOLS.length);
console.log("✅ 載入業務規則成功。");
console.log("---------------------------------\n");


// --- 2. 模擬工具執行函數 (在您的伺服器上運行) ---
const TOOL_FUNCTIONS = {
    book_room: (args) => {
        const rules = BUSINESS_RULES.core_business_rules;
        console.log(`\n\t[🛠️ 執行訂房系統 API] 正在處理預訂...`);
        console.log(`\t- 規則檢查: 入住時間 ${rules.入住時間}, 取消政策: ${rules.取消政策}`);
        
        if (args.member_id) {
            console.log(`\t- 身份驗證: 成功應用會員 ID ${args.member_id}。`);
        }
        
        // 模擬呼叫外部訂房 API
        return {
            status: "success",
            order_id: `HTL-TPE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            message: `已成功預訂 ${args.room_type} (共 ${args.guest_count} 人) 從 ${args.check_in_date} 到 ${args.check_out_date}。`
        };
    },
    retrieve_member_benefits: (args) => {
        const member_info = BUSINESS_RULES.member_rules[args.member_id];
        console.log(`\n\t[🛠️ 執行會員系統 API] 查詢會員權益...`);

        if (member_info) {
             return {
                status: "success",
                level: args.member_id,
                benefits: member_info
            };
        } else {
             return {
                status: "failure",
                message: `查無會員 ID: ${args.member_id}。`
            };
        }
    },
    search_attractions_and_facilities: (args) => {
        console.log(`\n\t[🛠️ 執行地理/設施查詢] 正在查詢...`);
        const results = args.query_type === '設施' 
            ? ["豪華室內泳池", "24H 健身房", "頂樓空中花園"]
            : ["歷史博物館 (車程10分鐘)", "城市購物中心", "港灣夜市"];
        
        return {
            status: "success",
            results: results,
            message: `這是關於 ${args.query_type} (${args.theme}) 的推薦結果。`
        };
    }
};

// --- 3. 模擬 Claude API 響應 (核心邏輯) ---
// 這裡用一個硬編碼函數來演示 Claude 判斷後的回應
function simulateClaudeResponse(userMessage, tools) {
    if (/(訂房|預訂|房型)/.test(userMessage)) {
        // 模擬 Claude 判斷：需要訂房工具
        return {
            type: "tool_call",
            tool_calls: [{
                id: "call_01",
                name: "book_room",
                arguments: {
                    check_in_date: "2026-03-01",
                    check_out_date: "2026-03-03",
                    room_type: "豪華雙人房",
                    guest_count: 2,
                    member_id: "金卡會員"
                }
            }]
        };
    } else if (/(會員|金卡|權益)/.test(userMessage)) {
        // 模擬 Claude 判斷：需要查詢會員工具
        return {
            type: "tool_call",
            tool_calls: [{
                id: "call_02",
                name: "retrieve_member_benefits",
                arguments: {
                    member_id: "金卡會員"
                }
            }]
        };
    } else if (/(景點|設施|夜市)/.test(userMessage)) {
        // 模擬 Claude 判斷：需要查詢景點工具
        return {
            type: "tool_call",
            tool_calls: [{
                id: "call_03",
                name: "search_attractions_and_facilities",
                arguments: {
                    query_type: "景點",
                    theme: "夜市"
                }
            }]
        };
    } else {
        // 模擬 Claude 判斷：直接文本回覆
        return {
            type: "text",
            text: "您好！我是小智，請問您需要訂房、查詢價格還是查詢飯店設施？"
        };
    }
}

// --- 4. 終端機交互與流程管理 ---

async function runChat(message) {
    console.log(`\n> 用戶: ${message}`);
    
    // 步驟 A: 第一次呼叫 Claude (傳入工具定義)
    const claudeDecision = simulateClaudeResponse(message, CLAUDE_TOOLS);

    if (claudeDecision.type === "tool_call") {
        const toolCall = claudeDecision.tool_calls[0];
        console.log(`\n[🤖 Claude 決定] 需要調用工具: ${toolCall.name}`);
        console.log(`[🤖 Claude 參數] ${JSON.stringify(toolCall.arguments)}`);
        
        // 步驟 B: 執行伺服器上的實際工具函數
        const toolFunction = TOOL_FUNCTIONS[toolCall.name];
        if (toolFunction) {
            const toolResult = toolFunction(toolCall.arguments);
            
            // 步驟 C: 將工具結果作為上下文，回傳給 Claude 進行自然語言回覆
            // 由於這是模擬器，我們直接生成最終回覆：
            
            let finalResponse;
            if (toolCall.name === 'book_room') {
                finalResponse = `✅ **訂房成功！** 訂單編號: ${toolResult.order_id}。\n小智已為您預訂 ${toolCall.arguments.room_type}。您的入住時間為 ${BUSINESS_RULES.core_business_rules.入住時間}。`;
            } else if (toolCall.name === 'retrieve_member_benefits') {
                finalResponse = `尊敬的 ${toolResult.level} 會員，您的專屬權益如下：\n• **折扣：** ${toolResult.benefits.折扣}\n• **延遲退房：** ${toolResult.benefits.延遲退房}。`;
            } else if (toolCall.name === 'search_attractions_and_facilities') {
                finalResponse = `好的，為您推薦 ${toolResult.results.join('、')}。請注意，港灣夜市步行僅需 5 分鐘！`;
            }

            console.log(`\n[💬 AI 助理最終回覆]:\n${finalResponse}`);

        } else {
            console.error(`\n[❌ 錯誤] 伺服器未實作工具: ${toolCall.name}`);
        }

    } else {
        // 步驟 D: Claude 直接回覆文本
        console.log(`\n[💬 AI 助理回覆]:\n${claudeDecision.text}`);
    }
}

// 啟動終端機互動
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion() {
    rl.question('\n請輸入您的需求 (輸入 exit 離開): ', async (answer) => {
        if (answer.toLowerCase() === 'exit') {
            rl.close();
            return;
        }
        await runChat(answer);
        askQuestion();
    });
}

askQuestion();

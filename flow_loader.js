const fs = require('fs');
const path = require('path');

class FlowConfigLoader {
    constructor(filePath) {
        this.filePath = filePath;
        // 確保配置在初始化時被載入
        this.DIALOGUE_FLOW = this.loadConfig();
    }

    getFlow() {
        return this.DIALOGUE_FLOW;
    }

    loadConfig() {
        try {
            // 由於沒有提供 dialogue_flow.json 檔案內容，這裡直接使用 getDefaultConfig 作為唯一的配置來源
            // 如果您有外部檔案，請取消註釋以下程式碼
            /*
            const fullPath = path.join(__dirname, this.filePath);
            if (fs.existsSync(fullPath)) {
                const data = fs.readFileSync(fullPath, 'utf8');
                console.log(`🛠️ 成功載入外部配置：${this.filePath}`);
                return JSON.parse(data);
            }
            */
            
            console.warn(`⚠️ 配置檔案不存在或未啟用外部載入，使用預設配置: ${this.filePath}`);
            return this.getDefaultConfig();
        } catch (error) {
            console.error(`❌ 載入配置失敗，將使用預設配置: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    // 預設配置 (這部分是您原始程式碼中 FlowConfigLoader 的核心)
    getDefaultConfig() {
        return {
            "name": "FallbackBookingFlow",
            "initial_state": "init",
            "states": {
                "init": {
                    "prompt": "您好，歡迎使用 AI 訂房助理！請問您是想【預訂房間】還是【查詢資訊】呢？",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇服務類型：",
                        "buttons": [
                            { "text": "🛏️ 預訂房間", "value": "我要訂房" },
                            { "text": "ℹ️ 查詢資訊", "value": "我想查詢資訊" }
                        ]
                    },
                    "intents": {
                        "booking": "show_room_types",
                        "general_inquiry": "handle_general_inquiry"
                    },
                    "fallback": "抱歉，我沒聽懂您的意思，請告訴我是想預訂房間或查詢其他資訊？"
                },
                "show_room_types": {
                    "prompt": "我們有以下四種熱門房型：\n\n1. 標準雙人房 (NT$2,200)\n2. 豪華客房 (NT$3,200)\n3. 行政套房 (NT$4,800)\n4. 家庭四人房 (NT$4,500)\n\n請問您想預訂哪一種房型？",
                    "richCard": {
                        "type": "button_list",
                        "title": "請選擇房型：",
                        "buttons": [
                            { "text": "標準雙人房", "value": "標準雙人房" },
                            { "text": "豪華客房", "value": "豪華客房" },
                            { "text": "行政套房", "value": "行政套房" },
                            { "text": "家庭四人房", "value": "家庭四人房" }
                        ]
                    },
                    "entities": ["roomType"],
                    "next_state": "collect_room_and_dates",
                    "fallback": "請告訴我您想預訂的房型名稱，例如：豪華客房。"
                },
                "collect_room_and_dates": {
                    "prompt": "好的，您選擇了 {roomType}。請問預計【入住日期】和【住宿晚數】？ (例如：12月25日住3晚)",
                    "entities": ["checkInDate", "nights"],
                    "next_state": "ask_guest_count",
                    "fallback": "請提供入住日期及住宿晚數，我會為您查詢空房與價格。"
                },
                "ask_guest_count": {
                    "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住呢？ (例如：2大1小)",
                    "entities": ["adultCount", "childCount"],
                    "next_state": "confirm_booking", 
                    "fallback": "請提供大人及兒童的人數。"
                },
                "confirm_booking": {
                    "prompt": "請給我您的會員帳號，以享受會員折扣（可跳過）。",
                    "richCard": {
                        "type": "button_list",
                        "title": "是否有會員帳號？",
                        "buttons": [
                            { "text": "我要登入會員", "value": "我要登入會員" },
                            { "text": "暫不登入", "value": "暫不登入" }
                        ]
                    },
                    "intents": { 
                        "member_login": "login_member_account", 
                        "deny": "ask_contact_info"
                    },
                    "entities": ["memberAccount"],
                    "fallback": "請提供會員帳號或選擇暫不登入，我才能為您計算最終價格。"
                },
                "login_member_account": {
                    "prompt": "請輸入您的會員帳號/手機號碼：",
                    "entities": ["memberAccount"],
                    "next_state": "ask_contact_info",
                    "fallback": "請輸入您的會員帳號，或回覆『取消』結束流程。"
                },
                "ask_contact_info": {
                    "prompt": "請提供您的【訂房人姓名】及【聯絡 Email】，我將為您發送訂單確認信。",
                    "entities": ["name", "email"],
                    "next_state": "final_summary_and_payment",
                    "fallback": "請提供您的姓名和 Email，以確保訂房成功。"
                },
                "final_summary_and_payment": {
                    "prompt": "【最終確認】總價：NT$ {finalPrice}。請問是否確認訂房？",
                    "intents": { "affirm": "booking_complete", "deny": "end_conversation" },
                    "fallback": "請確認訂房資訊，並回答『確認』或『取消』。"
                },
                "booking_complete": { "prompt": "🎉 訂房完成！我們已將詳細資訊發送到您的 Email：{email}。", "end": true },
                "end_conversation": { "prompt": "感謝您的使用，期待您的下次光臨。", "end": true },
                "handle_general_inquiry": { "prompt": "請提供更多細節，我會盡力回答您。", "allow_gemini_call": true },
                "paused_waiting_for_resume": { "prompt": "流程已暫停，請回覆『繼續』或點擊按鈕恢復訂房。", "allow_gemini_call": true }
            }
        };
    }
}

module.exports = { FlowConfigLoader }; // 使用 CommonJS 導出

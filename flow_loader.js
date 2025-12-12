// flow_config_loader.js (V3.0 - 修正模組系統並內建完整流程)

import fs from 'fs';
import path from 'path';

// 🎯 修正：將 CommonJS 轉換為 ES Module 導出
export class FlowConfigLoader {
    constructor(filePath = './dialogue_flow.json') {
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
            
            // 💡 僅為參考：如果您在生產環境啟用外部檔案，需先處理 __dirname 在 ESM 中的問題
            // const fullPath = path.join(path.dirname(new URL(import.meta.url).pathname), this.filePath);
            // if (fs.existsSync(fullPath)) {
            //     const data = fs.readFileSync(fullPath, 'utf8');
            //     console.log(`🛠️ 成功載入外部配置：${this.filePath}`);
            //     return JSON.parse(data);
            // }
            
            console.warn(`⚠️ 配置檔案不存在或未啟用外部載入，使用預設 V8.3 完整流程配置。`);
            return this.getCompleteConfigV83(); // 載入完整的 V8.3 流程
        } catch (error) {
            console.error(`❌ 載入配置失敗，將使用預設 V8.3 完整流程配置: ${error.message}`);
            return this.getCompleteConfigV83();
        }
    }

    // --- 完整 V8.3 流程配置 (與 booking_controller.js 邏輯匹配) ---
    getCompleteConfigV83() {
        return {
            "name": "CompleteBookingFlowV83",
            "initial_state": "init",
            "states": {
                // 1. 流程起始
                "init": {
                    "prompt": "您好，歡迎使用 AI 訂房助理！請問您是想【預訂房間】還是【查詢資訊】呢？",
                    "richCard": { /* ... (Rich Card 定義不變) ... */ },
                    "intents": {
                        "booking": "ask_dates_and_nights", // 流程修正：直接收集日期
                        "general_inquiry": "handle_general_inquiry"
                    },
                    "fallback": "抱歉，請告訴我是想預訂房間或查詢其他資訊？"
                },

                // 2. 日期與晚數
                "ask_dates_and_nights": {
                    "prompt": "請問預計【入住日期】和【住宿晚數】？ (例如：12月25日住3晚)",
                    "entities": ["checkInDate", "nights"],
                    "next_state": "check_date_completeness", // 呼叫 Controller 檢查
                    "logic_exec": "BookingFlowController.checkDateCompleteness",
                    "fallback": "請提供入住日期及住宿晚數，我會為您查詢空房與價格。"
                },
                "check_date_completeness": { /* 虛擬狀態，由 logic_exec 推進 */ },

                // 3. 人數
                "ask_guest_count": {
                    "prompt": "感謝您！請問總共【幾位大人】和【幾位兒童】入住？ (例如：2大1小)",
                    "entities": ["adultCount", "childCount"],
                    "next_state": "set_default_child_count",
                    "fallback": "請提供大人及兒童的人數。"
                },
                "set_default_child_count": { // 處理 childCount 補齊 (0)
                    "logic_exec": "BookingFlowController.setDefaultChildCount"
                },

                // 4. 房型選擇
                "ask_room_type": {
                    "prompt": "我們有 標準雙人房, 豪華客房, 行政套房, 家庭四人房，請問您想預訂哪一種房型？",
                    "richCard": { /* ... (房型 Rich Card 定義) ... */ },
                    "entities": ["roomType", "roomCount"], // 允許同時收集房型和間數
                    "next_state": "check_booking_essentials",
                    "fallback": "請告訴我您想預訂的房型名稱，例如：豪華客房，並請告知間數。"
                },
                "check_booking_essentials": { // 檢查是否收集到所有基本資訊 (日期/房型/人數/間數)
                    "logic_exec": "BookingFlowController.checkBookingEssentials" 
                },

                // 5. 庫存與價格
                "lock_inventory": { // 鎖定庫存
                    "prompt": "正在為您確認庫存...",
                    "logic_exec": "BookingFlowController.lockInventory"
                },
                "calculate_price_logic": { // 價格計算 (初次/登入後)
                    "prompt": "正在計算價格與折扣...",
                    "logic_exec": "BookingFlowController.calculatePrice"
                },

                // 6. 會員登入流程
                "ask_member_login": {
                    "prompt": "請問您是否為會員？登入可享有 95 折優惠！",
                    "richCard": { /* ... (登入/註冊/跳過 Rich Card 定義) ... */ },
                    "intents": {
                        "member_login": "ask_member_account",
                        "member_register": "register_member_account",
                        "skip": "ask_addons"
                    },
                    "fallback": "請選擇登入、註冊或跳過。"
                },
                "ask_member_account": {
                    "prompt": "請輸入您的會員帳號 (手機/Email)：",
                    "entities": ["memberAccount"],
                    "next_state": "ask_member_password",
                    "fallback": "請輸入您的會員帳號。"
                },
                "ask_member_password": {
                    "prompt": "請輸入密碼 (數字)：",
                    "entities": ["rawNumber"], // 使用 rawNumber 實體來收集密碼
                    "next_state": "login_member_account",
                    "fallback": "請輸入您的會員密碼。"
                },
                "login_member_account": {
                    "logic_exec": "BookingFlowController.loginMemberAccount"
                },
                "register_member_account": {
                    "prompt": "請輸入您想註冊的帳號 (手機/Email)：",
                    "entities": ["memberAccount"],
                    "logic_exec": "BookingFlowController.registerMemberAccount"
                },

                // 7. 加購服務流程
                "ask_addons": {
                    "prompt": "您目前價格為 NT$ {finalPrice}。您是否需要加購服務？",
                    "logic_exec": "BookingFlowController.generateAddonsCarousel", // 生成 Rich Card
                    "entities": ["addonAction", "addonId"], // 收集加購指令
                    "next_state": "execute_addons_selection",
                    "intents": { "affirm": "execute_addons_selection", "deny": "ask_contact_info" },
                    "fallback": "請選擇加購服務或回覆「完成」進入下一步。"
                },
                "execute_addons_selection": {
                    "logic_exec": "BookingFlowController.executeAddonsSelection"
                },
                "calculate_price_logic_after_addons": { // 加購後價格重算
                    "logic_exec": "BookingFlowController.calculatePriceAfterAddons"
                },

                // 8. 聯絡人與特殊需求
                "ask_contact_info": {
                    "prompt": "請提供您的【訂房人姓名】、【聯絡電話】及【聯絡 Email】。",
                    "entities": ["contactName", "contactPhone", "contactEmail"],
                    "next_state": "validate_contact_info",
                    "fallback": "請提供完整的姓名、電話和 Email。"
                },
                "validate_contact_info": {
                    "logic_exec": "BookingFlowController.validateContactInfo"
                },
                "ask_special_requests": {
                    "prompt": "您有任何【特殊需求】嗎？例如：高樓層、嬰兒床等，(可回覆「無」跳過)。",
                    "entities": ["specialRequest"],
                    "next_state": "ask_payment_method",
                    "fallback": "請告知您的特殊需求或回覆「無」。"
                },

                // 9. 付款與摘要
                "ask_payment_method": {
                    "prompt": "請選擇付款方式：",
                    "richCard": { /* ... (付款 Rich Card 定義) ... */ },
                    "entities": ["paymentMethod"],
                    "next_state": "generate_order_summary",
                    "fallback": "請選擇一種付款方式。"
                },
                "generate_order_summary": {
                    "logic_exec": "BookingFlowController.generateOrderSummary" // 生成摘要
                },
                "confirm_booking": {
                    "prompt": "請確認您的訂單摘要後，回覆「確認」送出訂單。",
                    "intents": {
                        "affirm": "submit_booking",
                        "correction": "ask_dates_and_nights", // 導回起點修改
                        "cancel": "handle_cancellation"
                    },
                    "fallback": "請確認訂單或選擇修改/取消。"
                },

                // 10. 訂單提交與完成
                "submit_booking": {
                    "prompt": "正在為您提交訂單...",
                    "logic_exec": "BookingFlowController.submitBooking"
                },
                "booking_complete": {
                    "prompt": "🎉 訂單 ${orderId} 成立！\n最終價格 NT$ ${finalPrice}。\n${paymentMessage}\n\n感謝您的預訂！",
                    "end": true
                },
                "handle_cancellation": {
                    "logic_exec": "BookingFlowController.handleCancellation"
                },

                // 11. 通用查詢與容錯
                "handle_general_inquiry": {
                    "logic_exec": "BookingFlowController.processGeneralInquiry"
                },
                "general_inquiry_response": {
                    "prompt": "${llm_response} \n\n請問您想繼續訂房嗎？",
                    "intents": { "affirm": "ask_dates_and_nights", "deny": "end_conversation" },
                    "fallback": "抱歉，請告訴我是否要繼續訂房。"
                },
                "handle_llm_failure": { "prompt": "抱歉，查詢服務暫時故障。", "end": true },
                "end_conversation": { "prompt": "感謝您的使用，期待您的下次光臨。", "end": true }
            }
        };
    }
}
// 🎯 修正：使用 ES Module 命名導出
// export { FlowConfigLoader }; 
// 為了簡化您的 server.js 導入，使用 default export
export default FlowConfigLoader;

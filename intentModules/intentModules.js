// intentModules/intentModules.js
const IntentModules = {
  // 訂房模組
  BOOKING: {
    name: 'booking',
    description: '處理所有訂房相關意圖',
    patterns: {
      'booking_start': {
        weight: 0.9,
        patterns: ['訂房', '預訂', '預約', '訂房間', '我要住', '想住', '有空房嗎', '想要訂'],
        entities: ['date', 'number', 'room_type'],
        nextSteps: ['ask_checkInDate'],
        responses: {
          success: '🏨 太好了！讓我為您安排訂房，請告訴我入住日期？',
          fallback: '請問您想預訂什麼房型？'
        }
      },
      'booking_inquiry': {
        weight: 0.8,
        patterns: ['有空房', '有房間嗎', '可以訂嗎', '能預訂嗎', '查詢空房'],
        entities: ['date', 'room_type'],
        nextSteps: ['check_availability'],
        responses: {
          success: '🔍 正在為您查詢空房情況...',
          fallback: '請問您要查詢哪個日期的空房？'
        }
      },
      'booking_modify': {
        weight: 0.7,
        patterns: ['修改訂房', '更改預訂', '改日期', '換房型', '修正訂單', '想改一下'],
        entities: ['booking_reference'],
        nextSteps: ['modify_booking'],
        responses: {
          success: '🛠️ 請告訴我要修改什麼內容？',
          fallback: '請提供訂單編號或要修改的項目'
        }
      },
      'booking_cancel': {
        weight: 0.8,
        patterns: ['取消訂房', '退訂', '不要了', '取消預訂', '取消訂單'],
        entities: ['booking_reference'],
        nextSteps: ['cancel_booking'],
        responses: {
          success: '❌ 確認取消訂房，請提供訂單編號...',
          fallback: '請提供要取消的訂單編號'
        }
      }
    },
    entities: {
      'date': {
        patterns: [
          { regex: /\d{4}-\d{2}-\d{2}/, type: 'iso_date' },
          { regex: /\d{1,2}\/\d{1,2}/, type: 'simple_date' },
          { regex: /\d{1,2}月\d{1,2}[號日]/, type: 'chinese_date' },
          { regex: /(今天|明天|後天)/, type: 'relative_date' }
        ]
      },
      'room_type': {
        patterns: [
          { regex: /標準雙人房|標準房/, value: '標準雙人房' },
          { regex: /豪華雙人房|豪華房/, value: '豪華雙人房' },
          { regex: /豪華家庭房|家庭房/, value: '豪華家庭房' },
          { regex: /行政套房|套房/, value: '行政套房' }
        ]
      },
      'number': {
        patterns: [
          { regex: /\d+/, type: 'number' }
        ]
      }
    }
  },

  // 會員模組
  MEMBER: {
    name: 'member',
    description: '處理會員相關意圖',
    patterns: {
      'member_login': {
        weight: 0.9,
        patterns: ['登入會員', '會員登入', '我要登入', '登入帳號', '會員登錄'],
        entities: ['phone', 'member_id'],
        nextSteps: ['ask_member_phone'],
        responses: {
          success: '🔐 請輸入您的手機號碼進行會員登入...',
          fallback: '請提供會員手機號碼或帳號'
        }
      },
      'member_benefits': {
        weight: 0.8,
        patterns: ['會員優惠', '會員折扣', '會員有什麼好處', 'VIP優惠', '會員權益'],
        entities: [],
        nextSteps: ['show_member_benefits'],
        responses: {
          success: '💎 為您介紹會員專屬權益：\n• 房價9折優惠\n• 免費早餐\n• 積分累積\n• 優先入住',
          fallback: '會員可享9折優惠和積分累積'
        }
      },
      'member_points': {
        weight: 0.7,
        patterns: ['我的積分', '積分查詢', '有多少點數', '會員點數', '點數餘額'],
        entities: [],
        nextSteps: ['check_member_points'],
        responses: {
          success: '📊 正在查詢您的積分餘額...',
          fallback: '請先登入會員帳號查詢積分'
        }
      },
      'member_register': {
        weight: 0.6,
        patterns: ['註冊會員', '加入會員', '申請會員', '辦會員', '成為會員'],
        entities: ['phone', 'name'],
        nextSteps: ['start_member_registration'],
        responses: {
          success: '📝 開始會員註冊流程，請提供手機號碼...',
          fallback: '請提供手機號碼開始註冊會員'
        }
      }
    },
    entities: {
      'phone': {
        patterns: [
          { regex: /09\d{8}/, type: 'mobile' },
          { regex: /\d{4}-\d{3}-\d{3}/, type: 'formatted_phone' }
        ]
      }
    }
  },

  // 查詢模組
  INQUIRY: {
    name: 'inquiry',
    description: '處理各類查詢意圖',
    patterns: {
      'pricing_inquiry': {
        weight: 0.9,
        patterns: ['價格', '價錢', '多少錢', '費用', '房價', '貴不貴', '怎麼算'],
        entities: ['room_type', 'date'],
        nextSteps: ['show_pricing'],
        responses: {
          success: '💰 為您查詢價格資訊...',
          fallback: '請問您想了解哪種房型的價格？'
        }
      },
      'facility_inquiry': {
        weight: 0.8,
        patterns: ['設施', '設備', '有什麼設施', '泳池', '健身房', 'SPA', '溫泉'],
        entities: ['facility_type'],
        nextSteps: ['show_facilities'],
        responses: {
          success: '🏊 為您介紹飯店設施：\n• 室外泳池 (07:00-22:00)\n• 24小時健身房\n• SPA水療中心\n• 商務中心',
          fallback: '我們有泳池、健身房、SPA等多種設施'
        }
      },
      'restaurant_inquiry': {
        weight: 0.8,
        patterns: ['餐廳', '美食', '吃什麼', '推薦餐廳', '早餐', '晚餐', '午餐'],
        entities: ['cuisine_type'],
        nextSteps: ['show_restaurants'],
        responses: {
          success: '🍽️ 為您推薦餐廳：\n• 自助餐廳 (06:30-22:00)\n• 頂樓景觀餐廳\n• 日式料理亭',
          fallback: '我們有多家餐廳可供選擇'
        }
      },
      'location_inquiry': {
        weight: 0.7,
        patterns: ['附近', '周邊', '旁邊', '周圍有什麼', '哪裡有', '周邊環境'],
        entities: ['location_type'],
        nextSteps: ['show_nearby'],
        responses: {
          success: '📍 為您介紹周邊環境：\n• 美麗華摩天輪 (0.5km)\n• 士林夜市 (2km)\n• 故宮博物院 (3km)',
          fallback: '附近有購物中心、景點和餐廳'
        }
      },
      'transport_inquiry': {
        weight: 0.7,
        patterns: ['交通', '怎麼去', '如何到', '接送', '接駁車', '機場接送'],
        entities: ['transport_type'],
        nextSteps: ['show_transport'],
        responses: {
          success: '🚗 為您提供交通資訊：\n• 捷運劍南路站 (0.3km)\n• 機場接送服務\n• 免費接駁車',
          fallback: '我們提供機場接送和接駁車服務'
        }
      }
    },
    entities: {
      'facility_type': {
        patterns: [
          { regex: /泳池|游泳池/, value: 'pool' },
          { regex: /健身|健身房/, value: 'gym' },
          { regex: /SPA|水療/, value: 'spa' },
          { regex: /餐廳|美食/, value: 'restaurant' }
        ]
      },
      'cuisine_type': {
        patterns: [
          { regex: /中式|中餐/, value: 'chinese' },
          { regex: /西式|西餐/, value: 'western' },
          { regex: /日式|日本料理/, value: 'japanese' },
          { regex: /海鮮/, value: 'seafood' }
        ]
      }
    }
  },

  // 服務模組
  SERVICE: {
    name: 'service',
    description: '處理附加服務意圖',
    patterns: {
      'transport_service': {
        weight: 0.9,
        patterns: ['接送', '接機', '送機', '機場接送', '交通服務', '預約接送'],
        entities: ['location', 'time'],
        nextSteps: ['arrange_transport'],
        responses: {
          success: '🚗 為您安排接送服務，請告訴我接送的時間和地點？',
          fallback: '請告訴我接送的時間和地點'
        }
      },
      'breakfast_service': {
        weight: 0.7,
        patterns: ['早餐', '含早餐', '加早餐', '要吃早餐', '訂早餐'],
        entities: [],
        nextSteps: ['add_breakfast'],
        responses: {
          success: '🍳 為您添加早餐服務，費用為每人200元',
          fallback: '早餐費用為每人200元'
        }
      },
      'special_request': {
        weight: 0.6,
        patterns: ['無菸房', '高樓層', '景觀房', '嬰兒床', '提早入住', '延遲退房'],
        entities: ['request_type'],
        nextSteps: ['process_special_request'],
        responses: {
          success: '🎯 已記錄您的特殊需求，我們會盡量安排',
          fallback: '我們會盡量安排您的要求'
        }
      }
    }
  }
};

module.exports = IntentModules;

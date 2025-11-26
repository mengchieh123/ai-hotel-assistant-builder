const fs = require('fs');

// 讀取當前的 intentModules.js
let content = fs.readFileSync('./intentModules/intentModules.js', 'utf8');

// 更新模組配置，添加繁體中文關鍵詞
const updatedContent = content.replace(/moduleConfig\s*=\s*{/, `moduleConfig = {
  booking: {
    keywords: {
      'en': ['book', 'reservation', 'reserve', 'room', 'stay', 'check in', 'check-out'],
      'zh-tw': ['訂房', '預訂', '預定', '房間', '入住', '退房', '我要訂', '訂一晚', '住宿']
    },
    intents: {
      'booking_start': { keywords: { 'en': ['book', 'reserve'], 'zh-tw': ['訂房', '預訂', '預定'] }, nextSteps: ['ask_checkInDate'] },
      'booking_inquiry': { keywords: { 'en': ['availability', 'room types'], 'zh-tw': ['有空房', '房型', '可訂'] }, nextSteps: ['show_room_types'] }
    }
  },
  member: {
    keywords: {
      'en': ['member', 'login', 'points', 'reward', 'loyalty'],
      'zh-tw': ['會員', '登入', '登錄', '積分', '點數', '獎勵', '會員卡', 'VIP']
    },
    intents: {
      'member_login': { keywords: { 'en': ['login', 'sign in'], 'zh-tw': ['登入', '登錄', '會員登入'] }, nextSteps: ['ask_member_phone'] },
      'member_points': { keywords: { 'en': ['points', 'reward'], 'zh-tw': ['積分', '點數', '會員積分'] }, nextSteps: ['show_member_points'] }
    }
  },
  inquiry: {
    keywords: {
      'en': ['price', 'cost', 'how much', 'restaurant', 'facility', 'pool', 'gym', 'breakfast'],
      'zh-tw': ['價格', '多少錢', '價錢', '餐廳', '設施', '游泳池', '健身房', '早餐', '開放時間', '營業時間']
    },
    intents: {
      'pricing_inquiry': { keywords: { 'en': ['price', 'how much', 'cost'], 'zh-tw': ['價格', '多少錢', '價目'] }, nextSteps: ['show_pricing'] },
      'restaurant_inquiry': { keywords: { 'en': ['restaurant', 'food', 'dining'], 'zh-tw': ['餐廳', '吃飯', '用餐', '美食'] }, nextSteps: ['show_restaurants'] },
      'facility_inquiry': { keywords: { 'en': ['facility', 'pool', 'gym', 'spa'], 'zh-tw': ['設施', '游泳池', '健身房', 'SPA'] }, nextSteps: ['show_facilities'] },
      'location_inquiry': { keywords: { 'en': ['nearby', 'around', 'location'], 'zh-tw': ['附近', '周圍', '周邊', '哪裡'] }, nextSteps: ['show_nearby'] }
    }
  },
  service: {
    keywords: {
      'en': ['wake up', 'call', 'service', 'room service', 'housekeeping'],
      'zh-tw': ['叫醒', '服務', '客房服務', '打掃', '清潔', '喚醒', '晨喚']
    },
    intents: {
      'wakeup_call': { keywords: { 'en': ['wake up', 'call'], 'zh-tw': ['叫醒', '喚醒', 'morning call'] }, nextSteps: ['ask_wakeup_time'] },
      'room_service': { keywords: { 'en': ['room service'], 'zh-tw': ['客房服務', '送餐'] }, nextSteps: ['ask_room_service'] }
    }
  },`);

fs.writeFileSync('./intentModules/intentModules.js', updatedContent);
console.log('✅ 已添加繁體中文關鍵詞支援');

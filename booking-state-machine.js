// 狀態機核心類別
class BookingStateMachine {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.currentState = 'initial';
    this.context = {
      sessionId: sessionId,
      selectedRoom: null,
      roomPrice: 0,
      checkIn: '',
      checkOut: '',
      nights: 0,
      adults: 2,
      children: 0,
      total: 0,
      guestInfo: {},
      lastUpdated: new Date()
    };
  }

  async processUserInput(userInput) {
    this.context.lastUpdated = new Date();
    const intent = this.recognizeIntent(userInput);
    return this.transitionState(intent, userInput);
  }

  recognizeIntent(userInput) {
    const input = userInput.toLowerCase();
    if (input.includes('訂房') || input.includes('預訂')) return 'booking';
    if (input.includes('取消')) return 'cancel';
    if (input.includes('價格') || input.includes('多少錢')) return 'price_inquiry';
    if (input.includes('房型') || input.includes('房間')) return 'room_selection';
    if (input.includes('日期')) return 'date_input';
    if (input.includes('人') || input.includes('大') || input.includes('小')) return 'guest_count';
    if (input.includes('確認') || input.includes('好') || input.includes('是')) return 'confirm';
    if (input.includes('修改')) return 'modify';
    return 'general_inquiry';
  }

  transitionState(intent, userInput) {
    switch (this.currentState) {
      case 'initial':
        return this.handleInitialState(intent, userInput);
      case 'room_selection':
        return this.handleRoomSelection(intent, userInput);
      case 'date_confirmation':
        return this.handleDateConfirmation(intent, userInput);
      case 'guest_confirmation':
        return this.handleGuestConfirmation(intent, userInput);
      case 'price_confirmation':
        return this.handlePriceConfirmation(intent, userInput);
      default:
        return this.getFallbackResponse();
    }
  }

  handleInitialState(intent, userInput) {
    if (intent === 'booking') {
      this.currentState = 'room_selection';
      return {
        success: true,
        response: "🏨 歡迎使用AI訂房助理！請選擇房型：\n\n1. 豪華雙人房 - $3,600/晚\n2. 標準雙人房 - $2,800/晚",
        state: this.currentState
      };
    }
    return this.getFallbackResponse();
  }

  handleRoomSelection(intent, userInput) {
    if (userInput.includes('豪華') || userInput.includes('1')) {
      this.context.selectedRoom = '豪華雙人房';
      this.context.roomPrice = 3600;
    } else if (userInput.includes('標準') || userInput.includes('2')) {
      this.context.selectedRoom = '標準雙人房';
      this.context.roomPrice = 2800;
    } else {
      return {
        success: false,
        response: "抱歉，請選擇「豪華雙人房」或「標準雙人房」？",
        state: this.currentState
      };
    }

    this.currentState = 'date_confirmation';
    return {
      success: true,
      response: `✅ 已選擇「${this.context.selectedRoom}」！\n請提供入住日期（格式：YYYY-MM-DD），例如：2025-02-10`,
      state: this.currentState
    };
  }

  handleDateConfirmation(intent, userInput) {
    const dateMatch = userInput.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      this.context.checkIn = dateMatch[0];
      this.context.nights = 2; // 預設2晚
      this.context.checkOut = this.addDays(this.context.checkIn, this.context.nights);
      this.currentState = 'guest_confirmation';
      return {
        success: true,
        response: `📅 日期確認：${this.context.checkIn} 至 ${this.context.checkOut}（${this.context.nights}晚）\n請問入住人數是幾位大人、幾位小孩？`,
        state: this.currentState
      };
    }
    return {
      success: false,
      response: "請提供正確日期格式，例如：2025-02-10",
      state: this.currentState
    };
  }

  handleGuestConfirmation(intent, userInput) {
    const adultMatch = userInput.match(/(\d+)大/) || userInput.match(/(\d+)位大人/);
    const childMatch = userInput.match(/(\d+)小/) || userInput.match(/(\d+)位小孩/);
    
    this.context.adults = adultMatch ? parseInt(adultMatch[1]) : 2;
    this.context.children = childMatch ? parseInt(childMatch[1]) : 0;
    
    this.currentState = 'price_confirmation';
    this.calculateTotalPrice();
    
    return {
      success: true,
      response: this.getPriceConfirmationResponse(),
      state: this.currentState
    };
  }

  handlePriceConfirmation(intent, userInput) {
    if (intent === 'confirm') {
      this.currentState = 'completed';
      return {
        success: true,
        response: "✅ 預訂流程完成！請提供訂房人資訊：姓名、電話、電子郵件",
        state: this.currentState
      };
    }
    return {
      success: false,
      response: "請回覆「確認」繼續預訂，或告訴我您想修改什麼？",
      state: this.currentState
    };
  }

  addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  calculateTotalPrice() {
    this.context.total = this.context.roomPrice * this.context.nights;
  }

  getPriceConfirmationResponse() {
    return `💰 價格總結：\n\n□ ${this.context.selectedRoom} × ${this.context.nights}晚: $${this.context.total.toLocaleString()}\n□ 總計: $${this.context.total.toLocaleString()}\n\n請問要繼續預訂嗎？`;
  }

  getFallbackResponse() {
    return {
      success: true,
      response: "您好！我是AI訂房助理，可以協助您預訂房間、查詢房型與價格。請問需要什麼服務？",
      state: this.currentState
    };
  }
}

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new BookingStateMachine(sessionId));
    }
    return this.sessions.get(sessionId);
  }
}

module.exports = { BookingStateMachine, SessionManager };

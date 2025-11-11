// services/bookingService.js
class BookingService {
  constructor() {
    this.bookings = new Map();
    this.bookingCount = 0;
  }

  async createBooking(bookingData) {
    try {
<<<<<<< HEAD
      const {
        checkInDate,
        nights,
        roomType,
        guestCount = 1,
        guestName = '待提供',  // 添加預設值
        contactInfo,
        specialRequests = [],
        memberLevel = 'none',
        promoCode
      } = bookingData;

      // 修正驗證邏輯 - 只驗證真正必要的欄位
      if (!checkInDate || !nights || !roomType) {
        throw new Error('缺少必要欄位: checkInDate, nights, roomType');
=======
      const requiredFields = [
        'checkInDate',
        'nights',
        'roomType',
        'guestName',
        'contactInfo',
        'paymentMethod',
        'totalPrice',
        'currency'
      ];

      for (const field of requiredFields) {
        if (
          !bookingData.hasOwnProperty(field) ||
          bookingData[field] === null ||
          bookingData[field] === undefined ||
          (typeof bookingData[field] === 'object' && Object.keys(bookingData[field]).length === 0)
        ) {
          throw new Error(`缺少必要欄位: ${field}`);
        }
      }

      // 聯絡資訊進一步驗證
      const contactInfo = bookingData.contactInfo;
      if (!contactInfo.phone || !contactInfo.email) {
        throw new Error('contactInfo 欄位中 phone 和 email 為必填');
      }

      // 模擬房態檢查，請替換為實際的房態服務邏輯
      const roomAvailable = await this.checkRoomAvailability(
        bookingData.checkInDate,
        bookingData.nights,
        bookingData.roomType
      );

      if (!roomAvailable) {
        throw new Error('抱歉，所選房型無可用房間');
      }

      // 模擬促銷代碼驗證及折扣計算
      let discount = 0;
      if (bookingData.promoCode) {
        discount = await this.calculatePromoDiscount(bookingData.promoCode, bookingData.totalPrice);
      }

      const finalPrice = bookingData.totalPrice - discount;
      if (finalPrice < 0) {
        throw new Error('計算的最終價格錯誤，請檢查促銷代碼與價格');
>>>>>>> 9d501fbf74e1d7c1aba1b466d4779b65dad9b84b
      }

      // 生成訂房ID
      this.bookingCount++;
      const bookingId = `BKG-${Date.now()}-${String(this.bookingCount).padStart(6, '0')}`;

      const booking = {
        id: bookingId,
<<<<<<< HEAD
        checkInDate,
        nights,
        roomType,
        guestCount,
        guestName,  // 使用預設值
        contactInfo: contactInfo || '未提供',
        specialRequests,
        memberLevel,
        promoCode,
=======
        checkInDate: bookingData.checkInDate,
        nights: bookingData.nights,
        roomType: bookingData.roomType,
        guestCount: bookingData.guestCount || 1,
        guestName: bookingData.guestName,
        contactInfo,
        specialRequests: bookingData.specialRequests || [],
        memberLevel: bookingData.memberLevel || 'none',
        promoCode: bookingData.promoCode || null,
        paymentMethod: bookingData.paymentMethod,
        totalPrice: bookingData.totalPrice,
        discount,
        finalPrice,
        currency: bookingData.currency,
>>>>>>> 9d501fbf74e1d7c1aba1b466d4779b65dad9b84b
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 儲存訂房
      this.bookings.set(bookingId, booking);

      console.log(`✅ 訂房建立成功: ${bookingId}`);

      return {
        success: true,
        bookingId,
        booking,
        message: '訂房建立成功',
      };

    } catch (error) {
      console.error('❌ 訂房服務錯誤:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async checkRoomAvailability(checkInDate, nights, roomType) {
    // 假設整合 roomStatusService 的邏輯
    // 現在模擬永遠有房
    console.log(`檢查 ${roomType} 從 ${checkInDate} 起住 ${nights} 晚的可用性`);
    return true;
  }

  async calculatePromoDiscount(promoCode, totalPrice) {
    // 模擬促銷代碼驗證
    const validPromoCodes = {
      "DISCOUNT10": 0.1,
      "HOLIDAY20": 0.2
    };

    if (promoCode in validPromoCodes) {
      return totalPrice * validPromoCodes[promoCode];
    }
    console.warn(`無效促銷代碼: ${promoCode}`);
    return 0;
  }

  async getBooking(bookingId) {
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) throw new Error('訂房不存在');
      return { success: true, booking };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelBooking(bookingId) {
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) throw new Error('訂房不存在');
      if (booking.status === 'cancelled') throw new Error('訂房已取消');

      booking.status = 'cancelled';
      booking.updatedAt = new Date().toISOString();

      console.log(`✅ 訂房已取消: ${bookingId}`);

      return {
        success: true,
        booking,
        message: '訂房已取消',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async listBookings() {
    const bookings = Array.from(this.bookings.values());
    return {
      success: true,
      bookings,
      total: bookings.length,
    };
  }
}

module.exports = new BookingService();

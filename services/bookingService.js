// services/bookingService.js
class BookingService {
  constructor() {
    this.bookings = new Map();
    this.bookingCount = 0;
  }

  async createBooking(bookingData) {
    try {
      const {
        checkInDate,
        nights,
        roomType,
        guestCount = 1,
        guestName,
        contactInfo,
        specialRequests = [],
        memberLevel = 'none',
        promoCode
      } = bookingData;

      if (!checkInDate || !nights || !roomType) {
        throw new Error('缺少必要欄位: checkInDate, nights, roomType');
      }

      this.bookingCount++;
      const bookingId = `BKG-${Date.now()}-${this.bookingCount.toString().padStart(6, '0')}`;

      const booking = {
        id: bookingId,
        checkInDate,
        nights,
        roomType,
        guestCount,
        guestName: guestName || '未提供',
        contactInfo: contactInfo || '未提供',
        specialRequests,
        memberLevel,
        promoCode,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.bookings.set(bookingId, booking);
      
      console.log(`✅ 訂房建立成功: ${bookingId}`);
      
      return {
        success: true,
        bookingId,
        booking,
        message: '訂房建立成功'
      };

    } catch (error) {
      console.error('❌ 訂房服務錯誤:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBooking(bookingId) {
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) {
        throw new Error('訂房不存在');
      }
      
      return {
        success: true,
        booking
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelBooking(bookingId) {
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) {
        throw new Error('訂房不存在');
      }

      if (booking.status === 'cancelled') {
        throw new Error('訂房已取消');
      }

      booking.status = 'cancelled';
      booking.updatedAt = new Date().toISOString();
      
      console.log(`✅ 訂房已取消: ${bookingId}`);
      
      return {
        success: true,
        booking,
        message: '訂房已取消'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listBookings() {
    const bookings = Array.from(this.bookings.values());
    return {
      success: true,
      bookings,
      total: bookings.length
    };
  }
}

module.exports = new BookingService();

const pricingService = require('./pricingService');
const roomStatusService = require('./roomStatusService');
const complianceService = require('./complianceService');

class BookingService {
    constructor() {
        this.bookings = new Map();
        this.bookingCounter = 1000;
    }

    static needChildInfo(message, bookingData = {}) {
        return (message.includes('小孩') || message.includes('兒童') ||
                (bookingData.children && bookingData.children.length > 0));
    }

    static needSeniorInfo(message, bookingData = {}) {
        return (message.includes('老人') || message.includes('年長者') || message.includes('長者') ||
                (bookingData.seniors && bookingData.seniors.length > 0));
    }

    async createBooking(bookingData, message = '') {
        try {
            if (BookingService.needChildInfo(message, bookingData) && !bookingData.childAges) {
                return {
                    success: false,
                    nextStep: 'collect_child_ages',
                    message: '請問同行小孩的年齡分別是多少？兒童收費標準依年齡有所不同，請輸入所有小孩年齡。'
                };
            }
            if (BookingService.needSeniorInfo(message, bookingData) && !bookingData.seniorAges) {
                return {
                    success: false,
                    nextStep: 'collect_senior_ages',
                    message: '請問同行長者的年齡？65歲以上可享特殊優惠，請輸入所有長者年齡。'
                };
            }

            const { checkInDate, nights, roomType, guestCount, guestName, memberLevel, promoCode, childAges, seniorAges } = bookingData;

            if (!checkInDate || !nights || !roomType || !guestCount || !guestName) {
                return {
                    success: false,
                    error: '缺少必要參數',
                    message: '請提供完整的訂房資訊 (checkInDate, nights, roomType, guestCount, guestName)'
                };
            }

            const complianceCheck = complianceService.validateBookingCompliance({
                guestCount,
                roomType,
                checkInDate,
                customerInfo: { name: guestName }
            });

            if (!complianceCheck.compliant) {
                return {
                    success: false,
                    error: '合規檢查失敗',
                    issues: complianceCheck.issues,
                    message: complianceCheck.issues.join(', ')
                };
            }

            const availability = roomStatusService.checkAvailability(roomType, checkInDate, checkInDate, 1);
            if (!availability.available) {
                return {
                    success: false,
                    error: '房間不可用',
                    details: availability,
                    message: '選擇的房型在指定日期不可用'
                };
            }

            // 傳入childAges及seniorAges協助價格計算
            const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel, { childAges, seniorAges });
            if (!priceResult.success) {
                return {
                    success: false,
                    error: '價格計算失敗',
                    details: priceResult,
                    message: '無法計算價格，請確認房型資訊'
                };
            }

            let finalPricing = priceResult.pricing;
            if (promoCode) {
                try {
                    const promoService = require('./promotionService');
                    const promoValidation = promoService.validatePromoCode(promoCode, finalPricing.totalPrice, nights);
                    if (promoValidation.valid) {
                        const promoResult = promoService.applyPromotion(finalPricing.totalPrice, promoValidation.promotion);
                        finalPricing.finalPrice = promoResult.finalPrice;
                        finalPricing.discountAmount = promoResult.discountAmount;
                        finalPricing.originalPrice = promoResult.originalPrice;
                    }
                } catch (promoError) {
                    console.log("⚠️ 促銷代碼處理失敗:", promoError.message);
                }
            }

            const bookingId = 'BKG-' + this.bookingCounter++;
            const booking = {
                bookingId,
                status: 'confirmed',
                createdAt: new Date().toISOString(),
                customer: {
                    name: guestName,
                    guestCount,
                    childAges,
                    seniorAges
                },
                stay: {
                    checkIn: checkInDate,
                    nights,
                    roomType
                },
                pricing: finalPricing,
                paymentStatus: 'pending'
            };

            this.bookings.set(bookingId, booking);

            const blockResult = roomStatusService.blockRooms(roomType, 1, bookingId);
            if (!blockResult.success) {
                console.log("⚠️ 房間鎖定失敗:", blockResult.error);
            }

            console.log("✅ 訂房成功建立:", bookingId);

            return {
                success: true,
                bookingId,
                message: '訂房成功',
                bookingDetails: booking
            };

        } catch (error) {
            console.error('❌ 訂房處理錯誤:', error);
            return {
                success: false,
                error: '訂房處理失敗',
                message: error.message
            };
        }
    }

    async getBooking(bookingId) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單'
                };
            }
            return {
                success: true,
                booking
            };
        } catch (error) {
            return {
                success: false,
                error: '查詢訂單失敗',
                message: error.message
            };
        }
    }

    async cancelBooking(bookingId) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單'
                };
            }

            if (booking.status === 'cancelled') {
                return {
                    success: false,
                    error: '訂單已取消',
                    message: '此訂單已經取消'
                };
            }

            booking.status = 'cancelled';
            booking.cancelledAt = new Date().toISOString();

            const releaseResult = roomStatusService.releaseRooms(bookingId);
            if (!releaseResult.success) {
                console.log("⚠️ 房間釋放失敗:", releaseResult.error);
            }

            if (booking.paymentStatus === 'paid') {
                try {
                    const paymentService = require('./paymentService');
                    const refundResult = await paymentService.refundPayment(booking.paymentId, booking.pricing.totalPrice);
                    if (refundResult.success) {
                        booking.paymentStatus = 'refunded';
                    }
                } catch (refundError) {
                    console.log("⚠️ 退款處理失敗:", refundError.message);
                }
            }

            return {
                success: true,
                message: '訂單取消成功',
                booking
            };

        } catch (error) {
            return {
                success: false,
                error: '取消訂單失敗',
                message: error.message
            };
        }
    }

    async updateBooking(bookingId, updates) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單'
                };
            }

            const allowedUpdates = ['guestCount', 'specialRequests'];
            const updatedFields = {};

            for (const [key, value] of Object.entries(updates)) {
                if (allowedUpdates.includes(key)) {
                    booking.customer[key] = value;
                    updatedFields[key] = value;
                }
            }

            booking.updatedAt = new Date().toISOString();

            return {
                success: true,
                message: '訂單更新成功',
                updatedFields,
                booking
            };
        } catch (error) {
            return {
                success: false,
                error: '更新訂單失敗',
                message: error.message
            };
        }
    }

    listBookings(filter = {}) {
        try {
            const allBookings = Array.from(this.bookings.values());
            
            let filteredBookings = allBookings;
            
            if (filter.status) {
                filteredBookings = filteredBookings.filter(b => b.status === filter.status);
            }
            
            if (filter.customerName) {
                filteredBookings = filteredBookings.filter(b => 
                    b.customer.name && b.customer.name.includes(filter.customerName)
                );
            }

            return {
                success: true,
                count: filteredBookings.length,
                bookings: filteredBookings
            };
        } catch (error) {
            return {
                success: false,
                error: '查詢訂單列表失敗',
                message: error.message
            };
        }
    }
}

module.exports = new BookingService();

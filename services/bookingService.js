// 訂房服務 - 最終修復版本
const pricingService = require('./pricingService');
const roomStatusService = require('./roomStatusService');
const complianceService = require('./complianceService');

class BookingService {
    constructor() {
        this.bookings = new Map();
        this.bookingCounter = 1000;
    }

    /**
     * 偵測是否訊息包含小孩或老人詢問
     */
    static needChildInfo(message, bookingData = {}) {
        // BookingData 設計可根據實際需求補充 children/senior 資料
        return (message.includes('小孩') || message.includes('兒童') ||
                (bookingData.children && bookingData.children.length > 0));
    }
    static needSeniorInfo(message, bookingData = {}) {
        return (message.includes('老人') || message.includes('年長者') || message.includes('長者') ||
                (bookingData.seniors && bookingData.seniors.length > 0));
    }

    async createBooking(bookingData, message = '') {
        try {
            // 0. 偵測小孩年齡/年長者優惠
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

            // 1. 基本參數檢查
            if (!checkInDate || !nights || !roomType || !guestCount || !guestName) {
                return {
                    success: false,
                    error: '缺少必要參數',
                    message: '請提供完整的訂房資訊 (checkInDate, nights, roomType, guestCount, guestName)'
                };
            }

            // 2. 合規檢查
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

            // 3. 檢查房態
            const availability = roomStatusService.checkAvailability(roomType, checkInDate, checkInDate, 1);
            if (!availability.available) {
                return {
                    success: false,
                    error: '房間不可用',
                    details: availability,
                    message: '選擇的房型在指定日期不可用'
                };
            }

            // 4. 計算價格 - 加入小孩/長者的分級邏輯
            const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel, { childAges, seniorAges });
            if (!priceResult.success) {
                return {
                    success: false,
                    error: '價格計算失敗',
                    details: priceResult,
                    message: '無法計算價格，請確認房型資訊'
                };
            }

            // 5. 套用促銷（如果有的話）
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
                    // 促銷失敗不影響主要訂房流程
                }
            }

            // 6. 建立訂單
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

            // 7. 鎖定房間
            const blockResult = roomStatusService.blockRooms(roomType, 1, bookingId);
            if (!blockResult.success) {
                console.log("⚠️ 房間鎖定失敗:", blockResult.error);
                // 房間鎖定失敗，但訂單仍然建立
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

    // 其他 getBooking, cancelBooking, updateBooking, listBookings 內容同您原來的版本

}

module.exports = new BookingService();

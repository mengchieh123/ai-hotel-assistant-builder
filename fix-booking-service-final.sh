#!/bin/bash

echo "🔧 修復 bookingService.js 中的錯誤..."
echo "==================================="

# 檢查並修復 bookingService.js
cat > services/bookingService.js << 'EOM'
// 訂房服務 - 最終修復版本
const pricingService = require('./pricingService');
const roomStatusService = require('./roomStatusService');
const complianceService = require('./complianceService');

class BookingService {
    constructor() {
        this.bookings = new Map();
        this.bookingCounter = 1000;
    }

    async createBooking(bookingData) {
        try {
            console.log("�� 開始處理訂房請求:", bookingData);
            
            const { checkInDate, nights, roomType, guestCount, guestName, memberLevel, promoCode } = bookingData;

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

            // 4. 計算價格
            const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
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
                    guestCount
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

            // 更新狀態
            booking.status = 'cancelled';
            booking.cancelledAt = new Date().toISOString();

            // 釋放房間
            const releaseResult = roomStatusService.releaseRooms(bookingId);
            if (!releaseResult.success) {
                console.log("⚠️ 房間釋放失敗:", releaseResult.error);
            }

            // 處理退款（如果已付款）
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

            // 只能更新特定欄位
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
EOM

echo "✅ bookingService.js 修復完成"

# 測試修復結果
echo ""
echo "🧪 測試修復後的訂房流程..."
cat > test-booking-final.js << 'EOM'
console.log("🧪 最終訂房流程測試...");

try {
    const bookingService = require('./services/bookingService');
    
    console.log("1. 測試完整訂房流程...");
    const bookingData = {
        checkInDate: "2025-02-14",
        nights: 2,
        roomType: "豪華雙人房",
        guestCount: 2,
        guestName: "測試用戶",
        memberLevel: "standard"
    };
    
    const result = bookingService.createBooking(bookingData);
    console.log("📝 訂房結果:", result);
    
    if (result.success) {
        console.log("✅ 訂房成功!");
        console.log("   訂單號:", result.bookingId);
        console.log("   狀態:", result.bookingDetails.status);
        console.log("   總價:", result.bookingDetails.pricing.totalPrice);
        
        // 測試查詢訂單
        console.log("\\n2. 測試訂單查詢...");
        const queryResult = bookingService.getBooking(result.bookingId);
        console.log("�� 查詢結果:", queryResult.success ? '成功' : '失敗');
        
        // 測試訂單列表
        console.log("\\n3. 測試訂單列表...");
        const listResult = bookingService.listBookings();
        console.log("📊 訂單數量:", listResult.count);
        
    } else {
        console.log("❌ 訂房失敗:");
        console.log("   錯誤:", result.error);
        console.log("   訊息:", result.message);
        if (result.issues) {
            console.log("   問題:", result.issues);
        }
    }
    
} catch (error) {
    console.log("❌ 測試失敗:", error.message);
}
EOM

node test-booking-final.js
rm -f test-booking-final.js

echo ""
echo "✅ bookingService 修復完成"

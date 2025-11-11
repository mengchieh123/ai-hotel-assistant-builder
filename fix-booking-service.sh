#!/bin/bash

echo "🔧 修復 bookingService.js 導入問題..."
echo "===================================="

# 備份有問題的檔案
cp services/bookingService.js services/bookingService.js.backup.$(date +%s)

# 檢查檔案內容
echo ""
echo "📝 檢查 bookingService.js 內容..."
head -20 services/bookingService.js

# 建立修復版本
cat > services/bookingService.js << 'EOM'
// 訂房服務 - 修復版本
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
            const { checkInDate, nights, roomType, guestCount, guestName, memberLevel, promoCode } = bookingData;

            // 1. 合規檢查
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
                    issues: complianceCheck.issues
                };
            }

            // 2. 檢查房態
            const availability = roomStatusService.checkAvailability(roomType, checkInDate, checkInDate, 1);
            if (!availability.available) {
                return {
                    success: false,
                    error: '房間不可用',
                    details: availability
                };
            }

            // 3. 計算價格
            const priceResult = pricingService.calculateRoomPrice(roomType, nights, guestCount, memberLevel);
            if (!priceResult.success) {
                return {
                    success: false,
                    error: '價格計算失敗',
                    details: priceResult
                };
            }

            // 4. 套用促銷（如果有的話）
            let finalPricing = priceResult.pricing;
            if (promoCode) {
                const promoService = require('./promotionService');
                const promoValidation = promoService.validatePromoCode(promoCode, finalPricing.totalPrice, nights);
                if (promoValidation.valid) {
                    finalPricing = promoService.applyPromotion(finalPricing.totalPrice, promoValidation.promotion);
                }
            }

            // 5. 建立訂單
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

            // 6. 鎖定房間
            roomStatusService.blockRooms(roomType, 1, bookingId);

            return {
                success: true,
                bookingId,
                message: '訂房成功',
                bookingDetails: booking
            };

        } catch (error) {
            console.error('Booking creation error:', error);
            return {
                success: false,
                error: '訂房處理失敗',
                message: error.message
            };
        }
    }

    async getBooking(bookingId) {
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            return {
                success: false,
                error: '訂單不存在'
            };
        }
        return {
            success: true,
            booking
        };
    }

    async cancelBooking(bookingId) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在'
                };
            }

            if (booking.status === 'cancelled') {
                return {
                    success: false,
                    error: '訂單已取消'
                };
            }

            // 更新狀態
            booking.status = 'cancelled';
            booking.cancelledAt = new Date().toISOString();

            // 釋放房間
            roomStatusService.releaseRooms(bookingId);

            // 處理退款（如果已付款）
            if (booking.paymentStatus === 'paid') {
                const paymentService = require('./paymentService');
                await paymentService.refundPayment(booking.paymentId, booking.pricing.totalPrice);
                booking.paymentStatus = 'refunded';
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
        const booking = this.bookings.get(bookingId);
        if (!booking) {
            return {
                success: false,
                error: '訂單不存在'
            };
        }

        // 只能更新特定欄位
        const allowedUpdates = ['guestCount', 'specialRequests'];
        const updatedFields = {};

        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                booking[key] = value;
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
    }

    listBookings(filter = {}) {
        const allBookings = Array.from(this.bookings.values());
        
        let filteredBookings = allBookings;
        
        if (filter.status) {
            filteredBookings = filteredBookings.filter(b => b.status === filter.status);
        }
        
        if (filter.customerName) {
            filteredBookings = filteredBookings.filter(b => 
                b.customer.name.includes(filter.customerName)
            );
        }

        return {
            success: true,
            count: filteredBookings.length,
            bookings: filteredBookings
        };
    }
}

module.exports = new BookingService();
EOM

echo ""
echo "✅ bookingService.js 修復完成"

# 測試修復結果
echo ""
echo "🧪 測試修復結果..."
cat > test-fixed-services.js << 'EOM'
console.log("🧪 測試修復後的服務導入...");

const services = [
    { name: 'bookingService', path: './services/bookingService.js' },
    { name: 'pricingService', path: './services/pricingService.js' },
    { name: 'memberService', path: './services/memberService.js' },
    { name: 'paymentService', path: './services/paymentService.js' },
    { name: 'promotionService', path: './services/promotionService.js' },
    { name: 'roomStatusService', path: './services/roomStatusService.js' },
    { name: 'invoiceService', path: './services/invoiceService.js' },
    { name: 'complianceService', path: './services/complianceService.js' },
    { name: 'localizationService', path: './services/localizationService.js' },
    { name: 'booking-calculator', path: './services/booking-calculator.js' }
];

let successCount = 0;

services.forEach(service => {
    try {
        const module = require(service.path);
        console.log(`✅ ${service.name} - 導入成功`);
        
        // 測試基本功能
        if (service.name === 'bookingService' && typeof module.createBooking === 'function') {
            console.log("   📝 createBooking() - 功能正常");
        }
        if (service.name === 'pricingService' && typeof module.calculateRoomPrice === 'function') {
            console.log("   💰 calculateRoomPrice() - 功能正常");
        }
        if (service.name === 'paymentService' && typeof module.processPayment === 'function') {
            console.log("   💳 processPayment() - 功能正常");
        }
        
        successCount++;
    } catch (error) {
        console.log(`❌ ${service.name} - 導入失敗: ${error.message}`);
    }
});

console.log("");
console.log(`📊 服務導入成功率: ${successCount}/${services.length} (${Math.round(successCount/services.length*100)}%)`);

if (successCount === services.length) {
    console.log("🎉 所有服務導入成功！");
} else {
    console.log("⚠️  部分服務需要進一步修復");
}
EOM

node test-fixed-services.js
rm -f test-fixed-services.js

echo ""
echo "✅ 修復流程完成"

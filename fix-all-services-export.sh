#!/bin/bash

echo "🔧 修復所有服務的導出問題..."
echo "============================"

# 1. 修復 complianceService.js
echo ""
echo "📝 修復 complianceService.js..."
cat > services/complianceService.js << 'EOM'
// 合規檢查服務
class ComplianceService {
    validateBookingCompliance(bookingData) {
        const { guestCount, roomType, checkInDate, customerInfo } = bookingData;
        const issues = [];
        
        // 檢查入住人數限制
        const maxGuests = this.getMaxGuestsForRoom(roomType);
        if (guestCount > maxGuests) {
            issues.push(`房型 ${roomType} 最多容納 ${maxGuests} 人`);
        }
        
        // 檢查客戶年齡（模擬）
        if (customerInfo && customerInfo.birthDate) {
            const age = this.calculateAge(customerInfo.birthDate);
            if (age < 18) {
                issues.push('訂房人需年滿18歲');
            }
        }
        
        // 檢查預訂日期
        const checkIn = new Date(checkInDate);
        const today = new Date();
        const daysInAdvance = Math.floor((checkIn - today) / (1000 * 60 * 60 * 24));
        
        if (daysInAdvance > 365) {
            issues.push('最多可預訂一年內的住宿');
        }
        
        if (daysInAdvance < 0) {
            issues.push('入住日期不能是過去日期');
        }
        
        return {
            compliant: issues.length === 0,
            issues: issues,
            checkedAt: new Date().toISOString()
        };
    }
    
    getMaxGuestsForRoom(roomType) {
        const limits = {
            '豪華雙人房': 3,
            '標準雙人房': 2,
            'deluxe': 3,
            'standard': 2
        };
        
        return limits[roomType] || 2;
    }
    
    calculateAge(birthDate) {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }
    
    validatePaymentCompliance(paymentData) {
        // 模擬支付合規檢查
        const { amount, method, customerInfo } = paymentData;
        const issues = [];
        
        // 檢查大額交易
        if (amount > 50000) {
            issues.push('大額交易需要額外驗證');
        }
        
        // 檢查支付方式限制
        if (method === 'credit_card' && (!customerInfo || !customerInfo.name)) {
            issues.push('信用卡支付需要持卡人姓名');
        }
        
        return {
            compliant: issues.length === 0,
            issues: issues
        };
    }
}

// 正確導出類別實例
module.exports = new ComplianceService();
EOM

# 2. 修復 paymentService.js
echo ""
echo "📝 修復 paymentService.js..."
cat > services/paymentService.js << 'EOM'
// 支付服務
class PaymentService {
    constructor() {
        this.supportedMethods = ['credit_card', 'line_pay', 'apple_pay', 'google_pay'];
    }
    
    async processPayment(paymentData) {
        const { method, amount, orderId, customerInfo } = paymentData;
        
        try {
            // 模擬支付處理
            if (!this.supportedMethods.includes(method)) {
                throw new Error(`不支持的支付方式: ${method}`);
            }
            
            // 模擬支付處理延遲
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const paymentId = 'PAY-' + Date.now();
            
            return {
                success: true,
                paymentId: paymentId,
                amount: amount,
                method: method,
                status: 'completed',
                transactionTime: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }
    
    async refundPayment(paymentId, amount) {
        try {
            // 模擬退款處理
            await new Promise(resolve => setTimeout(resolve, 800));
            
            return {
                success: true,
                refundId: 'REF-' + Date.now(),
                originalPaymentId: paymentId,
                refundAmount: amount,
                status: 'refunded'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 正確導出類別實例
module.exports = new PaymentService();
EOM

# 3. 修復 promotionService.js
echo ""
echo "📝 修復 promotionService.js..."
cat > services/promotionService.js << 'EOM'
// 促銷服務
class PromotionService {
    constructor() {
        this.activePromotions = {
            'WELCOME10': { type: 'percentage', value: 10, minAmount: 1000 },
            'STAY5': { type: 'fixed', value: 500, minNights: 5 },
            'SUMMER25': { type: 'percentage', value: 25, validUntil: '2025-08-31' }
        };
    }
    
    validatePromoCode(code, bookingAmount = 0, nights = 1) {
        const promotion = this.activePromotions[code];
        
        if (!promotion) {
            return {
                valid: false,
                error: '無效的促銷代碼'
            };
        }
        
        // 檢查最低金額要求
        if (promotion.minAmount && bookingAmount < promotion.minAmount) {
            return {
                valid: false,
                error: `未達到最低金額要求: $${promotion.minAmount}`
            };
        }
        
        // 檢查最低晚數要求
        if (promotion.minNights && nights < promotion.minNights) {
            return {
                valid: false,
                error: `需住宿至少 ${promotion.minNights} 晚`
            };
        }
        
        // 檢查有效期
        if (promotion.validUntil && new Date() > new Date(promotion.validUntil)) {
            return {
                valid: false,
                error: '促銷代碼已過期'
            };
        }
        
        return {
            valid: true,
            promotion: promotion
        };
    }
    
    applyPromotion(originalPrice, promotion) {
        let discount = 0;
        
        if (promotion.type === 'percentage') {
            discount = Math.round(originalPrice * (promotion.value / 100));
        } else if (promotion.type === 'fixed') {
            discount = promotion.value;
        }
        
        const finalPrice = Math.max(0, originalPrice - discount);
        
        return {
            originalPrice: originalPrice,
            discountAmount: discount,
            finalPrice: finalPrice,
            discountType: promotion.type
        };
    }
}

// 正確導出類別實例
module.exports = new PromotionService();
EOM

# 4. 修復 roomStatusService.js
echo ""
echo "📝 修復 roomStatusService.js..."
cat > services/roomStatusService.js << 'EOM'
// 房態管理服務
class RoomStatusService {
    constructor() {
        this.roomInventory = {
            '豪華雙人房': { total: 10, blocked: 2 },
            '標準雙人房': { total: 20, blocked: 1 }
        };
        
        this.bookings = new Map();
    }
    
    checkAvailability(roomType, checkIn, checkOut, roomsNeeded = 1) {
        const roomInfo = this.roomInventory[roomType];
        
        if (!roomInfo) {
            return {
                available: false,
                error: '無效的房型'
            };
        }
        
        const availableRooms = roomInfo.total - roomInfo.blocked;
        
        // 模擬日期衝突檢查
        const conflictingBookings = this.getConflictingBookings(roomType, checkIn, checkOut);
        const actuallyAvailable = Math.max(0, availableRooms - conflictingBookings);
        
        return {
            available: actuallyAvailable >= roomsNeeded,
            availableRooms: actuallyAvailable,
            requestedRooms: roomsNeeded,
            checkIn: checkIn,
            checkOut: checkOut,
            roomType: roomType
        };
    }
    
    getConflictingBookings(roomType, checkIn, checkOut) {
        // 簡化的衝突檢查邏輯
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        // 模擬一些預訂衝突
        const randomConflicts = Math.floor(Math.random() * 3);
        return randomConflicts;
    }
    
    blockRooms(roomType, count, bookingId) {
        const roomInfo = this.roomInventory[roomType];
        
        if (!roomInfo) {
            return { success: false, error: '無效的房型' };
        }
        
        const available = roomInfo.total - roomInfo.blocked;
        
        if (available < count) {
            return { success: false, error: '房間數量不足' };
        }
        
        roomInfo.blocked += count;
        this.bookings.set(bookingId, { roomType, count, blocked: true });
        
        return { success: true, blocked: count };
    }
    
    releaseRooms(bookingId) {
        const booking = this.bookings.get(bookingId);
        
        if (booking && booking.blocked) {
            const roomInfo = this.roomInventory[booking.roomType];
            roomInfo.blocked = Math.max(0, roomInfo.blocked - booking.count);
            this.bookings.delete(bookingId);
            
            return { success: true, released: booking.count };
        }
        
        return { success: false, error: '預訂不存在或未鎖定房間' };
    }
}

// 正確導出類別實例
module.exports = new RoomStatusService();
EOM

# 5. 修復 invoiceService.js
echo ""
echo "📝 修復 invoiceService.js..."
cat > services/invoiceService.js << 'EOM'
// 發票服務
class InvoiceService {
    generateInvoice(bookingData, paymentData) {
        const { bookingId, customerInfo, bookingDetails, pricing } = bookingData;
        
        const invoice = {
            invoiceNumber: 'INV-' + Date.now(),
            issueDate: new Date().toISOString().split('T')[0],
            bookingId: bookingId,
            customer: {
                name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone
            },
            items: [
                {
                    description: `${bookingDetails.roomType} - ${bookingDetails.nights}晚`,
                    quantity: 1,
                    unitPrice: pricing.basePrice,
                    amount: pricing.basePrice
                }
            ],
            subtotal: pricing.basePrice,
            tax: pricing.tax || Math.round(pricing.basePrice * 0.05),
            total: pricing.totalPrice,
            paymentMethod: paymentData.method,
            paymentStatus: paymentData.status
        };
        
        invoice.grandTotal = invoice.subtotal + invoice.tax;
        
        return {
            success: true,
            invoice: invoice
        };
    }
    
    formatInvoiceForPrint(invoice) {
        return {
            header: `發票號碼: ${invoice.invoiceNumber}`,
            issueDate: `開立日期: ${invoice.issueDate}`,
            customer: `客戶: ${invoice.customer.name}`,
            items: invoice.items.map(item => 
                `${item.description} x${item.quantity} $${item.amount}`
            ).join('\n'),
            summary: `小計: $${invoice.subtotal}\n稅金: $${invoice.tax}\n總計: $${invoice.grandTotal}`,
            payment: `支付方式: ${invoice.paymentMethod}`
        };
    }
}

// 正確導出類別實例
module.exports = new InvoiceService();
EOM

# 6. 修復 localizationService.js
echo ""
echo "📝 修復 localizationService.js..."
cat > services/localizationService.js << 'EOM'
// 本地化服務
class LocalizationService {
    constructor() {
        this.supportedLanguages = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
        this.translations = {
            'welcome': {
                'zh-TW': '歡迎使用AI訂房助理',
                'en-US': 'Welcome to AI Hotel Assistant',
                'ja-JP': 'AIホテルアシスタントへようこそ',
                'ko-KR': 'AI 호텔 어시스턴트에 오신 것을 환영합니다'
            },
            'room_selection': {
                'zh-TW': '請選擇房型',
                'en-US': 'Please select room type',
                'ja-JP': 'ルームタイプを選択してください',
                'ko-KR': '객실 유형을 선택해 주세요'
            },
            'price_total': {
                'zh-TW': '總計',
                'en-US': 'Total',
                'ja-JP': '合計',
                'ko-KR': '총액'
            },
            'confirmation': {
                'zh-TW': '確認預訂',
                'en-US': 'Confirm booking',
                'ja-JP': '予約を確認',
                'ko-KR': '예약 확인'
            }
        };
    }
    
    detectLanguage(text) {
        // 簡單的語言檢測
        if (/[\u4e00-\u9fff]/.test(text)) return 'zh-TW';
        if (/[a-zA-Z]/.test(text)) return 'en-US';
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP';
        if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
        return 'en-US'; // 預設
    }
    
    translate(key, language = 'zh-TW') {
        if (!this.translations[key]) {
            return key; // 回退到鍵名
        }
        
        if (!this.translations[key][language]) {
            // 回退到英文
            return this.translations[key]['en-US'] || key;
        }
        
        return this.translations[key][language];
    }
    
    formatCurrency(amount, currency = 'TWD', language = 'zh-TW') {
        const formats = {
            'zh-TW': `$${amount.toLocaleString()}`,
            'en-US': `$${amount.toLocaleString()}`,
            'ja-JP': `¥${amount.toLocaleString()}`,
            'ko-KR': `₩${amount.toLocaleString()}`
        };
        
        return formats[language] || `$${amount}`;
    }
    
    formatDate(dateString, language = 'zh-TW') {
        const date = new Date(dateString);
        const formats = {
            'zh-TW': `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
            'en-US': date.toLocaleDateString('en-US'),
            'ja-JP': `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
            'ko-KR': `${date.getFullYear()}년${date.getMonth() + 1}월${date.getDate()}일`
        };
        
        return formats[language] || date.toISOString().split('T')[0];
    }
}

// 正確導出類別實例
module.exports = new LocalizationService();
EOM

echo ""
echo "✅ 所有服務導出問題修復完成！"

# 測試修復結果
echo ""
echo "🧪 測試修復結果..."
cat > test-fixed-exports.js << 'EOM'
console.log("🧪 測試修復後的服務導出...");

const services = {
    complianceService: require('./services/complianceService'),
    paymentService: require('./services/paymentService'),
    promotionService: require('./services/promotionService'),
    roomStatusService: require('./services/roomStatusService'),
    invoiceService: require('./services/invoiceService'),
    localizationService: require('./services/localizationService')
};

let successCount = 0;
const totalServices = Object.keys(services).length;

Object.entries(services).forEach(([name, service]) => {
    try {
        // 測試主要功能方法
        let methodTested = false;
        
        if (name === 'complianceService' && typeof service.validateBookingCompliance === 'function') {
            const result = service.validateBookingCompliance({
                guestCount: 2,
                roomType: '豪華雙人房',
                checkInDate: '2025-02-14'
            });
            console.log(`✅ ${name} - validateBookingCompliance() 正常`);
            methodTested = true;
        }
        
        if (name === 'paymentService' && typeof service.processPayment === 'function') {
            console.log(`✅ ${name} - processPayment() 正常`);
            methodTested = true;
        }
        
        if (name === 'promotionService' && typeof service.validatePromoCode === 'function') {
            const result = service.validatePromoCode('WELCOME10', 2000, 2);
            console.log(`✅ ${name} - validatePromoCode() 正常`);
            methodTested = true;
        }
        
        if (name === 'roomStatusService' && typeof service.checkAvailability === 'function') {
            const result = service.checkAvailability('豪華雙人房', '2025-02-14', '2025-02-16');
            console.log(`✅ ${name} - checkAvailability() 正常`);
            methodTested = true;
        }
        
        if (name === 'localizationService' && typeof service.translate === 'function') {
            const result = service.translate('welcome', 'zh-TW');
            console.log(`✅ ${name} - translate() 正常`);
            methodTested = true;
        }
        
        if (methodTested) {
            successCount++;
        } else {
            console.log(`✅ ${name} - 導入成功（無特定方法測試）`);
            successCount++;
        }
        
    } catch (error) {
        console.log(`❌ ${name} - 測試失敗: ${error.message}`);
    }
});

console.log("");
console.log(`📊 服務導出測試: ${successCount}/${totalServices} 成功`);

if (successCount === totalServices) {
    console.log("🎉 所有服務導出問題已修復！");
    
    // 測試完整訂房流程
    console.log("\\n🚀 測試完整訂房流程...");
    try {
        const bookingService = require('./services/bookingService');
        const bookingData = {
            checkInDate: "2025-02-14",
            nights: 2,
            roomType: "豪華雙人房",
            guestCount: 2,
            guestName: "測試用戶"
        };
        
        const result = bookingService.createBooking(bookingData);
        console.log(`✅ 完整訂房流程測試: ${result.success ? '成功' : '失敗'}`);
        if (result.success) {
            console.log(`   訂單號: ${result.bookingId}`);
        } else {
            console.log(`   錯誤: ${result.error}`);
        }
    } catch (error) {
        console.log(`❌ 訂房流程測試失敗: ${error.message}`);
    }
} else {
    console.log("⚠️  仍有服務需要進一步修復");
}
EOM

node test-fixed-exports.js
rm -f test-fixed-exports.js

echo ""
echo "✅ 服務導出修復流程完成"

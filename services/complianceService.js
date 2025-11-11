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

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

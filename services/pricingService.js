class PricingService {
  constructor() {
    this.roomRates = {
      standard: { basePrice: 2200, name: '標準房', maxGuests: 2 },
      deluxe: { basePrice: 2800, name: '豪華房', maxGuests: 3 },
      suite: { basePrice: 4500, name: '套房', maxGuests: 4 },
      family: { basePrice: 3800, name: '家庭房', maxGuests: 5 }
    };
    
    this.memberDiscounts = {
      none: 0,
      silver: 0.05,
      gold: 0.1,
      platinum: 0.15
    };

    this.promotions = {
      'SUMMER2024': { type: 'percentage', value: 0.1, description: '夏季優惠 10% 折扣' },
      'WELCOME100': { type: 'fixed', value: 100, description: '新客優惠 100 元折扣' },
      'LONGSTAY15': { type: 'percentage', value: 0.15, description: '長住優惠 15% 折扣', minNights: 5 }
    };
  }

  calculateRoomPrice(roomType, nights, guestCount, memberLevel = 'none', childrenCount = 0, seniorCount = 0) {
    try {
      const room = this.roomRates[roomType];
      if (!room) {
        throw new Error(`無效房型: ${roomType}`);
      }

      if (nights < 1) {
        throw new Error('住宿天數至少為1晚');
      }

      if (guestCount < 1) {
        throw new Error('住宿人數至少為1人');
      }

      // 基礎房價
      const basePrice = room.basePrice * nights;

      // 超過最大入住人數額外費用（不含小孩）
      const extraGuests = Math.max(0, guestCount - room.maxGuests);
      const extraGuestFee = extraGuests * 500 * nights;

      // 小孩加價，每位小孩每晚300元
      const childExtraFee = childrenCount * 300 * nights;

      // 小計
      const subtotal = basePrice + extraGuestFee + childExtraFee;

      // 會員折扣
      const discountRate = this.memberDiscounts[memberLevel] || 0;
      const discountAmount = subtotal * discountRate;

      // 老人折扣，每位老人5%
      const seniorDiscountRate = 0.05;
      const seniorDiscountAmount = subtotal * seniorDiscountRate * seniorCount;

      // 總價
      const total = subtotal - discountAmount - seniorDiscountAmount;

      return {
        success: true,
        pricing: {
          basePrice,
          extraGuestFee,
          childExtraFee,
          subtotal,
          discountRate: discountRate * 100,
          discountAmount: Math.round(discountAmount),
          seniorDiscountRate: seniorDiscountRate * 100,
          seniorDiscountAmount: Math.round(seniorDiscountAmount),
          totalPrice: Math.round(total),
          currency: 'TWD',
          roomName: room.name
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  applyPromotion(pricing, promoCode, nights = 1) {
    try {
      const promotion = this.promotions[promoCode];
      if (!promotion) {
        return {
          success: true,
          pricing: {
            ...pricing,
            promoDiscount: 0,
            finalPrice: pricing.totalPrice,
            promoDescription: '無促銷折扣'
          }
        };
      }

      if (promotion.minNights && nights < promotion.minNights) {
        return {
          success: true,
          pricing: {
            ...pricing,
            promoDiscount: 0,
            finalPrice: pricing.totalPrice,
            promoDescription: `未達長住優惠條件（需${promotion.minNights}晚以上）`
          }
        };
      }

      let promoDiscount = 0;
      if (promotion.type === 'percentage') {
        promoDiscount = pricing.subtotal * promotion.value;
      } else if (promotion.type === 'fixed') {
        promoDiscount = promotion.value;
      }

      const finalPrice = pricing.totalPrice - promoDiscount;

      return {
        success: true,
        pricing: {
          ...pricing,
          promoDiscount: Math.round(promoDiscount),
          finalPrice: Math.round(finalPrice),
          promoDescription: promotion.description
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getAvailableRoomTypes() {
    return { success: true, roomTypes: this.roomRates };
  }

  getPromotions() {
    return { success: true, promotions: this.promotions };
  }
}

module.exports = new PricingService();

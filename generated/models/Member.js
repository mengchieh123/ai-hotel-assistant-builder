class Member {
  constructor(userId, level = '普通會員', points = 0) {
    this.userId = userId;
    this.level = level;
    this.points = points;
  }
  calculateDiscount() {
    const discountMap = {'普通會員': 0.05, '黃金會員': 0.10};
    return discountMap[this.level] || 0;
  }
  getBenefits() {
    const benefitsMap = {
      '普通會員': ['積分累積', '會員專屬價格'],
      '黃金會員': ['專屬客服', '房型升級機會', '提早入住']
    };
    return benefitsMap[this.level] || [];
  }
}
module.exports = Member;
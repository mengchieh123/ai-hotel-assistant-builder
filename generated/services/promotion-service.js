class PromotionService {
  constructor() {
    this.campaigns = [
      { name: "早鳥優惠", discount: 15, conditions: "提前7天預訂" },
      { name: "連住優惠", discount: 10, conditions: "連續入住3晚以上" }
    ];
  }
  getAvailableCampaigns() { 
    return this.campaigns; 
  }
}
module.exports = new PromotionService();
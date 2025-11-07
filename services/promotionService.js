// services/promotionService.js
class PromotionService {
  constructor() { this.serviceName = 'promotionService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new PromotionService();

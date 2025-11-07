// services/paymentService.js
class PaymentService {
  constructor() { this.serviceName = 'paymentService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new PaymentService();

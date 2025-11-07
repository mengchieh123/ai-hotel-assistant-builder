// services/index.js
// 服務層導出檔案

const bookingService = require('./bookingService');
const pricingService = require('./pricingService');
const memberService = require('./memberService');
const roomStatusService = require('./roomStatusService');
const promotionService = require('./promotionService');
const paymentService = require('./paymentService');
const invoiceService = require('./invoiceService');
const complianceService = require('./complianceService');
const localizationService = require('./localizationService');

module.exports = {
  bookingService,
  pricingService,
  memberService,
  roomStatusService,
  promotionService,
  paymentService,
  invoiceService,
  complianceService,
  localizationService
};

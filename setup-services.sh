#!/bin/bash
echo "🔄 設定服務層..."

# 建立 services 目錄
mkdir -p services

# 建立基礎服務檔案
cat > services/roomStatusService.js << 'FILEEOF'
// services/roomStatusService.js
class RoomStatusService {
  constructor() { this.serviceName = 'roomStatusService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new RoomStatusService();
FILEEOF

cat > services/promotionService.js << 'FILEEOF'
// services/promotionService.js
class PromotionService {
  constructor() { this.serviceName = 'promotionService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new PromotionService();
FILEEOF

cat > services/paymentService.js << 'FILEEOF'
// services/paymentService.js
class PaymentService {
  constructor() { this.serviceName = 'paymentService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new PaymentService();
FILEEOF

echo "✅ 基礎服務檔案建立完成"
ls -la services/

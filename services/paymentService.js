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

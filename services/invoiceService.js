// 發票服務
class InvoiceService {
    generateInvoice(bookingData, paymentData) {
        const { bookingId, customerInfo, bookingDetails, pricing } = bookingData;
        
        const invoice = {
            invoiceNumber: 'INV-' + Date.now(),
            issueDate: new Date().toISOString().split('T')[0],
            bookingId: bookingId,
            customer: {
                name: customerInfo.name,
                email: customerInfo.email,
                phone: customerInfo.phone
            },
            items: [
                {
                    description: `${bookingDetails.roomType} - ${bookingDetails.nights}晚`,
                    quantity: 1,
                    unitPrice: pricing.basePrice,
                    amount: pricing.basePrice
                }
            ],
            subtotal: pricing.basePrice,
            tax: pricing.tax || Math.round(pricing.basePrice * 0.05),
            total: pricing.totalPrice,
            paymentMethod: paymentData.method,
            paymentStatus: paymentData.status
        };
        
        invoice.grandTotal = invoice.subtotal + invoice.tax;
        
        return {
            success: true,
            invoice: invoice
        };
    }
    
    formatInvoiceForPrint(invoice) {
        return {
            header: `發票號碼: ${invoice.invoiceNumber}`,
            issueDate: `開立日期: ${invoice.issueDate}`,
            customer: `客戶: ${invoice.customer.name}`,
            items: invoice.items.map(item => 
                `${item.description} x${item.quantity} $${item.amount}`
            ).join('\n'),
            summary: `小計: $${invoice.subtotal}\n稅金: $${invoice.tax}\n總計: $${invoice.grandTotal}`,
            payment: `支付方式: ${invoice.paymentMethod}`
        };
    }
}

// 正確導出類別實例
module.exports = new InvoiceService();

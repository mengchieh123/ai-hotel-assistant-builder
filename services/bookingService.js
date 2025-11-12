const pricingService = require('./pricingService');
const roomStatusService = require('./roomStatusService');
const complianceService = require('./complianceService');

class BookingService {
    constructor() {
        this.bookings = new Map();
        this.bookingCounter = 1000;
        this.bookingHistory = new Map(); // 用於存儲修改歷史
    }

    static needChildInfo(message, bookingData = {}) {
        return (message.includes('小孩') || message.includes('兒童') || message.includes('孩子') ||
                message.includes('小朋友') || message.includes('嬰兒') ||
                (bookingData.children && bookingData.children.length > 0));
    }

    static needSeniorInfo(message, bookingData = {}) {
        return (message.includes('老人') || message.includes('年長者') || message.includes('長者') ||
                message.includes('長輩') || message.includes('敬老') ||
                (bookingData.seniors && bookingData.seniors.length > 0));
    }

    static needSpecialRequirements(message, bookingData = {}) {
        return (message.includes('無障礙') || message.includes('輪椅') || message.includes('殘障') ||
                message.includes('素食') || message.includes('過敏') || message.includes('寵物') ||
                message.includes('停車') || message.includes('早餐') ||
                (bookingData.specialRequirements && bookingData.specialRequirements.length > 0));
    }

    // 新增：智能需求檢測
    static detectSpecialRequirements(message) {
        const requirements = {
            accessibility: {
                wheelchair: /輪椅|無障礙|行動不便/.test(message),
                elevator: /電梯|升降機/.test(message)
            },
            family: {
                children: /兒童|小孩|寶寶|嬰兒/.test(message),
                extraBed: /加床|嬰兒床/.test(message),
                familyRoom: /家庭房|親子/.test(message)
            },
            dietary: {
                vegetarian: /素食|不吃肉/.test(message),
                allergy: /過敏|不能吃/.test(message)
            },
            service: {
                parking: /停車|車位/.test(message),
                breakfast: /早餐|餐點/.test(message),
                pet: /寵物|狗|貓/.test(message)
            }
        };

        const detectedRequirements = [];
        if (requirements.accessibility.wheelchair) detectedRequirements.push('無障礙需求');
        if (requirements.family.children) detectedRequirements.push('兒童相關');
        if (requirements.dietary.vegetarian) detectedRequirements.push('素食需求');
        if (requirements.service.parking) detectedRequirements.push('停車需求');

        return {
            hasRequirements: detectedRequirements.length > 0,
            requirements: detectedRequirements,
            details: requirements
        };
    }

    // 新增：團體訂房處理
    static isGroupBooking(message, bookingData = {}) {
        const roomMatch = message.match(/(\d+).*間/);
        const roomCount = roomMatch ? parseInt(roomMatch[1]) : (bookingData.roomCount || 1);
        return roomCount > 1 || /團體|多人|公司|企業/.test(message);
    }

    // 新增：長住優惠檢測
    static isLongStay(message, bookingData = {}) {
        const nightMatch = message.match(/(\d+).*晚/);
        const nights = nightMatch ? parseInt(nightMatch[1]) : (bookingData.nights || 1);
        return nights >= 7 || /長住|長期|月租/.test(message);
    }

    async createBooking(bookingData, message = '') {
        try {
            // 智能需求檢測
            const requirementCheck = BookingService.detectSpecialRequirements(message);
            if (requirementCheck.hasRequirements) {
                console.log('🔍 檢測到特殊需求:', requirementCheck.requirements);
            }

            // 兒童年齡收集
            if (BookingService.needChildInfo(message, bookingData) && !bookingData.childAges) {
                return {
                    success: false,
                    nextStep: 'collect_child_ages',
                    message: '請問同行小孩的年齡分別是多少？兒童收費標準依年齡有所不同：\n• 0-2歲：免費\n• 3-6歲：300 TWD/晚\n• 7-12歲：500 TWD/晚\n請輸入所有小孩年齡（例如：3,5,8）。'
                };
            }

            // 長者年齡收集
            if (BookingService.needSeniorInfo(message, bookingData) && !bookingData.seniorAges) {
                return {
                    success: false,
                    nextStep: 'collect_senior_ages',
                    message: '請問同行長者的年齡？65歲以上可享房價9折優惠，請輸入所有長者年齡。'
                };
            }

            const { checkInDate, nights, roomType, guestCount, guestName, memberLevel, promoCode, childAges, seniorAges, specialRequirements } = bookingData;

            if (!checkInDate || !nights || !roomType || !guestCount || !guestName) {
                return {
                    success: false,
                    error: '缺少必要參數',
                    message: '請提供完整的訂房資訊：入住日期、住宿天數、房型、旅客人數、旅客姓名'
                };
            }

            // 新增：日期驗證
            const today = new Date();
            const checkIn = new Date(checkInDate);
            if (checkIn < today) {
                return {
                    success: false,
                    error: '日期無效',
                    message: '入住日期不能是過去日期'
                };
            }

            // 合規檢查
            const complianceCheck = complianceService.validateBookingCompliance({
                guestCount,
                roomType,
                checkInDate,
                customerInfo: { name: guestName },
                childAges,
                seniorAges
            });

            if (!complianceCheck.compliant) {
                return {
                    success: false,
                    error: '合規檢查失敗',
                    issues: complianceCheck.issues,
                    message: complianceCheck.issues.join(', ')
                };
            }

            // 房間可用性檢查
            const availability = roomStatusService.checkAvailability(roomType, checkInDate, nights, guestCount);
            if (!availability.available) {
                return {
                    success: false,
                    error: '房間不可用',
                    details: availability,
                    message: `選擇的${this.getRoomTypeName(roomType)}在指定日期不可用，建議日期：${availability.suggestedDates ? availability.suggestedDates.join(', ') : '請選擇其他日期'}`
                };
            }

            // 價格計算（傳入childAges及seniorAges協助價格計算）
            const priceResult = pricingService.calculateRoomPrice(
                roomType, 
                nights, 
                guestCount, 
                memberLevel, 
                { childAges, seniorAges, specialRequirements }
            );
            
            if (!priceResult.success) {
                return {
                    success: false,
                    error: '價格計算失敗',
                    details: priceResult,
                    message: '無法計算價格，請確認房型資訊'
                };
            }

            let finalPricing = priceResult.pricing;
            
            // 促銷代碼處理
            if (promoCode) {
                try {
                    const promoService = require('./promotionService');
                    const promoValidation = promoService.validatePromoCode(promoCode, finalPricing.totalPrice, nights);
                    if (promoValidation.valid) {
                        const promoResult = promoService.applyPromotion(finalPricing.totalPrice, promoValidation.promotion);
                        finalPricing.finalPrice = promoResult.finalPrice;
                        finalPricing.discountAmount = promoResult.discountAmount;
                        finalPricing.originalPrice = promoResult.originalPrice;
                        finalPricing.promoCode = promoCode;
                    } else {
                        return {
                            success: false,
                            error: '促銷代碼無效',
                            message: promoValidation.message || '無效的促銷代碼'
                        };
                    }
                } catch (promoError) {
                    console.log("⚠️ 促銷代碼處理失敗:", promoError.message);
                }
            }

            // 團體優惠處理
            if (BookingService.isGroupBooking(message, bookingData)) {
                const roomCount = bookingData.roomCount || 1;
                const groupDiscount = this.calculateGroupDiscount(roomCount, finalPricing.totalPrice);
                if (groupDiscount.discount > 0) {
                    finalPricing.groupDiscount = groupDiscount.discount;
                    finalPricing.groupDiscountAmount = groupDiscount.discountAmount;
                    finalPricing.finalPrice = groupDiscount.finalPrice;
                }
            }

            // 長住優惠處理
            if (BookingService.isLongStay(message, bookingData)) {
                const longStayDiscount = this.calculateLongStayDiscount(nights, finalPricing.totalPrice);
                if (longStayDiscount.discount > 0) {
                    finalPricing.longStayDiscount = longStayDiscount.discount;
                    finalPricing.longStayDiscountAmount = longStayDiscount.discountAmount;
                    finalPricing.finalPrice = longStayDiscount.finalPrice;
                }
            }

            const bookingId = 'BKG-' + this.bookingCounter++;
            const booking = {
                bookingId,
                status: 'confirmed',
                createdAt: new Date().toISOString(),
                customer: {
                    name: guestName,
                    guestCount,
                    childAges: childAges || [],
                    seniorAges: seniorAges || [],
                    specialRequirements: specialRequirements || [],
                    memberLevel: memberLevel || 'none'
                },
                stay: {
                    checkIn: checkInDate,
                    nights,
                    roomType,
                    roomTypeName: this.getRoomTypeName(roomType)
                },
                pricing: finalPricing,
                paymentStatus: 'pending',
                requirements: requirementCheck.details,
                metadata: {
                    isGroupBooking: BookingService.isGroupBooking(message, bookingData),
                    isLongStay: BookingService.isLongStay(message, bookingData),
                    hasSpecialRequirements: requirementCheck.hasRequirements
                }
            };

            this.bookings.set(bookingId, booking);
            
            // 保存修改歷史
            this.bookingHistory.set(bookingId, [{
                timestamp: new Date().toISOString(),
                action: 'create',
                details: '訂單創建'
            }]);

            // 房間鎖定
            const roomCount = bookingData.roomCount || 1;
            const blockResult = roomStatusService.blockRooms(roomType, roomCount, bookingId, checkInDate, nights);
            if (!blockResult.success) {
                console.log("⚠️ 房間鎖定失敗:", blockResult.error);
                return {
                    success: false,
                    error: '房間鎖定失敗',
                    message: '無法鎖定房間，請稍後再試'
                };
            }

            console.log("✅ 訂房成功建立:", bookingId);

            return {
                success: true,
                bookingId,
                message: '🎉 訂房成功！',
                bookingDetails: booking,
                nextSteps: [
                    '請在24小時內完成付款',
                    '入住時請出示身份證明文件',
                    '如需修改請聯繫客服'
                ]
            };

        } catch (error) {
            console.error('❌ 訂房處理錯誤:', error);
            return {
                success: false,
                error: '訂房處理失敗',
                message: '系統繁忙，請稍後再試'
            };
        }
    }

    async getBooking(bookingId) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單，請確認訂單編號是否正确'
                };
            }

            // 獲取房間狀態
            const roomStatus = roomStatusService.getRoomStatus(bookingId);
            
            return {
                success: true,
                booking: {
                    ...booking,
                    roomStatus
                }
            };
        } catch (error) {
            return {
                success: false,
                error: '查詢訂單失敗',
                message: error.message
            };
        }
    }

    async cancelBooking(bookingId, cancellationReason = '') {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單'
                };
            }

            if (booking.status === 'cancelled') {
                return {
                    success: false,
                    error: '訂單已取消',
                    message: '此訂單已經取消'
                };
            }

            // 計算退款金額
            const refundResult = pricingService.calculateRefund(
                booking.pricing.finalPrice || booking.pricing.totalPrice,
                'standard', // 可根據會員等級調整
                booking.stay.checkIn
            );

            booking.status = 'cancelled';
            booking.cancelledAt = new Date().toISOString();
            booking.cancellationReason = cancellationReason;
            booking.refundAmount = refundResult.refundAmount;
            booking.refundRate = refundResult.refundRate;

            // 保存修改歷史
            this.bookingHistory.get(bookingId).push({
                timestamp: new Date().toISOString(),
                action: 'cancel',
                details: `訂單取消，退款金額: ${refundResult.refundAmount} TWD`,
                reason: cancellationReason
            });

            // 釋放房間
            const releaseResult = roomStatusService.releaseRooms(bookingId);
            if (!releaseResult.success) {
                console.log("⚠️ 房間釋放失敗:", releaseResult.error);
            }

            // 退款處理
            if (booking.paymentStatus === 'paid') {
                try {
                    const paymentService = require('./paymentService');
                    const refundResult = await paymentService.refundPayment(booking.paymentId, booking.refundAmount);
                    if (refundResult.success) {
                        booking.paymentStatus = 'refunded';
                        booking.refundProcessedAt = new Date().toISOString();
                    }
                } catch (refundError) {
                    console.log("⚠️ 退款處理失敗:", refundError.message);
                }
            }

            return {
                success: true,
                message: `✅ 訂單取消成功！退款金額: ${refundResult.refundAmount} TWD (${refundResult.refundRate}%)`,
                booking,
                refundDetails: refundResult
            };

        } catch (error) {
            return {
                success: false,
                error: '取消訂單失敗',
                message: error.message
            };
        }
    }

    async updateBooking(bookingId, updates) {
        try {
            const booking = this.bookings.get(bookingId);
            if (!booking) {
                return {
                    success: false,
                    error: '訂單不存在',
                    message: '找不到指定的訂單'
                };
            }

            if (booking.status === 'cancelled') {
                return {
                    success: false,
                    error: '訂單已取消',
                    message: '已取消的訂單無法修改'
                };
            }

            const allowedUpdates = ['guestCount', 'specialRequests', 'childAges', 'seniorAges', 'memberLevel'];
            const updatedFields = {};
            const changeLog = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedUpdates.includes(key)) {
                    const oldValue = booking.customer[key];
                    booking.customer[key] = value;
                    updatedFields[key] = value;
                    
                    if (oldValue !== value) {
                        changeLog.push(`${key}: ${oldValue} → ${value}`);
                    }
                }
            }

            booking.updatedAt = new Date().toISOString();

            // 保存修改歷史
            if (changeLog.length > 0) {
                this.bookingHistory.get(bookingId).push({
                    timestamp: new Date().toISOString(),
                    action: 'update',
                    details: `訂單更新: ${changeLog.join(', ')}`
                });
            }

            return {
                success: true,
                message: '✅ 訂單更新成功',
                updatedFields,
                changeLog,
                booking
            };
        } catch (error) {
            return {
                success: false,
                error: '更新訂單失敗',
                message: error.message
            };
        }
    }

    // 新增：獲取訂單歷史
    async getBookingHistory(bookingId) {
        try {
            const history = this.bookingHistory.get(bookingId);
            if (!history) {
                return {
                    success: false,
                    error: '訂單歷史不存在',
                    message: '找不到訂單歷史記錄'
                };
            }

            return {
                success: true,
                history,
                count: history.length
            };
        } catch (error) {
            return {
                success: false,
                error: '獲取訂單歷史失敗',
                message: error.message
            };
        }
    }

    listBookings(filter = {}) {
        try {
            const allBookings = Array.from(this.bookings.values());
            
            let filteredBookings = allBookings;
            
            if (filter.status) {
                filteredBookings = filteredBookings.filter(b => b.status === filter.status);
            }
            
            if (filter.customerName) {
                filteredBookings = filteredBookings.filter(b => 
                    b.customer.name && b.customer.name.toLowerCase().includes(filter.customerName.toLowerCase())
                );
            }

            if (filter.checkInDate) {
                filteredBookings = filteredBookings.filter(b => b.stay.checkIn === filter.checkInDate);
            }

            if (filter.roomType) {
                filteredBookings = filteredBookings.filter(b => b.stay.roomType === filter.roomType);
            }

            // 排序：最新的訂單在前
            filteredBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return {
                success: true,
                count: filteredBookings.length,
                bookings: filteredBookings,
                summary: {
                    total: allBookings.length,
                    confirmed: allBookings.filter(b => b.status === 'confirmed').length,
                    cancelled: allBookings.filter(b => b.status === 'cancelled').length,
                    pending: allBookings.filter(b => b.paymentStatus === 'pending').length
                }
            };
        } catch (error) {
            return {
                success: false,
                error: '查詢訂單列表失敗',
                message: error.message
            };
        }
    }

    // 新增：輔助方法
    getRoomTypeName(roomType) {
        const roomNames = {
            'standard': '標準雙人房',
            'deluxe': '豪華雙人房', 
            'suite': '套房',
            'family': '家庭房'
        };
        return roomNames[roomType] || roomType;
    }

    calculateGroupDiscount(roomCount, totalPrice) {
        let discount = 0;
        if (roomCount >= 3 && roomCount <= 5) discount = 0.05;
        else if (roomCount >= 6 && roomCount <= 10) discount = 0.1;
        else if (roomCount > 10) discount = 0.15;

        const discountAmount = totalPrice * discount;
        return {
            discount: discount * 100,
            discountAmount,
            finalPrice: totalPrice - discountAmount
        };
    }

    calculateLongStayDiscount(nights, totalPrice) {
        let discount = 0;
        if (nights >= 7 && nights <= 13) discount = 0.1;
        else if (nights >= 14 && nights <= 29) discount = 0.15;
        else if (nights >= 30) discount = 0.3;

        const discountAmount = totalPrice * discount;
        return {
            discount: discount * 100,
            discountAmount,
            finalPrice: totalPrice - discountAmount
        };
    }

    // 新增：統計資訊
    getBookingStats() {
        const allBookings = Array.from(this.bookings.values());
        
        return {
            totalBookings: allBookings.length,
            confirmedBookings: allBookings.filter(b => b.status === 'confirmed').length,
            cancelledBookings: allBookings.filter(b => b.status === 'cancelled').length,
            totalRevenue: allBookings
                .filter(b => b.status === 'confirmed')
                .reduce((sum, b) => sum + (b.pricing.finalPrice || b.pricing.totalPrice), 0),
            averageStayLength: allBookings
                .filter(b => b.status === 'confirmed')
                .reduce((sum, b) => sum + b.stay.nights, 0) / allBookings.filter(b => b.status === 'confirmed').length || 0,
            popularRoomTypes: this.getPopularRoomTypes(allBookings)
        };
    }

    getPopularRoomTypes(bookings) {
        const roomTypeCount = {};
        bookings
            .filter(b => b.status === 'confirmed')
            .forEach(b => {
                roomTypeCount[b.stay.roomType] = (roomTypeCount[b.stay.roomType] || 0) + 1;
            });
        
        return Object.entries(roomTypeCount)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({
                roomType: type,
                roomTypeName: this.getRoomTypeName(type),
                count,
                percentage: (count / bookings.filter(b => b.status === 'confirmed').length * 100).toFixed(1)
            }));
    }
}

module.exports = new BookingService();

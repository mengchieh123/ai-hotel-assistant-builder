const MockAPI = require('./service_mock_api');
const sessionManager = require('./session_manager');

// --- 輔助常量 ---
const MAX_NIGHTS = 30;
const CHILD_SURCHARGE = 500;
const SERVICE_FEE_RATE = 0.1;
const MEMBER_DISCOUNT_RATE = 0.05;

// --- 安全日誌函數 ---
function log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    try {
        const safeDetails = {};
        for (const key in details) {
            if (typeof details[key] !== 'object' || details[key] === null) {
                safeDetails[key] = details[key];
            } else if (key !== 'session') {
                safeDetails[key] = String(details[key]);
            }
        }
        console.log(JSON.stringify({
            timestamp: timestamp,
            level: level,
            message: message,
            details: safeDetails
        }));
    } catch (error) {
        console.log(`${timestamp} [${level}] ${message} - 日誌序列化失敗: ${error.message}`);
    }
}

// --- 價格計算核心邏輯 ---
async function getPriceDetails(data) {
    if (!data.nights || !data.roomType || !data.adultCount || !data.roomCount) {
        log('WARNING', 'Price calculation skipped due to missing essential data.', {
            nights: data.nights,
            roomType: data.roomType,
            adultCount: data.adultCount,
            roomCount: data.roomCount
        });
        return {
            roomCost: 0,
            childCost: 0,
            addonsCost: 0,
            memberDiscountValue: 0,
            serviceFee: 0,
            finalPrice: 0,
            error: true,
            errorMessage: '缺少必要的預訂資訊'
        };
    }

    try {
        const pricingData = await MockAPI.getPricingDetails(data.roomType);
        const roomDetails = pricingData.roomDetails;
        const ADDONS_SERVICE = pricingData.addons;

        if (!roomDetails) {
            log('ERROR', 'Room details not found in API response', { roomType: data.roomType });
            return {
                roomCost: 0,
                childCost: 0,
                finalPrice: 0,
                error: true,
                errorMessage: '無效房型或價格 API 錯誤'
            };
        }

        let roomCost = 0;
        const totalNights = parseInt(data.nights) || 1;
        const totalRooms = parseInt(data.roomCount) || 1;
        const totalAdults = parseInt(data.adultCount) || 1;
        const totalChildren = parseInt(data.childCount) || 0;
        const checkInDate = data.checkInDate ? new Date(data.checkInDate) : null;

        // --- 1. 房費計算 (Room Cost) ---
        let isWeekend = false;
        if (checkInDate) {
            const day = checkInDate.getUTCDay();
            isWeekend = (day === 6 || day === 0);
        }

        const multiplier = isWeekend ? (roomDetails.weekendMultiplier || 1.2) : 1;
        const basePrice = roomDetails.price * multiplier;
        roomCost = basePrice * totalRooms * totalNights;

        // --- 2. 兒童附加費 (Child Cost) ---
        const childCost = totalChildren * CHILD_SURCHARGE * totalNights;

        // --- 3. 加購服務費 (Addons Cost) ---
        let addonsCost = 0;
        if (data.addons && Array.isArray(data.addons) && data.addons.length > 0) {
            data.addons.forEach(addon => {
                const item = ADDONS_SERVICE[addon.id];
                if (item) {
                    let cost = item.price;
                    if (item.type === 'per_person') {
                        cost *= (totalAdults + totalChildren);
                    }
                    if (item.isPerNight) {
                        cost *= totalNights;
                    }
                    addonsCost += cost;
                }
            });
        }

        let totalPriceBeforeFee = roomCost + childCost + addonsCost;

        // --- 4. 會員折扣 (Member Discount) ---
        const memberDiscountValue = data.isLoggedIn ? roomCost * MEMBER_DISCOUNT_RATE : 0;

        let subtotalAfterDiscount = totalPriceBeforeFee - memberDiscountValue;

        // --- 5. 服務費 (Service Fee) ---
        const serviceFee = subtotalAfterDiscount * SERVICE_FEE_RATE;

        // --- 6. 最終價格 (Final Price) ---
        const finalPrice = Math.round(subtotalAfterDiscount + serviceFee);

        log('INFO', 'Price Calculation Completed', {
            roomCost: roomCost.toFixed(2),
            childCost: childCost.toFixed(2),
            addonsCost: addonsCost.toFixed(2),
            memberDiscountValue: memberDiscountValue.toFixed(2),
            finalPrice: finalPrice
        });

        return {
            roomCost: roomCost,
            childCost: childCost,
            addonsCost: addonsCost,
            memberDiscountValue: memberDiscountValue,
            serviceFee: serviceFee,
            finalPrice: finalPrice,
            error: false
        };

    } catch (error) {
        log('FATAL', 'Price Service API Failure', { error: error.message });
        return {
            roomCost: 0,
            childCost: 0,
            finalPrice: 0,
            error: true,
            errorMessage: '價格計算服務暫時無法使用'
        };
    }
}

// --- Handler 區塊 ---
async function checkDateCompleteness(session) {
    const data = session.collectedData;

    if (!data.checkInDate || !data.nights) {
        return {
            isHandled: true,
            prompt: '請提供完整的入住日期和住宿晚數。',
            nextStep: 'handle_date_not_found'
        };
    }

    const date = new Date(data.checkInDate);
    if (isNaN(date.getTime())) {
        return {
            isHandled: true,
            prompt: '請提供有效的日期格式 (例如: 2025-12-25)。',
            nextStep: 'handle_date_not_found'
        };
    }

    const nights = parseInt(data.nights);
    if (isNaN(nights) || nights <= 0 || nights > MAX_NIGHTS) {
        return {
            isHandled: true,
            prompt: `請提供有效的住宿晚數 (1-${MAX_NIGHTS}晚)。`,
            nextStep: 'handle_date_not_found'
        };
    }

    return { isHandled: true };
}

async function checkBookingEssentials(session) {
    const data = session.collectedData;

    if (!data.roomType) {
        data.CUSTOM_PROMPT = '請選擇有效的【房型】。';
        return { isHandled: true, nextStep: 'show_room_types' };
    }
    if (!data.roomCount || parseInt(data.roomCount) <= 0 || isNaN(parseInt(data.roomCount))) {
        data.CUSTOM_PROMPT = '請輸入正確的【房間數】。';
        return { isHandled: true, nextStep: 'ask_room_count' };
    }
    if (!data.adultCount || parseInt(data.adultCount) <= 0 || isNaN(parseInt(data.adultCount))) {
        data.CUSTOM_PROMPT = '請輸入正確的【大人】人數。';
        return { isHandled: true, nextStep: 'ask_guest_count' };
    }

    delete data.CUSTOM_PROMPT;
    return { isHandled: true };
}

async function lockInventory(session) {
    const data = session.collectedData;
    const { roomType, roomCount } = data;

    if (data.inventoryLockId) {
        log('INFO', 'Inventory lock already exists.', { lockId: data.inventoryLockId });
        return { isHandled: true };
    }

    if (!roomType || !roomCount) {
        log('ERROR', 'Lock inventory failed: Missing roomType or roomCount.', { roomType: roomType, roomCount: roomCount });
        return {
            isHandled: true,
            prompt: '庫存鎖定失敗：缺少房型或房間數資訊，請返回重新選擇。',
            nextStep: 'show_room_types'
        };
    }

    try {
        const lockResult = await MockAPI.lockInventory(roomType, parseInt(roomCount));

        if (lockResult.isLocked) {
            data.inventoryLockId = lockResult.lockId;
            log('INFO', 'Inventory locked successfully', {
                lockId: lockResult.lockId,
                roomType: roomType,
                roomCount: roomCount
            });
            return {
                isHandled: true,
                prompt: `✅ 庫存鎖定成功！【${roomType}】現有 ${lockResult.remaining} 間庫存。`
            };
        } else {
            log('WARNING', 'Inventory lock failed', {
                roomType: roomType,
                roomCount: roomCount,
                reason: lockResult.message,
                remaining: lockResult.remaining
            });
            return {
                isHandled: true,
                prompt: `😭 抱歉，您選擇的【${roomType}】庫存不足 (剩餘 ${lockResult.remaining} 間)，請重新選擇房型或間數。`,
                nextStep: 'show_room_types'
            };
        }
    } catch (error) {
        log('FATAL', 'Inventory API failed', { error: error.message });
        return {
            isHandled: true,
            prompt: '庫存服務暫時無法連線，請稍後再試。',
            nextStep: 'show_room_types'
        };
    }
}

async function calculatePrice(session) {
    const data = session.collectedData;

    if (data.finalPrice && data.priceDetails) {
        log('INFO', 'Price calculation skipped as data is cached.', { finalPrice: data.finalPrice });
        return { isHandled: true };
    }

    if (!data.inventoryLockId) {
        log('WARNING', 'Price calculation aborted: Inventory lock ID missing. Redirect to re-lock.', {});
        return {
            isHandled: true,
            prompt: '價格計算失敗，庫存鎖定已失效，請重新鎖定房型。',
            nextStep: 'lock_inventory'
        };
    }

    const details = await getPriceDetails(data);

    if (details.error || details.finalPrice <= 0) {
        log('ERROR', 'Final price is invalid or zero.', { details: details });

        if (data.inventoryLockId) {
            await MockAPI.unlockInventory(data.inventoryLockId).catch(() => {});
            delete data.inventoryLockId;
        }

        return {
            isHandled: true,
            prompt: `抱歉，價格計算失敗：${details.errorMessage || '請確認您的預訂資訊。'}`,
            nextStep: 'show_room_types'
        };
    }

    data.finalPrice = details.finalPrice;

    const displayDetails = {};
    for (const key in details) {
        if (typeof details[key] === 'number') {
            displayDetails[key] = Math.round(details[key]);
        } else {
            displayDetails[key] = details[key];
        }
    }
    data.priceDetails = displayDetails;

    log('INFO', 'Price Calculated and Stored.', { finalPrice: details.finalPrice });
    return {
        isHandled: true,
        prompt: `總價格已計算完成，金額為 **TWD ${details.finalPrice} 元**。`
    };
}

async function generateAddonsCarousel(session) {
    const addonsList = await MockAPI.getAddonsList();

    const richCard = {
        type: 'carousel',
        options: addonsList.map(item => ({
            id: item.id,
            title: item.title,
            description: `${item.description} (NT$ ${item.price}/${item.isPerNight ? '晚' : '次'})`
        }))
    };
    return { isHandled: true, richCard: richCard };
}

async function executeAddonsSelection(session) {
    const data = session.collectedData;

    if (data.addonSelection && data.addonSelection.length > 0) {
        data.addons = data.addonSelection.map(id => ({ id: id, count: 1 }));
        delete data.addonSelection;

        delete data.finalPrice;
        delete data.priceDetails;

        log('INFO', 'Addons selected. Price cache cleared.', { addonCount: data.addons.length });

        return {
            isHandled: true,
            prompt: `已記錄 ${data.addons.length} 項加購服務，將重新計算總價。`,
            nextStep: 'calculate_price_logic'
        };
    }

    data.addons = [];
    log('INFO', 'No addons selected.');
    return {
        isHandled: true,
        prompt: '未選擇加購服務，繼續流程。'
    };
}

async function loginMemberAccount(session) {
    const data = session.collectedData;
    const { memberAccount, memberPassword } = data;

    if (data.isLoggedIn) {
        log('INFO', 'User already logged in.');
        return { isHandled: true };
    }

    if (!memberAccount || !memberPassword) {
        return { isHandled: false };
    }

    try {
        const loginResult = await MockAPI.verifyMember(memberAccount, memberPassword);

        if (loginResult.isSuccessful) {
            data.isLoggedIn = true;
            data.memberId = loginResult.memberId;

            delete data.finalPrice;
            delete data.priceDetails;

            log('INFO', 'Member login successful. Price cache cleared.', { memberId: loginResult.memberId });

            return {
                isHandled: true,
                prompt: `✅ 會員登入成功！已為您套用 ${MEMBER_DISCOUNT_RATE * 100}% 的會員折扣，正在重新計算價格...`,
                nextStep: 'calculate_price_logic'
            };
        } else {
            delete data.memberPassword;
            log('WARNING', 'Member login failed.', { account: memberAccount });
            return {
                isHandled: true,
                prompt: '❌ 登入失敗：帳號或密碼錯誤，請重新輸入密碼。',
                nextStep: 'ask_member_password'
            };
        }
    } catch (error) {
        log('FATAL', 'Member API failed', { error: error.message });
        return {
            isHandled: true,
            prompt: '會員服務暫時無法連線，將跳過登入步驟。',
            nextStep: 'ask_addons'
        };
    }
}

async function validateContactInfo(session) {
    const data = session.collectedData;

    if (!data.contactName || data.contactName.length < 2) {
        data.CUSTOM_PROMPT = '請提供有效的【訂房人姓名】。';
        delete data.contactName;
        return {
            isHandled: true,
            nextStep: 'ask_contact_info'
        };
    }

    if (!data.contactPhone || String(data.contactPhone).replace(/\D/g, '').length < 8) {
        data.CUSTOM_PROMPT = '請提供有效的【電話號碼】。';
        delete data.contactPhone;
        return {
            isHandled: true,
            nextStep: 'ask_contact_info'
        };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.contactEmail || !emailRegex.test(data.contactEmail)) {
        data.CUSTOM_PROMPT = '請提供有效的【電子郵件】。';
        delete data.contactEmail;
        return {
            isHandled: true,
            nextStep: 'ask_contact_info'
        };
    }

    delete data.CUSTOM_PROMPT;
    return { isHandled: true };
}

async function handleSpecialRequests(session) {
    const data = session.collectedData;

    if (data.specialRequest && data.specialRequest.trim().length > 0) {
        data.CUSTOM_PROMPT = `✅ 已記錄您的特殊需求: ${data.specialRequest}`;
        log('INFO', 'Special request recorded.', { request: data.specialRequest });
    } else {
        data.CUSTOM_PROMPT = '無特殊需求記錄。';
    }

    return { isHandled: true };
}

async function generateOrderSummary(session) {
    const data = session.collectedData;

    if (!data.priceDetails) {
        const priceResult = await calculatePrice(session);
        if (priceResult.error) {
            return priceResult;
        }
    }

    const details = data.priceDetails;
    const isMember = data.isLoggedIn ? '（已套用會員折扣）' : '';

    const summary = `
- 房型/間數: ${data.roomType} x ${data.roomCount} 間
- 入住/晚數: ${data.checkInDate} / ${data.nights} 晚
- 聯絡人: ${data.contactName} (${data.contactPhone})
- 費用詳情:
    - 房費總計: TWD ${details.roomCost.toFixed(0)}
    - 兒童附加費: TWD ${details.childCost.toFixed(0)}
    - 加購服務費: TWD ${details.addonsCost.toFixed(0)}
    - 會員折扣 (${MEMBER_DISCOUNT_RATE * 100}%): - TWD ${details.memberDiscountValue.toFixed(0)}
    - 服務費 (${SERVICE_FEE_RATE * 100}%): + TWD ${details.serviceFee.toFixed(0)}
- **應付總額: TWD ${data.finalPrice} 元**
`;
    data.finalSummary = summary;

    const richCard = {
        type: 'text_card',
        title: `✅ 訂單摘要 ${isMember}`,
        body: summary,
        buttons: [
            { text: '確認並提交', intent: 'affirm' },
            { text: '修改預訂', intent: 'correction' }
        ]
    };

    log('INFO', 'Order Summary Generated.', { finalPrice: data.finalPrice });
    return {
        isHandled: true,
        prompt: `請仔細核對以下訂單摘要，確認無誤後請點選【確認並提交】。`,
        richCard: richCard
    };
}

async function submitBooking(session) {
    const data = session.collectedData;
    const lockId = data.inventoryLockId;

    if (!lockId) {
        log('ERROR', 'Submission failed: Inventory lock ID missing.');
        return {
            isHandled: true,
            prompt: '提交失敗：庫存鎖定狀態遺失，請重新開始預訂流程。',
            nextStep: 'init'
        };
    }

    try {
        await MockAPI.simulateDelay(500);

        const bookingResult = await MockAPI.submitBooking({
            roomType: data.roomType,
            roomCount: data.roomCount,
            checkInDate: data.checkInDate,
            nights: data.nights,
            contactName: data.contactName,
            finalPrice: data.finalPrice,
            inventoryLockId: lockId
        });

        await MockAPI.unlockInventory(lockId).catch(e => {
            log('WARNING', 'Failed to unlock inventory after submission.', { lockId: lockId, error: e.message });
        });
        delete data.inventoryLockId;

        if (bookingResult.success) {
            data.orderId = `HTL${Date.now().toString().slice(-6)}`;
            data.paymentMessage = data.paymentMethod === '信用卡'
                ? '您的信用卡授權成功。'
                : '請於入住前 72 小時內完成銀行轉帳/支付。';

            log('SUCCESS', 'Booking Submitted Successfully', { orderId: data.orderId });
            return {
                isHandled: true,
                prompt: `🎉 訂房成功！您的訂單編號是 **${data.orderId}**。${data.paymentMessage}稍後我們會將完整的確認信寄至您的信箱。`
            };
        } else {
            log('ERROR', 'Booking Submission Failed', { message: bookingResult.message });
            return {
                isHandled: true,
                prompt: `訂單提交失敗：${bookingResult.message}。請嘗試重新預訂。`,
                nextStep: 'init'
            };
        }
    } catch (error) {
        log('FATAL', 'Booking Submission Service Failed', { error: error.message });
        if (lockId) {
            await MockAPI.unlockInventory(lockId).catch(() => {});
            delete data.inventoryLockId;
        }
        return {
            isHandled: true,
            prompt: `訂單提交服務暫時無法連線：${error.message}。請聯繫客服。`,
            nextStep: 'end_of_flow'
        };
    }
}

module.exports = {
    checkDateCompleteness,
    checkBookingEssentials,
    lockInventory,
    calculatePrice,
    generateAddonsCarousel,
    executeAddonsSelection,
    loginMemberAccount,
    validateContactInfo,
    handleSpecialRequests,
    generateOrderSummary,
    submitBooking
};

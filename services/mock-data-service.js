/**
 * 模擬資料服務
 * 使用內存數據，無需資料庫
 * 之後可輕鬆替換為真實資料庫
 */

class MockDataService {
    constructor() {
        this.initializeData();
    }

    initializeData() {
        // 房型數據
        this.rooms = [
            {
                id: 1,
                name: '豪華景觀套房',
                nameEn: 'Deluxe View Suite',
                type: 'deluxe',
                size: 45,
                maxGuests: 2,
                floor: '25-30F',
                view: '城市景觀',
                description: '坐擁台北101美景，配備豪華設施，適合商務或浪漫住宿',
                amenities: [
                    '免費 WiFi',
                    '55吋 4K 電視',
                    'Nespresso 咖啡機',
                    '迷你吧',
                    '獨立浴缸',
                    '智能馬桶',
                    '保險箱',
                    '免費礦泉水'
                ],
                basePrice: 6800,
                weekendPrice: 8200,
                available: true,
                totalRooms: 5,
                bookedRooms: 2,
                images: [
                    'https://example.com/deluxe-1.jpg',
                    'https://example.com/deluxe-2.jpg'
                ]
            },
            {
                id: 2,
                name: '商務標準房',
                nameEn: 'Business Standard Room',
                type: 'business',
                size: 28,
                maxGuests: 2,
                floor: '12-18F',
                view: '部分城市景觀',
                description: '舒適實用，配備完善辦公設施，商務人士首選',
                amenities: [
                    '免費 WiFi',
                    '43吋電視',
                    '書桌',
                    'Nespresso 咖啡機',
                    '保險箱',
                    '免費礦泉水'
                ],
                basePrice: 3200,
                weekendPrice: 3800,
                available: true,
                totalRooms: 12,
                bookedRooms: 8,
                images: [
                    'https://example.com/business-1.jpg',
                    'https://example.com/business-2.jpg'
                ]
            },
            {
                id: 3,
                name: '家庭套房',
                nameEn: 'Family Suite',
                type: 'family',
                size: 60,
                maxGuests: 4,
                floor: '20-24F',
                view: '城市景觀',
                description: '寬敞舒適，配備客廳和小廚房，適合全家入住',
                amenities: [
                    '免費 WiFi',
                    '兩間臥室',
                    '客廳',
                    '小廚房',
                    '洗衣機',
                    '55吋電視',
                    'Nespresso 咖啡機',
                    '兒童備品'
                ],
                basePrice: 8500,
                weekendPrice: 10200,
                available: true,
                totalRooms: 3,
                bookedRooms: 1,
                images: [
                    'https://example.com/family-1.jpg',
                    'https://example.com/family-2.jpg'
                ]
            },
            {
                id: 4,
                name: '經濟雙人房',
                nameEn: 'Economy Twin Room',
                type: 'economy',
                size: 22,
                maxGuests: 2,
                floor: '8-11F',
                view: '無窗或內景',
                description: '經濟實惠，設施齊全，適合預算有限的旅客',
                amenities: [
                    '免費 WiFi',
                    '32吋電視',
                    '書桌',
                    '保險箱'
                ],
                basePrice: 2200,
                weekendPrice: 2600,
                available: true,
                totalRooms: 15,
                bookedRooms: 12,
                images: [
                    'https://example.com/economy-1.jpg'
                ]
            }
        ];

        // 對話歷史（每個 session）
        this.conversations = new Map();

        // 用戶偏好
        this.userPreferences = new Map();

        // 模擬訂單
        this.bookings = [];
        this.bookingCounter = 1001;
    }

    // ============================================
    // 房型相關
    // ============================================

    async getAvailableRooms(criteria = {}) {
        const { guests, budget, preferences = [], checkIn, checkOut } = criteria;

        let results = [...this.rooms].filter(room => room.available);

        // 篩選人數
        if (guests) {
            results = results.filter(room => room.maxGuests >= guests);
        }

        // 篩選預算
        if (budget) {
            results = results.filter(room => room.basePrice <= budget);
        }

        // 根據偏好排序
        if (preferences.length > 0) {
            results = results.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;

                if (preferences.includes('安靜') || preferences.includes('quiet')) {
                    scoreA += parseInt(a.floor.split('-')[0]);
                    scoreB += parseInt(b.floor.split('-')[0]);
                }

                if (preferences.includes('景觀') || preferences.includes('view')) {
                    if (a.view.includes('景觀')) scoreA += 10;
                    if (b.view.includes('景觀')) scoreB += 10;
                }

                if (preferences.includes('便宜') || preferences.includes('budget')) {
                    scoreA -= a.basePrice / 1000;
                    scoreB -= b.basePrice / 1000;
                }

                return scoreB - scoreA;
            });
        }

        // 添加可用數量
        return results.map(room => ({
            ...room,
            availableRooms: room.totalRooms - room.bookedRooms,
            pricePerNight: this.isWeekend(checkIn) ? room.weekendPrice : room.basePrice
        }));
    }

    async getRoomById(roomId) {
        return this.rooms.find(room => room.id === parseInt(roomId));
    }

    // ============================================
    // 價格計算
    // ============================================

    async calculatePrice(roomId, checkIn, checkOut) {
        const room = await this.getRoomById(roomId);
        if (!room) return null;

        const nights = this.calculateNights(checkIn, checkOut);
        
        // 計算每晚價格（考慮週末）
        let totalRoomPrice = 0;
        const currentDate = new Date(checkIn);
        const endDate = new Date(checkOut);
        
        while (currentDate < endDate) {
            const isWeekend = this.isWeekend(currentDate);
            totalRoomPrice += isWeekend ? room.weekendPrice : room.basePrice;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const serviceFee = Math.round(totalRoomPrice * 0.1);
        const tax = Math.round(totalRoomPrice * 0.05);
        const totalPrice = totalRoomPrice + serviceFee + tax;

        return {
            roomName: room.name,
            nights,
            breakdown: {
                roomPrice: totalRoomPrice,
                serviceFee,
                tax,
                total: totalPrice
            },
            pricePerNight: {
                weekday: room.basePrice,
                weekend: room.weekendPrice
            }
        };
    }

    // ============================================
    // 預訂管理
    // ============================================

    async createBooking(bookingData) {
        const bookingNumber = `BK${this.bookingCounter++}`;
        
        const booking = {
            bookingNumber,
            ...bookingData,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };

        this.bookings.push(booking);
        
        // 更新房間已訂數量
        const room = await this.getRoomById(bookingData.roomId);
        if (room) {
            room.bookedRooms += 1;
        }

        return booking;
    }

    async getBooking(bookingNumber) {
        return this.bookings.find(b => b.bookingNumber === bookingNumber);
    }

    // ============================================
    // 對話歷史
    // ============================================

    async saveConversation(sessionId, role, content, metadata = {}) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }

        const conversation = {
            role,
            content,
            ...metadata,
            timestamp: new Date().toISOString()
        };

        const history = this.conversations.get(sessionId);
        history.push(conversation);

        // 限制歷史長度（保留最近 20 條）
        if (history.length > 20) {
            history.shift();
        }

        return conversation;
    }

    async getConversationHistory(sessionId, limit = 10) {
        if (!this.conversations.has(sessionId)) {
            return [];
        }

        const history = this.conversations.get(sessionId);
        return history.slice(-limit);
    }

    async clearConversation(sessionId) {
        this.conversations.delete(sessionId);
    }

    // ============================================
    // 用戶偏好
    // ============================================

    async saveUserPreference(userId, preferences) {
        const existing = this.userPreferences.get(userId) || {};
        
        this.userPreferences.set(userId, {
            ...existing,
            ...preferences,
            updatedAt: new Date().toISOString()
        });

        return this.userPreferences.get(userId);
    }

    async getUserPreference(userId) {
        return this.userPreferences.get(userId) || null;
    }

    // ============================================
    // 輔助方法
    // ============================================

    calculateNights(checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isWeekend(date) {
        const d = new Date(date);
        const day = d.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }

    // ============================================
    // 統計數據
    // ============================================

    async getStatistics() {
        return {
            totalRooms: this.rooms.reduce((sum, room) => sum + room.totalRooms, 0),
            bookedRooms: this.rooms.reduce((sum, room) => sum + room.bookedRooms, 0),
            availableRooms: this.rooms.reduce((sum, room) => sum + (room.totalRooms - room.bookedRooms), 0),
            totalBookings: this.bookings.length,
            activeConversations: this.conversations.size
        };
    }
}

module.exports = new MockDataService();

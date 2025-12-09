// AddonsService.js
class AddonsService {
    /**
     * 獲取可用的加購項目清單，根據訂單人數計算描述
     * @param {number} adultCount 成人數
     * @param {number} childCount 兒童數
     * @returns {Array<Object>} 加購項目清單
     */
    static getAvailableAddons(adultCount, childCount) {
        // 模擬從資料庫讀取的加購清單
        return [
            {
                id: 'breakfast',
                name: '豪華自助式早餐',
                type: 'meal',
                priceAdult: 600,
                priceChild: 300,
                // 使用人數來動態生成描述
                description: `依訂單人數（成人 ${adultCount} 人，兒童 ${childCount} 人）計算費用。`,
                imageUrl: 'https://example.com/images/breakfast.jpg' 
            },
            {
                id: 'afternoon_tea',
                name: '經典雙人下午茶',
                type: 'package',
                // ⭐️ 修正：使用 priceFixed 讓 controller 知道是固定價格
                priceFixed: 1200, 
                description: '含兩客經典下午茶套餐，適合情侶或商務會談。',
                imageUrl: 'https://example.com/images/afternoon_tea.jpg' 
            },
            {
                id: 'museum_ticket',
                name: '台北故宮門票',
                type: 'ticket',
                priceAdult: 350,
                priceChild: 0,
                description: '可加購故宮博物院門票，大人費用 350 元。',
                imageUrl: 'https://example.com/images/museum.jpg' 
            },
            // ⭐️ 新增：機場接送服務 (問題 4)
            {
                id: 'transfer',
                name: '機場接送服務',
                type: 'package', // 視為單次固定的套餐
                priceFixed: 1200, // 假設固定價格
                description: '提供桃園/松山機場單程接送，舒適轎車，固定價格。',
                imageUrl: 'https://example.com/images/airport_transfer.jpg'
            }
        ];
    }

    /**
     * 根據 ID 獲取單個加購項目詳情
     */
    static getAddonById(addonId) {
        // 傳入預設人數，避免錯誤
        const addons = this.getAvailableAddons(1, 0); 
        return addons.find(addon => addon.id === addonId);
    }
}

module.exports = AddonsService;


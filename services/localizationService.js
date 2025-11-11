// 本地化服務
class LocalizationService {
    constructor() {
        this.supportedLanguages = ['zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
        this.translations = {
            'welcome': {
                'zh-TW': '歡迎使用AI訂房助理',
                'en-US': 'Welcome to AI Hotel Assistant',
                'ja-JP': 'AIホテルアシスタントへようこそ',
                'ko-KR': 'AI 호텔 어시스턴트에 오신 것을 환영합니다'
            },
            'room_selection': {
                'zh-TW': '請選擇房型',
                'en-US': 'Please select room type',
                'ja-JP': 'ルームタイプを選択してください',
                'ko-KR': '객실 유형을 선택해 주세요'
            },
            'price_total': {
                'zh-TW': '總計',
                'en-US': 'Total',
                'ja-JP': '合計',
                'ko-KR': '총액'
            },
            'confirmation': {
                'zh-TW': '確認預訂',
                'en-US': 'Confirm booking',
                'ja-JP': '予約を確認',
                'ko-KR': '예약 확인'
            }
        };
    }
    
    detectLanguage(text) {
        // 簡單的語言檢測
        if (/[\u4e00-\u9fff]/.test(text)) return 'zh-TW';
        if (/[a-zA-Z]/.test(text)) return 'en-US';
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP';
        if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
        return 'en-US'; // 預設
    }
    
    translate(key, language = 'zh-TW') {
        if (!this.translations[key]) {
            return key; // 回退到鍵名
        }
        
        if (!this.translations[key][language]) {
            // 回退到英文
            return this.translations[key]['en-US'] || key;
        }
        
        return this.translations[key][language];
    }
    
    formatCurrency(amount, currency = 'TWD', language = 'zh-TW') {
        const formats = {
            'zh-TW': `$${amount.toLocaleString()}`,
            'en-US': `$${amount.toLocaleString()}`,
            'ja-JP': `¥${amount.toLocaleString()}`,
            'ko-KR': `₩${amount.toLocaleString()}`
        };
        
        return formats[language] || `$${amount}`;
    }
    
    formatDate(dateString, language = 'zh-TW') {
        const date = new Date(dateString);
        const formats = {
            'zh-TW': `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
            'en-US': date.toLocaleDateString('en-US'),
            'ja-JP': `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
            'ko-KR': `${date.getFullYear()}년${date.getMonth() + 1}월${date.getDate()}일`
        };
        
        return formats[language] || date.toISOString().split('T')[0];
    }
}

// 正確導出類別實例
module.exports = new LocalizationService();

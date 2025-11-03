/**
 * 飯店業務資料
 * 包含房型、價格、設施等完整信息
 */

const hotelData = {
  hotelInfo: {
    name: "台北晶華酒店",
    stars: 5,
    address: "台北市中山區中山北路二段39巷3號",
    phone: "+886-2-2523-8000",
    checkIn: "15:00",
    checkOut: "12:00"
  },

  roomTypes: [
    {
      id: "deluxe",
      name: "豪華客房",
      size: "35平方公尺",
      capacity: 2,
      bed: "一張特大床或兩張單人床",
      price: 8800,
      features: ["市景", "免費WiFi", "迷你吧", "保險箱", "浴缸"],
      description: "舒適寬敞的客房，配有現代化設施，適合商務和休閒旅客"
    },
    {
      id: "executive",
      name: "行政客房",
      size: "42平方公尺",
      capacity: 2,
      bed: "一張特大床",
      price: 12800,
      features: ["行政酒廊使用權", "免費早餐", "晚間雞尾酒", "市景", "獨立浴缸和淋浴間"],
      description: "位於高樓層的行政客房，享有城市美景和額外禮遇"
    },
    {
      id: "suite",
      name: "套房",
      size: "68平方公尺",
      capacity: 3,
      bed: "一張特大床",
      price: 18800,
      features: ["獨立客廳", "用餐區", "迷你廚房", "兩間浴室", "全景落地窗"],
      description: "奢華套房提供獨立起居空間，適合家庭或長期入住"
    },
    {
      id: "presidential",
      name: "總統套房",
      size: "120平方公尺",
      capacity: 4,
      bed: "主臥特大床 + 客房雙人床",
      price: 38800,
      features: ["兩間臥室", "餐廳", "私人管家", "360度全景視野", "奢華浴室配備"],
      description: "頂級總統套房，提供無與倫比的奢華體驗"
    }
  ],

  facilities: [
    {
      category: "餐飲",
      items: ["三間餐廳", "行政酒廊", "大廳酒吧", "24小時客房服務"]
    },
    {
      category: "休閒",
      items: ["室內溫水游泳池", "健身中心", "SPA水療中心", "三溫暖"]
    },
    {
      category: "商務",
      items: ["商務中心", "會議室", "多功能宴會廳"]
    },
    {
      category: "服務",
      items: ["24小時禮賓服務", "機場接送", "洗衣服務", "停車場"]
    }
  ],

  policies: {
    cancellation: "入住前24小時免費取消",
    payment: "接受信用卡、現金",
    pets: "不允許攜帶寵物",
    smoking: "全館禁菸",
    children: "12歲以下兒童免費加床"
  }
};

module.exports = hotelData;

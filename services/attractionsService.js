// services/attractionsService.js
class AttractionsService {
  constructor() {
    this.attractions = {
      food: [
        { 
          name: '鼎泰豐', 
          distance: '150m', 
          type: '餐廳', 
          rating: 4.8, 
          description: '知名小籠包專賣店',
          address: '台北市大安區信義路二段194號',
          openingHours: '10:00-21:00',
          priceLevel: '$$',
          features: ['小籠包', '炒飯', '點心'],
          contact: '02-2321-4848'
        },
        { 
          name: '林東芳牛肉麵', 
          distance: '180m', 
          type: '餐廳', 
          rating: 4.6, 
          description: '老字號牛肉麵',
          address: '台北市中山區八德路二段322號',
          openingHours: '11:00-03:00',
          priceLevel: '$',
          features: ['半筋半肉麵', '牛肉湯'],
          contact: '02-2752-2556'
        },
        { 
          name: '阜杭豆漿', 
          distance: '250m', 
          type: '早餐', 
          rating: 4.7, 
          description: '傳統中式早餐',
          address: '台北市中正區忠孝東路一段108號',
          openingHours: '05:30-12:30',
          priceLevel: '$',
          features: ['厚餅夾蛋', '鹹豆漿', '燒餅油條'],
          contact: '02-2392-2175'
        }
      ],
      shopping: [
        { 
          name: '新光三越', 
          distance: '100m', 
          type: '購物', 
          rating: 4.5, 
          description: '大型百貨公司',
          address: '台北市信義區松高路19號',
          openingHours: '11:00-21:30',
          priceLevel: '$$$',
          features: ['國際精品', '化妝品', '美食街'],
          contact: '02-8780-9966'
        },
        { 
          name: '誠品書店', 
          distance: '120m', 
          type: '書店', 
          rating: 4.7, 
          description: '文青書店',
          address: '台北市信義區松高路11號',
          openingHours: '10:00-22:00',
          priceLevel: '$$',
          features: ['書籍', '文創商品', '咖啡廳'],
          contact: '02-8789-3388'
        },
        { 
          name: '微風廣場', 
          distance: '180m', 
          type: '購物', 
          rating: 4.4, 
          description: '時尚購物中心',
          address: '台北市松山區復興南路一段39號',
          openingHours: '11:00-21:30',
          priceLevel: '$$$',
          features: ['設計師品牌', '餐廳', '超市'],
          contact: '02-6600-8888'
        }
      ],
      nature: [
        { 
          name: '大安森林公園', 
          distance: '200m', 
          type: '公園', 
          rating: 4.9, 
          description: '都市中的綠洲',
          address: '台北市大安區新生南路二段1號',
          openingHours: '24小時',
          priceLevel: '免費',
          features: ['散步', '野餐', '生態池', '兒童遊樂場'],
          contact: '02-2700-3830'
        },
        { 
          name: '國父紀念館', 
          distance: '350m', 
          type: '公園', 
          rating: 4.6, 
          description: '歷史紀念館與公園',
          address: '台北市信義區仁愛路四段505號',
          openingHours: '09:00-18:00',
          priceLevel: '免費',
          features: ['衛兵交接', '展覽', '廣場'],
          contact: '02-2758-8008'
        }
      ],
      culture: [
        { 
          name: '中正紀念堂', 
          distance: '800m', 
          type: '古蹟', 
          rating: 4.7, 
          description: '歷史建築',
          address: '台北市中正區中山南路21號',
          openingHours: '09:00-18:00',
          priceLevel: '免費',
          features: ['衛兵交接', '展覽', '廣場'],
          contact: '02-2343-1100'
        },
        { 
          name: '台北101觀景台', 
          distance: '500m', 
          type: '觀光', 
          rating: 4.8, 
          description: '台北地標建築',
          address: '台北市信義區信義路五段7號',
          openingHours: '11:00-21:00',
          priceLevel: '$$$',
          features: ['觀景台', '購物中心', '餐廳'],
          contact: '02-8101-8899'
        }
      ],
      nightmarket: [
        { 
          name: '通化夜市', 
          distance: '500m', 
          type: '夜市', 
          rating: 4.4, 
          description: '美食小吃聚集地',
          address: '台北市大安區通化街',
          openingHours: '18:00-24:00',
          priceLevel: '$',
          features: ['小吃', '遊戲', '服飾'],
          contact: ''
        },
        { 
          name: '臨江街夜市', 
          distance: '450m', 
          type: '夜市', 
          rating: 4.3, 
          description: '當地人喜愛的夜市',
          address: '台北市大安區臨江街',
          openingHours: '18:00-24:00',
          priceLevel: '$',
          features: ['美食', '生活用品', '服飾'],
          contact: ''
        }
      ],
      convenience: [
        { 
          name: '7-11', 
          distance: '50m', 
          type: '便利商店', 
          rating: 4.2, 
          description: '24小時便利商店',
          address: '酒店大廳',
          openingHours: '24小時',
          priceLevel: '$',
          features: ['零食', '飲料', '日用品', 'ATM'],
          contact: ''
        },
        { 
          name: '全家便利商店', 
          distance: '80m', 
          type: '便利商店', 
          rating: 4.2, 
          description: '連鎖便利商店',
          address: '台北市大安區仁愛路四段',
          openingHours: '24小時',
          priceLevel: '$',
          features: ['咖啡', '便當', '複印'],
          contact: ''
        }
      ]
    };
  }

  // 根據類型推薦景點
  recommendByType(type, maxDistance = 200) {
    const filtered = this.attractions[type]?.filter(attr => {
      const distance = parseInt(attr.distance);
      return distance <= maxDistance;
    }) || [];
    
    return {
      success: true,
      type,
      maxDistance: `${maxDistance}公尺`,
      attractions: filtered,
      count: filtered.length
    };
  }

  // 搜索景點
  searchAttractions(keyword, maxDistance = 200) {
    const results = [];
    Object.values(this.attractions).forEach(category => {
      category.forEach(attr => {
        const distance = parseInt(attr.distance);
        if (distance <= maxDistance && 
            (attr.name.includes(keyword) || 
             attr.description.includes(keyword) ||
             attr.type.includes(keyword) ||
             (attr.features && attr.features.some(feature => feature.includes(keyword))))) {
          results.push(attr);
        }
      });
    });
    
    return {
      success: true,
      keyword,
      maxDistance: `${maxDistance}公尺`,
      attractions: results,
      count: results.length
    };
  }

  // 獲取所有附近景點
  getAllNearby(maxDistance = 200) {
    const allAttractions = [];
    Object.values(this.attractions).forEach(category => {
      category.forEach(attr => {
        const distance = parseInt(attr.distance);
        if (distance <= maxDistance) {
          allAttractions.push(attr);
        }
      });
    });
    
    return {
      success: true,
      maxDistance: `${maxDistance}公尺`,
      attractions: allAttractions,
      count: allAttractions.length
    };
  }

  // 獲取景點詳細資訊
  getAttractionDetails(name) {
    for (const category of Object.values(this.attractions)) {
      const attraction = category.find(attr => attr.name === name);
      if (attraction) {
        return {
          success: true,
          attraction: attraction
        };
      }
    }
    
    return {
      success: false,
      error: '找不到該景點'
    };
  }

  // 獲取推薦路線
  getRecommendedRoute(types = [], maxDistance = 500) {
    const route = [];
    types.forEach(type => {
      const attractions = this.recommendByType(type, maxDistance).attractions;
      if (attractions.length > 0) {
        route.push({
          type,
          attraction: attractions[0] // 取評分最高的
        });
      }
    });
    
    return {
      success: true,
      route: route,
      totalDistance: maxDistance,
      estimatedTime: `${route.length * 30}分鐘`
    };
  }

  // 獲取服務類別列表
  getCategories() {
    const categories = {
      'food': '美食餐廳',
      'shopping': '購物中心', 
      'nature': '自然景觀',
      'culture': '文化古蹟',
      'nightmarket': '夜市小吃',
      'convenience': '便利商店'
    };
    
    return {
      success: true,
      categories: categories
    };
  }
}

module.exports = AttractionsService;

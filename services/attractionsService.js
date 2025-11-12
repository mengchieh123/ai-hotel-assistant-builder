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
          contact: '02-2321-4848',
          recommendedDishes: ['小籠包', '蝦仁炒飯', '紅油抄手'],
          averageCost: '300-600 TWD',
          bestTime: '14:00-17:00 (避開用餐高峰)',
          reservation: '建議預約',
          tags: ['中式', '點心', '適合家庭']
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
          contact: '02-2752-2556',
          recommendedDishes: ['半筋半肉牛肉麵', '清燉牛肉湯'],
          averageCost: '200-350 TWD',
          bestTime: '15:00-17:00',
          reservation: '不接受預約',
          tags: ['台灣小吃', '牛肉麵', '宵夜']
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
          contact: '02-2392-2175',
          recommendedDishes: ['厚餅夾蛋', '鹹豆漿', '飯糰'],
          averageCost: '80-150 TWD',
          bestTime: '07:00前',
          reservation: '不接受預約',
          tags: ['早餐', '傳統', '排隊名店']
        },
        { 
          name: 'RAW餐廳', 
          distance: '300m', 
          type: '餐廳', 
          rating: 4.9, 
          description: '米其林三星創意料理',
          address: '台北市大安區忠孝東路四段',
          openingHours: '18:00-22:00',
          priceLevel: '$$$$',
          features: ['創意料理', '精緻用餐'],
          contact: '02-2321-4888',
          recommendedDishes: ['季節套餐', '創意前菜'],
          averageCost: '3000-5000 TWD',
          bestTime: '需預約',
          reservation: '必須預約',
          tags: ['米其林', '精緻', '特殊場合']
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
          contact: '02-8780-9966',
          floorGuide: 'B2:美食街, 1F:精品, 4F:女裝, 6F:家居',
          parking: '地下停車場',
          tags: ['百貨', '精品', '家庭購物']
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
          contact: '02-8789-3388',
          floorGuide: '1F:新書, 2F:文學, 3F:藝術',
          parking: '附近停車場',
          tags: ['書店', '文創', '咖啡']
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
          contact: '02-6600-8888',
          floorGuide: 'B1:超市, 1F:奢侈品, 2F:時尚',
          parking: '地下停車場',
          tags: ['時尚', '設計師', '美食']
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
          contact: '02-2700-3830',
          activities: ['晨跑', '野餐', '親子活動', '攝影'],
          bestTime: '06:00-10:00, 16:00-18:00',
          facilities: ['廁所', '飲水機', '兒童遊樂場'],
          tags: ['公園', '親子', '運動']
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
          contact: '02-2758-8008',
          activities: ['觀賞衛兵交接', '參觀展覽', '太極拳'],
          bestTime: '09:00-11:00, 14:00-16:00',
          facilities: ['展覽廳', '紀念品店', '廁所'],
          tags: ['歷史', '文化', '免費']
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
          contact: '02-2343-1100',
          activities: ['衛兵交接儀式', '參觀展覽', '建築攝影'],
          bestTime: '10:00, 14:00 (衛兵交接時間)',
          facilities: ['展覽廳', '紀念品店', '遊客中心'],
          tags: ['歷史', '建築', '免費']
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
          contact: '02-8101-8899',
          activities: ['觀景台參觀', '購物', '美食'],
          bestTime: '16:00-18:00 (日落時分)',
          facilities: ['觀景台', '購物中心', '餐廳'],
          tags: ['地標', '觀景', '購物']
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
          contact: '',
          mustTry: ['胡記米粉湯', '紅花鹽水雞', '御品元冰火湯圓'],
          bestTime: '19:00-22:00',
          tags: ['夜市', '小吃', '本地特色']
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
          contact: '',
          mustTry: ['梁記滷味', '愛玉之夢遊仙草', '石家割包'],
          bestTime: '19:00-23:00',
          tags: ['夜市', '傳統', '美食']
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
          contact: '',
          services: ['ATM', '影印', '繳費', '咖啡'],
          tags: ['便利', '24小時', '基本需求']
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
          contact: '',
          services: ['咖啡', '便當', '霜淇淋', '包裹代收'],
          tags: ['便利', '咖啡', '餐食']
        }
      ]
    };

    // 新增：推薦組合
    this.recommendedCombinations = {
      family: ['nature', 'food', 'shopping'],
      couple: ['culture', 'food', 'nature'],
      friends: ['nightmarket', 'shopping', 'food'],
      business: ['convenience', 'food', 'shopping'],
      solo: ['culture', 'nature', 'convenience']
    };
  }

  // 根據類型推薦景點（增強版）
  recommendByType(type, maxDistance = 200, sortBy = 'rating') {
    let filtered = this.attractions[type]?.filter(attr => {
      const distance = parseInt(attr.distance);
      return distance <= maxDistance;
    }) || [];
    
    // 排序
    if (sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'distance') {
      filtered.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
    }
    
    return {
      success: true,
      type,
      typeName: this.getTypeName(type),
      maxDistance: `${maxDistance}公尺`,
      attractions: filtered,
      count: filtered.length,
      recommendation: this.getTypeRecommendation(type)
    };
  }

  // 智能搜索景點（增強版）
  searchAttractions(keyword, maxDistance = 200, filters = {}) {
    const results = [];
    Object.values(this.attractions).forEach(category => {
      category.forEach(attr => {
        const distance = parseInt(attr.distance);
        if (distance <= maxDistance) {
          const matchesKeyword = 
            attr.name.includes(keyword) || 
            attr.description.includes(keyword) ||
            attr.type.includes(keyword) ||
            (attr.features && attr.features.some(feature => feature.includes(keyword))) ||
            (attr.tags && attr.tags.some(tag => tag.includes(keyword)));
          
          const matchesFilters = this.matchesFilters(attr, filters);
          
          if (matchesKeyword && matchesFilters) {
            results.push(attr);
          }
        }
      });
    });
    
    // 按評分排序
    results.sort((a, b) => b.rating - a.rating);
    
    return {
      success: true,
      keyword,
      maxDistance: `${maxDistance}公尺`,
      attractions: results,
      count: results.length,
      searchSummary: this.generateSearchSummary(keyword, results)
    };
  }

  // 獲取所有附近景點（增強版）
  getAllNearby(maxDistance = 200, limit = 10) {
    const allAttractions = [];
    Object.values(this.attractions).forEach(category => {
      category.forEach(attr => {
        const distance = parseInt(attr.distance);
        if (distance <= maxDistance) {
          allAttractions.push(attr);
        }
      });
    });
    
    // 按距離排序
    allAttractions.sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
    
    const limitedAttractions = allAttractions.slice(0, limit);
    
    return {
      success: true,
      maxDistance: `${maxDistance}公尺`,
      attractions: limitedAttractions,
      count: limitedAttractions.length,
      totalCount: allAttractions.length
    };
  }

  // 獲取景點詳細資訊（增強版）
  getAttractionDetails(name) {
    for (const category of Object.values(this.attractions)) {
      const attraction = category.find(attr => attr.name === name);
      if (attraction) {
        return {
          success: true,
          attraction: {
            ...attraction,
            detailedInfo: this.generateDetailedInfo(attraction),
            nearbyAttractions: this.findNearbyAttractions(attraction, 300),
            travelTips: this.generateTravelTips(attraction)
          }
        };
      }
    }
    
    return {
      success: false,
      error: '找不到該景點',
      suggestions: this.getSimilarAttractions(name)
    };
  }

  // 新增：智能推薦路線
  getRecommendedRoute(userType = 'family', maxDistance = 500, duration = 'half-day') {
    const types = this.recommendedCombinations[userType] || this.recommendedCombinations.family;
    const route = [];
    
    types.forEach(type => {
      const attractions = this.recommendByType(type, maxDistance).attractions;
      if (attractions.length > 0) {
        route.push({
          type,
          typeName: this.getTypeName(type),
          attraction: attractions[0],
          recommendedDuration: this.getRecommendedDuration(attractions[0], duration)
        });
      }
    });
    
    return {
      success: true,
      userType,
      userTypeName: this.getUserTypeName(userType),
      route: route,
      totalDistance: maxDistance,
      estimatedTime: this.calculateEstimatedTime(route, duration),
      itinerary: this.generateItinerary(route, duration)
    };
  }

  // 新增：根據需求推薦
  recommendByNeeds(needs = [], maxDistance = 300) {
    const recommendations = {};
    
    needs.forEach(need => {
      const matchedTypes = this.findTypesByNeed(need);
      matchedTypes.forEach(type => {
        if (!recommendations[type]) {
          recommendations[type] = this.recommendByType(type, maxDistance, 'distance');
        }
      });
    });
    
    return {
      success: true,
      needs,
      recommendations,
      summary: this.generateNeedsSummary(needs, recommendations)
    };
  }

  // 獲取服務類別列表（增強版）
  getCategories() {
    const categories = {
      'food': '美食餐廳',
      'shopping': '購物中心', 
      'nature': '自然景觀',
      'culture': '文化古蹟',
      'nightmarket': '夜市小吃',
      'convenience': '便利商店'
    };
    
    const categoryStats = {};
    Object.keys(categories).forEach(type => {
      categoryStats[type] = {
        name: categories[type],
        count: this.attractions[type]?.length || 0,
        avgRating: this.calculateAverageRating(type),
        avgDistance: this.calculateAverageDistance(type)
      };
    });
    
    return {
      success: true,
      categories: categories,
      statistics: categoryStats,
      popularCategories: this.getPopularCategories()
    };
  }

  // 新增：獲取今日推薦
  getTodayRecommendations(weather = 'sunny', timeOfDay = 'afternoon') {
    const recommendations = {};
    
    if (weather === 'rainy') {
      recommendations.indoor = this.recommendByType('shopping', 200);
      recommendations.indoor.attractions.push(...this.recommendByType('culture', 200).attractions);
    } else {
      recommendations.outdoor = this.recommendByType('nature', 300);
    }
    
    if (timeOfDay === 'morning') {
      recommendations.breakfast = this.searchAttractions('早餐', 200);
    } else if (timeOfDay === 'evening') {
      recommendations.night = this.recommendByType('nightmarket', 300);
    }
    
    return {
      success: true,
      weather,
      timeOfDay,
      recommendations,
      message: this.generateWeatherMessage(weather, timeOfDay)
    };
  }

  // ==================== 輔助方法 ====================

  getTypeName(type) {
    const typeNames = {
      'food': '美食餐廳',
      'shopping': '購物中心',
      'nature': '自然景觀',
      'culture': '文化古蹟',
      'nightmarket': '夜市小吃',
      'convenience': '便利商店'
    };
    return typeNames[type] || type;
  }

  getUserTypeName(userType) {
    const userTypeNames = {
      'family': '家庭旅遊',
      'couple': '情侶約會',
      'friends': '朋友聚會',
      'business': '商務行程',
      'solo': '獨自旅行'
    };
    return userTypeNames[userType] || userType;
  }

  getTypeRecommendation(type) {
    const recommendations = {
      'food': '建議避開用餐高峰時段',
      'shopping': '百貨公司通常11點開始營業',
      'nature': '清晨和傍晚是最佳遊覽時間',
      'culture': '注意展覽和衛兵交接時間',
      'nightmarket': '晚上7-10點是最熱鬧的時段',
      'convenience': '24小時營業，隨時可前往'
    };
    return recommendations[type] || '';
  }

  matchesFilters(attraction, filters) {
    if (filters.priceLevel && attraction.priceLevel !== filters.priceLevel) {
      return false;
    }
    if (filters.minRating && attraction.rating < filters.minRating) {
      return false;
    }
    if (filters.tags && filters.tags.some(tag => !attraction.tags?.includes(tag))) {
      return false;
    }
    return true;
  }

  generateSearchSummary(keyword, results) {
    if (results.length === 0) {
      return `沒有找到包含"${keyword}"的景點`;
    }
    
    const topCategories = {};
    results.forEach(attr => {
      topCategories[attr.type] = (topCategories[attr.type] || 0) + 1;
    });
    
    const mostCommonCategory = Object.keys(topCategories).reduce((a, b) => 
      topCategories[a] > topCategories[b] ? a : b
    );
    
    return `找到 ${results.length} 個相關景點，主要集中在${this.getTypeName(mostCommonCategory)}`;
  }

  generateDetailedInfo(attraction) {
    return {
      bestVisitTime: attraction.bestTime || '全天',
      estimatedCost: attraction.averageCost || '視消費而定',
      reservationNeeded: attraction.reservation || '不需要',
      suitableFor: attraction.tags || ['一般遊客'],
      specialFeatures: attraction.features || []
    };
  }

  findNearbyAttractions(attraction, maxDistance) {
    const nearby = [];
    const baseDistance = parseInt(attraction.distance);
    
    Object.values(this.attractions).forEach(category => {
      category.forEach(attr => {
        if (attr.name !== attraction.name) {
          const distance = parseInt(attr.distance);
          if (Math.abs(distance - baseDistance) <= maxDistance) {
            nearby.push(attr);
          }
        }
      });
    });
    
    return nearby.slice(0, 3); // 返回最近的3個景點
  }

  generateTravelTips(attraction) {
    const tips = [];
    
    if (attraction.type === 'food') {
      tips.push('建議避開用餐高峰時段');
      if (attraction.reservation === '建議預約') {
        tips.push('建議提前預約');
      }
    }
    
    if (attraction.type === 'shopping') {
      tips.push('可辦理退稅服務');
      tips.push('百貨公司通常有地下美食街');
    }
    
    if (attraction.type === 'nature') {
      tips.push('建議攜帶防蚊液');
      tips.push('適合晨跑或傍晚散步');
    }
    
    if (attraction.priceLevel === '$$$$') {
      tips.push('高消費場所，建議預算充足');
    }
    
    return tips;
  }

  getSimilarAttractions(name) {
    // 簡單的相似度匹配（實際應該更複雜）
    const results = this.searchAttractions(name.split('')[0], 500).attractions;
    return results.filter(attr => attr.name !== name).slice(0, 3);
  }

  calculateEstimatedTime(route, duration) {
    const baseTime = duration === 'half-day' ? 180 : 360; // 分鐘
    return `${Math.min(baseTime, route.length * 60)}分鐘`;
  }

  generateItinerary(route, duration) {
    return route.map((item, index) => ({
      order: index + 1,
      time: `${9 + index * 2}:00`,
      activity: `參觀${item.attraction.name}`,
      duration: '1-2小時',
      type: item.typeName
    }));
  }

  findTypesByNeed(need) {
    const needMapping = {
      '吃飯': ['food'],
      '購物': ['shopping'],
      '散步': ['nature'],
      '觀光': ['culture', 'nature'],
      '夜市': ['nightmarket'],
      '便利': ['convenience'],
      '親子': ['nature', 'shopping'],
      '約會': ['culture', 'food', 'nature']
    };
    return needMapping[need] || ['food', 'shopping'];
  }

  generateNeedsSummary(needs, recommendations) {
    const totalAttractions = Object.values(recommendations).reduce((sum, rec) => 
      sum + (rec.attractions?.length || 0), 0
    );
    return `根據您的${needs.join('、')}需求，為您推薦${totalAttractions}個相關景點`;
  }

  calculateAverageRating(type) {
    const attractions = this.attractions[type] || [];
    if (attractions.length === 0) return 0;
    return (attractions.reduce((sum, attr) => sum + attr.rating, 0) / attractions.length).toFixed(1);
  }

  calculateAverageDistance(type) {
    const attractions = this.attractions[type] || [];
    if (attractions.length === 0) return 0;
    return Math.round(attractions.reduce((sum, attr) => sum + parseInt(attr.distance), 0) / attractions.length);
  }

  getPopularCategories() {
    const stats = Object.keys(this.attractions).map(type => ({
      type,
      name: this.getTypeName(type),
      count: this.attractions[type].length,
      avgRating: this.calculateAverageRating(type)
    }));
    
    return stats.sort((a, b) => b.avgRating - a.avgRating).slice(0, 3);
  }

  getRecommendedDuration(attraction, duration) {
    const baseDuration = duration === 'half-day' ? 60 : 120;
    if (attraction.type === 'shopping') return baseDuration + 30;
    if (attraction.type === 'culture') return baseDuration + 20;
    return baseDuration;
  }

  generateWeatherMessage(weather, timeOfDay) {
    const messages = {
      sunny: '天氣晴朗，適合戶外活動',
      rainy: '下雨天，建議安排室內行程',
      cloudy: '多雲天氣，適合各種活動'
    };
    
    const timeMessages = {
      morning: '早上空氣清新',
      afternoon: '下午時光悠閒',
      evening: '夜晚氣氛浪漫'
    };
    
    return `${messages[weather]}，${timeMessages[timeOfDay]}。`;
  }
}

module.exports = AttractionsService;

// services/memberService.js
class MemberService {
  constructor() {
    this.members = new Map();
    this.memberLevels = {
      none: { 
        discount: 0, 
        name: '非會員', 
        minPoints: 0,
        color: '⚪',
        benefits: ['房價 98 折優惠']
      },
      silver: { 
        discount: 0.05, 
        name: '銀卡會員', 
        minPoints: 1000,
        color: '🥈',
        benefits: [
          '房價 95 折優惠',
          '免費早餐',
          '提前入住 (14:00)',
          '專屬會員積分 (消費1元=1.2積分)',
          '生日當月 88 折優惠'
        ]
      },
      gold: { 
        discount: 0.1, 
        name: '金卡會員', 
        minPoints: 5000,
        color: '🎖️',
        benefits: [
          '房價 9 折優惠',
          '免費早餐',
          '提前入住/延遲退房 (13:00-15:00)',
          '房型免費升級機會',
          '迎賓水果',
          '專屬會員積分 (消費1元=1.5積分)',
          '生日當月免費升等'
        ]
      },
      platinum: { 
        discount: 0.15, 
        name: '白金會員', 
        minPoints: 15000,
        color: '💎',
        benefits: [
          '房價 85 折優惠',
          '免費早餐 + 晚餐',
          '24小時彈性入住/退房',
          '保證房型升級',
          '專屬管家服務',
          '機場接送服務',
          '專屬會員積分 (消費1元=2積分)',
          '生日免費住宿一晚'
        ]
      }
    };
    
    this.memberPackages = {
      business: {
        name: '商務會員專案',
        price: 8888,
        benefits: [
          '一年內無限次 85 折優惠',
          '每次住宿累積雙倍積分',
          '專屬商務樓層',
          '會議室使用時數 10小時/年',
          '免費延遲退房至16:00'
        ],
        target: '頻繁出差商務客'
      },
      family: {
        name: '家庭會員專案', 
        price: 6888,
        benefits: [
          '家庭房型專屬 8 折',
          '兒童免費加床',
          '親子活動體驗券',
          '生日派對佈置服務',
          '家庭攝影服務'
        ],
        target: '親子旅遊家庭'
      },
      luxury: {
        name: '奢華會員專案',
        price: 18888,
        benefits: [
          '套房房型專屬 7 折',
          '私人管家服務',
          '米其林餐廳用餐券',
          'SPA療程體驗',
          '豪華轎車接送'
        ],
        target: '高端奢華旅客'
      }
    };
    
    this.initializeSampleMembers();
  }

  initializeSampleMembers() {
    this.members.set('M001', {
      id: 'M001',
      name: '張小明',
      level: 'gold',
      points: 6500,
      joinDate: '2023-01-15',
      contact: 'zhang@example.com',
      phone: '0912-345-678',
      totalSpent: 125000,
      lastStay: '2024-10-20'
    });

    this.members.set('M002', {
      id: 'M002', 
      name: '李美華',
      level: 'silver',
      points: 2500,
      joinDate: '2023-05-20',
      contact: 'li@example.com',
      phone: '0933-456-789',
      totalSpent: 45000,
      lastStay: '2024-09-15'
    });

    this.members.set('M003', {
      id: 'M003',
      name: '王大明', 
      level: 'platinum',
      points: 18500,
      joinDate: '2022-08-10',
      contact: 'wang@example.com',
      phone: '0921-234-567',
      totalSpent: 285000,
      lastStay: '2024-11-05'
    });
  }

  // 會員搜尋功能
  async searchMembers(query) {
    try {
      const results = [];
      const lowerQuery = query.toLowerCase();
      
      for (const [id, member] of this.members.entries()) {
        if (
          member.name.toLowerCase().includes(lowerQuery) ||
          member.contact.toLowerCase().includes(lowerQuery) ||
          member.phone.includes(query) ||
          id.toLowerCase().includes(lowerQuery)
        ) {
          results.push(member);
        }
      }
      
      return {
        success: true,
        results,
        count: results.length,
        query
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 會員登入與身份驗證
  async memberLogin(identifier, password = 'default123') {
    try {
      // 實務上這裡應該有真正的驗證邏輯
      let member = null;
      
      // 根據不同識別方式查找會員
      for (const [id, m] of this.members.entries()) {
        if (m.contact === identifier || m.phone === identifier || id === identifier) {
          member = m;
          break;
        }
      }
      
      if (!member) {
        // 模擬新會員註冊
        const newMemberId = 'M' + String(this.members.size + 1).padStart(3, '0');
        member = {
          id: newMemberId,
          name: '新會員',
          level: 'none',
          points: 0,
          joinDate: new Date().toISOString().split('T')[0],
          contact: identifier,
          phone: '',
          totalSpent: 0
        };
        this.members.set(newMemberId, member);
        
        return {
          success: true,
          member,
          isNew: true,
          message: '歡迎新會員！已為您建立帳戶，立即享受會員優惠！'
        };
      }
      
      return {
        success: true,
        member,
        isNew: false,
        message: `歡迎回來，${member.name}！您的會員等級：${this.memberLevels[member.level].name}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 推薦會員專案
  async recommendPackages(memberId = null) {
    try {
      let member = null;
      if (memberId) {
        const memberResult = await this.getMemberLevel(memberId);
        if (memberResult.success) {
          member = memberResult.member;
        }
      }
      
      let recommendations = [];
      
      if (member) {
        // 根據會員特徵推薦
        if (member.totalSpent > 100000) {
          recommendations.push(this.memberPackages.luxury);
        }
        if (member.level === 'silver' || member.level === 'gold') {
          recommendations.push(this.memberPackages.business);
        }
      }
      
      // 如果沒有特定推薦，返回所有專案
      if (recommendations.length === 0) {
        recommendations = Object.values(this.memberPackages);
      }
      
      return {
        success: true,
        recommendations,
        memberLevel: member ? member.level : 'none',
        message: member ? '為您精選的會員專案' : '熱門會員專案推薦'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 加入會員流程
  async joinMember(userData) {
    try {
      const { name, contact, phone } = userData;
      
      if (!name || !contact) {
        throw new Error('請提供姓名和聯絡方式');
      }
      
      // 檢查是否已是會員
      for (const member of this.members.values()) {
        if (member.contact === contact || (phone && member.phone === phone)) {
          return {
            success: false,
            error: '該聯絡方式已是會員',
            member
          };
        }
      }
      
      const newMemberId = 'M' + String(this.members.size + 1).padStart(3, '0');
      const newMember = {
        id: newMemberId,
        name,
        level: 'none',
        points: 100, // 加入送100點
        joinDate: new Date().toISOString().split('T')[0],
        contact,
        phone: phone || '',
        totalSpent: 0
      };
      
      this.members.set(newMemberId, newMember);
      
      return {
        success: true,
        member: newMember,
        welcomeBonus: 100,
        message: `🎉 歡迎 ${name} 加入會員！已贈送 100 點歡迎積分！`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 會員升級建議
  async getUpgradeSuggestion(memberId) {
    try {
      const memberResult = await this.getMemberLevel(memberId);
      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }
      
      const { member } = memberResult;
      const currentLevel = member.level;
      const suggestions = [];
      
      for (const [level, info] of Object.entries(this.memberLevels)) {
        if (level !== 'none' && level !== currentLevel && this.memberLevels[currentLevel].minPoints < info.minPoints) {
          const pointsNeeded = info.minPoints - member.points;
          if (pointsNeeded > 0) {
            suggestions.push({
              targetLevel: level,
              targetName: info.name,
              pointsNeeded,
              currentPoints: member.points,
              benefits: info.benefits.slice(0, 3) // 顯示前3個主要優惠
            });
          }
        }
      }
      
      return {
        success: true,
        member,
        suggestions,
        hasSuggestions: suggestions.length > 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 會員專屬優惠
  async getExclusiveOffers(memberId) {
    try {
      const memberResult = await this.getMemberLevel(memberId);
      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }
      
      const { member } = memberResult;
      const level = member.level;
      
      const offers = {
        gold: [
          '週末住宿 75 折優惠',
          '餐飲消費 8 折',
          '免費接駁服務'
        ],
        platinum: [
          '年度住宿 7 折專案', 
          '米其林餐廳買一送一',
          '免費機場接送',
          'SPA療程 5 折'
        ],
        silver: [
          '平日住宿 85 折',
          '早餐買一送一'
        ]
      };
      
      return {
        success: true,
        member,
        offers: offers[level] || ['立即加入會員享受專屬優惠！'],
        level: this.memberLevels[level].name
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 原有的方法保持不變，但可以優化回應格式
  async getMemberBenefits(memberId) {
    try {
      const memberResult = await this.getMemberLevel(memberId);
      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }

      const { member } = memberResult;
      const levelInfo = this.memberLevels[member.level];

      return {
        success: true,
        member,
        benefits: levelInfo.benefits,
        levelInfo: {
          name: levelInfo.name,
          color: levelInfo.color,
          discount: levelInfo.discount * 100
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMemberLevel(memberId) {
    try {
      if (!memberId) {
        return {
          success: true,
          member: {
            id: 'guest',
            level: 'none',
            name: '非會員',
            points: 0
          }
        };
      }

      const member = this.members.get(memberId);
      if (!member) {
        throw new Error('會員不存在');
      }
      
      return {
        success: true,
        member
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async calculatePoints(amount) {
    try {
      if (amount < 0) {
        throw new Error('金額必須為正數');
      }

      const points = Math.floor(amount / 100);
      
      return {
        success: true,
        points,
        message: `消費 ${amount} 元可獲得 ${points} 點`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 新增：取得所有會員等級資訊
  async getAllLevelsInfo() {
    return {
      success: true,
      levels: this.memberLevels,
      packages: this.memberPackages
    };
  }
}

module.exports = new MemberService();

// services/memberService.js
class MemberService {
  constructor() {
    this.members = new Map();
    this.memberLevels = {
      none: { discount: 0, name: '非會員', minPoints: 0 },
      silver: { discount: 0.05, name: '銀卡會員', minPoints: 1000 },
      gold: { discount: 0.1, name: '金卡會員', minPoints: 5000 },
      platinum: { discount: 0.15, name: '白金會員', minPoints: 15000 }
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
      contact: 'zhang@example.com'
    });

    this.members.set('M002', {
      id: 'M002', 
      name: '李美華',
      level: 'silver',
      points: 2500,
      joinDate: '2023-05-20',
      contact: 'li@example.com'
    });
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

  async upgradeMember(memberId, targetLevel) {
    try {
      const member = this.members.get(memberId);
      if (!member) {
        throw new Error('會員不存在');
      }

      if (!this.memberLevels[targetLevel]) {
        throw new Error('無效的會員等級');
      }

      const targetLevelInfo = this.memberLevels[targetLevel];
      if (member.points < targetLevelInfo.minPoints) {
        throw new Error(`點數不足，需要 ${targetLevelInfo.minPoints} 點才能升級到 ${targetLevelInfo.name}`);
      }

      const oldLevel = member.level;
      member.level = targetLevel;
      member.updatedAt = new Date().toISOString();

      return {
        success: true,
        member,
        message: `會員等級已從 ${this.memberLevels[oldLevel].name} 升級為 ${targetLevelInfo.name}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addPoints(memberId, pointsToAdd) {
    try {
      const member = this.members.get(memberId);
      if (!member) {
        throw new Error('會員不存在');
      }

      if (pointsToAdd <= 0) {
        throw new Error('點數必須為正數');
      }

      member.points += pointsToAdd;
      member.updatedAt = new Date().toISOString();

      let upgraded = false;
      let upgradeMessage = '';

      for (const [level, info] of Object.entries(this.memberLevels)) {
        if (level !== 'none' && member.points >= info.minPoints && 
            this.memberLevels[member.level].minPoints < info.minPoints) {
          const oldLevel = member.level;
          member.level = level;
          upgraded = true;
          upgradeMessage = `自動升級為 ${info.name}`;
          break;
        }
      }

      return {
        success: true,
        member,
        pointsAdded: pointsToAdd,
        upgraded,
        upgradeMessage
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMemberBenefits(memberId) {
    try {
      const memberResult = await this.getMemberLevel(memberId);
      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }

      const { member } = memberResult;
      const levelInfo = this.memberLevels[member.level];

      const benefits = {
        discount: levelInfo.discount * 100,
        freeBreakfast: member.level !== 'none',
        lateCheckout: member.level === 'gold' || member.level === 'platinum',
        roomUpgrade: member.level === 'platinum',
        welcomeGift: true
      };

      return {
        success: true,
        member,
        benefits,
        levelInfo
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MemberService();

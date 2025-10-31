const Member = require('../models/Member');
class MembershipService {
  constructor() { 
    this.members = new Map();
  }
  registerMember(userId, level = '普通會員') {
    const member = new Member(userId, level, 0);
    this.members.set(userId, member);
    return member;
  }
  getMember(userId) { 
    return this.members.get(userId); 
  }
}
module.exports = new MembershipService();
// services/roomStatusService.js
class RoomStatusService {
  constructor() { this.serviceName = 'roomStatusService'; }
  async process(data) {
    return { success: true, service: this.serviceName, data };
  }
}
module.exports = new RoomStatusService();

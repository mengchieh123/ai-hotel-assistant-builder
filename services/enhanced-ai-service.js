class EnhancedAIService {
    constructor() {
        this.version = '5.2.0-OPTIMIZED-FIXED';
    }

    async processMessage(message) {
        console.log(`处理消息: ${message}`);
        
        // 简单的意图识别
        let intent = 'greeting';
        let reply = '';
        
        if (message.includes('你好') || message.includes('hello')) {
            intent = 'greeting';
            reply = '您好！我是AI酒店助手，很高兴为您服务！';
        }
        else if (message.includes('订') || message.includes('book') || message.includes('reserve')) {
            intent = 'booking';
            reply = '📅 我可以帮您预订房间！请告诉我入住日期和住宿天数。';
        }
        else if (message.includes('价格') || message.includes('多少钱') || message.includes('price') || message.includes('cost')) {
            intent = 'price';
            reply = '💰 豪华客房: NT$3,800/晚\n行政客房: NT$5,200/晚\n尊荣套房: NT$8,500/晚';
        }
        else if (message.includes('取消') || message.includes('cancel')) {
            intent = 'policy';
            reply = '📋 取消政策:\n• 入住前48小时免费取消\n• 入住前24小时收取50%费用';
        }
        else if (message.includes('会员') || message.includes('member')) {
            intent = 'member';
            reply = '🎯 会员优惠:\n• 金卡会员: 房价9折\n• 白金会员: 房价85折\n• 钻石会员: 房价8折';
        }
        else if (message.includes('小孩') || message.includes('儿童') || message.includes('child')) {
            intent = 'children';
            reply = '👶 儿童政策:\n• 6岁以下: 不占床免费\n• 6-12岁: 不占床半价';
        }
        else {
            reply = '您好！我可以帮您：预订房间、查询价格、了解会员优惠、儿童政策等。请告诉我您的需求！';
        }
        
        return {
            version: this.version,
            message: reply,
            intent: intent,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new EnhancedAIService();

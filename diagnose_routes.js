const app = require('./server.js');

console.log('🔍 诊断服务器路由配置...');

function analyzeRoutes() {
  try {
    const routes = [];
    
    if (app._router && app._router.stack) {
      app._router.stack.forEach((layer, index) => {
        if (layer.route) {
          // 直接路由
          routes.push({
            type: 'ROUTE',
            path: layer.route.path,
            methods: Object.keys(layer.route.methods),
            index: index
          });
        } else if (layer.name === 'router') {
          // 路由模块
          routes.push({
            type: 'ROUTER',
            name: layer.name,
            regexp: layer.regexp.toString(),
            index: index
          });
        } else if (layer.handle) {
          // 中间件
          routes.push({
            type: 'MIDDLEWARE', 
            name: layer.name || 'anonymous',
            index: index
          });
        }
      });
    }
    
    console.log('📋 发现的路由和中间件:');
    routes.forEach(route => {
      console.log(`  [${route.index}] ${route.type}:`, 
        route.path ? `PATH: ${route.path} (${route.methods})` : 
        route.regexp ? `REGEXP: ${route.regexp}` :
        `NAME: ${route.name}`);
    });
    
    // 特别检查 /chat 路由
    const chatRoute = routes.find(r => r.path === '/chat');
    console.log('\n🎯 /chat 路由状态:');
    if (chatRoute) {
      console.log('  ✅ 找到 /chat 路由:', chatRoute);
    } else {
      console.log('  ❌ 未找到 /chat 路由');
    }
    
  } catch (error) {
    console.log('❌ 诊断失败:', error.message);
  }
}

analyzeRoutes();

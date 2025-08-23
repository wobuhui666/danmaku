const { getDomainConfig, buildPublicUrl, validateDomainConfig, resetConfigCache } = require('../utils/domain');

// 模拟Express请求对象
function mockRequest(protocol = 'http', host = 'localhost:3000') {
    return {
        protocol: protocol,
        get: (header) => {
            if (header.toLowerCase() === 'host') {
                return host;
            }
            return null;
        }
    };
}

// 测试函数
function runTests() {
    console.log('开始测试域名配置功能...\n');
    
    // 测试1: 默认行为（无环境变量）
    console.log('测试1: 默认行为');
    resetConfigCache();
    delete process.env.CUSTOM_DOMAIN;
    delete process.env.CUSTOM_PROTOCOL;
    delete process.env.CUSTOM_HOST;
    delete process.env.FORCE_HTTPS;
    
    const req1 = mockRequest('http', 'localhost:3000');
    const config1 = getDomainConfig(req1);
    const url1 = buildPublicUrl(req1, '/danmaku/test.xml');
    
    console.log('配置:', config1);
    console.log('构建URL:', url1);
    console.log('预期: http://localhost:3000/danmaku/test.xml\n');
    
    // 测试2: 完整域名配置
    console.log('测试2: 完整域名配置');
    resetConfigCache();
    process.env.CUSTOM_DOMAIN = 'https://api.example.com';
    
    const req2 = mockRequest('http', 'localhost:3000');
    const config2 = getDomainConfig(req2);
    const url2 = buildPublicUrl(req2, '/danmaku/test.xml');
    
    console.log('配置:', config2);
    console.log('构建URL:', url2);
    console.log('预期: https://api.example.com/danmaku/test.xml\n');
    
    // 测试3: 分别配置协议和主机
    console.log('测试3: 分别配置协议和主机');
    resetConfigCache();
    delete process.env.CUSTOM_DOMAIN;
    process.env.CUSTOM_PROTOCOL = 'https';
    process.env.CUSTOM_HOST = 'myapp.herokuapp.com';
    
    const req3 = mockRequest('http', 'localhost:3000');
    const config3 = getDomainConfig(req3);
    const url3 = buildPublicUrl(req3, '/danmaku/test.xml');
    
    console.log('配置:', config3);
    console.log('构建URL:', url3);
    console.log('预期: https://myapp.herokuapp.com/danmaku/test.xml\n');
    
    // 测试4: 强制HTTPS
    console.log('测试4: 强制HTTPS');
    resetConfigCache();
    delete process.env.CUSTOM_DOMAIN;
    delete process.env.CUSTOM_PROTOCOL;
    delete process.env.CUSTOM_HOST;
    process.env.FORCE_HTTPS = 'true';
    
    const req4 = mockRequest('http', 'localhost:3000');
    const config4 = getDomainConfig(req4);
    const url4 = buildPublicUrl(req4, '/danmaku/test.xml');
    
    console.log('配置:', config4);
    console.log('构建URL:', url4);
    console.log('预期: https://localhost:3000/danmaku/test.xml\n');
    
    // 测试5: 配置验证
    console.log('测试5: 配置验证');
    resetConfigCache();
    process.env.CUSTOM_DOMAIN = 'invalid-url';
    
    const validation = validateDomainConfig();
    console.log('验证结果:', validation);
    console.log('预期: 配置无效，包含错误信息\n');
    
    console.log('测试完成！');
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
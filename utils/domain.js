const URL = require('url');

/**
 * 环境变量自定义域名配置工具
 */

// 缓存配置对象，避免重复解析环境变量
let domainConfigCache = null;

/**
 * 解析和缓存域名配置
 * @returns {Object} 域名配置对象
 */
function parseDomainConfig() {
    if (domainConfigCache !== null) {
        return domainConfigCache;
    }

    const config = {
        customDomain: process.env.CUSTOM_DOMAIN,
        customProtocol: process.env.CUSTOM_PROTOCOL,
        customHost: process.env.CUSTOM_HOST,
        forceHttps: process.env.FORCE_HTTPS === 'true',
        overrideMode: process.env.DOMAIN_OVERRIDE_MODE || 'auto'
    };

    // 验证配置
    const validation = validateConfig(config);
    if (!validation.isValid) {
        console.warn('Domain configuration validation failed:', validation.errors);
        // 配置无效时使用默认模式
        config.overrideMode = 'auto';
        config.customDomain = null;
        config.customProtocol = null;
        config.customHost = null;
    }

    domainConfigCache = config;
    return config;
}

/**
 * 验证域名配置
 * @param {Object} config 配置对象
 * @returns {Object} 验证结果 {isValid: boolean, errors: array}
 */
function validateConfig(config) {
    const errors = [];
    
    // 验证 CUSTOM_DOMAIN
    if (config.customDomain) {
        try {
            const parsedUrl = new URL(config.customDomain);
            
            // 只允许 http/https 协议
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                errors.push('CUSTOM_DOMAIN must use http or https protocol');
            }
            
            // 不允许包含路径
            if (parsedUrl.pathname !== '/') {
                errors.push('CUSTOM_DOMAIN should not contain path');
            }
            
            // 不允许包含查询参数
            if (parsedUrl.search) {
                errors.push('CUSTOM_DOMAIN should not contain query parameters');
            }
        } catch (e) {
            errors.push('CUSTOM_DOMAIN format is invalid: ' + e.message);
        }
    }
    
    // 验证 CUSTOM_PROTOCOL
    if (config.customProtocol && !['http', 'https'].includes(config.customProtocol)) {
        errors.push('CUSTOM_PROTOCOL must be "http" or "https"');
    }
    
    // 验证 CUSTOM_HOST
    if (config.customHost) {
        // 基本的主机名验证
        const hostPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*?(:[0-9]+)?$/;
        if (!hostPattern.test(config.customHost)) {
            errors.push('CUSTOM_HOST format is invalid');
        }
    }
    
    // 验证 DOMAIN_OVERRIDE_MODE
    if (!['auto', 'custom', 'hybrid'].includes(config.overrideMode)) {
        errors.push('DOMAIN_OVERRIDE_MODE must be "auto", "custom", or "hybrid"');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * 获取域名配置
 * @param {Object} req Express请求对象
 * @returns {Object} 包含protocol和host的配置对象
 */
function getDomainConfig(req) {
    const config = parseDomainConfig();
    
    // 优先级1: CUSTOM_DOMAIN（完整域名）
    if (config.customDomain) {
        try {
            const parsedUrl = new URL(config.customDomain);
            return {
                protocol: parsedUrl.protocol.slice(0, -1), // 移除末尾的冒号
                host: parsedUrl.host
            };
        } catch (e) {
            console.warn('Failed to parse CUSTOM_DOMAIN, falling back to auto detection:', e.message);
        }
    }
    
    // 优先级2: CUSTOM_PROTOCOL + CUSTOM_HOST
    if (config.customProtocol && config.customHost) {
        return {
            protocol: config.customProtocol,
            host: config.customHost
        };
    }
    
    // 优先级3: 部分自定义
    let protocol = req.protocol;
    let host = req.get('host');
    
    if (config.customProtocol) {
        protocol = config.customProtocol;
    } else if (config.forceHttps) {
        protocol = 'https';
    }
    
    if (config.customHost) {
        host = config.customHost;
    }
    
    return { protocol, host };
}

/**
 * 构建公开URL
 * @param {Object} req Express请求对象
 * @param {String} path URL路径（可选）
 * @returns {String} 完整的公开URL
 */
function buildPublicUrl(req, path = '') {
    const domainConfig = getDomainConfig(req);
    
    // 确保路径以 / 开头
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }
    
    return `${domainConfig.protocol}://${domainConfig.host}${path}`;
}

/**
 * 获取配置验证结果（用于启动时检查）
 * @returns {Object} 验证结果
 */
function validateDomainConfig() {
    const config = {
        customDomain: process.env.CUSTOM_DOMAIN,
        customProtocol: process.env.CUSTOM_PROTOCOL,
        customHost: process.env.CUSTOM_HOST,
        forceHttps: process.env.FORCE_HTTPS === 'true',
        overrideMode: process.env.DOMAIN_OVERRIDE_MODE || 'auto'
    };
    
    return validateConfig(config);
}

/**
 * 重置配置缓存（主要用于测试）
 */
function resetConfigCache() {
    domainConfigCache = null;
}

module.exports = {
    getDomainConfig,
    buildPublicUrl,
    validateDomainConfig,
    resetConfigCache
};
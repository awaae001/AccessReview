const fs = require('fs');
const path = require('path');

// 定义配置文件的绝对路径
const configPath = path.join(__dirname, '..', '..', 'data', 'new_ApplyConfig.json');

/**
 * 读取并解析配置文件。
 * @returns {object | null} 解析后的配置对象，如果失败则返回 null。
 */
function readConfig() {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(configPath)) {
            console.error(`[configManager] 配置文件未找到: ${configPath}`);
            return null;
        }

        // 读取文件内容
        const rawData = fs.readFileSync(configPath, 'utf8');
        
        // 解析 JSON
        const config = JSON.parse(rawData);
        return config;

    } catch (error) {
        console.error('[configManager] 读取或解析配置文件时出错:', error);
        return null;
    }
}

/**
 * 根据服务器 ID 获取其所有申请配置。
 * @param {string} guildId 服务器 ID。
 * @returns {object | null} 服务器的配置对象，如果未找到则返回 null。
 */
function getGuildConfig(guildId) {
    const config = readConfig();
    if (config && config[guildId]) {
        return config[guildId];
    }
    return null;
}

/**
 * 根据服务器 ID 和申请类别 ID 获取特定的申请配置。
 * @param {string} guildId 服务器 ID。
 * @param {string} categoryId 申请类别的 ID。
 * @returns {object | null} 具体的申请类别配置，如果未找到则返回 null。
 */
function getCategoryConfig(guildId, categoryId) {
    const guildConfig = getGuildConfig(guildId);
    if (guildConfig && guildConfig.data && guildConfig.data[categoryId]) {
        return guildConfig.data[categoryId];
    }
    return null;
}

module.exports = {
    readConfig,
    getGuildConfig,
    getCategoryConfig,
};
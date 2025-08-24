const fs = require('fs');
const path = require('path');

const applyFilePath = path.join(__dirname, '..', '..', 'data', 'active_applies.json');

/**
 * 读取活跃的申请数据。
 * @returns {object} 申请数据的对象。
 */
function loadApplies() {
    try {
        if (fs.existsSync(applyFilePath)) {
            const rawData = fs.readFileSync(applyFilePath, 'utf8');
            return JSON.parse(rawData);
        }
    } catch (error) {
        console.error('[Persistence] 读取 active_applies.json 失败:', error);
    }
    return {}; // 如果文件不存在或读取失败，返回空对象
}

/**
 * 保存活跃的申请数据。
 * @param {object} data 要保存的数据。
 */
function saveApplies(data) {
    try {
        fs.writeFileSync(applyFilePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[Persistence] 写入 active_applies.json 失败:', error);
    }
}

/**
 * 添加一条新的申请记录。
 * @param {object} applyInfo 申请信息，至少包含 channelId。
 */
function addApply(applyInfo) {
    const applies = loadApplies();
    applies[applyInfo.channelId] = applyInfo;
    saveApplies(applies);
}

/**
 * 根据频道 ID 移除一条申请记录。
 * @param {string} channelId 要移除的频道 ID。
 */
function removeApply(channelId) {
    const applies = loadApplies();
    if (applies[channelId]) {
        delete applies[channelId];
        saveApplies(applies);
    }
}

/**
 * 根据频道 ID 查找一条申请记录。
 * @param {string} channelId 频道 ID。
 * @returns {object | null} 找到的申请信息，否则返回 null。
 */
function findApplyByChannel(channelId) {
    const applies = loadApplies();
    return applies[channelId] || null;
}

module.exports = {
    addApply,
    removeApply,
    findApplyByChannel,
};
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const { sendLog } = require('../utils/logger');

const sleep = ms => new Promise(res => setTimeout(res, ms));
const kickConfigPath = path.join(__dirname, '..', '..', 'data', 'kick', 'kick_config.json');

// 读取踢人配置文件
async function loadKickConfig() {
    try {
        const data = await fs.readFile(kickConfigPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[KickManager] 读取配置文件失败: ${error.message}`);
        await sendLog({ module: 'KickManager', action: 'Error', info: `读取配置文件失败: ${error.message}` }, 'error');
        return null;
    }
}

async function logAtRiskMembers(client, config) {
    const { name, data, whitelist } = config;
    const { database: dbFiles, "guilds_:_role": guildRoles } = data;
    const atRiskMembers = new Map();
    const allMemberIds = new Set();

    // 1. 统一收集所有服务器的目标成员ID
    for (const guildId in guildRoles) {
        const roleId = guildRoles[guildId];
        try {
            const guild = await client.guilds.fetch(guildId);
            const role = await guild.roles.fetch(roleId);
            if (!role) {
                console.warn(`[KickManager] 在服务器 ${guildId} 未找到身份组 ${roleId}，跳过危险用户扫描。`);
                continue;
            }
            // 直接获取拥有该身份组的成员
            const roleMembers = role.members;
            roleMembers.forEach(m => allMemberIds.add(m.id));
        } catch (guildError) {
            console.error(`[KickManager] 预测危险用户时处理服务器 ${guildId} 失败: ${guildError.message}`);
            await sendLog({ module: 'KickManager', action: 'Error', info: `预测危险用户时处理服务器 ${guildId} 失败: ${guildError.message}` }, 'error');
        }
    }

    const memberIdsArray = Array.from(allMemberIds);
    if (memberIdsArray.length === 0) {
        await sendLog({ module: 'KickManager', action: 'AtRiskList', info: `任务 '${name}' 未发现需要关注的危险用户。` });
        return;
    }

    // 2. 遍历数据库，一次性查询所有成员
    for (const dbFile of dbFiles) {
        const dbPath = path.join(__dirname, '..', '..', 'data', 'task', dbFile);
        let db;
        try {
            db = await open({ filename: dbPath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });

            const placeholders = memberIdsArray.map(() => '?').join(',');
            const usersStats = await db.all(
                `SELECT user_id, last_message_timestamp FROM user_stats WHERE user_id IN (${placeholders})`,
                memberIdsArray
            );

            for (const stat of usersStats) {
                const userIdStr = String(stat.user_id);
                if (!whitelist.includes(userIdStr)) {
                    // 使用 Map 存储每个用户最新的时间戳，以防他们在多个数据库中都有记录
                    if (!atRiskMembers.has(userIdStr) || atRiskMembers.get(userIdStr) < stat.last_message_timestamp) {
                        atRiskMembers.set(userIdStr, stat.last_message_timestamp);
                    }
                }
            }
        } catch (dbError) {
            console.error(`[KickManager] 预测危险用户时读取数据库 ${dbFile} 失败: ${dbError.message}`);
            await sendLog({ module: 'KickManager', action: 'Error', info: `预测危险用户时读取数据库 ${dbFile} 失败: ${dbError.message}` }, 'error');
        } finally {
            if (db) await db.close();
        }
    }

    const sortedAtRisk = Array.from(atRiskMembers.entries())
        .sort(([, tsA], [, tsB]) => tsA - tsB)
        .slice(0, 5);

    if (sortedAtRisk.length > 0) {
        const atRiskList = sortedAtRisk.map(([userId, timestamp]) => {
            const daysAgo = ((Date.now() - timestamp) / (1000 * 60 * 60 * 24)).toFixed(1);
            return `<@${userId}> (上次发言: ${daysAgo} 天前)`;
        }).join('\n');
        await sendLog({ module: 'KickManager', action: 'AtRiskList', info: `任务 '${name}' 的 5 个最危险用户:\n${atRiskList}` });
    } else {
        await sendLog({ module: 'KickManager', action: 'AtRiskList', info: `任务 '${name}' 未发现需要关注的危险用户。` });
    }
}

// 主要处理函数
async function scanAndKick() {
    const kickConfig = await loadKickConfig();
    if (!kickConfig) {
        console.log('[KickManager] 未找到或无法加载踢人配置，任务中止。');
        return;
    }

    if (!global.client || !global.client.isReady()) {
        console.warn('[KickManager] Discord 客户端未就绪，跳过本次扫描。');
        return;
    }
    const client = global.client;

    for (const configId in kickConfig) {
        const config = kickConfig[configId];
        const { name, time, data, whitelist } = config;
        const { database: dbFiles, "guilds_:_role": guildRoles } = data;

        const inactivityThreshold = Date.now() - (parseInt(time, 10) * 24 * 60 * 60 * 1000);
        let totalKickedCount = 0;
        const kickedMembers = new Set(); // 使用 Set 避免重复记录
        const kickedMembersDetails = {}; // 用于生成JSON日志

        // 1. 统一收集所有服务器和身份组的成员
        const membersToProcess = new Map(); 
        for (const guildId in guildRoles) {
            const roleId = guildRoles[guildId];
            try {
                const guild = await client.guilds.fetch(guildId);
                const role = await guild.roles.fetch(roleId);
                if (!role) {
                    console.warn(`[KickManager] 在服务器 ${guildId} 未找到身份组 ${roleId}，跳过。`);
                    continue;
                }
                // 直接获取拥有该身份组的成员
                const roleMembers = role.members;
                // 将每个拥有该身份组的成员添加到待处理列表
                for (const [memberId] of roleMembers) {
                    if (!membersToProcess.has(memberId)) {
                        membersToProcess.set(memberId, []);
                    }
                    membersToProcess.get(memberId).push({ guildId, roleId });
                }
            } catch (guildError) {
                console.error(`[KickManager] 处理服务器 ${guildId} 失败: ${guildError.message}`);
                await sendLog({ module: 'KickManager', action: 'Error', info: `处理服务器 ${guildId} 失败: ${guildError.message}` }, 'error');
            }
        }

        if (membersToProcess.size === 0) {
            await sendLog({ module: 'KickManager', action: 'Summary', info: `任务 '${name}' 未找到需要处理的成员。` });
            await logAtRiskMembers(client, config);
            continue; // 处理下一个配置
        }

        // 2. 一次性查询所有待处理成员的最新发言时间
        const memberIds = Array.from(membersToProcess.keys());
        const memberLastSeen = new Map();
        for (const dbFile of dbFiles) {
            const dbPath = path.join(__dirname, '..', '..', 'data', 'task', dbFile);
            let db;
            try {
                db = await open({ filename: dbPath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
                const placeholders = memberIds.map(() => '?').join(',');
                const usersStats = await db.all(
                    `SELECT user_id, last_message_timestamp FROM user_stats WHERE user_id IN (${placeholders})`,
                    memberIds
                );
                for (const stat of usersStats) {
                    const userIdStr = String(stat.user_id);
                    if (!memberLastSeen.has(userIdStr) || memberLastSeen.get(userIdStr) < stat.last_message_timestamp) {
                        memberLastSeen.set(userIdStr, stat.last_message_timestamp);
                    }
                }
            } catch (dbError) {
                console.error(`[KickManager] 读取数据库 ${dbFile} 失败: ${dbError.message}`);
                await sendLog({ module: 'KickManager', action: 'Error', info: `读取数据库 ${dbFile} 失败: ${dbError.message}` }, 'error');
            } finally {
                if (db) await db.close();
            }
        }

        // 3. 找出不活跃成员并移除其所有相关身份组
        for (const [memberId, roles] of membersToProcess.entries()) {
            if (whitelist.includes(String(memberId))) continue;

            const lastSeen = memberLastSeen.get(memberId);
            if (!lastSeen || lastSeen < inactivityThreshold) {
                for (const roleInfo of roles) {
                    try {
                        const guild = await client.guilds.fetch(roleInfo.guildId);
                        const member = await guild.members.fetch(memberId);

                        await sleep(1000); // 避免速率限制
                        await member.roles.remove(roleInfo.roleId, '用户长时间未发言，自动移除身份组');
                        console.log(`[KickManager] 成功移除用户 ${memberId} 在服务器 ${roleInfo.guildId} 的身份组 ${roleInfo.roleId}`);
                        totalKickedCount++;
                        kickedMembers.add(memberId);

                        if (!kickedMembersDetails[memberId]) {
                            kickedMembersDetails[memberId] = { username: member.user.username };
                        }
                        kickedMembersDetails[memberId][roleInfo.guildId] = roleInfo.roleId;
                    } catch (error) {
                        console.error(`[KickManager] 移除用户 ${memberId} 身份组失败: ${error.message}`);
                        await sendLog({ module: 'KickManager', action: 'Error', info: `移除用户 ${memberId} 身份组失败: ${error.message}` }, 'error');
                    }
                }
            }
        }

        // 将移除记录保存为JSON文件
        if (Object.keys(kickedMembersDetails).length > 0) {
            console.log(`[KickManager] 准备为任务 '${name}' 保存移除记录...`);
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const logDir = path.join(__dirname, '..', '..', 'data', 'kick', 'logs');
                await fs.mkdir(logDir, { recursive: true });
                const filePath = path.join(logDir, `kick_${name}_${timestamp}.json`);
                await fs.writeFile(filePath, JSON.stringify(kickedMembersDetails, null, 4));
                console.log(`[KickManager] 任务 '${name}' 的移除记录已保存至 ${filePath}`);
            } catch (logError) {
                console.error(`[KickManager] 保存移除记录失败: ${logError.message}`);
                await sendLog({ module: 'KickManager', action: 'Error', info: `保存移除记录失败: ${logError.message}` }, 'error');
            }
        }

        console.log(`[KickManager] 准备为任务 '${name}' 发送总结日志...`);
        if (kickedMembers.size > 0) {
            const memberList = Array.from(kickedMembers).map(id => `<@${id}>`).join(' ');
            await sendLog({ module: 'KickManager', action: 'KickedList', info: `任务 '${name}' 处理的成员列表: ${memberList}` });
        }
        await logAtRiskMembers(client, config);
    }
    console.log('[KickManager] 所有踢人配置任务均已处理完毕。');
}

// 设置定时任务，每天凌晨4点执行
cron.schedule('0 4 * * *', async () => {
    await sendLog({ module: 'KickManager', action: 'Start Cron Job', info: '开始执行身份组自动管理任务...' });
    await scanAndKick();
});

// 导出函数以便于在主文件里直接调用启动
module.exports = {
    initialize: () => {
        console.log('[KickManager] 身份组自动管理任务已初始化。');
        try {
            scanAndKick();
        } catch (error) {
            console.error('[KickManager] scanAndKick 函数执行时发生未捕获的顶层错误:', error);
            sendLog({ module: 'KickManager', action: 'Fatal Error', info: `执行时发生致命错误: ${error.message}` }, 'error');
        }
    }
};

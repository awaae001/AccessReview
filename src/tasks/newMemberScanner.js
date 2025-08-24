const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { Events } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { enqueueOperation } = require('../fileLock');

const configPath = path.join(__dirname, '..', '..', 'data', 'new', 'new_scam.json');
let config = {};

/**
 * 加载配置文件
 */
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(data);
        console.log('新成员扫描器配置加载成功 ');
        await sendLog({ module: 'NewMemberScanner', action: 'Load Config', info: '配置加载成功' });
    } catch (error) {
        console.error('加载新成员扫描器配置文件失败:', error);
        await sendLog({ module: 'NewMemberScanner', action: 'Load Config', info: `配置加载失败: ${error.message}` }, 'error');
        config = {}; // 出错时重置为空对象
    }
}

/**
 * 读取指定任务的数据文件
 * @param {string} filePath - 数据文件的路径
 */
async function readDataFile(filePath) {
    return enqueueOperation(filePath, async () => {
        try {
            const fullPath = path.join(__dirname, '..', '..', filePath);
            await fs.access(fullPath);
            const data = await fs.readFile(fullPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            console.error(`读取数据文件 ${filePath} 失败:`, error);
            // 在队列中抛出错误，让调用者能感知到
            throw error;
        }
    });
}

/**
 * 将数据写入指定任务的数据文件
 * @param {string} filePath - 数据文件的路径
 * @param {object} data - 要写入的数据
 */
async function writeDataFile(filePath, data) {
    return enqueueOperation(filePath, async () => {
        try {
            const fullPath = path.join(__dirname, '..', '..', filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, JSON.stringify(data, null, 4), 'utf8');
        } catch (error) {
            console.error(`写入数据文件 ${filePath} 失败:`, error);
            // 在队列中抛出错误
            throw error;
        }
    });
}

/**
 * 执行扫描任务
 */
async function runScan() {
    console.log('开始执行新成员每日扫描...');
    await sendLog({ module: 'NewMemberScanner', action: 'Run Scan', info: '开始执行每日扫描' });

    if (!global.client || !global.client.isReady()) {
        console.error('客户端未准备就绪，无法执行扫描 ');
        await sendLog({ module: 'NewMemberScanner', action: 'Run Scan', info: '客户端未准备就绪，扫描中止' }, 'error');
        return;
    }

    for (const guildId in config) {
        const task = config[guildId];
        try {
            const guild = await global.client.guilds.fetch(guildId);
            if (!guild) {
                console.warn(`找不到服务器: ${guildId}，跳过此任务 `);
                continue;
            }

            await guild.members.fetch(); // 获取所有成员
            const role = await guild.roles.fetch(task.role_id);
            if (!role) {
                console.warn(`在服务器 ${guild.name} 中找不到角色: ${task.role_id}，跳过此任务 `);
                continue;
            }

            const memberCount = role.members.size;
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            const data = await readDataFile(task.filepath);
            if (data === null) {
                console.error(`读取数据文件 ${task.filepath} 失败，跳过此任务 `);
                continue;
            }
            
            if (!data[today]) {
                data[today] = { join: 0, leave: 0, count: 0, role_join: 0, role_leave: 0 };
            }
            data[today].count = memberCount;

            await writeDataFile(task.filepath, data);
            console.log(`服务器 ${guild.name} 的成员数快照已保存: ${memberCount}`);
            await sendLog({ module: 'NewMemberScanner', action: 'Run Scan', info: `服务器 ${guild.name} (${guildId}) 的快照已保存，当前人数: ${memberCount}` });

        } catch (error) {
            console.error(`处理服务器 ${guildId} 的扫描任务时出错:`, error);
            await sendLog({ module: 'NewMemberScanner', action: 'Run Scan', info: `处理服务器 ${guildId} 时出错: ${error.message}` }, 'error');
        }
    }
    console.log('新成员每日扫描完成 ');
}

/**
 * 处理成员加入事件
 * @param {import('discord.js').GuildMember} member
 */
async function handleGuildMemberAdd(member) {
    const task = config[member.guild.id];
    if (!task) {
        return;
    }

    try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await readDataFile(task.filepath).catch(err => {
            console.error(`[handleGuildMemberAdd] readDataFile 失败:`, err);
            return null;
        });
        if (data === null) return;

        if (!data[today]) {
            data[today] = { join: 0, leave: 0, count: 0, role_join: 0, role_leave: 0 };
        }
        data[today].join = (data[today].join || 0) + 1;

        await writeDataFile(task.filepath, data);
        console.log(`服务器 ${member.guild.name} 有新成员加入，已更新统计 `);
    } catch (error) {
        console.error(`处理成员加入事件时出错:`, error);
    }
}

/**
 * 处理成员离开事件
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} member
 */
async function handleGuildMemberRemove(member) {
    const task = config[member.guild.id];
    // 对于离开事件，我们检查角色是否存在于成员离开前的角色缓存中
    if (!task) {
        return;
    }

    try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await readDataFile(task.filepath).catch(err => {
            console.error(`[handleGuildMemberRemove] readDataFile 失败:`, err);
            return null;
        });
        if (data === null) return;

        if (!data[today]) {
            data[today] = { join: 0, leave: 0, count: 0, role_join: 0, role_leave: 0 };
        }
        data[today].leave = (data[today].leave || 0) + 1;

        await writeDataFile(task.filepath, data);
        console.log(`服务器 ${member.guild.name} 有成员离开，已更新统计 `);
    } catch (error) {
        console.error(`处理成员离开事件时出错:`, error);
    }
}

/**
 * 处理成员角色更新事件
 * @param {import('discord.js').GuildMember | import('discord.js').PartialGuildMember} oldMember
 * @param {import('discord.js').GuildMember} newMember
 */
async function handleGuildMemberUpdate(oldMember, newMember) {
    const task = config[newMember.guild.id];
    if (!task) return;

    const oldHasRole = oldMember.roles.cache.has(task.role_id);
    const newHasRole = newMember.roles.cache.has(task.role_id);

    if (oldHasRole === newHasRole) {
        // 角色没有发生我们关心的变化
        return;
    }

    try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await readDataFile(task.filepath).catch(err => {
            console.error(`[handleGuildMemberUpdate] readDataFile 失败:`, err);
            return null;
        });
        if (data === null) return;

        if (!data[today]) {
            data[today] = { join: 0, leave: 0, count: 0, role_join: 0, role_leave: 0 };
        }

        if (newHasRole) { // 获得角色
            data[today].role_join = (data[today].role_join || 0) + 1;
            console.log(`服务器 ${newMember.guild.name} 有成员  ${newMember.user.tag} 获得角色，已更新统计 `);
        } else { // 失去角色
            data[today].role_leave = (data[today].role_leave || 0) + 1;
             console.log(`服务器 ${newMember.guild.name} 有成员  ${newMember.user.tag} 失去角色，已更新统计 `);
        }

        await writeDataFile(task.filepath, data);
    } catch (error) {
        console.error(`处理成员角色更新事件时出错:`, error);
    }
}


/**
 * 初始化扫描器，设置定时任务和事件监听器
 */
async function initialize() {
    console.log('初始化新成员扫描器...');
    
    // 1. 加载配置
    await loadConfig();

    // 2. 设置每日定时扫描任务 (例如每天的 23:59)
    cron.schedule('59 23 * * *', runScan);
    console.log('每日新成员扫描定时任务已设置 ');

    // 3. 注册事件监听器
    if (global.client) {
        global.client.on(Events.GuildMemberAdd, handleGuildMemberAdd);
        global.client.on(Events.GuildMemberRemove, handleGuildMemberRemove);
        global.client.on(Events.GuildMemberUpdate, handleGuildMemberUpdate);
        console.log('新成员加入/离开/角色更新事件监听器已注册 ');
    } else {
        console.error('无法注册事件监听器：全局客户端实例未找到 ');
    }
}

module.exports = {
    initialize
};
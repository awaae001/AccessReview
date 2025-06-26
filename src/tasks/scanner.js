const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');

const configPath = path.join(__dirname, '..', '..', 'data', 'task', 'task_config.json');
const dbPath = path.join(__dirname, '..', '..', 'data', 'task', 'stats.db');

// 初始化数据库
async function initializeDatabase() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            message_count INTEGER DEFAULT 0,
            mention_count INTEGER DEFAULT 0
        );
    `);

    console.log('数据库初始化成功');
    return db;
}

// 读取配置文件
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
}

// 扫描任务
async function scanTask() {
    console.log('开始执行扫描任务...');
    const config = await loadConfig();
    if (!config) {
        console.log('无法加载配置，任务终止');
        return;
    }

    const db = await initializeDatabase();

    // 清空统计数据（可选，取决于是否需要重新统计）
    // await db.run('DELETE FROM user_stats');

    // 遍历所有配置的服务器和频道
    for (const key in config) {
        const task = config[key];
        const { guilds_id, channel_id, frist_message_id } = task.data;
        console.log(`正在扫描服务器: ${guilds_id}, 频道: ${channel_id}`);

        // 使用全局共享的 Discord 客户端实例
        if (!global.client) {
            console.error('Discord 客户端未初始化');
            continue;
        }
        const client = global.client;
        console.log('客户端guilds属性:', client.guilds);

        // 确保客户端已准备好
        if (!client.isReady()) {
            console.error('Discord 客户端尚未准备好');
            continue;
        }

        try {
            // 获取频道
            const guild = await client.guilds.fetch(String(guilds_id));
            const channel = await guild.channels.fetch(String(channel_id));
            if (!channel) {
                console.error(`未找到频道: ${channel_id}`);
                continue;
            }

            console.log(`成功获取频道: ${channel.name}`);

            // 用于存储用户统计数据的对象
            const userStats = {};

            // 获取消息（从指定的第一条消息开始）
            let lastMessageId = String(frist_message_id);
            let hasMoreMessages = true;

            // 分批获取消息
            while (hasMoreMessages) {
                const options = { limit: 100 }; // Discord API 一次最多返回 100 条消息

                if (lastMessageId) {
                    options.after = lastMessageId; // 获取指定消息之后的消息
                }

                const messages = await channel.messages.fetch(options);
                console.log(`获取了 ${messages.size} 条消息`);

                if (messages.size === 0) {
                    hasMoreMessages = false;
                    continue;
                }

                // 更新最后一条消息的 ID，用于下一次获取
                lastMessageId = messages.last().id;

                // 处理消息
                for (const [messageId, message] of messages) {
                    // 忽略机器人消息
                    if (message.author.bot) continue;

                    // 统计发言次数
                    const userId = message.author.id;
                    const username = message.author.username;

                    if (!userStats[userId]) {
                        userStats[userId] = {
                            username,
                            message_count: 0,
                            mention_count: 0
                        };
                    }

                    userStats[userId].message_count++;

                    // 统计被提及次数（包含@提及和回复提及）
                    // message.mentions.users 会自动包含：
                    // 1. 直接@提及的用户
                    // 2. 回复消息时自动提及的用户
                    const mentionedUsers = message.mentions.users;
                    for (const [mentionedId, mentionedUser] of mentionedUsers) {
                        if (mentionedUser.bot) continue;

                        if (!userStats[mentionedId]) {
                            userStats[mentionedId] = {
                                username: mentionedUser.username,
                                message_count: 0,
                                mention_count: 0
                            };
                        }

                        userStats[mentionedId].mention_count++;
                    }
                }
            }

            // 将结果存入数据库
            for (const userId in userStats) {
                const { username, message_count, mention_count } = userStats[userId];
                
                // 使用 UPSERT 语法，如果用户已存在则更新，不存在则插入
                await db.run(`
                    INSERT INTO user_stats (user_id, username, message_count, mention_count)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(user_id) 
                    DO UPDATE SET 
                        username = ?,
                        message_count = message_count + ?,
                        mention_count = mention_count + ?
                `, [userId, username, message_count, mention_count, username, message_count, mention_count]);
            }

            console.log(`成功更新了 ${Object.keys(userStats).length} 名用户的统计数据`);

        } catch (error) {
            console.error(`扫描过程中出错:`, error);
        }
    }

    await db.close();
    console.log('扫描任务执行完毕。');
}

// 设置定时任务，每天凌晨3点执行一次（服务器负载较低的时间）
cron.schedule('0 3 * * *', async () => {
    console.log('开始执行定时扫描任务...');
    try {
        await scanTask();
        console.log('定时扫描任务执行完毕');
    } catch (error) {
        console.error('定时扫描任务执行失败:', error);
    }
});

// 导出函数，以便在其他地方调用
module.exports = {
    initializeDatabase,
    scanTask,
    loadConfig
};

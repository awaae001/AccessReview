const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
const { sendLog } = require('../utils/logger');

const configPath = path.join(__dirname, '..', '..', 'data', 'task', 'task_config.json');

// 初始化数据库
async function initializeDatabase(channel_id) {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'task', `data_${channel_id}.db`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            message_count INTEGER DEFAULT 0,
            mention_count INTEGER DEFAULT 0,
            mentions_made_count INTEGER DEFAULT 0,
            last_message_timestamp INTEGER DEFAULT 0
        );
    `);

    console.log('数据库初始化成功');
    return db;
}

// 读取配置文件
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        console.log('配置文件加载成功:', data);
        return JSON.parse(data);
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
}

// 更新配置文件
async function updateConfig(taskId, newFristMessageId) {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(data);
        if (config[taskId]) {
            config[taskId].data.frist_message_id = newFristMessageId;
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log( `任务 ${taskId} 的 frist_message_id 已更新为: ${newFristMessageId}` )
        }
    } catch (error) {
        console.error(`更新任务 ${taskId} 的配置文件失败:`, error);
    }
}

// 单个频道扫描逻辑
async function scanChannel(taskId, task) {
    const { guilds_id, channel_id, frist_message_id } = task.data;
    console.log(`正在扫描服务器: ${guilds_id}, 频道: ${channel_id}`)

    const db = await initializeDatabase(channel_id);
    let totalMessagesScanned = 0;
    let totalMembersAffected = 0;

    try {
        // 使用全局共享的 Discord 客户端实例
        if (!global.client || !global.client.isReady()) {
            return;
        }
        const client = global.client;

        // 获取频道
        const guild = await client.guilds.fetch(String(guilds_id));
        const channel = await guild.channels.fetch(String(channel_id));
        if (!channel) {
            console.error(`未找到频道: ${channel_id}`)
            return;
        }

        console.log(`开始扫描频道: ${channel.name} (${channel_id})`);

        // 获取消息（从指定的第一条消息开始）
        let lastMessageId = String(frist_message_id);
        let hasMoreMessages = true;
        let cumulativeStats = {};
        let messagesSinceLastWrite = 0;

        while (hasMoreMessages) {
            const options = { limit: 100 };
            if (lastMessageId) {
                options.after = lastMessageId;
            }

            const messages = await channel.messages.fetch(options);
            totalMessagesScanned += messages.size;
            console.log(`在频道 ${channel_id} 获取了 ${messages.size} 条消息`)

            if (messages.size > 0) {
                lastMessageId = messages.first().id;
                messagesSinceLastWrite += messages.size;
            } else {
                hasMoreMessages = false;
            }

            // 处理消息
            for (const [, message] of messages) {
                if (message.author.bot) continue;

                const userId = message.author.id;
                const username = message.author.username;
                const messageTimestamp = message.createdTimestamp;

                if (!cumulativeStats[userId]) {
                    cumulativeStats[userId] = { username, message_count: 0, mention_count: 0, mentions_made_count: 0, last_message_timestamp: 0 };
                }
                cumulativeStats[userId].message_count++;
                if (messageTimestamp > cumulativeStats[userId].last_message_timestamp) {
                    cumulativeStats[userId].last_message_timestamp = messageTimestamp;
                }

                const mentionedUsers = message.mentions.users;
                const nonBotMentionsCount = mentionedUsers.filter(u => !u.bot).size;
                if (nonBotMentionsCount > 0) {
                    cumulativeStats[userId].mentions_made_count += nonBotMentionsCount;
                }

                for (const [mentionedId, mentionedUser] of mentionedUsers) {
                    if (mentionedUser.bot) continue;

                    if (!cumulativeStats[mentionedId]) {
                        cumulativeStats[mentionedId] = { username: mentionedUser.username, message_count: 0, mention_count: 0, mentions_made_count: 0, last_message_timestamp: 0 };
                    }
                    cumulativeStats[mentionedId].mention_count++;
                }
            }

            // 每 X 条消息写一次库, 或者在没有更多消息时写入剩余的统计数据
            if (messagesSinceLastWrite >= 1000 || (!hasMoreMessages && Object.keys(cumulativeStats).length > 0)) {
                // 将当前批次结果存入数据库
                if (Object.keys(cumulativeStats).length > 0) {
                    const membersAffectedInBatch = Object.keys(cumulativeStats).length;
                    totalMembersAffected += membersAffectedInBatch;
                    for (const userId in cumulativeStats) {
                        const { username, message_count, mention_count, mentions_made_count, last_message_timestamp } = cumulativeStats[userId];
                        await db.run(`
                            INSERT INTO user_stats (user_id, username, message_count, mention_count, mentions_made_count, last_message_timestamp)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(user_id) 
                            DO UPDATE SET 
                                username = excluded.username,
                                message_count = message_count + excluded.message_count,
                                mention_count = mention_count + excluded.mention_count,
                                mentions_made_count = mentions_made_count + excluded.mentions_made_count,
                                last_message_timestamp = IIF(excluded.last_message_timestamp > last_message_timestamp, excluded.last_message_timestamp, last_message_timestamp)
                        `, [userId, username, message_count, mention_count, mentions_made_count, last_message_timestamp]);
                    }
                    await updateConfig(taskId, lastMessageId);
                }
                
                // 重置计数器和累积器
                cumulativeStats = {};
                messagesSinceLastWrite = 0;
            }
        }
        await sendLog({ module: 'Scanner', action: 'Scan Complete', info: `频道 <#${channel_id}> 扫描完成 \n共扫描 ${totalMessagesScanned} 条消息 \n操作了 ${totalMembersAffected} 名成员 ` });
    } catch (error) {
    } finally {
        await db.close();
        console.log(`频道 ${channel_id} 的数据库连接已关闭`)
    }
}

// 并行扫描任务
async function scanTask() {
    const config = await loadConfig();
    if (!config) {
        return;
    }
    const scanPromises = Object.entries(config).map(([taskId, task]) => scanChannel(taskId, task));

    await Promise.all(scanPromises);
}

// 设置定时任务，每天凌晨3点执行一次（服务器负载较低的时间）
cron.schedule('0 3 * * *', async () => {
    await sendLog({ module: 'Scanner', action: 'Start Cron Job', info: '开始执行定时扫描任务...' }, 'warn');
    await scanTask();
});

// 导出函数，以便在其他地方调用
module.exports = {
    initializeDatabase,
    scanTask,
    loadConfig
};

const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs').promises;
const path = require('path');

const dbDir = path.join(__dirname, '..', '..', 'data', 'task');

async function queryUserData(userId) {
    try {
        const dbFiles = (await fs.readdir(dbDir)).filter(file => file.startsWith('data_') && file.endsWith('.db'));

        if (dbFiles.length === 0) {
            return { error: '未找到任何数据库文件 ' };
        }

        let userData = [];
        let targetUsername = '未知';

        for (const file of dbFiles) {
            const dbPath = path.join(dbDir, file);
            const db = await open({
                filename: dbPath,
                driver: sqlite3.Database,
                mode: sqlite3.OPEN_READONLY
            }).catch(err => {
                console.error(`无法打开数据库 ${dbPath}:`, err);
                return null;
            });

            if (!db) continue;

            try {
                const row = await db.get('SELECT * FROM user_stats WHERE user_id = ?', userId);
                if (row) {
                    const channelId = file.replace('data_', '').replace('.db', '');
                    userData.push({ ...row, channelId });
                    if (row.username) {
                        targetUsername = row.username;
                    }
                }
            } finally {
                await db.close();
            }
        }

        if (userData.length === 0) {
            return { error: `在所有数据库中都未找到用户ID: ${userId} 的数据 ` };
        }

        return { userData, targetUsername };

    } catch (error) {
        console.error(`[dataQuery/queryUserData] 查询用户 ${userId} 数据时出错:`, error);
        return { error: '查询数据时发生内部错误 ' };
    }
}

module.exports = {
    queryUserData
};

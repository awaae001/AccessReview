const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendLog } = require('../src/utils/logger');

async function registerSlashCommands() {
    try {
        const commands = [];
        const commandsPath = path.join(__dirname, '../src/commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            if (command.data) commands.push(command.data.toJSON());
        }
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
        const CLIENT_ID = process.env.CLIENT_ID;

        if (CLIENT_ID) {
            const serverIds = process.env.SERVER_IDS ? process.env.SERVER_IDS.split(',').map(id => id.trim()) : [];

            if (serverIds.length > 0) {
                console.log(`准备为 ${serverIds.length} 个服务器注册命令...`);

                for (const serverId of serverIds) {
                    let retries = 3;
                    let success = false;

                    while (retries > 0 && !success) {
                        try {
                            console.log(`正在删除服务器 ${serverId} 的所有命令... (剩余重试: ${retries})`);
                            await rest.put(
                                Routes.applicationGuildCommands(CLIENT_ID, serverId),
                                { body: [] }
                            );
                            console.log(`服务器 ${serverId} 的命令已清空`);

                            await new Promise(resolve => setTimeout(resolve, 1000));

                            console.log(`正在为服务器 ${serverId} 注册命令...`);
                            await rest.put(
                                Routes.applicationGuildCommands(CLIENT_ID, serverId),
                                { body: commands }
                            );
                            console.log(`服务器 ${serverId} 的命令注册成功！`);

                            await sendLog({
                                module: 'Main',
                                action: 'Command Registration',
                                info: `已为服务器 ${serverId} 注册 ${commands.length} 个命令`
                            });
                            success = true;
                        } catch (guildErr) {
                            retries--;
                            console.error(`服务器 ${serverId} 命令注册失败 (剩余重试: ${retries}):`, guildErr.message);

                            if (retries === 0) {
                                await sendLog({
                                    module: 'Main',
                                    action: 'Command Registration Error',
                                    error: `服务器 ${serverId} 命令注册失败: ${guildErr.message}`
                                });
                            } else {
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }
                    }
                }
                console.log('所有服务器命令注册完成！');
            } else {
                console.log('未在 SERVER_IDS 中配置服务器，跳过命令注册 ');
            }
        } else {
            console.log('未设置 CLIENT_ID，跳过命令注册 ');
        }
    } catch (err) {
        console.error('命令注册失败:', err);
        await sendLog({
            module: 'Main',
            action: 'Command Registration Error',
            error: `命令注册失败: ${err.message}`
        });
    }
}

module.exports = { registerSlashCommands };
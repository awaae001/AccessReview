const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '../src/commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`已加载命令: ${command.data.name}`);
    } else {
      console.log(`[警告] 文件 ${filePath} 中的命令缺少 "data" 或 "execute" 属性 `);
    }
  }
}

module.exports = { loadCommands };
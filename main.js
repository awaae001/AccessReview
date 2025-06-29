// 主入口，注册事件与命令
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events, InteractionType } = require('discord.js');
const { scanTask } = require('./src/tasks/scanner');
const kickManager = require('./src/tasks/kickManager');
const { sendLog } = require('./src/utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageTyping
  ],
  partials: [Partials.Channel]
});

// 设置全局客户端实例，以便其他模块访问
global.client = client;

// 命令集合
client.commands = new Collection();
client.commands.set('apply', require('./src/commands/apply'));
client.commands.set('creat_apply_ed', require('./src/commands/create_apply_embed'));
client.commands.set('refresh_db', require('./src/commands/refresh_db'));

// 监听 ready
client.once(Events.ClientReady, async () => {
  console.log(`Bot 已上线: ${client.user.tag}`);
  await sendLog({
    module: 'Main',
    action: 'Bot Startup',
    info: `Bot 已上线: ${client.user.tag}`
  });

  // 自动全局注册 Slash 命令
  try {
    const { REST, Routes } = require('discord.js');
    const fs = require('fs');
    const path = require('path');
    const commands = [];
    const commandsPath = path.join(__dirname, 'src/commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data) commands.push(command.data.toJSON());
    }
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    const CLIENT_ID = process.env.CLIENT_ID;
    if (CLIENT_ID) {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log('全局 Slash 命令注册成功！');
    } else {
      console.log('未设置 CLIENT_ID，跳过全局命令注册。');
    }
  } catch (err) {
    console.error('全局命令注册失败:', err);
  }

  // 执行扫描任务
  scanTask();
  // 初始化身份组管理任务
  kickManager.initialize();
});

// 监听交互
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction, client);
  } else if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId.startsWith('rejectModal:')) {
      require('./src/interactions/rejectModal')(interaction, client);
    } else {
      require('./src/interactions/applyModal')(interaction, client);
    }
  } else if (interaction.isButton()) {
    // 入群申请按钮处理
    if (interaction.customId.startsWith('openApplyModal')) {
      const apply = require('./src/commands/apply');
      await apply.handleButton(interaction, client);
      return;
    }
    // 审核按钮处理
    if (interaction.customId.startsWith('approve') || interaction.customId.startsWith('reject')) {
      const [action, userId, targetRoleId] = interaction.customId.split(':');
      if (userId && targetRoleId) {
        const roleManager = require('./src/utils/roleManager');
        await roleManager.handleReview(interaction, action, userId, targetRoleId, client);
      }
      return;
    }
    // 自动审核按钮处理
    if (interaction.customId.startsWith('autoApply')) {
      const { handleAutoApply } = require('./src/interactions/autoApply');
      await handleAutoApply(interaction);
      return;
    }
  }
});

// 登录
client.login(process.env.BOT_TOKEN);

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
client.commands.set('query', require('./src/commands/query'));

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

  // scanTask();
  // kickManager.initialize();
});

const rejectModalHandler = require('./src/interactions/rejectModal');
const applyModalHandler = require('./src/interactions/applyModal');
const applyCommandHandler = require('./src/commands/apply');
const roleManager = require('./src/utils/roleManager');
const { handleAutoApply } = require('./src/interactions/autoApply');
const { handleVote } = require('./src/interactions/voteHandler');

// 监听交互
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, client);
    } else if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith('rejectModal:')) {
        await rejectModalHandler(interaction, client);
      } else {
        await applyModalHandler(interaction, client);
      }
    } else if (interaction.isButton()) {
      const [customIdPrefix] = interaction.customId.split(':');

      switch (customIdPrefix) {
        case 'openApplyModal':
          await applyCommandHandler.handleButton(interaction, client);
          break;
        case 'approve':
        case 'reject':
          const [action, userId, targetRoleId] = interaction.customId.split(':');
          if (userId && targetRoleId) {
            await roleManager.handleReview(interaction, action, userId, targetRoleId, client);
          }
          break;
        case 'autoApply':
          await handleAutoApply(interaction);
          break;
       case 'vote':
           await handleVote(interaction);
           break;
      }
    }
  } catch (error) {
    console.error('交互处理失败:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '处理您的请求时发生错误。', ephemeral: true });
    } else {
      await interaction.reply({ content: '处理您的请求时发生错误。', ephemeral: true });
    }
  }
});

// 登录
client.login(process.env.BOT_TOKEN);

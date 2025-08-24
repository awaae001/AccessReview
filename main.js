// 主入口，注册事件与命令
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events, InteractionType } = require('discord.js');
const { scanTask } = require('./src/tasks/scanner');
const kickManager = require('./src/tasks/kickManager');
const newMemberScanner = require('./src/tasks/newMemberScanner');
const voteMonitor = require('./src/tasks/voteMonitor');
const cron = require('node-cron');
const { sendLog } = require('./src/utils/logger');
const { enqueueOperation } = require('./src/fileLock');

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
// 动态加载所有命令
client.commands = new Collection();
const fs = require('fs');
const path = require('path');
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // 确保命令对象有效且具有 data 和 execute 属性
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`已加载命令: ${command.data.name}`);
    } else {
        console.log(`[警告] 文件 ${filePath} 中的命令缺少 "data" 或 "execute" 属性 `);
    }
}
// 监听 ready
client.once(Events.ClientReady, async () => {
  console.log(`Bot 已上线: ${client.user.tag}`);
  await sendLog({
    module: 'Main',
    action: 'Bot Startup',
    info: `Bot 已上线: ${client.user.tag}`
  });
  // 注册 Slash 命令到指定服务器
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
      // 从环境变量读取服务器 ID 列表
      const serverIds = process.env.SERVER_IDS ? process.env.SERVER_IDS.split(',').map(id => id.trim()) : [];

      if (serverIds.length > 0) {
        console.log(`准备为 ${serverIds.length} 个服务器注册命令...`);

        // 为每个服务器注册命令
        for (const serverId of serverIds) {
          let retries = 3;
          let success = false;

          while (retries > 0 && !success) {
            try {
              // 首先删除该服务器的所有现有命令
              console.log(`正在删除服务器 ${serverId} 的所有命令... (剩余重试: ${retries})`);
              await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, serverId),
                { body: [] }
              );
              console.log(`服务器 ${serverId} 的命令已清空`);

              // 稍等片刻避免API限制
              await new Promise(resolve => setTimeout(resolve, 1000));

              // 然后注册新命令
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
                // 等待后重试
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

  // scanTask();
  // kickManager.initialize();
  newMemberScanner.initialize();

  // Schedule the vote monitor task
  if (cron.validate(voteMonitor.schedule)) {
    cron.schedule(voteMonitor.schedule, () => voteMonitor.execute(client));
    console.log(`Task '${voteMonitor.name}' scheduled.`);
  } else {
    console.error(`Invalid cron schedule for task '${voteMonitor.name}': ${voteMonitor.schedule}`);
  }
});

const rejectModalHandler = require('./src/interactions/rejectModal');
const applyModalHandler = require('./src/interactions/applyModal');
const applyCommandHandler = require('./src/commands/apply');
const roleManager = require('./src/utils/roleManager');
const { handleAutoApply } = require('./src/interactions/autoApply');
const { handleVote } = require('./src/interactions/voteHandler');
const { handleQueryNewMembers } = require('./src/interactions/queryNewMembersHandler');

// 监听交互
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 处理自动完成
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        await command.autocomplete(interaction);
      }
    }
    // 处理斜杠命令
    else if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'query_new_members') {
        await handleQueryNewMembers(interaction);
      } else {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction, client);
      }
    }
    // 处理模态框提交
    else if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith('rejectModal:')) {
        await rejectModalHandler(interaction, client);
      } else if (interaction.customId.startsWith('newApplyModal:')) {
        const newApplyModalHandler = require('./src/interactions/newApplyModalSubmit');
        await newApplyModalHandler.execute(interaction);
      } else {
        await applyModalHandler(interaction, client);
      }
    }
    // 处理按钮点击
    else if (interaction.isButton()) {
      const [customIdPrefix] = interaction.customId.split(':');
      // 引入新的处理器
      const newApplyHandler = require('./src/interactions/newApplyHandler');

      switch (customIdPrefix) {
        case 'apply': // 新增的处理 case
          await newApplyHandler.execute(interaction);
          break;
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
        case 'review':
          const reviewHandler = require('./src/interactions/reviewHandler');
          await reviewHandler.execute(interaction);
          break;
      }
    }
  } catch (error) {
    console.error('交互处理失败:', error);
    // 检查交互是否仍然可以回复
    if (interaction.replied || interaction.deferred) {
      // 如果已经回复或延迟，使用 followUp
      await interaction.followUp({ content: '处理您的请求时发生错误 ', ephemeral: true }).catch(console.error);
    } else {
      // 否则，使用 reply
      await interaction.reply({ content: '处理您的请求时发生错误 ', ephemeral: true }).catch(console.error);
    }
  }
});

// 登录
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('Bot 登录失败:', error);
  process.exit(1);
});

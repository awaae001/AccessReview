const { Events, InteractionType } = require('discord.js');
const { sendLog } = require('../src/utils/logger');
const { registerSlashCommands } = require('./commandRegistry');
const { startTasks } = require('./taskManager');

// handlers
const rejectModalHandler = require('../src/interactions/rejectModal');
const applyModalHandler = require('../src/interactions/applyModal');
const applyCommandHandler = require('../src/commands/apply');
const roleManager = require('../src/utils/roleManager');
const { handleAutoApply } = require('../src/interactions/autoApply');
const { handleVote } = require('../src/interactions/voteHandler');
const { handleQueryNewMembers } = require('../src/interactions/queryNewMembersHandler');

function registerEventListeners(client) {
  client.once(Events.ClientReady, async () => {
    console.log(`Bot 已上线: ${client.user.tag}`);
    await sendLog({
      module: 'Main',
      action: 'Bot Startup',
      info: `Bot 已上线: ${client.user.tag}`
    });

    await registerSlashCommands();
    startTasks(client);
  });

  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command && command.autocomplete) {
          await command.autocomplete(interaction);
        }
      }
      else if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'query_new_members') {
          await handleQueryNewMembers(interaction);
        } else {
          const command = client.commands.get(interaction.commandName);
          if (command) await command.execute(interaction, client);
        }
      }
      else if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId.startsWith('rejectModal:')) {
          await rejectModalHandler(interaction, client);
        } else if (interaction.customId.startsWith('newApplyModal:')) {
          const newApplyModalHandler = require('../src/interactions/newApplyModalSubmit');
          await newApplyModalHandler.execute(interaction);
        } else {
          await applyModalHandler(interaction, client);
        }
      }
      else if (interaction.isButton()) {
        const [customIdPrefix] = interaction.customId.split(':');
        const newApplyHandler = require('../src/interactions/newApplyHandler');

        switch (customIdPrefix) {
          case 'apply':
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
            const reviewHandler = require('../src/interactions/reviewHandler');
            await reviewHandler.execute(interaction);
            break;
          case 'finish':
            const finishApplyHandler = require('../src/interactions/finish/finishApplyHandler');
            await finishApplyHandler.execute(interaction);
            break;
          case 'finish_confirm':
            const finishConfirmHandler = require('../src/interactions/finish/finishConfirmHandler');
            await finishConfirmHandler.execute(interaction);
            break;
          case 'finish_cancel':
            const finishCancelHandler = require('../src/interactions/finish/finishCancelHandler');
            await finishCancelHandler.execute(interaction);
            break;
          case 'admin_approve':
            const adminApproveHandler = require('../src/interactions/finish/adminApproveHandler');
            await adminApproveHandler.execute(interaction);
            break;
          case 'admin_reject':
            const adminRejectHandler = require('../src/interactions/finish/adminRejectHandler');
            await adminRejectHandler.execute(interaction);
            break;
          case 'admin_role':
            const adminRoleHandler = require('../src/interactions/finish/adminRoleHandler');
            await adminRoleHandler.execute(interaction);
            break;
        }
      }
      else if (interaction.isStringSelectMenu()) {
        const [customIdPrefix] = interaction.customId.split(':');
        
        switch (customIdPrefix) {
          case 'select_extra_role':
            const selectExtraRoleHandler = require('../src/interactions/finish/selectExtraRoleHandler');
            await selectExtraRoleHandler.execute(interaction);
            break;
        }
      }
    } catch (error) {
      console.error('交互处理失败:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '处理您的请求时发生错误 ', ephemeral: true }).catch(console.error);
      } else {
        await interaction.reply({ content: '处理您的请求时发生错误 ', ephemeral: true }).catch(console.error);
      }
    }
  });
}

module.exports = { registerEventListeners };
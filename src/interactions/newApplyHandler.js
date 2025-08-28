const { getCategoryConfig } = require('../utils/configManager');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { findUserApplyHistory, findActiveApply } = require('../utils/persistence');
const { isUserBlacklisted, addToBlacklist } = require('../utils/cooldownManager');

module.exports = {
    name: 'apply', // Corresponds to the first part of customId
    async execute(interaction) {
        const [, guildId, categoryId] = interaction.customId.split(':');
        const member = interaction.member;
        const userId = interaction.user.id;

        // 1. 检查用户是否在拉黑列表中
        const blacklistInfo = await isUserBlacklisted(userId);
        if (blacklistInfo) {
            const blacklistDate = new Date(blacklistInfo.timestamp).toLocaleString('zh-CN');
            return await interaction.reply({
                content: `您已被禁止申请此类身份组 \n拉黑时间：${blacklistDate}\n拉黑原因：${blacklistInfo.reason}`,
                flags: 64, // Ephemeral
            });
        }

        // 2. Check user's application history
        const userHistory = findUserApplyHistory(guildId, userId);
        const activeApply = findActiveApply(guildId, userId, categoryId);

        const allApplies = [...userHistory, ...(activeApply ? [activeApply] : [])];

        const isRejected = allApplies.some(apply => apply.status === 'rejected');
        if (isRejected) {
            return interaction.reply({
                content: '⛔ 您的申请已被拒绝（或者你手动退出），无法再次提交 \n如有疑问，请联系管理员 ',
                flags: 64, // Ephemeral
            });
        }

        const hasPendingOrApproved = allApplies.some(apply => apply.status === 'pending' || apply.status === 'approved');
        if (hasPendingOrApproved) {
            return interaction.reply({
                content: '⚠️ 您已经有一个正在进行中或已批准的申请，请勿重复提交 ',
                flags: 64, // Ephemeral
            });
        }

        // 2. Get configuration
        const categoryConfig = getCategoryConfig(guildId, categoryId);
        if (!categoryConfig || !categoryConfig.role_config || !categoryConfig.role_config.musthold_role_id) {
            console.error(`[newApplyHandler] Cannot find musthold_role_id config for ${guildId}:${categoryId}.`);
            return interaction.reply({ content: 'Application configuration error, please contact an administrator.', flags: 64 });
        }

        const mustHoldRoleId = categoryConfig.role_config.musthold_role_id;

        // 3. Perform prerequisite checks
        if (!member.roles.cache.has(mustHoldRoleId)) {
            // 身份组不匹配，加入拉黑列表
            await addToBlacklist(userId, '身份组不匹配');
            return interaction.reply({
                content: `🚫 抱歉，您需要持有特定的身份组(<@&${mustHoldRoleId}>)才能申请 \n由于不符合条件，您已被禁止再次申请`,
                flags: 64,
            });
        }

        // 4. Create and show the modal
        const modal = new ModalBuilder()
            .setCustomId(`newApplyModal:${guildId}:${categoryId}`)
            .setTitle(`申请 - ${categoryConfig.category_name || categoryConfig.name}`);

        const selfIntroductionInput = new TextInputBuilder()
            .setCustomId('selfIntroduction')
            .setLabel('自我介绍')
            .setPlaceholder('请详细介绍您自己，以及您申请该身份组的理由 ')
            .setStyle(TextInputStyle.Paragraph) // Paragraph for long text
            .setMinLength(50)
            .setMaxLength(1000)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(selfIntroductionInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },
};
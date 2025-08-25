const { getCategoryConfig } = require('../../utils/configManager');
const { findActiveApply } = require('../../utils/persistence');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'admin_role',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const admin = interaction.user;

        try {
            await interaction.deferUpdate();

            // 权限检查：只有管理员可以操作
            if (!hasPermission(interaction.member, admin.id)) {
                return await interaction.followUp({ content: '您没有权限执行此操作 ', flags: 64 });
            }

            const pendingApply = findActiveApply(guildId, userId, categoryId);

            if (!pendingApply || pendingApply.status !== 'approved') {
                return await interaction.followUp({ content: '未找到相关申请或申请状态不正确 ', flags: 64 });
            }

            const categoryConfig = getCategoryConfig(guildId, categoryId);

            // 显示额外身份组选择
            if (!categoryConfig?.choose || Object.keys(categoryConfig.choose).length === 0) {
                return await interaction.followUp({ 
                    content: '此类别没有配置额外身份组选项 ', 
                    flags: 64 
                });
            }

            const roleOptions = Object.values(categoryConfig.choose).map(role => ({
                label: role.name,
                value: role.role_id,
                description: `授予 ${role.name} 身份组`
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select_extra_role:${guildId}:${categoryId}:${userId}`)
                .setPlaceholder('选择要授予的额外身份组')
                .addOptions(roleOptions);

            const actionRow = new ActionRowBuilder()
                .addComponents(selectMenu);

            const roleEmbed = new EmbedBuilder()
                .setTitle('选择额外身份组')
                .setDescription(`请为 <@${userId}> 选择要授予的额外身份组：`)
                .setColor(0x0099FF);

            await interaction.followUp({ 
                embeds: [roleEmbed], 
                components: [actionRow],
                flags: 64
            });

        } catch (error) {
            console.error(`[adminRoleHandler] Error processing admin_role:`, error);
        }
    },
};
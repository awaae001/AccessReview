const { getCategoryConfig } = require('../../utils/configManager');
const { 
    findActiveApply, 
    removeActiveApply, 
    addApplyToHistory 
} = require('../../utils/persistence');
const { EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'admin_approve',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const guild = interaction.guild;
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

            const applicant = await guild.members.fetch(userId);
            const channel = interaction.channel;
            const categoryConfig = getCategoryConfig(guildId, categoryId);

            // 批准申请，授予基础身份组
            const giveRoleId = categoryConfig?.role_config?.give_role_id;
            
            if (giveRoleId) {
                await applicant.roles.add(giveRoleId);
            }

            // 删除活跃申请记录
            removeActiveApply(guildId, userId, categoryId);

            // 添加到历史记录
            addApplyToHistory(guildId, {
                ...pendingApply,
                status: 'approved',
                processedAt: new Date().toISOString(),
                processedBy: admin.id
            });

            // 移除申请人的频道权限
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: false,
                SendMessages: false
            });

            const approvedEmbed = new EmbedBuilder()
                .setTitle('申请已批准')
                .setDescription(`<@${userId}> 的申请已被 <@${admin.id}> 批准通过`)
                .setColor(0x00FF00) // Green
                .setTimestamp();

            await interaction.editReply({ embeds: [approvedEmbed], components: [] });

            // 向申请人发送私信
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 申请已通过')
                    .setDescription(`恭喜！您的 **${categoryConfig.category_name || categoryConfig.name}** 申请已被批准。`)
                    .setColor(0x00FF00);
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`无法向用户 ${userId} 发送私信`);
            }

        } catch (error) {
            console.error(`[adminApproveHandler] Error processing admin_approve:`, error);
        }
    },
};
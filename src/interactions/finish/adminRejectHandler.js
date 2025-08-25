const { getCategoryConfig } = require('../../utils/configManager');
const { 
    findActiveApply, 
    updateActiveApply, 
    addApplyToHistory 
} = require('../../utils/persistence');
const { EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'admin_reject',
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

            // 拒绝申请
            updateActiveApply(guildId, userId, categoryId, {
                status: 'rejected',
                processedAt: new Date().toISOString(),
                processedBy: admin.id
            });

            // 添加到历史记录
            addApplyToHistory(guildId, {
                ...pendingApply,
                status: 'rejected',
                processedAt: new Date().toISOString(),
                processedBy: admin.id
            });

            // 移除申请人的频道权限
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: false,
                SendMessages: false
            });

            const rejectedEmbed = new EmbedBuilder()
                .setTitle('申请已拒绝')
                .setDescription(`<@${userId}> 的申请已被 <@${admin.id}> 拒绝`)
                .setColor(0xFF0000) // Red
                .setTimestamp();

            await interaction.editReply({ embeds: [rejectedEmbed], components: [] });

            // 向申请人发送私信
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('申请结果通知')
                    .setDescription('很抱歉，您的申请未能通过。感谢您的申请，祝您生活愉快。')
                    .setColor(0xFF0000);
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`无法向用户 ${userId} 发送私信`);
            }

        } catch (error) {
            console.error(`[adminRejectHandler] Error processing admin_reject:`, error);
        }
    },
};
const { getCategoryConfig } = require('../../utils/configManager');
const { 
    findActiveApply, 
    updateActiveApply, 
    removeActiveApply, 
    addApplyToHistory 
} = require('../../utils/persistence');
const { EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'finish_confirm',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const guild = interaction.guild;
        const user = interaction.user;

        try {
            await interaction.deferUpdate();

            const pendingApply = findActiveApply(guildId, userId, categoryId);

            if (!pendingApply || pendingApply.status !== 'approved') {
                return await interaction.followUp({ content: '未找到相关申请或申请状态不正确 ', flags: 64 });
            }

            // 权限检查：只有申请人本人可以确认退出
            if (user.id !== userId) {
                return await interaction.followUp({ content: '只有申请人本人可以确认退出 ', flags: 64 });
            }

            const applicant = await guild.members.fetch(userId);
            const channel = interaction.channel;

            // 更新申请状态为rejected（防止重新申请）
            updateActiveApply(guildId, userId, categoryId, {
                status: 'rejected',
                processedAt: new Date().toISOString(),
                processedBy: userId, // 标记为申请人自己结束
                reason: 'applicant_exit'
            });

            // 添加到历史记录
            addApplyToHistory(guildId, {
                ...pendingApply,
                status: 'rejected',
                processedAt: new Date().toISOString(),
                processedBy: userId,
                reason: 'applicant_exit'
            });

            // 移除申请人的频道权限
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: false,
                SendMessages: false
            });

            // 发送确认消息
            const exitEmbed = new EmbedBuilder()
                .setTitle('申请已结束')
                .setDescription(`<@${userId}> 已主动结束申请流程`)
                .setColor(0xFF6600) // Orange
                .setTimestamp();

            await interaction.editReply({ embeds: [exitEmbed], components: [] });

            // 向申请人发送私信
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('申请已结束')
                    .setDescription('您已成功结束申请流程。如需重新申请，请联系管理员。')
                    .setColor(0xFF6600);
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`无法向用户 ${userId} 发送私信`);
            }

        } catch (error) {
            console.error(`[finishConfirmHandler] Error processing finish_confirm:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '处理请求时发生错误 ', ephemeral: true });
                } else {
                    await interaction.followUp({ content: '处理请求时发生错误 ', flags: 64 });
                }
            } catch (followUpError) {
                console.error('无法发送错误响应:', followUpError);
            }
        }
    },
};
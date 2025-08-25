const { getCategoryConfig } = require('../utils/configManager');
const { 
    findActiveApply, 
    updateActiveApply, 
    removeActiveApply, 
    addApplyToHistory 
} = require('../utils/persistence');
const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'review',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, action, guildId, categoryId, userId] = interaction.customId.split(':');
        const guild = interaction.guild;
        const reviewer = interaction.user;

        try {
            await interaction.deferUpdate();

            const pendingApply = findActiveApply(guildId, userId, categoryId);

            if (!pendingApply || pendingApply.status !== 'pending') {
                return await interaction.followUp({ content: '未找到待处理的申请，或该申请已被处理 ', flags: 64 });
            }

            const applicant = await guild.members.fetch(userId);
            const originalMessage = interaction.message;
            const originalEmbed = originalMessage.embeds[0];
            
            if (action === 'approve') {
                const categoryConfig = getCategoryConfig(guildId, categoryId);

                const parentCategory = await guild.channels.fetch(categoryId);
                const permissionOverwrites = Array.from(parentCategory.permissionOverwrites.cache.values());

                permissionOverwrites.push({
                    id: userId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                });

                const channel = await guild.channels.create({
                    name: `${applicant.user.username}-申请`,
                    type: 0, // Text channel
                    parent: categoryId,
                    permissionOverwrites: permissionOverwrites,
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`欢迎 ${applicant.user.username}！`)
                    .setDescription(`您的 **${categoryConfig.category_name || categoryConfig.name}** 申请预审核已通过 `)
                    .addFields({ name: '您的自我介绍', value: pendingApply.selfIntroduction.length > 1024 ? pendingApply.selfIntroduction.substring(0, 1021) + '...' : pendingApply.selfIntroduction })
                    .setColor(0x00FF00) // Green
                    .setTimestamp();

                const finishEmbed = new EmbedBuilder()
                    .setTitle('手动结束')
                    .setDescription('你可以通过这个按钮结束你的申请')
                    .setColor(0xFFFF00); // Yellow

                // 创建"结束"按钮
                const finishButton = new ButtonBuilder()
                    .setCustomId(`finish:${guildId}:${categoryId}:${userId}`)
                    .setLabel('结束')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Success);

                const actionRow = new ActionRowBuilder()
                    .addComponents(finishButton);

                const welcomeMessage = await channel.send({
                    content: `欢迎 <@${userId}>！`,
                    embeds: [welcomeEmbed, finishEmbed],
                    components: [actionRow]
                });

                updateActiveApply(guildId, userId, categoryId, {
                    status: 'approved',
                    channelId: channel.id,
                    reviewerId: reviewer.id,
                    messageId: welcomeMessage.id
                });

                const approvedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0x00FF00)
                    .setFields(
                        { name: '申请人', value: `<@${userId}>`, inline: true },
                        { name: '状态', value: `已通过 (处理人: <@${reviewer.id}>)`, inline: true }
                    );
                
                await originalMessage.edit({ embeds: [approvedEmbed], components: [] });

            } else if (action === 'reject') {
                updateActiveApply(guildId, userId, categoryId, {
                    status: 'rejected',
                    reviewerId: reviewer.id
                });

                try {
                    const rejectionEmbed = new EmbedBuilder()
                        .setTitle('🫡 感谢您申请社区管理职位')
                        .setDescription('很抱歉，您的申请未能通过本次预审。感谢您对管理组工作的支持，祝您生活愉快')
                        .setColor(0xFFFF00); // Yellow
                    await applicant.send({ embeds: [rejectionEmbed] });
                } catch (dmError) {
                    console.error(`无法向用户 ${userId} 发送私信:`, dmError);
                }
                
                const rejectedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(0xFF0000) // Red
                    .setFields(
                        { name: '申请人', value: `<@${userId}>`, inline: true },
                        { name: '状态', value: `已拒绝 (处理人: <@${reviewer.id}>)`, inline: true }
                    );
                
                await originalMessage.edit({ embeds: [rejectedEmbed], components: [] });
            }
        } catch (error) {
            console.error(`[reviewHandler] Error processing review:`, error);
        }
    },
};
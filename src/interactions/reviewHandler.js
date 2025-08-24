const { getCategoryConfig } = require('../utils/configManager');
const { 
    findActiveApply, 
    updateActiveApply, 
    removeActiveApply, 
    addApplyToHistory 
} = require('../utils/persistence');
const { PermissionsBitField, EmbedBuilder } = require('discord.js');

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

            const originalMessage = interaction.message;
            const originalEmbed = originalMessage.embeds[0];
            
            if (action === 'approve') {
                const categoryConfig = getCategoryConfig(guildId, categoryId);
                const applicant = await guild.members.fetch(userId);

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
                    .addFields({ name: '您的自我介绍', value: pendingApply.selfIntroduction })
                    .setColor(0x00FF00) // Green
                    .setTimestamp();
                await channel.send({ content: `欢迎 <@${userId}>！`, embeds: [welcomeEmbed] });

                updateActiveApply(guildId, userId, categoryId, { 
                    status: 'approved', 
                    channelId: channel.id, 
                    reviewerId: reviewer.id 
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
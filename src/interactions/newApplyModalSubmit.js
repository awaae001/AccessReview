const { getCategoryConfig, getGuildConfig } = require('../utils/configManager');
const { sendLog } = require('../utils/logger');
const { addActiveApply } = require('../utils/persistence');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'newApplyModal', // Corresponds to the first part of customId
    async execute(interaction) {
        if (!interaction.isModalSubmit()) return;

        const [, guildId, categoryId] = interaction.customId.split(':');
        const selfIntroduction = interaction.fields.getTextInputValue('selfIntroduction');
        const user = interaction.user;
        const guild = interaction.guild;

        try {
            // 1. Save application to persistence with 'pending' status
            addActiveApply({
                userId: user.id,
                guildId: guild.id,
                categoryId: categoryId,
                applyTime: new Date().toISOString(),
                selfIntroduction: selfIntroduction,
                status: 'pending', // 'pending', 'approved', 'rejected'
            });

            // 2. Send notification to admin channel for review
            const categoryConfig = getCategoryConfig(guildId, categoryId);

            if (categoryConfig && categoryConfig.admin_channle_id) {
                const adminChannelId = categoryConfig.admin_channle_id;
                const adminChannel = await guild.channels.fetch(adminChannelId);

                if (adminChannel) {
                    const reviewEmbed = new EmbedBuilder()
                        .setTitle(`新的 ${categoryConfig.category_name || categoryConfig.name} 申请`)
                        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                        .setDescription(selfIntroduction)
                        .addFields(
                            { name: '申请人', value: `<@${user.id}>`, inline: true },
                            { name: '状态', value: '等待审核', inline: true }
                        )
                        .setColor(0xFFA500) // Orange for pending
                        .setTimestamp();

                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`review:approve:${guildId}:${categoryId}:${user.id}`)
                                .setLabel('通过')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`review:reject:${guildId}:${categoryId}:${user.id}`)
                                .setLabel('拒绝')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await adminChannel.send({ embeds: [reviewEmbed], components: [actionRow] });
                }
            } else {
                const warnMsg = `Admin channel ID not configured for category ${categoryId} in guild ${guildId}.`;
                console.warn(`[newApplyModalSubmit] ${warnMsg}`);
                sendLog({ module: 'newApplyModalSubmit', action: 'configWarning', info: warnMsg }, 'warn');
            }

            // 3. Respond to the user
            await interaction.reply({
                content: '您的申请已成功提交，正在等待管理员审核 ',
                flags: 64, // Ephemeral
            });

        } catch (error) {
            console.error(`[newApplyModalSubmit] Error processing application:`, error);
            await interaction.reply({
                content: '提交申请时遇到错误，请联系管理员 ',
                flags: 64, // Ephemeral
            });
        }
    },
};
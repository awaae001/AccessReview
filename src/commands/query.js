const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissionChecker');
const { queryUserData } = require('../utils/dataQuery');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('query')
        .setDescription('Query user data across all databases')
        .setNameLocalizations({
            'zh-CN': '查询'
        })
        .setDescriptionLocalizations({
            'zh-CN': '查询用户在所有库中的数据'
        })
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('User ID to query (Admin only)')
                .setDescriptionLocalizations({
                    'zh-CN': '要查询的用户ID (管理员专用)'
                })
                .setRequired(false)),
    async execute(interaction, client) {
        const member = interaction.member;
        const requestUserId = interaction.user.id;
        const isAdmin = hasPermission(member, requestUserId);
        let targetUserIdInput = interaction.options.getString('user_id');
        let targetUserId;

        if (!isAdmin && targetUserIdInput) {
            await interaction.reply({ content: '您没有权限查询其他用户的数据', ephemeral: true });
            return;
        }

        if (isAdmin) {
            targetUserId = targetUserIdInput || requestUserId;
        } else {
            targetUserId = requestUserId;
        }

        console.log(`[query/execute] 用户 ${requestUserId} 正在查询用户 ${targetUserId} 的数据`);

        await interaction.deferReply({ ephemeral: true });

        const result = await queryUserData(targetUserId);

        if (result.error) {
            await interaction.editReply(result.error);
            return;
        }

        const { userData, targetUsername } = result;

        const embed = new EmbedBuilder()
            .setTitle(`用户 ${targetUsername} (${targetUserId}) 的数据`)
            .setColor(0x0099ff);

        userData.forEach(data => {
            embed.addFields({
                name: `频道: <#${data.channelId}>`,
                value: `\`\`\`
消息数: ${data.message_count}
被提及数: ${data.mention_count}
主动提及数: ${data.mentions_made_count}
最后消息: ${new Date(data.last_message_timestamp).toLocaleString('zh-CN')}
\`\`\``,
                inline: false
            });
        });

        await interaction.editReply({ embeds: [embed] });
    },
};

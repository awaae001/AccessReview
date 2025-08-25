const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'finish_cancel',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const user = interaction.user;

        try {
            await interaction.deferUpdate();

            // 权限检查：只有申请人本人可以取消
            if (user.id !== userId) {
                return await interaction.followUp({ content: '只有申请人本人可以取消操作 ', flags: 64 });
            }

            const cancelEmbed = new EmbedBuilder()
                .setTitle('操作已取消')
                .setDescription('您已取消结束申请，可以继续进行申请流程。')
                .setColor(0x808080); // Gray

            await interaction.editReply({ embeds: [cancelEmbed], components: [] });

        } catch (error) {
            console.error(`[finishCancelHandler] Error processing finish_cancel:`, error);
        }
    },
};
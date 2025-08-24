const { SlashCommandBuilder } = require('discord.js');
const { hasPermission } = require('../utils/permissionChecker');
const { scanTask } = require('../tasks/scanner')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh_db')
        .setDescription('刷新数据库'),
    async execute(interaction, client) {
        const member = interaction.member;
        const userId = interaction.user.id;

        if (!hasPermission(member, userId)) {
            console.log(`[refresh_db/execute] 用户 ${userId} 权限不足，拒绝执行`);
            await interaction.reply({ content: '你没有权限使用该命令 ', ephemeral: true });
            return;
        }

        console.log(`[refresh_db/execute] 用户 ${userId} 权限校验通过，开始刷新数据库`);

        await interaction.reply({ content: '数据库刷新命令已收到 ', ephemeral: true });
        scanTask();
    },
};

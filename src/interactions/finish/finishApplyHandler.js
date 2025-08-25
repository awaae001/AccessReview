const { getCategoryConfig } = require('../../utils/configManager');
const { 
    findActiveApply, 
    updateActiveApply, 
    removeActiveApply, 
    addApplyToHistory 
} = require('../../utils/persistence');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'finish',
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const guild = interaction.guild;
        const user = interaction.user;

        try {
            console.log(`[finishApplyHandler] Processing finish button for user ${user.id}, target ${userId}`);
            
            // 先简单回复确认收到请求
            await interaction.reply({ 
                content: '正在处理您的请求...', 
                ephemeral: true 
            });

            const pendingApply = findActiveApply(guildId, userId, categoryId);
            console.log(`[finishApplyHandler] Found apply:`, pendingApply);

            if (!pendingApply || pendingApply.status !== 'approved') {
                return await interaction.editReply({ content: '未找到相关申请或申请状态不正确 ' });
            }

            // 如果是申请人自己点击，询问确认
            if (user.id === userId) {
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('确认结束申请？')
                    .setDescription('点击"确认退出"将结束您的申请流程，该操作不可撤销')
                    .setColor(0xFFFF00); // Yellow

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`finish_confirm:${guildId}:${categoryId}:${userId}`)
                    .setLabel('确认退出')
                    .setStyle(ButtonStyle.Danger);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`finish_cancel:${guildId}:${categoryId}:${userId}`)
                    .setLabel('取消')
                    .setStyle(ButtonStyle.Secondary);

                const actionRow = new ActionRowBuilder()
                    .addComponents(confirmButton, cancelButton);

                return await interaction.editReply({ 
                    content: '', 
                    embeds: [confirmEmbed], 
                    components: [actionRow]
                });
            }

            // 如果是管理员点击，显示管理员选项
            if (hasPermission(interaction.member, user.id)) {
                const adminEmbed = new EmbedBuilder()
                    .setTitle('管理员操作')
                    .setDescription(`请选择对 <@${userId}> 申请的处理方式：`)
                    .setColor(0x0099FF); // Blue

                const approveButton = new ButtonBuilder()
                    .setCustomId(`admin_approve:${guildId}:${categoryId}:${userId}`)
                    .setLabel('批准通过')
                    .setStyle(ButtonStyle.Success);

                const rejectButton = new ButtonBuilder()
                    .setCustomId(`admin_reject:${guildId}:${categoryId}:${userId}`)
                    .setLabel('拒绝申请')
                    .setStyle(ButtonStyle.Danger);

                const roleButton = new ButtonBuilder()
                    .setCustomId(`admin_role:${guildId}:${categoryId}:${userId}`)
                    .setLabel('授予额外身份组')
                    .setStyle(ButtonStyle.Primary);

                const actionRow = new ActionRowBuilder()
                    .addComponents(approveButton, rejectButton, roleButton);

                return await interaction.editReply({ 
                    content: '',
                    embeds: [adminEmbed], 
                    components: [actionRow]
                });
            }

            // 如果既不是申请人也不是管理员，返回错误信息
            return await interaction.editReply({ 
                content: '您没有权限操作此申请 '
            });

        } catch (error) {
            console.error(`[finishApplyHandler] Error processing finish:`, error);
            // 确保在错误情况下也有响应
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '处理请求时发生错误 ', ephemeral: true });
                } else {
                    await interaction.editReply({ content: '处理请求时发生错误 ' });
                }
            } catch (followUpError) {
                console.error('无法发送错误响应:', followUpError);
            }
        }
    },
};
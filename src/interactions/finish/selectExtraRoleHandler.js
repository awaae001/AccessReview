const { getCategoryConfig } = require('../../utils/configManager');
const { findActiveApply } = require('../../utils/persistence');
const { EmbedBuilder } = require('discord.js');
const { hasPermission } = require('../../utils/permissionChecker');

module.exports = {
    name: 'select_extra_role',
    async execute(interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const [, guildId, categoryId, userId] = interaction.customId.split(':');
        const guild = interaction.guild;
        const admin = interaction.user;
        const selectedRoleId = interaction.values[0];

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
            const categoryConfig = getCategoryConfig(guildId, categoryId);
            
            // 查找选中的身份组信息
            const roleInfo = categoryConfig?.choose ? 
                Object.values(categoryConfig.choose).find(role => role.role_id === selectedRoleId) : 
                null;

            if (!roleInfo) {
                return await interaction.followUp({ 
                    content: '找不到指定的身份组配置 ', 
                    flags: 64 
                });
            }

            // 授予额外身份组
            await applicant.roles.add(selectedRoleId);

            const successEmbed = new EmbedBuilder()
                .setTitle('身份组已授予')
                .setDescription(`已为 <@${userId}> 授予 **${roleInfo.name}** 身份组`)
                .addFields(
                    { name: '操作员', value: `<@${admin.id}>`, inline: true },
                    { name: '身份组', value: roleInfo.name, inline: true }
                )
                .setColor(0x00FF00) // Green
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });

            // 向申请人发送私信
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('额外身份组授予')
                    .setDescription(`您已被授予 **${roleInfo.name}** 身份组！`)
                    .setColor(0x00FF00);
                await applicant.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`无法向用户 ${userId} 发送私信`);
            }

        } catch (error) {
            console.error(`[selectExtraRoleHandler] Error processing select_extra_role:`, error);
            await interaction.followUp({ 
                content: '授予身份组时发生错误，请检查权限设置 ', 
                flags: 64 
            });
        }
    },
};
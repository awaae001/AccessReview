const { getCategoryConfig } = require('../../utils/configManager');
const {
    findActiveApply,
    removeActiveApply,
    addApplyToHistory
} = require('../../utils/persistence');
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
            const channel = interaction.channel;
            const categoryConfig = getCategoryConfig(guildId, categoryId);
            
            //  - 查找选中的身份组信息  -
            const roleInfo = categoryConfig?.choose ?
                Object.values(categoryConfig.choose).find(role => role.role_id === selectedRoleId) :
                null;

            if (!roleInfo) {
                return await interaction.followUp({ content: '找不到指定的身份组配置 ', flags: 64 });
            }

            //  - 授予身份组  -
            const baseRoleId = categoryConfig?.role_config?.give_role_id;
            let rolesGranted = [roleInfo.name];
            await applicant.roles.add(selectedRoleId);

            if (baseRoleId) {
                await applicant.roles.add(baseRoleId);
                const baseRole = await guild.roles.fetch(baseRoleId);
                if (baseRole) rolesGranted.push(baseRole.name);
            }

            //  - 结束申请流程  -
            removeActiveApply(guildId, userId, categoryId);
            addApplyToHistory(guildId, {
                ...pendingApply,
                status: 'approved',
                processedAt: new Date().toISOString(),
                processedBy: admin.id,
                extraRoles: [selectedRoleId]
            });

            //  - 关闭频道  -
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: false,
                SendMessages: false
            });

            if (pendingApply.messageId) {
                try {
                    const originalMessage = await channel.messages.fetch(pendingApply.messageId);
                    await originalMessage.edit({ components: [] });
                } catch (msgError) {
                    console.error(`[selectExtraRoleHandler] Could not edit original message ${pendingApply.messageId}:`, msgError);
                }
            }

            //  - 发送最终确认消息  -
            const successEmbed = new EmbedBuilder()
                .setTitle('申请已批准并通过')
                .setDescription(`已为 <@${userId}> 的申请处理完毕，频道已关闭。`)
                .addFields(
                    { name: '处理人', value: `<@${admin.id}>`, inline: true },
                    { name: '授予的身份组', value: rolesGranted.join(', '), inline: false }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            // First, edit the original ephemeral reply to confirm the action is done.
            await interaction.editReply({ content: '身份组授予成功 ', embeds: [], components: [] });

            // Then, send a new public message to the channel.
            await interaction.channel.send({ embeds: [successEmbed] });

            //  - 向申请人发送私信  -
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 申请已通过')
                    .setDescription(`恭喜！您的 **${categoryConfig.category_name || categoryConfig.name}** 申请已被批准。`)
                    .addFields({ name: '您被授予了以下身份组', value: rolesGranted.join(', ') })
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
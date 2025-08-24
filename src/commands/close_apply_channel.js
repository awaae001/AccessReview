const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { hasPermission } = require('../utils/permissionChecker');
const { findApplyByChannel, removeApply } = require('../utils/persistence');
const { getCategoryConfig } = require('../utils/configManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close_apply_channel')
        .setDescription('关闭当前申请频道')
        .addBooleanOption(option =>
            option.setName('approve')
                .setDescription('是否批准申请？ (默认为 No)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('applicant')
                .setDescription('手动指定申请人 (通常不需要)')
                .setRequired(false)),
    aliases: ['ac'], // 添加别名

    async execute(interaction) {
        // 权限检查
        if (!hasPermission(interaction.member, interaction.user.id)) {
            return interaction.reply({ content: '你没有权限使用此命令。', ephemeral: true });
        }

        // 立即延迟回复，以防后续操作超时
        await interaction.deferReply();

        try {
            const channel = interaction.channel;
            const approve = interaction.options.getBoolean('approve') ?? false;
            let applicantUser = interaction.options.getUser('applicant');

            // 1. 智能检测申请人
            const applyInfo = findApplyByChannel(channel.id);
            if (!applicantUser && applyInfo) {
                try {
                    applicantUser = await interaction.client.users.fetch(applyInfo.userId);
                } catch (fetchError) {
                    console.error(`[close_apply_channel] 无法通过 ID (${applyInfo.userId}) 获取用户:`, fetchError);
                    await interaction.editReply({ content: '无法获取申请人信息，用户可能已离开服务器。' });
                    return;
                }
            }

            if (!applicantUser) {
                await interaction.editReply({ content: '无法确定申请人。请使用 `applicant` 选项手动指定或确保频道与申请关联。' });
                return;
            }

            let replyMessage = '';

            // 2. 如果批准，则授予身份组
            if (approve) {
                if (!applyInfo) {
                    await interaction.editReply({ content: '无法找到该申请的配置信息，无法授予身份组。' });
                    return;
                }

                const categoryConfig = getCategoryConfig(applyInfo.guildId, applyInfo.categoryId);
                const giveRoleId = categoryConfig?.role_config?.give_role_id;

                if (giveRoleId) {
                    const member = await interaction.guild.members.fetch(applicantUser.id);
                    await member.roles.add(giveRoleId);
                    replyMessage = `${applicantUser.tag} 的申请已被批准，相应身份组已授予。`;
                } else {
                    replyMessage = `**警告**: 未在此申请类别中配置 'give_role_id'，因此未自动授予身份组。\n${applicantUser.tag} 的申请已被手动批准。`;
                }
            } else {
                replyMessage = `${applicantUser.tag} 的申请已被拒绝。`;
            }
            
            // 3. 移除申请人的查看权限以“关闭”频道
            await channel.permissionOverwrites.edit(applicantUser.id, {
                ViewChannel: false,
            });
            replyMessage += ' 频道已关闭。';

            // 4. 清理持久化数据
            removeApply(channel.id);

            // 5. 完成后更新回复
            await interaction.editReply({ content: replyMessage });

        } catch (error) {
            console.error('[close_apply_channel] 处理申请时出错:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '处理申请时出错，请检查后台日志。' });
            }
        }
    },
};
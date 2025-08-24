const { getCategoryConfig } = require('../utils/configManager');
const { addApply } = require('../utils/persistence');
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'apply', // 这个名字对应 customId 的第一部分
    async execute(interaction) {
        const [, guildId, categoryId] = interaction.customId.split(':');
        const member = interaction.member;

        // 1. 获取配置
        const categoryConfig = getCategoryConfig(guildId, categoryId);
        if (!categoryConfig || !categoryConfig.role_config || !categoryConfig.role_config.musthold_role_id) {
            console.error(`[newApplyHandler] 无法找到 ${guildId}:${categoryId} 的 musthold_role_id 配置。`);
            return interaction.reply({ content: '申请配置错误，请联系管理员。', ephemeral: true });
        }

        const mustHoldRoleId = categoryConfig.role_config.musthold_role_id;

        // 2. 执行前置检查
        if (!member.roles.cache.has(mustHoldRoleId)) {
            // 如果用户没有所需身份组，则回复提示消息
            return interaction.reply({
                content: `抱歉，您需要持有特定的身份组才能进行申请。`,
                ephemeral: true, // 消息仅对该用户可见
            });
        }
        
        // 权限检查通过，开始创建频道
        await interaction.reply({
            content: '身份验证通过！正在为您创建申请频道...',
            ephemeral: true,
        });

        try {
            const guild = interaction.guild;
            const user = interaction.user;
            const categoryChannel = await guild.channels.fetch(categoryId);

            // 创建一个新的私密频道
            const channel = await guild.channels.create({
                name: `申请-${user.username}-${categoryConfig.category_name || categoryConfig.name}`,
                type: 0, // 0 表示文本频道
                parent: categoryChannel, // 继承父类别的权限
                permissionOverwrites: [
                    {
                        id: guild.id, // @everyone 角色
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: user.id, // 申请人
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.SendMessagesInThreads,
                        ],
                    },
                ],
            });

            // 在新频道中发送欢迎消息
            await channel.send(`欢迎 ${user}！您的 **${categoryConfig.category_name || categoryConfig.name}** 申请已开始。请在此频道中与我们沟通。`);

            // 记录到持久化数据中
            addApply({
                channelId: channel.id,
                userId: user.id,
                guildId: guild.id,
                categoryId: categoryId,
                applyTime: new Date().toISOString(),
            });

        } catch (error) {
            console.error(`[newApplyHandler] 创建申请频道时出错:`, error);
            await interaction.followUp({
                content: '创建申请频道失败，请联系管理员',
                ephemeral: true,
            });
        }
    },
};
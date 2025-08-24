const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getGuildConfig } = require('../utils/configManager');
const { hasPermission } = require('../utils/permissionChecker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create_new_apply_panel')
        .setDescription('创建一个新的申请面板')
        .addStringOption(option =>
            option.setName('category_id')
                .setDescription('请选择一个申请类别')
                .setRequired(true)
                .setAutocomplete(true) // 启用自动完成
        )
        .addStringOption(option =>
            option.setName('title')
                .setDescription('自定义标题')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('context')
                .setDescription('自定义描述内容')
                .setRequired(false)
        ),
    async autocomplete(interaction) {
        const guildId = interaction.guild.id;
        const guildConfig = getGuildConfig(guildId);

        if (!guildConfig || !guildConfig.data) {
            await interaction.respond([]);
            return;
        return;
    }

    const categories = Object.values(guildConfig.data);
    const filteredCategories = categories.filter(category => category && (category.category_name || category.name) && category.id);

    const choices = filteredCategories.map(category => ({
        name: category.category_name || category.name,
        value: category.id,
    }));

    // Discord API 限制 choices 数量不能超过 25
    const finalChoices = choices.slice(0, 25);

    await interaction.respond(finalChoices);
},
async execute(interaction) {
    // 权限检查
    if (!hasPermission(interaction.member, interaction.user.id)) {
            return interaction.reply({ content: '你没有权限使用此命令 ', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        const categoryId = interaction.options.getString('category_id');
        const customTitle = interaction.options.getString('title');
        const customContext = interaction.options.getString('context');
        
        // 从配置中获取类别数据
        const guildConfig = getGuildConfig(guildId);
        if (!guildConfig || !guildConfig.data || !guildConfig.data[categoryId]) {
            return interaction.reply({ content: '无效的申请类别或服务器配置 ', ephemeral: true });
        }

        const categoryConfig = guildConfig.data[categoryId];

        // 创建嵌入式消息
        const title = customTitle || `**${categoryConfig.category_name || categoryConfig.name}** 申请面板`;
        const description = customContext || `点击下方的按钮开始您的 **${categoryConfig.category_name || categoryConfig.name}** 申请流程 `;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0x0099FF);

        // 创建按钮
        const applyButton = new ButtonBuilder()
            .setCustomId(`apply:${guildId}:${categoryId}`)
            .setLabel('点击开始申请')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(applyButton);

        // 发送消息
        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '申请面板已成功创建 ', ephemeral: true });
    },
};
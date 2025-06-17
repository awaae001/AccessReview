const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('申请加入服务器')
    .addStringOption(option =>
      option.setName('admin_channel_id')
        .setDescription('管理员频道ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('target_role_id')
        .setDescription('要分配的身份组ID')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    // 引入权限校验工具
    const { hasPermission } = require('../utils/permissionChecker');

    // 日志：命令被调用
    console.log(`[apply/execute] 用户 ${interaction.user.tag}(${interaction.user.id}) 调用了 /apply`);

    // 检查用户是否有权限
    const member = interaction.member;
    const userId = interaction.user.id;

    if (!hasPermission(member, userId)) {
      console.log(`[apply/execute] 用户 ${userId} 权限不足，拒绝执行`);
      await interaction.reply({ content: '你没有权限使用该命令。', flags: 64 });
      return;
    }
    console.log(`[apply/execute] 用户 ${userId} 权限校验通过`);

    // 解析参数
    const adminChannelId = interaction.options.getString('admin_channel_id');
    const targetRoleId = interaction.options.getString('target_role_id');
    console.log(`[apply/execute] 参数解析: adminChannelId=${adminChannelId}, targetRoleId=${targetRoleId}`);

    // 嵌入式消息
    const embed = new EmbedBuilder()
      .setTitle('入群申请')
      .setDescription('请点击下方按钮填写申请表单。')
      .setColor(0x3498db);

    // 申请按钮，携带参数
    const applyBtn = new ButtonBuilder()
      .setCustomId(`openApplyModal:${adminChannelId}:${targetRoleId}`)
      .setLabel('申请入群')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(applyBtn);

    console.log(`[apply/execute] 正在回复嵌入消息并添加按钮`);
    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
    console.log(`[apply/execute] 回复完成`);
  },
  async handleButton(interaction, client) {
    // 日志：按钮被点击
    console.log(`[apply/handleButton] 用户 ${interaction.user.tag}(${interaction.user.id}) 点击了按钮 customId=${interaction.customId}`);

    // 从 customId 解析参数
    const [_, adminChannelId, targetRoleId] = interaction.customId.split(':');
    console.log(`[apply/handleButton] 解析 customId: adminChannelId=${adminChannelId}, targetRoleId=${targetRoleId}`);

    // 弹出模态框，customId 携带参数
    const modal = new ModalBuilder()
      .setCustomId(`applyModal:${adminChannelId}:${targetRoleId}`)
      .setTitle('入群申请表')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('简述理由')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('extra')
            .setLabel('附加资料')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );
    console.log(`[apply/handleButton] 弹出模态框 applyModal:${adminChannelId}:${targetRoleId}`);
    await interaction.showModal(modal);
    console.log(`[apply/handleButton] showModal 已调用`);
  }
};

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 配置文件路径
const roleConfigPath = path.join(__dirname, '..', '..', 'data', 'role_config.json');

// 读取并解析配置文件以获取选项
let roleChoices = [];
try {
  const rawData = fs.readFileSync(roleConfigPath);
  const roleConfigs = JSON.parse(rawData);
  roleChoices = Object.values(roleConfigs).map(config => ({
    name: config.name,
    value: config.name,
  }));
} catch (error) {
  console.error('无法加载身份组配置以生成命令选项:', error);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creat_apply_ed')
    .setDescription('创建一个嵌入式消息，用于身份组申请')
    .addStringOption(option =>
      option.setName('action_name')
        .setDescription('操作名称，对应配置文件中的 name 字段')
        .setRequired(true)
        .addChoices(...roleChoices)
    ),
  async execute(interaction, client) {
    // 引入权限校验工具
    const { hasPermission } = require('../utils/permissionChecker');

    // 日志：命令被调用
    console.log(`[create_apply_embed/execute] 用户 ${interaction.user.tag}(${interaction.user.id}) 调用了 /creat_apply_ed`);

    // 检查用户是否有权限
    const member = interaction.member;
    const userId = interaction.user.id;

    if (!hasPermission(member, userId)) {
      console.log(`[create_apply_embed/execute] 用户 ${userId} 权限不足，拒绝执行`);
      await interaction.reply({ content: '你没有权限使用该命令 ', flags: 64 });
      return;
    }
    console.log(`[create_apply_embed/execute] 用户 ${userId} 权限校验通过`);

    // 解析参数
    const actionName = interaction.options.getString('action_name');
    console.log(`[create_apply_embed/execute] 参数解析: action_name=${actionName}`);

    // 读取并解析配置文件
    let roleConfigs;
    try {
      const rawData = fs.readFileSync(roleConfigPath);
      roleConfigs = JSON.parse(rawData);
    } catch (error) {
      console.error(`[create_apply_embed/execute] 读取或解析配置文件失败:`, error);
      await interaction.reply({ content: '无法读取或解析身份组配置文件 ', flags: 64 });
      return;
    }

    // 查找匹配的配置
    const configKey = Object.keys(roleConfigs).find(key => roleConfigs[key].name === actionName);
    if (!configKey) {
      console.log(`[create_apply_embed/execute] 未找到名称为 "${actionName}" 的配置`);
      await interaction.reply({ content: `未找到名称为 "${actionName}" 的配置 `, flags: 64 });
      return;
    }

    const config = roleConfigs[configKey].data;
    const targetRoleId = config.role_id;
    const adminChannelId = config.admin_channel_id;
    const dbName = config.database_name;
    const dbKv = config.database_kv;
    const threshold = config.threshold;
    console.log(`[create_apply_embed/execute] 找到配置: targetRoleId=${targetRoleId}, adminChannelId=${adminChannelId}, dbName=${dbName}, dbKv=${dbKv}`);

    // 嵌入式消息
    const embed = new EmbedBuilder()
      .setTitle('自动审核通道')
      .setDescription('请点击下方按钮进行自动审核 \n ' + roleConfigs[configKey].name)
      .setColor(0x3498db);

    // 申请按钮，携带参数
    const applyBtn = new ButtonBuilder()
      .setCustomId(`autoApply:${targetRoleId}:${dbName}:${dbKv}:${adminChannelId}`)
      .setLabel('开始自动审核')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(applyBtn);

    console.log(`[create_apply_embed/execute] 正在回复嵌入消息并添加按钮`);
    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
    console.log(`[create_apply_embed/execute] 回复完成`);
  },
};

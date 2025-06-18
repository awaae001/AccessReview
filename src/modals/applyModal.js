const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const fs = require('fs/promises');
const path = require('path');

module.exports = async (interaction, client) => {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('applyModal:')) return;

  // 解析 customId，格式 applyModal:adminChannelId:targetRoleId
  const [_, adminChannelId, targetRoleId] = interaction.customId.split(':');

  const reason = interaction.fields.getTextInputValue('reason');
  const extra = interaction.fields.getTextInputValue('extra') || '无';

  // 持久化保存申请信息
  try {
    const guildId = interaction.guildId;
    const dataDir = path.join(__dirname, '../../data');
    const filePath = path.join(dataDir, `apply_${guildId}.json`);
    // 确保 data 目录存在
    await fs.mkdir(dataDir, { recursive: true });

    // 读取现有数据
    let fileObj = {
      adminChannelId,
      targetRoleId,
      guildId,
      data: []
    };
    try {
      const file = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(file);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.data)
      ) {
        fileObj = {
          adminChannelId: parsed.adminChannelId || adminChannelId,
          targetRoleId: parsed.targetRoleId || targetRoleId,
          guildId: parsed.guildId || guildId,
          data: parsed.data
        };
      }
    } catch (e) {
      // 文件不存在或格式错误，初始化为默认结构
    }

    // 检查是否已拥有身份组
    let alreadyHasRole = false;
    try {
      // 获取最新 member 信息
      let member = interaction.member;
      if (!member || !member.roles || !member.roles.cache) {
        member = await interaction.guild.members.fetch(interaction.user.id);
      }
      if (member && member.roles && member.roles.cache) {
        alreadyHasRole = member.roles.cache.some(role => role.id === targetRoleId);
      }
    } catch (e) {
    }

    if (alreadyHasRole) {
      await interaction.reply({ content: '你已拥有该身份组，无法再次申请。', flags: 64 });
      return;
    }

    // 检查是否有未完成的申请
    const hasPending = fileObj.data.some(
      d =>
        d.userId === interaction.user.id &&
        (!d.status || (d.status !== 'approved' && d.status !== 'rejected'))
    );
    if (hasPending) {
      await interaction.reply({ content: '你有未完成的申请，请等待审核结果。', flags: 64 });
      return;
    }

    // 追加新记录，生成唯一操作ID
    const opId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    fileObj.data.push({
      id: opId,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      reason,
      extra,
      timestamp: Date.now()
    });
    // 写回文件
    await fs.writeFile(filePath, JSON.stringify(fileObj, null, 2), 'utf-8');

    // 申请信息嵌入
    const embed = new EmbedBuilder()
      .setTitle('新申请')
      .addFields(
        { name: '申请人', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        { name: '简述理由', value: reason, inline: false },
        { name: '附加资料', value: extra, inline: false }
      )
      .setTimestamp()
      .setColor(0xf1c40f);

    // 审核按钮
    const approveBtn = new ButtonBuilder()
      .setCustomId(`approve:${opId}:${targetRoleId}`)
      .setLabel('通过')
      .setStyle(ButtonStyle.Success);

    const rejectBtn = new ButtonBuilder()
      .setCustomId(`reject:${opId}:${targetRoleId}`)
      .setLabel('拒绝')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

    // 推送到管理员频道
    const adminChannel = await client.channels.fetch(adminChannelId);
    if (adminChannel && adminChannel.isTextBased()) {
      await adminChannel.send({
        embeds: [embed],
        components: [row]
      });
    }

    await interaction.reply({ content: '申请已提交，等待管理员审核。', flags: 64 });
  } catch (err) {
    // 持久化失败不影响主流程，仅记录日志
    console.error('保存申请信息失败:', err);
  }
};

const fs = require('fs/promises');
const path = require('path');
const { addToBlacklist } = require('../utils/cooldownManager');

module.exports = async (interaction, client) => {
  try {
    // 解析 customId
    const [_, opId, targetRoleId] = interaction.customId.split(':');
    const reason = interaction.fields.getTextInputValue('rejectReason');

    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const filePath = path.join(__dirname, '../../data', `apply_${guildId}.json`);

    // 查找申请记录获取 userId
    let userId = null;
    try {
      const file = await fs.readFile(filePath, 'utf-8');
      const fileObj = JSON.parse(file);
      if (fileObj && Array.isArray(fileObj.data)) {
        const rec = fileObj.data.find(d => d.id === opId);
        if (rec) userId = rec.userId;
      }
    } catch (e) {
      // 忽略文件读取错误
    }

    if (!userId) {
      await interaction.reply({ content: '未找到对应的申请记录 ', flags: 64 });
      return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await interaction.reply({ content: '用户已不在服务器 ', flags: 64 });
      return;
    }

    // 将用户加入拉黑列表
    await addToBlacklist(userId, '管理员拒绝（旧系统）');

    // 如果填写了拒绝理由，私信给用户
    if (reason) {
      try {
        await member.user.send({
          embeds: [{
            title: '你的申请已被拒绝',
            description: `管理员给出的理由如下：\n\n${reason}`,
            color: 0xED4245 // 红色
          }]
        });
      } catch (e) {
        console.log(`[rejectModal] 无法私聊用户 ${userId}：${e}`);
      }
    }

    // 在频道中回复并发送公开消息
    await interaction.reply({ content: `已拒绝 <@${userId}> 的申请 `, flags: 64 });
    await interaction.channel.send({
      embeds: [{
        title: '申请已拒绝',
        description: `用户 <@${userId}> 的申请已被拒绝`,
        color: 0xED4245, // 红色
        footer: { text: `由 ${interaction.user.username} 操作 · AccessReview ` }
      }]
    });

    // 删除原来的审核消息
    if (interaction.message && typeof interaction.message.delete === 'function') {
      await interaction.message.delete();
    }

    // 更新 JSON 文件
    try {
      const file = await fs.readFile(filePath, 'utf-8');
      const fileObj = JSON.parse(file);
      if (fileObj && Array.isArray(fileObj.data)) {
        const rec = fileObj.data.find(d => d.id === opId);
        if (rec) {
          rec.status = 'rejected';
          delete rec.userTag;
          delete rec.reason;
          delete rec.extra;
        }
        await fs.writeFile(filePath, JSON.stringify(fileObj, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error(`[rejectModal] 更新申请状态失败: ${e}`);
    }

  } catch (err) {
    console.error(`[rejectModal] 处理拒绝模态框失败: ${err}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '操作失败，发生未知错误 ', flags: 64 });
      } else {
        await interaction.followUp({ content: '操作失败，发生未知错误 ', flags: 64 });
      }
    } catch (e) {
      // ignore
    }
  }
};

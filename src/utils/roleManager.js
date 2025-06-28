module.exports = {
  // opId: 唯一操作ID
  async handleReview(interaction, action, opId, targetRoleId, client) {
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const guild = interaction.guild;
      const guildId = interaction.guildId;
      const filePath = path.join(__dirname, '../../data', `apply_${guildId}.json`);
      // 先查找记录，获取 userId
      let userId = null;
      let rec = null;
      try {
        const file = await fs.readFile(filePath, 'utf-8');
        const fileObj = JSON.parse(file);
        if (fileObj && Array.isArray(fileObj.data)) {
          rec = fileObj.data.find(d => d.id === opId);
          if (rec) userId = rec.userId;
        }
      } catch (e) {}
      if (!userId) {
        await interaction.reply({ content: '未找到对应的申请记录。', flags: 64 });
        return;
      }
      const member = await guild.members.fetch(userId).catch(() => null);

      if (!member) {
        console.log(`[roleManager] 用户 ${userId} 不在服务器中`);
        await interaction.reply({ content: '用户已不在服务器。', flags: 64 });
        return;
      }

      if (action === 'approve') {
        // 分配身份组
        await member.roles.add(targetRoleId);
        console.log(`[roleManager] 已为 ${userId} 分配身份组 ${targetRoleId}`);

        // 私聊通知用户
        try {
          await member.user.send({
            embeds: [{
              title: '申请已通过',
              description: `你的申请已通过，已为你分配身份组。`,
              color: 0x57F287 
            }]
          });
        } catch (e) {
          console.log(`[roleManager] 无法私聊用户 ${userId}：${e}`);
        }

        await interaction.reply({ content: `已通过，已为 <@${userId}> 分配身份组。`, flags: 64 });
        await interaction.channel.send({
          embeds: [{
            title: '申请已通过',
            description: `用户 <@${userId}> 的申请已通过，已分配身份组`,
            color: 0x57F287,
            footer: { text: `由 ${interaction.user.username} 操作 · AccessReview ` }
          }]
        });
        // 删除原来的 ED 消息
        if (interaction.message && typeof interaction.message.delete === 'function') {
          await interaction.message.delete();
        }
        // 标记json为已完成
        try {
          const file = await fs.readFile(filePath, 'utf-8');
          const fileObj = JSON.parse(file);
          if (fileObj && Array.isArray(fileObj.data)) {
            const rec2 = fileObj.data.find(d => d.id === opId);
            if (rec2) {
              rec2.status = 'approved';
              delete rec2.userTag;
              delete rec2.reason;
              delete rec2.extra;
            }
            await fs.writeFile(filePath, JSON.stringify(fileObj, null, 2), 'utf-8');
          }
        } catch (e) {
          // 忽略json写入异常
        }
      } else if (action === 'reject') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        // 创建一个模态框
        const modal = new ModalBuilder()
          .setCustomId(`rejectModal:${opId}:${targetRoleId}`)
          .setTitle('拒绝申请');

        const reasonInput = new TextInputBuilder()
          .setCustomId('rejectReason')
          .setLabel("拒绝理由(可选，将私信给用户)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('如果留空，将不会发送私信。')
          .setRequired(false);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        // 显示模态框
        await interaction.showModal(modal);
      }
    } catch (err) {
      console.error(`[roleManager] 操作失败: ${err}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '操作失败，请检查机器人权限。', flags: 64 });
        } else {
          await interaction.followUp({ content: '操作失败，请检查机器人权限。', flags: 64 });
        }
      } catch (e) {
      }
    }
  }
};

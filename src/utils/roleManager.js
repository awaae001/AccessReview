module.exports = {
  async handleReview(interaction, action, userId, targetRoleId, client) {
    try {
      const guild = interaction.guild;
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
        await interaction.reply({ content: `已通过，已为 <@${userId}> 分配身份组。`, flags: 64 });
        // 发送新的 Embed 消息作为ED消息
        await interaction.channel.send({
          embeds: [{
            title: '申请已通过',
            description: `用户 <@${userId}> 的申请已通过，已分配身份组。`,
            color: 0x57F287 // 绿色
          }]
        });
        // 删除原来的 ED 消息
        if (interaction.message && typeof interaction.message.delete === 'function') {
          await interaction.message.delete();
        }
        // 标记json为已完成
        try {
          const fs = require('fs/promises');
          const path = require('path');
          const guildId = interaction.guildId;
          const filePath = path.join(__dirname, '../../data', `apply_${guildId}.json`);
          const file = await fs.readFile(filePath, 'utf-8');
          const fileObj = JSON.parse(file);
          if (fileObj && Array.isArray(fileObj.data)) {
            const rec = fileObj.data.find(d => d.userId === userId);
            if (rec) {
              rec.status = 'approved';
              // 移除冗余字段节约空间
              delete rec.userTag;
              delete rec.reason;
              delete rec.extra;
            }
            await fs.writeFile(filePath, JSON.stringify(fileObj, null, 2), 'utf-8');
          }
        } catch (e) {
          // 忽略json写入异常
        }
      } else if (action === 'reject') {
        console.log(`[roleManager] 用户 ${userId} 的申请被拒绝`);
        await interaction.reply({ content: `已拒绝 <@${userId}> 的申请。`, flags: 64 });
        // 发送新的 Embed 消息作为ED消息
        await interaction.channel.send({
          embeds: [{
            title: '申请已拒绝',
            description: `用户 <@${userId}> 的申请已被拒绝。`,
            color: 0xED4245 // 红色
          }]
        });
        // 删除原来的 ED 消息
        if (interaction.message && typeof interaction.message.delete === 'function') {
          await interaction.message.delete();
        }
        // 标记json为已完成
        try {
          const fs = require('fs/promises');
          const path = require('path');
          const guildId = interaction.guildId;
          const filePath = path.join(__dirname, '../../data', `apply_${guildId}.json`);
          const file = await fs.readFile(filePath, 'utf-8');
          const fileObj = JSON.parse(file);
          if (fileObj && Array.isArray(fileObj.data)) {
            const rec = fileObj.data.find(d => d.userId === userId);
            if (rec) rec.status = 'rejected';
            // 移除冗余字段节约空间
            delete rec.userTag;
            delete rec.reason;
            delete rec.extra;
            await fs.writeFile(filePath, JSON.stringify(fileObj, null, 2), 'utf-8');
          }
        } catch (e) {
          // 忽略json写入异常
        }
      }
    } catch (err) {
      console.error(`[roleManager] 操作失败: ${err}`);
      await interaction.reply({ content: '操作失败，请检查机器人权限。', flags: 64 });
    }
  }
};
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const roleConfig = require('../../data/role_config.json');
const voteManager = require('../utils/voteManager');
const { getAutoApplyCooldowns, setAutoApplyCooldown, getTimeRemaining } = require('../utils/cooldownManager');



async function handleAutoApply(interaction) {
  const [_, targetRoleId, dbName, dbKv, adminChannelId] = interaction.customId.split(':');
  const userId = interaction.user.id;
  const guild = interaction.guild;

  // 检查用户是否已持有该身份组
  if (interaction.member.roles.cache.has(targetRoleId)) {
    return interaction.reply({
      content: '🎵 您已经拥有该身份组了',
      ephemeral: true,
    });
  }

  // 速率限制检查
  const cooldowns = await getAutoApplyCooldowns();

  if (cooldowns[userId]) {
    const timeRemaining = getTimeRemaining(cooldowns[userId], 24);
    if (timeRemaining) {
      return interaction.reply({
        content: `您今天已经申请过了，请在 ${timeRemaining.hoursLeft} 小时 ${timeRemaining.minutesLeft} 分钟后重试 `,
        ephemeral: true,
      });
    }
  }

  // 无论成功与否，先设置冷却
  await setAutoApplyCooldown(userId);

  // Find the config entry for the target role and get the threshold
  const configKey = Object.keys(roleConfig).find(key => roleConfig[key].data.role_id === targetRoleId);
  if (!configKey) {
      console.error(`[autoApply/handleAutoApply] 无法在 role_config.json 中找到 role_id 为 ${targetRoleId} 的配置`);
      return interaction.reply({ content: '审核配置错误，找不到对应的身份组设置 ', ephemeral: true });
  }
  const config = roleConfig[configKey];
  const configData = config.data;
  const threshold = configData.threshold;

  if (configData.musthold_role_id && configData.musthold_role_id !== "0") {
    if (!interaction.member.roles.cache.has(configData.musthold_role_id)) {
      return interaction.reply({
        content: `您需要持有 <@&${configData.musthold_role_id}> 身份组才能申请此身份组 `,
        ephemeral: true,
      });
    }
  }

  const member = interaction.member;
  const client = interaction.client;

  console.log(`[autoApply/handleAutoApply] 用户 ${interaction.user.tag}(${userId}) 在服务器 ${guild.name}(${guild.id}) 开始自动审核流程`);
  console.log(`[autoApply/handleAutoApply] 参数: targetRoleId=${targetRoleId}, dbName=${dbName}, dbKv=${dbKv}, adminChannelId=${adminChannelId}`);

  const dbPath = path.join(__dirname, '..', '..', 'data', 'task', dbName);
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error(`[autoApply/handleAutoApply] 无法连接到数据库: ${dbPath}`, err);
      interaction.reply({ content: '审核时发生错误，无法连接到数据库 ', ephemeral: true });
      return;
    }
  });

  db.get(`SELECT ${dbKv} FROM user_stats WHERE user_id = ?`, [userId], async (err, row) => {
    if (err) {
      console.error(`[autoApply/handleAutoApply] 查询数据库失败:`, err);
      interaction.reply({ content: '审核时发生错误，无法查询数据 ', ephemeral: true });
      db.close();
      return;
    }

    const adminChannel = await client.channels.fetch(adminChannelId);

    if (row && row[dbKv] >= threshold) {
      // 检查是否需要人工审核
      if (config.manual_revive === true) {
        try {
          await voteManager.createVote(interaction, config);
          const reviewEmbed = new EmbedBuilder()
            .setTitle('申请已提交')
            .setDescription('您的申请已满足基本条件并成功提交至人工审核渠道，请耐心等待审核结果')
            .setColor(0x3498db)
            .setTimestamp();
          return interaction.reply({ embeds: [reviewEmbed], ephemeral: true });
        } catch (error) {
          console.error(`[autoApply/handleAutoApply] 创建投票失败:`, error);
          return interaction.reply({ content: '提交人工审核时发生错误，请联系管理员 ', ephemeral: true });
        }
      } else {
        // 原始的自动通过逻辑
        try {
          await member.roles.add(targetRoleId);
          console.log(`[autoApply/handleAutoApply] 用户 ${userId} 审核通过，已分配身份组 ${targetRoleId}`);
          const successEmbed = new EmbedBuilder()
            .setTitle('审核通过')
            .setDescription(`恭喜！您已通过自动审核，并获得了相应的身份组 `)
            .setColor(0x2ecc71)
            .setTimestamp();
          interaction.reply({ embeds: [successEmbed], ephemeral: true });

          if (adminChannel) {
            const adminEmbed = new EmbedBuilder()
              .setTitle('自动审核日志')
              .setDescription(`用户 ${member} (${userId}) 的申请已自动通过 `)
              .setColor(0x2ecc71)
              .addFields(
                { name: '申请的身份组', value: `<@&${targetRoleId}>`, inline: true },
                { name: '审核状态', value: '通过', inline: true },
                { name: '服务器', value: `${guild.name}`, inline: false }
              )
              .setTimestamp();
            adminChannel.send({ embeds: [adminEmbed] });
          }
        } catch (error) {
          console.error(`[autoApply/handleAutoApply] 分配身份组失败:`, error);
          interaction.reply({ content: '审核通过，但在分配身份组时遇到问题，请联系管理员 ', ephemeral: true });
        }
      }
    } else {
      const currentValue = row ? row[dbKv] : 0;
      console.log(`[autoApply/handleAutoApply] 用户 ${userId} 审核未通过，当前值: ${currentValue}, 阈值: ${threshold}`);
      const failureEmbed = new EmbedBuilder()
        .setTitle('审核未通过')
        .setDescription(`抱歉，您未达到自动审核的要求 \n\n**当前进度**: ${currentValue} / ${threshold}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      interaction.reply({ embeds: [failureEmbed], ephemeral: true });

      if (adminChannel) {
          const adminEmbed = new EmbedBuilder()
            .setTitle('自动审核日志')
            .setDescription(`用户 ${member} (${userId}) 的申请已自动拒绝 `)
            .setColor(0xe74c3c)
            .addFields(
              { name: '申请的身份组', value: `<@&${targetRoleId}>`, inline: true },
              { name: '审核状态', value: '未通过', inline: true },
              { name: '服务器', value: `${guild.name}`, inline: false },
              { name: '原因', value: `当前值 ${currentValue} 未达到阈值 ${threshold}`, inline: false }
            )
            .setTimestamp();
        adminChannel.send({ embeds: [adminEmbed] });
      }
    }

    db.close();
  });
}

module.exports = { handleAutoApply };

const { EmbedBuilder } = require('discord.js');
const { globalAdminChannelId } = require('../config');

/**
 * 发送日志到指定的 Discord 频道
 * @param {object} logData - 日志数据
 * @param {string} logData.module - 模块名称
 * @param {string} logData.action - 操作
 * @param {string} logData.info - 附加信息
 * @param {string} level - 日志级别 ('info', 'warn', 'error')
 */
async function sendLog(logData, level = 'info') {
  if (!global.client) {
    console.error('Discord client is not available.');
    return;
  }

  const channel = await global.client.channels.fetch(globalAdminChannelId);
  if (!channel) {
    console.error(`Could not find channel with ID: ${globalAdminChannelId}`);
    return;
  }

  const { module, action, info } = logData;

  const embed = new EmbedBuilder()
    .setTitle('系统日志')
    .addFields(
      { name: '模块', value: module, inline: true },
      { name: '操作', value: action, inline: true },
      { name: '附加信息', value: info, inline: false }
    )
    .setTimestamp();

  switch (level) {
    case 'info':
      embed.setColor(0x00AE86); // Green
      break;
    case 'warn':
      embed.setColor(0xFFA500); // Orange
      break;
    case 'error':
      embed.setColor(0xFF0000); // Red
      break;
    default:
      embed.setColor(0x00AE86); // Default to info
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send log message:', error);
  }
}

module.exports = { sendLog };

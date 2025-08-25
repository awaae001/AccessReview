const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('text')
    .setDescription('Sends a message to a channel.')
    .setNameLocalizations({
      'zh-CN': '发送消息'
    })
    .setDescriptionLocalizations({
      'zh-CN': '往指定频道发送消息'
    })
    .addStringOption(option =>
      option.setName('content')
        .setDescription('The message content.')
        .setRequired(true)
        .setDescriptionLocalizations({
          'zh-CN': '消息内容'
        })
    )
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL of the message to reply to.')
        .setRequired(false)
        .setDescriptionLocalizations({
          'zh-CN': '要回复的消息链接'
        })
    )
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('The image to send.')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('channel_id')
        .setDescription('The ID of the channel to send the message to.')
        .setRequired(false)
        .setDescriptionLocalizations({
          'zh-CN': '要发送消息的频道ID'
        })
    ),
  async execute(interaction, client) {
    const { hasPermission } = require('../utils/permissionChecker');
    const member = interaction.member;
    const userId = interaction.user.id;

    if (!hasPermission(member, userId)) {
      await interaction.reply({ content: '你没有权限使用该命令', ephemeral: true });
      return;
    }

    const content = interaction.options.getString('content');
    const url = interaction.options.getString('url');
    const image = interaction.options.getAttachment('image');
    let channelId = interaction.options.getString('channel_id');
    if (!channelId) {
      channelId = interaction.channel.id;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      await interaction.reply({ content: '找不到指定的频道', ephemeral: true });
      return;
    }

    let message_options = { content: content };
    let files = [];

    if (image) {
      const imageDir = path.join(__dirname, '..', '..', 'image');
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }
      const imagePath = path.join(imageDir, image.name);
      
      const response = await fetch(image.url);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(imagePath, Buffer.from(buffer));

      files.push(new AttachmentBuilder(imagePath));
    }
    
    message_options.files = files;

    if (url) {
      const match = url.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
      if (match) {
        const [, guildId, channelId, messageId] = match;
        try {
          const repliedMessage = await client.channels.cache.get(channelId).messages.fetch(messageId);
          if (repliedMessage) {
            message_options.reply = { messageReference: repliedMessage };
          }
        } catch (error) {
          console.error('Could not find the message to reply to:', error);
        }
      }
    }

    try {
      await channel.send(message_options);
      await interaction.reply({ content: '消息已发送', ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '发送消息时发生错误', ephemeral: true });
    }
  }
};
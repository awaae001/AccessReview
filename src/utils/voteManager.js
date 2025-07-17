const fs = require('fs/promises');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const votesFilePath = path.join(__dirname, '..', '..', 'data', 'votes.json');

// Helper to ensure the votes file exists
async function ensureVotesFile() {
  try {
    await fs.access(votesFilePath);
  } catch (error) {
    await fs.writeFile(votesFilePath, JSON.stringify({}));
  }
}

// Helper to read vote data
async function getVotes() {
  await ensureVotesFile();
  const data = await fs.readFile(votesFilePath, 'utf8');
  return JSON.parse(data);
}

// Helper to save vote data
async function saveVotes(data) {
  await fs.writeFile(votesFilePath, JSON.stringify(data, null, 2));
}

// Called from autoApply.js to start a new vote
async function createVote(interaction, config) {
  const { revive_config, data: configData, guild_id } = config;
  const { review_channel_id } = revive_config;
  const { role_id: targetRoleId } = configData;
  const requester = interaction.member;
  const client = interaction.client;

  if (!review_channel_id) {
    throw new Error('配置文件中缺少 review_channel_id');
  }

  const reviewChannel = await client.channels.fetch(review_channel_id);
  if (!reviewChannel) {
    throw new Error(`找不到 ID 为 ${review_channel_id} 的审核频道`);
  }

  const voteId = `${Date.now()}-${requester.id}`;

  const voteEmbed = new EmbedBuilder()
    .setTitle('身份组申请人工审核')
    .setDescription(`用户 **${requester.user.tag}** (${requester.id}) 申请获得身份组 <@&${targetRoleId}>，需要投票决定是否批准。`)
    .setColor(0x3498db)
    .addFields(
      { name: '申请人', value: `<@${requester.id}>`, inline: true },
      { name: '申请身份组', value: `<@&${targetRoleId}>`, inline: true },
      { name: '当前状态', value: '投票中...', inline: false },
      { name: '👍 同意', value: '管理员: 0/-\n用户: 0/-', inline: true },
      { name: '👎 拒绝', value: '管理员: 0/-\n用户: 0/-', inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `投票ID: ${voteId}` });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`vote:approve:${voteId}`)
        .setLabel('同意')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👍'),
      new ButtonBuilder()
        .setCustomId(`vote:reject:${voteId}`)
        .setLabel('拒绝')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('👎')
    );

  const voteMessage = await reviewChannel.send({ embeds: [voteEmbed], components: [row] });

  const votes = await getVotes();
  votes[voteId] = {
    messageId: voteMessage.id,
    channelId: reviewChannel.id,
    requesterId: requester.id,
    targetRoleId: targetRoleId,
    config: config, // Save the entire config for later use
    status: 'pending',
    votes: {
      approve: [],
      reject: []
    }
  };

  await saveVotes(votes);
  console.log(`[voteManager/createVote] 已为用户 ${requester.id} 的申请创建投票，ID: ${voteId}`);
}

// Called from voteHandler.js to check the status after a vote
async function checkVoteStatus(client, voteId) {
  const allVotes = await getVotes();
  const voteData = allVotes[voteId];

  if (!voteData || voteData.status !== 'pending') {
    return;
  }

  const { config, votes, channelId, messageId } = voteData;
  const { revive_config, guild_id } = config;

  if (!revive_config) {
    console.error(`[voteManager/checkVoteStatus] FATAL: 投票数据 ${voteId} 缺少 revive_config 配置。`, { voteData });
    return;
  }
  const { allow_vote_role } = revive_config;
  const { ratio_allow, ratio_reject } = allow_vote_role || {};
  if (!ratio_allow || !ratio_reject || !allow_vote_role) {
    console.error(`[voteManager/checkVoteStatus] FATAL: 投票数据 ${voteId} 的 revive_config 或 allow_vote_role 不完整。`, { revive_config });
    return;
  }

  const guild = await client.guilds.fetch(guild_id);
  if (!guild) {
    console.error(`[voteManager/checkVoteStatus] 无法找到服务器: ${guild_id}`);
    return;
  }

  // Calculate current votes
  let adminApprovals = 0, userApprovals = 0, adminRejections = 0, userRejections = 0;

  for (const userId of votes.approve) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      if (member.roles.cache.has(allow_vote_role.admin)) adminApprovals++;
      else if (member.roles.cache.has(allow_vote_role.user)) userApprovals++;
    }
  }

  for (const userId of votes.reject) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      if (member.roles.cache.has(allow_vote_role.admin)) adminRejections++;
      else if (member.roles.cache.has(allow_vote_role.user)) userRejections++;
    }
  }

  // Check if conditions are met
  const isApproved = (ratio_allow.admin > 0 && adminApprovals >= ratio_allow.admin) ||
                     (ratio_allow.user > 0 && userApprovals >= ratio_allow.user);
  const isRejected = (ratio_reject.admin > 0 && adminRejections >= ratio_reject.admin) ||
                     (ratio_reject.user > 0 && userRejections >= ratio_reject.user);

  if (isApproved) {
    return finalizeVote(client, voteId, 'approved');
  }
  if (isRejected) {
    return finalizeVote(client, voteId, 'rejected');
  }

  // If the vote is not over, update the message
  const channel = await guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);
  const originalEmbed = message.embeds[0];

  const updatedEmbed = new EmbedBuilder(originalEmbed.toJSON())
    .setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '当前状态', value: '投票中...', inline: false },
      { name: '👍 同意', value: `管理员: ${adminApprovals}/${ratio_allow.admin}\n用户: ${userApprovals}/${ratio_allow.user}`, inline: true },
      { name: '👎 拒绝', value: `管理员: ${adminRejections}/${ratio_reject.admin}\n用户: ${userRejections}/${ratio_reject.user}`, inline: true }
    );

  await message.edit({ embeds: [updatedEmbed] });
}

// Called by checkVoteStatus to finalize the vote
async function finalizeVote(client, voteId, result) {
  const allVotes = await getVotes();
  const voteData = allVotes[voteId];

  if (!voteData || voteData.status !== 'pending') {
    return;
  }

  voteData.status = result;
  await saveVotes(allVotes);

  const { requesterId, targetRoleId, channelId, messageId, config } = voteData;
  const guild = await client.guilds.fetch(config.guild_id);
  if (!guild) {
    console.error(`[voteManager/finalizeVote] 无法找到服务器: ${config.guild_id}`);
    return;
  }
  const requester = await guild.members.fetch(requesterId).catch(() => null);

  const channel = await guild.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);
  const originalEmbed = message.embeds[0];

  const finalEmbed = new EmbedBuilder(originalEmbed.toJSON());
  const finalComponents = []; // Empty components to disable buttons

  if (result === 'approved') {
    finalEmbed.setColor(0x2ecc71).setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '状态', value: '✅ 已通过', inline: false }
    );
    if (requester) {
      await requester.roles.add(targetRoleId);
      try {
        await requester.send(`🎉 恭喜！您在 **${guild.name}** 的身份组申请 **(<@&${targetRoleId}>)** 已通过人工审核。`);
      } catch (e) {
        console.log(`[voteManager/finalizeVote] 无法私信用户 ${requesterId}`);
      }
    }
  } else { // rejected
    finalEmbed.setColor(0xe74c3c).setFields(
      originalEmbed.fields[0],
      originalEmbed.fields[1],
      { name: '状态', value: '❌ 已拒绝', inline: false }
    );
    if (requester) {
      try {
        await requester.send(`很抱歉，您在 **${guild.name}** 的身份组申请 **(<@&${targetRoleId}>)** 未通过人工审核。`);
      } catch (e) {
        console.log(`[voteManager/finalizeVote] 无法私信用户 ${requesterId}`);
      }
    }
  }

  await message.edit({ embeds: [finalEmbed], components: finalComponents });
  console.log(`[voteManager/finalizeVote] 投票 ${voteId} 已结束，结果: ${result}`);
}

module.exports = {
  createVote,
  getVotes,
  saveVotes,
  checkVoteStatus,
  finalizeVote
};
const voteManager = require('../utils/voteManager');

async function handleVote(interaction) {
  // Defer the reply immediately to avoid "Unknown Interaction"
  await interaction.deferReply({ ephemeral: true });

  const [_, action, voteId] = interaction.customId.split(':');
  const voter = interaction.member;
  const voterId = voter.id;

  const allVotes = await voteManager.getVotes();
  const voteData = allVotes[voteId];

  if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
    return interaction.editReply({ content: '这个投票已结束或不存在。' });
  }

  const { config } = voteData;
  const { allow_vote_role } = config.revive_config;

  // Permission check
  const hasPermission = Object.values(allow_vote_role).some(roleId => voter.roles.cache.has(String(roleId)));
  if (!hasPermission) {
    return interaction.editReply({ content: '你没有权限参与本次投票。' });
  }

  // Applicant cannot vote for themselves
  if (voterId === voteData.requesterId) {
    return interaction.editReply({ content: '申请人不能为自己投票。' });
  }

  const { votes } = voteData;
  const oppositeAction = action === 'approve' ? 'reject' : 'approve';

  // If the user has already voted for the same action, retract the vote
  if (votes[action].includes(voterId)) {
    votes[action] = votes[action].filter(id => id !== voterId);
    await voteManager.saveVotes(allVotes);
    await interaction.editReply({ content: '您已撤销投票。' });
    return voteManager.checkVoteStatus(interaction.client, voteId);
  }

  votes[oppositeAction] = votes[oppositeAction].filter(id => id !== voterId);
  votes[action].push(voterId);

  await voteManager.saveVotes(allVotes);
  await interaction.editReply({ content: `您已成功投出 **${action === 'approve' ? '同意' : '拒绝'}** 票。` });
  await voteManager.checkVoteStatus(interaction.client, voteId);
}

module.exports = { handleVote };
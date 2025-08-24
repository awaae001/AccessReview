const { getVotes, finalizeVote } = require('../utils/voteManager');
const { sendLog } = require('../utils/logger');

async function checkPendingVotes(client) {
    console.log('[voteMonitor] Running task to check pending votes...');
    const allVotes = await getVotes();
    const now = new Date();

    for (const voteId in allVotes) {
        const voteData = allVotes[voteId];
        if (voteData.status === 'pending_admin' && voteData.pendingUntil) {
            const pendingUntil = new Date(voteData.pendingUntil);
            if (now >= pendingUntil) {
                console.log(`[voteMonitor] Vote ${voteId} pending period has expired. Finalizing as approved.`);
                try {
                    await finalizeVote(client, voteId, 'approved');
                    await sendLog({
                        module: '投票监控',
                        action: '自动批准',
                        info: `投票 ${voteId} 因等待期结束被自动批准。`
                    }, 'info');
                } catch (error) {
                    console.error(`[voteMonitor] Error finalizing vote ${voteId}:`, error);
                    await sendLog({
                        module: '投票监控',
                        action: '自动批准失败',
                        info: `投票 ${voteId} 自动批准失败: ${error.message}`
                    }, 'error');
                }
            }
        }
    }
}

module.exports = {
    name: 'voteMonitor',
    schedule: '5 * * * *',
    execute: checkPendingVotes,
};
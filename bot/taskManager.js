const cron = require('node-cron');
const newMemberScanner = require('../src/tasks/newMemberScanner');
const voteMonitor = require('../src/tasks/voteMonitor');

function startTasks(client) {
  newMemberScanner.initialize();

  if (cron.validate(voteMonitor.schedule)) {
    cron.schedule(voteMonitor.schedule, () => voteMonitor.execute(client));
    console.log(`Task '${voteMonitor.name}' scheduled.`);
  } else {
    console.error(`Invalid cron schedule for task '${voteMonitor.name}': ${voteMonitor.schedule}`);
  }
}

module.exports = { startTasks };
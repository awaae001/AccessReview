const cron = require('node-cron');
const newMemberScanner = require('../src/tasks/newMemberScanner');
const voteMonitor = require('../src/tasks/voteMonitor');
const imageCleaner = require('../src/tasks/imageCleaner');

function startTasks(client) {
  newMemberScanner.initialize();

  if (cron.validate(voteMonitor.schedule)) {
    cron.schedule(voteMonitor.schedule, () => voteMonitor.execute(client));
    console.log(`[TaskManager]Task '${voteMonitor.name}' scheduled.`);
  } else {
    console.error(`Invalid cron schedule for task '${voteMonitor.name}': ${voteMonitor.schedule}`);
  }

  if (cron.validate(imageCleaner.schedule)) {
    cron.schedule(imageCleaner.schedule, () => imageCleaner.execute(client));
    console.log(`[TaskManager]Task '${imageCleaner.name}' scheduled.`);
  } else {
    console.error(`[TaskManager]Invalid cron schedule for task '${imageCleaner.name}': ${imageCleaner.schedule}`);
  }
}

module.exports = { startTasks };
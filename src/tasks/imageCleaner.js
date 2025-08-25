const fs = require('fs');
const path = require('path');

const imageDir = path.join(__dirname, '..', '..', 'image');
const MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

module.exports = {
  name: 'imageCleaner',
  schedule: '0 0 * * *', // Run once a day at midnight
  async execute() {
    console.log('[imageCleaner]Running image cleaner task...');
    if (!fs.existsSync(imageDir)) {
      console.log('[imageCleaner]Image directory does not exist. Skipping cleanup.');
      return;
    }

    const files = fs.readdirSync(imageDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(imageDir, file);
      const stat = fs.statSync(filePath);
      const fileAge = now - stat.mtimeMs;

      if (fileAge > MAX_AGE) {
        fs.unlinkSync(filePath);
        console.log(`[imageCleaner]Deleted old image: ${file}`);
      }
    }
    console.log('[imageCleaner]Image cleaner task finished.');
  }
};
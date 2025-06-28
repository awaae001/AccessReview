require('dotenv').config();

module.exports = {
  adminChannelId: process.env.ADMIN_CHANNEL_ID,
  targetRoleId: process.env.TARGET_ROLE_ID,
  globalAdminChannelId: process.env.GLOBAL_ADMIN_CHANNEL_ID,
};

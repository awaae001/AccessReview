require('dotenv').config();

module.exports = {
  adminChannelId: process.env.ADMIN_CHANNEL_ID,
  targetRoleId: process.env.TARGET_ROLE_ID,
  globalAdminChannelId: process.env.GLOBAL_ADMIN_CHANNEL_ID,
  
  // gRPC 配置
  grpc: {
    serverAddress: process.env.GRPC_SERVER_ADDRESS,
    token: process.env.GRPC_TOKEN,
    clientName: process.env.GRPC_CLIENT_NAME
  }
};

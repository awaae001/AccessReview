const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./commandLoader');
const { registerEventListeners } = require('./eventHandler');
const { grpcManager } = require('../src/grpc/index');

class Bot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
      ],
      partials: [Partials.Channel],
    });

    global.client = this.client;
    global.grpcManager = grpcManager;
  }

  async start() {
    try {
      // 启动 Discord bot
      loadCommands(this.client);
      registerEventListeners(this.client);

      console.log('[Bot] 正在启动 Discord bot...');
      await this.client.login(process.env.BOT_TOKEN);
      console.log('[Bot] Discord bot 启动成功');

      // 启动 gRPC 客户端
      console.log('[Bot] 正在启动 gRPC 客户端...');
      await this.initializeGrpc();
      console.log('[Bot] gRPC 客户端启动成功');

    } catch (error) {
      console.error('[Bot] 启动失败:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  async initializeGrpc() {
    try {
      // 初始化 gRPC 管理器
      await grpcManager.initialize();
      
      // 启动 gRPC 服务（可以根据需要添加服务列表）
      const services = []; // 这里可以添加具体的服务名称
      await grpcManager.start(services);
      
      console.log('[Bot] gRPC 服务已启动并连接到:', process.env.GRPC_SERVER_ADDRESS);
    } catch (error) {
      console.error('[Bot] gRPC 初始化失败:', error);
      throw error;
    }
  }

  async shutdown() {
    console.log('[Bot] 正在关闭服务...');
    
    try {
      // 关闭 gRPC 连接
      if (grpcManager) {
        await grpcManager.stop();
        console.log('[Bot] gRPC 服务已关闭');
      }
    } catch (error) {
      console.error('[Bot] 关闭 gRPC 服务时出错:', error);
    }

    try {
      // 关闭 Discord 连接
      if (this.client) {
        this.client.destroy();
        console.log('[Bot] Discord 连接已关闭');
      }
    } catch (error) {
      console.error('[Bot] 关闭 Discord 连接时出错:', error);
    }
  }
}

module.exports = Bot;
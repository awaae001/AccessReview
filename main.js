// main.js
require('dotenv').config();
const Bot = require('./bot/bot');

const bot = new Bot();

// 处理优雅关闭
async function gracefulShutdown(signal) {
  console.log(`[Main] 收到 ${signal} 信号，正在优雅关闭...`);
  
  try {
    await bot.shutdown();
    console.log('[Main] 服务已优雅关闭');
    process.exit(0);
  } catch (error) {
    console.error('[Main] 关闭时出错:', error);
    process.exit(1);
  }
}

// 监听关闭信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[Main] 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] 未处理的Promise拒绝:', reason);
  gracefulShutdown('unhandledRejection');
});

// 启动应用
async function startApp() {
  try {
    console.log('[Main] 正在启动应用...');
    await bot.start();
    console.log('[Main] 应用启动完成');
  } catch (error) {
    console.error('[Main] 应用启动失败:', error.message);
  }
}

startApp();

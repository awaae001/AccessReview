const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./commandLoader');
const { registerEventListeners } = require('./eventHandler');

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
  }

  start() {
    loadCommands(this.client);
    registerEventListeners(this.client);

    this.client.login(process.env.BOT_TOKEN).catch(error => {
      console.error('[Main_setup]Bot 登录失败:', error);
      process.exit(1);
    });
  }
}

module.exports = Bot;
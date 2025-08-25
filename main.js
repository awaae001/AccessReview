// main.js
require('dotenv').config();
const Bot = require('./bot/bot');

const bot = new Bot();
bot.start();

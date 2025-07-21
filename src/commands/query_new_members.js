const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('query_new_members')
        .setDescription('查询服务器新人加入情况')
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('要查询的服务器ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('要查询的日期 (YYYY-MM-DD)')
                .setRequired(false)),
};
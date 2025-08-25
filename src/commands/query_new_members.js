const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('query_new_members')
        .setDescription('Query new member join status')
        .setNameLocalizations({
            'zh-CN': '查询新成员'
        })
        .setDescriptionLocalizations({
            'zh-CN': '查询服务器新人加入情况'
        })
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('Server ID to query')
                .setDescriptionLocalizations({
                    'zh-CN': '要查询的服务器ID'
                })
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date to query (YYYY-MM-DD)')
                .setDescriptionLocalizations({
                    'zh-CN': '要查询的日期 (YYYY-MM-DD)'
                })
                .setRequired(false)),
   async execute(interaction) {
       // The core logic is handled in eventHandler.js by handleQueryNewMembers
   },
};
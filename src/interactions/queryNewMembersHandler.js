const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { hasPermission } = require('../utils/permissionChecker');

async function handleQueryNewMembers(interaction) {
    const member = interaction.member;
    const requestUserId = interaction.user.id;
    const isAdmin = hasPermission(member, requestUserId);

    if (!isAdmin) {
        await interaction.reply({ content: '您没有权限使用此命令 ', ephemeral: true });
        return;
    }

    const serverId = interaction.options.getString('server_id');
    const date = interaction.options.getString('date');

    await interaction.deferReply({ ephemeral: true });

    try {
        const configPath = path.join(__dirname, '..', '..', 'data', 'new', 'new_scam.json');
        const configData = await fs.readFile(configPath, 'utf8');
        const serverConfigs = JSON.parse(configData);

        const serverConfig = serverConfigs[serverId];
        if (!serverConfig) {
            await interaction.editReply({ content: `未找到服务器ID: ${serverId} 的配置 ` });
            return;
        }

        const dataPath = path.join(__dirname, '..', '..', serverConfig.filepath);
        const rawData = await fs.readFile(dataPath, 'utf8');
        const data = JSON.parse(rawData);

        const embed = new EmbedBuilder()
            .setTitle(`服务器 ${serverConfig.name} (${serverId}) 的新人数据`)
            .setColor(0x0099ff);

        if (date) {
            const dateData = data[date];
            if (dateData) {
                embed.setDescription(`日期: ${date}`)
                    .addFields(
                        { name: '加入', value: dateData.join.toString(), inline: true },
                        { name: '离开', value: dateData.leave.toString(), inline: true },
                        { name: '当前人数', value: dateData.count.toString(), inline: true },
                        { name: '获得身份组', value: dateData.role_join.toString(), inline: true }
                    );
            } else {
                embed.setDescription(`在 ${date} 未找到数据 `);
            }
        } else {
            let totalJoin = 0;
            let totalLeave = 0;
            let totalRoleJoin = 0;
            const latestDate = Object.keys(data).sort().pop();
            const latestCount = latestDate ? data[latestDate].count : 0;

            for (const dateKey in data) {
                totalJoin += data[dateKey].join;
                totalLeave += data[dateKey].leave;
                totalRoleJoin += data[dateKey].role_join;
            }

            embed.setDescription('所有日期的汇总数据')
                .addFields(
                    { name: '总加入', value: totalJoin.toString(), inline: true },
                    { name: '总离开', value: totalLeave.toString(), inline: true },
                    { name: '当前人数', value: latestCount.toString(), inline: true },
                    { name: '总获得身份组', value: totalRoleJoin.toString(), inline: true }
                );
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[queryNewMembersHandler] Error:', error);
        await interaction.editReply({ content: '处理您的请求时发生错误 ' });
    }
}

module.exports = { handleQueryNewMembers };
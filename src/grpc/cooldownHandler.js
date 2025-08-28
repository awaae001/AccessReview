const cooldownManager = require('../utils/cooldownManager');

class CooldownHandler {
    constructor() {
        console.log('[CooldownHandler]冷却服务处理器已初始化');
    }

    async handleRequest(methodPath, payload) {
        try {
            console.log(`[CooldownHandler]处理请求: ${methodPath}`);
            
            let request;
            try {
                request = JSON.parse(payload.toString());
            } catch (parseError) {
                throw new Error('Invalid JSON payload');
            }

            // 处理 accessreview.cooldown 服务的方法路径
            switch (methodPath) {
                case '/accessreview.cooldown/GetAutoApplyCooldown':
                    return await this.getAutoApplyCooldown(request);
                    
                case '/accessreview.cooldown/GetBlacklistStatus':
                    return await this.getBlacklistStatus(request);
                    
                case '/accessreview.cooldown/AddToBlacklist':
                    return await this.addToBlacklist(request);
                    
                case '/accessreview.cooldown/GetAllBlacklistedUsers':
                    return await this.getAllBlacklistedUsers(request);
                    
                case '/accessreview.cooldown/BatchGetCooldownStatus':
                    return await this.batchGetCooldownStatus(request);
                    
                default:
                    throw new Error(`未知的方法路径: ${methodPath}`);
            }
        } catch (error) {
            console.error('[CooldownHandler]处理请求失败:', error);
            throw error;
        }
    }

    async getAutoApplyCooldown(request) {
        const { user_id } = request;
        console.log(`[CooldownHandler]查询用户 ${user_id} 的自动申请冷却状态`);

        const cooldowns = await cooldownManager.getAutoApplyCooldowns();
        const userCooldownTimestamp = cooldowns[user_id];

        if (userCooldownTimestamp) {
            const now = Date.now();
            const cooldownAmount = 24 * 60 * 60 * 1000; // 24小时
            const cooldownEndTime = userCooldownTimestamp + cooldownAmount;
            const timeRemaining = cooldownManager.getTimeRemaining(userCooldownTimestamp, 24);

            if (timeRemaining) {
                return {
                    is_on_cooldown: true,
                    cooldown_start_time: userCooldownTimestamp,
                    cooldown_end_time: cooldownEndTime,
                    time_remaining: {
                        hours_left: timeRemaining.hoursLeft,
                        minutes_left: timeRemaining.minutesLeft,
                        total_seconds_left: Math.floor((cooldownEndTime - now) / 1000)
                    }
                };
            }
        }

        return {
            is_on_cooldown: false,
            cooldown_start_time: 0,
            cooldown_end_time: 0,
            time_remaining: {
                hours_left: 0,
                minutes_left: 0,
                total_seconds_left: 0
            }
        };
    }

    async getBlacklistStatus(request) {
        const { user_id } = request;
        console.log(`[CooldownHandler]查询用户 ${user_id} 的拉黑状态`);

        const blacklistData = await cooldownManager.isUserBlacklisted(user_id);

        if (blacklistData) {
            const now = Date.now();
            const blacklistCooldown = 48 * 60 * 60 * 1000; // 48小时
            const blacklistEndTime = blacklistData.timestamp + blacklistCooldown;
            const timeRemaining = cooldownManager.getTimeRemaining(blacklistData.timestamp, 48);

            return {
                is_blacklisted: true,
                reason: blacklistData.reason || '未提供原因',
                blacklist_start_time: blacklistData.timestamp,
                blacklist_end_time: blacklistEndTime,
                time_remaining: {
                    hours_left: timeRemaining ? timeRemaining.hoursLeft : 0,
                    minutes_left: timeRemaining ? timeRemaining.minutesLeft : 0,
                    total_seconds_left: timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0
                }
            };
        }

        return {
            is_blacklisted: false,
            reason: '',
            blacklist_start_time: 0,
            blacklist_end_time: 0,
            time_remaining: {
                hours_left: 0,
                minutes_left: 0,
                total_seconds_left: 0
            }
        };
    }

    async addToBlacklist(request) {
        const { user_id, reason, timestamp } = request;
        console.log(`[CooldownHandler]添加用户 ${user_id} 到拉黑列表，原因: ${reason}`);

        try {
            await cooldownManager.addToBlacklist(user_id, reason || '未提供原因');
            return {
                success: true,
                message: `用户 ${user_id} 已成功添加到拉黑列表`
            };
        } catch (error) {
            return {
                success: false,
                message: `添加用户到拉黑列表失败: ${error.message}`
            };
        }
    }

    async getAllBlacklistedUsers(request) {
        console.log('[CooldownHandler]获取所有拉黑用户');

        const blacklistedUsers = await cooldownManager.getBlacklistedUsers();
        const result = [];

        for (const [userId, data] of Object.entries(blacklistedUsers)) {
            const now = Date.now();
            const blacklistCooldown = 48 * 60 * 60 * 1000; // 48小时
            const blacklistEndTime = data.timestamp + blacklistCooldown;
            const timeRemaining = cooldownManager.getTimeRemaining(data.timestamp, 48);

            result.push({
                user_id: userId,
                reason: data.reason || '未提供原因',
                blacklist_start_time: data.timestamp,
                blacklist_end_time: blacklistEndTime,
                time_remaining: {
                    hours_left: timeRemaining ? timeRemaining.hoursLeft : 0,
                    minutes_left: timeRemaining ? timeRemaining.minutesLeft : 0,
                    total_seconds_left: timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0
                }
            });
        }

        return {
            blacklisted_users: result,
            total_count: result.length
        };
    }

    async batchGetCooldownStatus(request) {
        const { user_ids } = request;
        console.log(`[CooldownHandler]批量查询 ${user_ids.length} 个用户的冷却状态`);

        const result = [];

        for (const userId of user_ids) {
            const autoApplyCooldowns = await cooldownManager.getAutoApplyCooldowns();
            const blacklistData = await cooldownManager.isUserBlacklisted(userId);
            
            const userCooldownTimestamp = autoApplyCooldowns[userId];
            const now = Date.now();

            let autoApplyCooldown = {
                is_active: false,
                start_time: 0,
                end_time: 0,
                time_remaining: {
                    hours_left: 0,
                    minutes_left: 0,
                    total_seconds_left: 0
                }
            };

            if (userCooldownTimestamp) {
                const cooldownAmount = 24 * 60 * 60 * 1000; // 24小时
                const cooldownEndTime = userCooldownTimestamp + cooldownAmount;
                const timeRemaining = cooldownManager.getTimeRemaining(userCooldownTimestamp, 24);

                if (timeRemaining) {
                    autoApplyCooldown = {
                        is_active: true,
                        start_time: userCooldownTimestamp,
                        end_time: cooldownEndTime,
                        time_remaining: {
                            hours_left: timeRemaining.hoursLeft,
                            minutes_left: timeRemaining.minutesLeft,
                            total_seconds_left: Math.floor((cooldownEndTime - now) / 1000)
                        }
                    };
                }
            }

            let blacklistInfo = {
                is_active: false,
                reason: '',
                start_time: 0,
                end_time: 0,
                time_remaining: {
                    hours_left: 0,
                    minutes_left: 0,
                    total_seconds_left: 0
                }
            };

            if (blacklistData) {
                const blacklistCooldown = 48 * 60 * 60 * 1000; // 48小时
                const blacklistEndTime = blacklistData.timestamp + blacklistCooldown;
                const timeRemaining = cooldownManager.getTimeRemaining(blacklistData.timestamp, 48);

                blacklistInfo = {
                    is_active: true,
                    reason: blacklistData.reason || '未提供原因',
                    start_time: blacklistData.timestamp,
                    end_time: blacklistEndTime,
                    time_remaining: {
                        hours_left: timeRemaining ? timeRemaining.hoursLeft : 0,
                        minutes_left: timeRemaining ? timeRemaining.minutesLeft : 0,
                        total_seconds_left: timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0
                    }
                };
            }

            result.push({
                user_id: userId,
                auto_apply_cooldown: autoApplyCooldown,
                blacklist_info: blacklistInfo
            });
        }

        return {
            user_statuses: result
        };
    }
}

module.exports = CooldownHandler;
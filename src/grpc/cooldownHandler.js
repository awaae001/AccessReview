const cooldownManager = require('../utils/cooldownManager');
const cooldownMessages = require('../../grpc/generated/proto/cooldown_service_pb');

class CooldownHandler {
    constructor() {
        console.log('[CooldownHandler]冷却服务处理器已初始化');
    }

    async handleRequest(methodPath, payload) {
        try {
            console.log(`[CooldownHandler]处理请求: ${methodPath}`);
            
            let request;
            
            // 根据方法路径解析对应的protobuf消息
            switch (methodPath) {
                case '/accessreview.cooldown/GetAutoApplyCooldown':
                    request = cooldownMessages.GetCooldownRequest.deserializeBinary(payload);
                    return await this.getAutoApplyCooldown(request);
                    
                case '/accessreview.cooldown/GetBlacklistStatus':
                    request = cooldownMessages.GetBlacklistRequest.deserializeBinary(payload);
                    return await this.getBlacklistStatus(request);
                    
                case '/accessreview.cooldown/AddToBlacklist':
                    request = cooldownMessages.AddBlacklistRequest.deserializeBinary(payload);
                    return await this.addToBlacklist(request);
                    
                case '/accessreview.cooldown/GetAllBlacklistedUsers':
                    request = cooldownMessages.GetAllBlacklistRequest.deserializeBinary(payload);
                    return await this.getAllBlacklistedUsers(request);
                    
                case '/accessreview.cooldown/BatchGetCooldownStatus':
                    request = cooldownMessages.BatchGetCooldownRequest.deserializeBinary(payload);
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
        const user_id = request.getUserId();
        console.log(`[CooldownHandler]查询用户 ${user_id} 的自动申请冷却状态`);

        const cooldowns = await cooldownManager.getAutoApplyCooldowns();
        const userCooldownTimestamp = cooldowns[user_id];

        if (userCooldownTimestamp) {
            const now = Date.now();
            const cooldownAmount = 24 * 60 * 60 * 1000; // 24小时
            const cooldownEndTime = userCooldownTimestamp + cooldownAmount;
            const timeRemaining = cooldownManager.getTimeRemaining(userCooldownTimestamp, 24);

            if (timeRemaining) {
                const response = new cooldownMessages.CooldownResponse();
                response.setIsOnCooldown(true);
                response.setCooldownStartTime(userCooldownTimestamp);
                response.setCooldownEndTime(cooldownEndTime);
                
                const timeRemainingProto = new cooldownMessages.TimeRemaining();
                timeRemainingProto.setHoursLeft(timeRemaining.hoursLeft);
                timeRemainingProto.setMinutesLeft(timeRemaining.minutesLeft);
                timeRemainingProto.setTotalSecondsLeft(Math.floor((cooldownEndTime - now) / 1000));
                response.setTimeRemaining(timeRemainingProto);
                
                return response.serializeBinary();
            }
        }

        const response = new cooldownMessages.CooldownResponse();
        response.setIsOnCooldown(false);
        response.setCooldownStartTime(0);
        response.setCooldownEndTime(0);
        
        const timeRemainingProto = new cooldownMessages.TimeRemaining();
        timeRemainingProto.setHoursLeft(0);
        timeRemainingProto.setMinutesLeft(0);
        timeRemainingProto.setTotalSecondsLeft(0);
        response.setTimeRemaining(timeRemainingProto);
        
        return response.serializeBinary();
    }

    async getBlacklistStatus(request) {
        const user_id = request.getUserId();
        console.log(`[CooldownHandler]查询用户 ${user_id} 的拉黑状态`);

        const blacklistData = await cooldownManager.isUserBlacklisted(user_id);

        if (blacklistData) {
            const now = Date.now();
            const blacklistCooldown = 48 * 60 * 60 * 1000; // 48小时
            const blacklistEndTime = blacklistData.timestamp + blacklistCooldown;
            const timeRemaining = cooldownManager.getTimeRemaining(blacklistData.timestamp, 48);

            const response = new cooldownMessages.BlacklistResponse();
            response.setIsBlacklisted(true);
            response.setReason(blacklistData.reason || '未提供原因');
            response.setBlacklistStartTime(blacklistData.timestamp);
            response.setBlacklistEndTime(blacklistEndTime);
            
            const timeRemainingProto = new cooldownMessages.TimeRemaining();
            timeRemainingProto.setHoursLeft(timeRemaining ? timeRemaining.hoursLeft : 0);
            timeRemainingProto.setMinutesLeft(timeRemaining ? timeRemaining.minutesLeft : 0);
            timeRemainingProto.setTotalSecondsLeft(timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0);
            response.setTimeRemaining(timeRemainingProto);
            
            return response.serializeBinary();
        }

        const response = new cooldownMessages.BlacklistResponse();
        response.setIsBlacklisted(false);
        response.setReason('');
        response.setBlacklistStartTime(0);
        response.setBlacklistEndTime(0);
        
        const timeRemainingProto = new cooldownMessages.TimeRemaining();
        timeRemainingProto.setHoursLeft(0);
        timeRemainingProto.setMinutesLeft(0);
        timeRemainingProto.setTotalSecondsLeft(0);
        response.setTimeRemaining(timeRemainingProto);
        
        return response.serializeBinary();
    }

    async addToBlacklist(request) {
        const user_id = request.getUserId();
        const reason = request.getReason();
        const timestamp = request.getTimestamp();
        console.log(`[CooldownHandler]添加用户 ${user_id} 到拉黑列表，原因: ${reason}`);

        try {
            await cooldownManager.addToBlacklist(user_id, reason || '未提供原因');
            const response = new cooldownMessages.AddBlacklistResponse();
            response.setSuccess(true);
            response.setMessage(`用户 ${user_id} 已成功添加到拉黑列表`);
            return response.serializeBinary();
        } catch (error) {
            const response = new cooldownMessages.AddBlacklistResponse();
            response.setSuccess(false);
            response.setMessage(`添加用户到拉黑列表失败: ${error.message}`);
            return response.serializeBinary();
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

            const blacklistedUser = new cooldownMessages.BlacklistedUser();
            blacklistedUser.setUserId(userId);
            blacklistedUser.setReason(data.reason || '未提供原因');
            blacklistedUser.setBlacklistStartTime(data.timestamp);
            blacklistedUser.setBlacklistEndTime(blacklistEndTime);
            
            const timeRemainingProto = new cooldownMessages.TimeRemaining();
            timeRemainingProto.setHoursLeft(timeRemaining ? timeRemaining.hoursLeft : 0);
            timeRemainingProto.setMinutesLeft(timeRemaining ? timeRemaining.minutesLeft : 0);
            timeRemainingProto.setTotalSecondsLeft(timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0);
            blacklistedUser.setTimeRemaining(timeRemainingProto);

            result.push(blacklistedUser);
        }

        const response = new cooldownMessages.GetAllBlacklistResponse();
        response.setBlacklistedUsersList(result);
        response.setTotalCount(result.length);
        return response.serializeBinary();
    }

    async batchGetCooldownStatus(request) {
        const user_ids = request.getUserIdsList();
        console.log(`[CooldownHandler]批量查询 ${user_ids.length} 个用户的冷却状态`);

        const result = [];

        for (const userId of user_ids) {
            const autoApplyCooldowns = await cooldownManager.getAutoApplyCooldowns();
            const blacklistData = await cooldownManager.isUserBlacklisted(userId);
            
            const userCooldownTimestamp = autoApplyCooldowns[userId];
            const now = Date.now();

            // 创建自动申请冷却信息
            const autoApplyCooldown = new cooldownMessages.CooldownInfo();
            autoApplyCooldown.setIsActive(false);
            autoApplyCooldown.setStartTime(0);
            autoApplyCooldown.setEndTime(0);
            
            const autoTimeRemaining = new cooldownMessages.TimeRemaining();
            autoTimeRemaining.setHoursLeft(0);
            autoTimeRemaining.setMinutesLeft(0);
            autoTimeRemaining.setTotalSecondsLeft(0);
            autoApplyCooldown.setTimeRemaining(autoTimeRemaining);

            if (userCooldownTimestamp) {
                const cooldownAmount = 24 * 60 * 60 * 1000; // 24小时
                const cooldownEndTime = userCooldownTimestamp + cooldownAmount;
                const timeRemaining = cooldownManager.getTimeRemaining(userCooldownTimestamp, 24);

                if (timeRemaining) {
                    autoApplyCooldown.setIsActive(true);
                    autoApplyCooldown.setStartTime(userCooldownTimestamp);
                    autoApplyCooldown.setEndTime(cooldownEndTime);
                    
                    autoTimeRemaining.setHoursLeft(timeRemaining.hoursLeft);
                    autoTimeRemaining.setMinutesLeft(timeRemaining.minutesLeft);
                    autoTimeRemaining.setTotalSecondsLeft(Math.floor((cooldownEndTime - now) / 1000));
                }
            }

            // 创建拉黑信息
            const blacklistInfo = new cooldownMessages.BlacklistInfo();
            blacklistInfo.setIsActive(false);
            blacklistInfo.setReason('');
            blacklistInfo.setStartTime(0);
            blacklistInfo.setEndTime(0);
            
            const blacklistTimeRemaining = new cooldownMessages.TimeRemaining();
            blacklistTimeRemaining.setHoursLeft(0);
            blacklistTimeRemaining.setMinutesLeft(0);
            blacklistTimeRemaining.setTotalSecondsLeft(0);
            blacklistInfo.setTimeRemaining(blacklistTimeRemaining);

            if (blacklistData) {
                const blacklistCooldown = 48 * 60 * 60 * 1000; // 48小时
                const blacklistEndTime = blacklistData.timestamp + blacklistCooldown;
                const timeRemaining = cooldownManager.getTimeRemaining(blacklistData.timestamp, 48);

                blacklistInfo.setIsActive(true);
                blacklistInfo.setReason(blacklistData.reason || '未提供原因');
                blacklistInfo.setStartTime(blacklistData.timestamp);
                blacklistInfo.setEndTime(blacklistEndTime);
                
                blacklistTimeRemaining.setHoursLeft(timeRemaining ? timeRemaining.hoursLeft : 0);
                blacklistTimeRemaining.setMinutesLeft(timeRemaining ? timeRemaining.minutesLeft : 0);
                blacklistTimeRemaining.setTotalSecondsLeft(timeRemaining ? Math.floor((blacklistEndTime - now) / 1000) : 0);
            }

            // 创建用户冷却状态
            const userStatus = new cooldownMessages.UserCooldownStatus();
            userStatus.setUserId(userId);
            userStatus.setAutoApplyCooldown(autoApplyCooldown);
            userStatus.setBlacklistInfo(blacklistInfo);

            result.push(userStatus);
        }

        const response = new cooldownMessages.BatchGetCooldownResponse();
        response.setUserStatusesList(result);
        return response.serializeBinary();
    }
}

module.exports = CooldownHandler;
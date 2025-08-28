const RegistryClient = require('./registryClient');
const GrpcConfig = require('./config');

/**
 * gRPC 模块主入口
 */
class GrpcManager {
    constructor() {
        this.registryClient = null;
        this.heartbeatInterval = null;
    }

    /**
     * 初始化 gRPC 管理器
     */
    async initialize() {
        try {
            // 创建注册服务客户端
            this.registryClient = new RegistryClient();
            
            console.log('[Grpc_Client]gRPC 管理器初始化完成');
            return true;
        } catch (error) {
            console.error('[Grpc_Client]gRPC 管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 启动服务注册和连接
     * @param {Array<string>} services - 要注册的服务列表
     */
    async start(services = []) {
        try {
            if (!this.registryClient) {
                throw new Error('[Grpc_Client]gRPC 管理器未初始化');
            }
            
            // 默认包含冷却服务，使用配置的客户端名称
            const clientName = this.registryClient.getConfig().clientName;
            const defaultServices = [clientName];
            const allServices = [...new Set([...defaultServices, ...services])];
            
            console.log('[Grpc_Client]正在注册服务:', allServices);
            const registerResult = await this.registryClient.register(allServices);
            
            if (registerResult.success) {
                console.log('[Grpc_Client]服务注册成功:', registerResult.message);
                console.log('[Grpc_Client]正在建立反向连接...');
                await this.registryClient.establishConnection();
                this.startHeartbeat();
                console.log('[Grpc_Client]gRPC 服务启动完成');
                return true;
            } else {
                throw new Error(`[Grpc_Client]服务注册失败: ${registerResult.message}`);
            }
        } catch (error) {
            console.error('[Grpc_Client]启动 gRPC 服务失败:', error);
            throw error;
        }
    }

    /**
     * 启动心跳机制
     */
    startHeartbeat() {
        // 每30秒发送一次心跳
        this.heartbeatInterval = setInterval(() => {
            if (this.registryClient && this.registryClient.isConnectionActive()) {
                this.registryClient.sendHeartbeat();
                console.log('[Grpc_Client]已发送心跳');
            }
        }, 30000);

        console.log('[Grpc_Client]心跳机制已启动');
    }

    /**
     * 停止心跳机制
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('[Grpc_Client]心跳机制已停止');
        }
    }

    /**
     * 停止 gRPC 服务
     */
    async stop() {
        try {
            console.log('[Grpc_Client]正在停止 gRPC 服务...');
            
            // 停止心跳
            this.stopHeartbeat();
            
            // 关闭连接
            if (this.registryClient) {
                this.registryClient.close();
                this.registryClient = null;
            }
            
            console.log('[Grpc_Client]gRPC 服务已停止');
        } catch (error) {
            console.error('[Grpc_Client]停止 gRPC 服务时出错:', error);
        }
    }

    /**
     * 获取连接状态
     * @returns {Object} 连接状态信息
     */
    getStatus() {
        if (!this.registryClient) {
            return {
                initialized: false,
                connected: false,
                config: null
            };
        }

        return {
            initialized: true,
            connected: this.registryClient.isConnectionActive(),
            config: this.registryClient.getConfig(),
            heartbeatActive: this.heartbeatInterval !== null
        };
    }

    /**
     * 获取注册客户端实例
     * @returns {RegistryClient|null} 注册客户端实例
     */
    getRegistryClient() {
        return this.registryClient;
    }

    /**
     * 手动触发重连
     * @returns {Promise<boolean>} 重连是否成功
     */
    async reconnect() {
        try {
            if (!this.registryClient) {
                console.error('[Grpc_Client]gRPC 管理器未初始化');
                return false;
            }

            console.log('[Grpc_Client]手动触发重连...');
            
            // 重置重连状态
            this.registryClient.resetReconnectState();
            
            // 尝试重连
            await this.registryClient.attemptReconnect();
            
            console.log('[Grpc_Client]手动重连成功');
            return true;
        } catch (error) {
            console.error('[Grpc_Client]手动重连失败:', error);
            return false;
        }
    }
}

// 导出单例实例
const grpcManager = new GrpcManager();

module.exports = {
    GrpcManager,
    RegistryClient,
    GrpcConfig,
    grpcManager
};
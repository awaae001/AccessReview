require('dotenv').config();

/**
 * gRPC 客户端配置管理类
 */
class GrpcConfig {
    constructor() {
        this.serverAddress = process.env.GRPC_SERVER_ADDRESS || 'localhost:50051';
        this.token = process.env.GRPC_TOKEN || '';
        this.clientName = process.env.GRPC_CLIENT_NAME || 'default-client';

        // 验证必需的配置
        this.validate();
    }

    /**
     * 验证配置参数
     */
    validate() {
        if (!this.serverAddress) {
            throw new Error('[Grpc_config]GRPC_SERVER_ADDRESS 环境变量未设置');
        }

        if (!this.token) {
            throw new Error('[Grpc_config]GRPC_TOKEN 环境变量未设置');
        }

        if (!this.clientName) {
            throw new Error('[Grpc_config]GRPC_CLIENT_NAME 环境变量未设置');
        }
    }

    /**
     * 获取服务器地址
     * @returns {string} 服务器地址
     */
    getServerAddress() {
        return this.serverAddress;
    }

    /**
     * 获取认证令牌
     * @returns {string} 认证令牌
     */
    getToken() {
        return this.token;
    }

    /**
     * 获取客户端名称
     * @returns {string} 客户端名称
     */
    getClientName() {
        return this.clientName;
    }

    /**
     * 获取 gRPC 客户端选项
     * @returns {Object} gRPC 客户端选项
     */
    getClientOptions() {
        return {
            'grpc.keepalive_time_ms': 30000,
            'grpc.keepalive_timeout_ms': 5000,
            'grpc.keepalive_permit_without_calls': true,
            'grpc.http2.max_pings_without_data': 0,
            'grpc.http2.min_time_between_pings_ms': 10000,
            'grpc.http2.min_ping_interval_without_data_ms': 300000
        };
    }

    /**
     * 获取连接重试选项
     * @returns {Object} 重试选项
     */
    getRetryOptions() {
        return {
            maxRetries: 5,
            retryDelay: 1000,
            maxRetryDelay: 30000,
            backoffMultiplier: 2
        };
    }
}

module.exports = GrpcConfig;
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const GrpcConfig = require('./config');
const CooldownHandler = require('./cooldownHandler');

/**
 * RegistryService gRPC 客户端
 */
class RegistryClient {
    constructor() {
        this.config = new GrpcConfig();
        this.client = null;
        this.isConnected = false;
        this.connectionStream = null;
        this.cooldownHandler = new CooldownHandler();
        
        // 重连配置
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5秒
        this.reconnectTimer = null;
        this.isReconnecting = false;

        // 初始化客户端
        this.initClient();
    }

    /**
     * 初始化 gRPC 客户端
     */
    initClient() {
        try {
            // 加载 proto 文件
            const protoPath = path.join(__dirname, '../../proto/registry.proto');
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });

            const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
            const registryProto = protoDescriptor.registry;

            // 创建客户端实例
            this.client = new registryProto.RegistryService(
                this.config.getServerAddress(),
                grpc.credentials.createInsecure(),
                this.config.getClientOptions()
            );

            console.log(`[Grpc_Registry]gRPC 客户端已初始化，连接到: ${this.config.getServerAddress()}`);
        } catch (error) {
            console.error('[Grpc_Registry]初始化 gRPC 客户端失败:', error);
            throw error;
        }
    }

    /**
     * 注册服务
     * @param {Array<string>} services - 服务列表
     * @returns {Promise<Object>} 注册结果
     */
    async register(services = []) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('[Grpc_Registry]gRPC 客户端未初始化'));
            }

            const request = {
                api_key: this.config.getToken(),
                address: `http://${this.config.getClientName()}:50051`,
                services: services
            };

            console.log('[Grpc_Registry]正在注册服务:', request);

            this.client.Register(request, (error, response) => {
                if (error) {
                    console.error('[Grpc_Registry]服务注册失败:', error);
                    reject(error);
                } else {
                    console.log('[Grpc_Registry]服务注册结果:', response);
                    resolve(response);
                }
            });
        });
    }

    /**
     * 建立反向连接
     * @returns {Promise<Object>} 连接流对象
     */
    async establishConnection() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('[Grpc_Registry]gRPC 客户端未初始化'));
            }

            try {
                // 创建双向流
                this.connectionStream = this.client.EstablishConnection();

                // 监听流事件
                this.connectionStream.on('data', (message) => {
                    this.handleIncomingMessage(message);
                });

                this.connectionStream.on('error', (error) => {
                    console.error('连接流错误:', error);
                    this.isConnected = false;
                    this.handleConnectionError(error);
                    reject(error);
                });

                this.connectionStream.on('end', () => {
                    console.log('连接流已结束');
                    this.isConnected = false;
                    if (!this.isReconnecting) {
                        console.log('连接流错误以后应该尝试重连');
                        this.scheduleReconnect();
                    }
                });

                // 发送连接注册消息
                const registerMessage = {
                    register: {
                        api_key: this.config.getToken(),
                        services: [], // 根据需要添加服务列表
                        connection_id: this.generateConnectionId()
                    }
                };

                this.connectionStream.write(registerMessage);
                this.isConnected = true;

                console.log('[Grpc_Registry]反向连接已建立');
                resolve(this.connectionStream);

            } catch (error) {
                console.error('[Grpc_Registry]建立连接失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 处理收到的消息
     * @param {Object} message - 收到的消息
     */
    handleIncomingMessage(message) {
        console.log('[Grpc_Registry]收到消息:', JSON.stringify(message, null, 2));

        if (message.request) {
            // 处理转发请求
            this.handleForwardRequest(message.request);
        } else if (message.heartbeat) {
            // 处理心跳消息
            this.handleHeartbeat(message.heartbeat);
        } else if (message.status) {
            // 处理连接状态消息
            this.handleConnectionStatus(message.status);
        }
    }

    /**
     * 处理转发请求
     * @param {Object} request - 转发请求
     */
    async handleForwardRequest(request) {
        console.log('[Grpc_Registry]处理转发请求:', request.request_id, request.method_path);

        try {
            let responseData;
            let statusCode = 200;
            let errorMessage = '';

            // 根据 method_path 路由到对应的服务处理器
            if (request.method_path.startsWith('/accessreview.cooldown/')) {
                responseData = await this.cooldownHandler.handleRequest(request.method_path, request.payload);
            } else {
                // 未知服务
                statusCode = 404;
                errorMessage = `未知的服务路径: ${request.method_path}`;
                responseData = { error: errorMessage };
            }

            const response = {
                response: {
                    request_id: request.request_id,
                    status_code: statusCode,
                    headers: {},
                    payload: Buffer.from(JSON.stringify(responseData)),
                    error_message: errorMessage
                }
            };

            if (this.connectionStream) {
                this.connectionStream.write(response);
            }
        } catch (error) {
            console.error('[Grpc_Registry]处理转发请求失败:', error);
            
            const errorResponse = {
                response: {
                    request_id: request.request_id,
                    status_code: 500,
                    headers: {},
                    payload: Buffer.from(JSON.stringify({ error: error.message })),
                    error_message: error.message
                }
            };

            if (this.connectionStream) {
                this.connectionStream.write(errorResponse);
            }
        }
    }

    /**
     * 处理心跳消息
     * @param {Object} heartbeat - 心跳消息
     */
    handleHeartbeat(heartbeat) {
        console.log('[Grpc_Registry]收到心跳:', heartbeat.timestamp);

        // 回复心跳
        const heartbeatResponse = {
            heartbeat: {
                timestamp: Date.now(),
                connection_id: heartbeat.connection_id
            }
        };

        if (this.connectionStream) {
            this.connectionStream.write(heartbeatResponse);
        }
    }

    /**
     * 处理连接状态消息
     * @param {Object} status - 连接状态
     */
    handleConnectionStatus(status) {
        console.log('[Grpc_Registry]连接状态更新:', status);

        switch (status.status) {
            case 'CONNECTED':
                this.isConnected = true;
                break;
            case 'DISCONNECTED':
            case 'ERROR':
                this.isConnected = false;
                break;
        }
    }

    /**
     * 生成连接 ID
     * @returns {string} 连接 ID
     */
    generateConnectionId() {
        return `${this.config.getClientName()}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * 发送心跳
     */
    sendHeartbeat() {
        if (this.connectionStream && this.isConnected) {
            const heartbeat = {
                heartbeat: {
                    timestamp: Date.now(),
                    connection_id: this.generateConnectionId()
                }
            };

            this.connectionStream.write(heartbeat);
        }
    }

    /**
     * 处理连接错误
     * @param {Error} error - 连接错误
     */
    handleConnectionError(error) {
        console.error('[Grpc_Registry]连接错误:', error.message);
        this.isConnected = false;
        this.connectionStream = null;
        
        // 对于UNAVAILABLE错误（错误代码14），尝试重连
        if (error.code === 14 && !this.isReconnecting) {
            console.log('[Grpc_Registry]检测到连接断开，准备重连...');
            this.scheduleReconnect();
        }
    }

    /**
     * 安排重连
     */
    scheduleReconnect() {
        if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error(`[Grpc_Registry]已达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
            }
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
        console.log(`[Grpc_Registry]将在 ${delay/1000} 秒后进行第 ${this.reconnectAttempts} 次重连尝试`);
        
        this.reconnectTimer = setTimeout(async () => {
            try {
                console.log(`[Grpc_Registry]开始第 ${this.reconnectAttempts} 次重连尝试...`);
                await this.attemptReconnect();
                
                // 重连成功，重置计数器
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                console.log('[Grpc_Registry]重连成功！');
                
            } catch (error) {
                console.error(`[Grpc_Registry]第 ${this.reconnectAttempts} 次重连尝试失败:`, error.message);
                this.isReconnecting = false;
                
                // 如果还有重连次数，继续尝试
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            }
        }, delay);
    }

    /**
     * 尝试重连
     * @returns {Promise<void>}
     */
    async attemptReconnect() {
        // 清理旧连接
        if (this.connectionStream) {
            try {
                this.connectionStream.end();
            } catch (error) {
                // 忽略清理时的错误
            }
            this.connectionStream = null;
        }
        
        // 重新初始化客户端（以防服务器重启）
        try {
            this.initClient();
        } catch (error) {
            console.error('[Grpc_Registry]重新初始化客户端失败:', error);
        }
        
        // 尝试建立新连接
        await this.establishConnection();
    }

    /**
     * 重置重连状态
     */
    resetReconnectState() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
    }

    /**
     * 关闭连接
     */
    close() {
        // 重置重连状态
        this.resetReconnectState();
        
        if (this.connectionStream) {
            this.connectionStream.end();
            this.connectionStream = null;
        }

        if (this.client) {
            this.client.close();
        }

        this.isConnected = false;
        console.log('[Grpc_Registry]gRPC 客户端连接已关闭');
    }

    /**
     * 检查连接状态
     * @returns {boolean} 是否已连接
     */
    isConnectionActive() {
        return this.isConnected && this.connectionStream;
    }

    /**
     * 获取客户端配置
     * @returns {Object} 客户端配置
     */
    getConfig() {
        return {
            serverAddress: this.config.getServerAddress(),
            clientName: this.config.getClientName(),
            isConnected: this.isConnected
        };
    }
}

module.exports = RegistryClient;
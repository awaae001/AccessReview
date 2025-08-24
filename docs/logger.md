# 日志模块使用文档

本日志模块用于向指定的 Discord 频道发送格式化的日志消息 

## 如何使用

要使用日志模块，您需要从 `src/utils/logger.js` 导入 `sendLog` 函数 

```javascript
const { sendLog } = require('../utils/logger');
```

`sendLog` 函数接受两个参数：

1.  `logData` (object): 包含日志信息的对象 
    *   `module` (string): 模块的名称 (例如, 'Commands', 'Tasks').
    *   `action` (string): 执行的操作 (例如, 'User Apply', 'Database Refresh').
    *   `info` (string): 附加的详细信息 
2.  `level` (string, 可选): 日志级别 可以是 `'info'`, `'warn'`, 或 `'error'` 默认为 `'info'` 

### 示例

```javascript
const { sendLog } = require('../utils/logger');

// 发送一条 info 级别的日志
await sendLog({
  module: 'User Authentication',
  action: 'User Login',
  info: 'User "testuser" logged in successfully.'
});

// 发送一条 error 级别的日志
await sendLog({
  module: 'Database',
  action: 'Data Fetch',
  info: 'Failed to fetch data for user "testuser".'
}, 'error');
```

## 配置

日志频道 ID 在 `.env` 文件中通过 `GLOBAL_ADMIN_CHANNEL_ID` 变量进行配置 

```
GLOBAL_ADMIN_CHANNEL_ID=your_channel_id

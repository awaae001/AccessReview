const fs = require('fs').promises;
const path = require('path');

const cooldownsFilePath = path.join(__dirname, '..', '..', 'data', 'cooldowns.json');

async function ensureCooldownsFile() {
  try {
    await fs.access(cooldownsFilePath);
  } catch (error) {
    const initialStructure = {
      "auto_apply": {},
      "new_apply_panel": {}
    };
    await fs.writeFile(cooldownsFilePath, JSON.stringify(initialStructure, null, 2));
  }
}

async function getCooldowns() {
  await ensureCooldownsFile();
  const data = await fs.readFile(cooldownsFilePath, 'utf8');
  let cooldowns = JSON.parse(data);
  
  // 如果是旧格式，转换为新格式
  if (!cooldowns["auto_apply"] && !cooldowns["new_apply_panel"]) {
    const oldData = cooldowns;
    cooldowns = {
      "auto_apply": oldData,
      "new_apply_panel": {}
    };
  }
  
  // 确保结构完整
  if (!cooldowns["auto_apply"]) cooldowns["auto_apply"] = {};
  if (!cooldowns["new_apply_panel"]) cooldowns["new_apply_panel"] = {};
  
  return cooldowns;
}

async function saveCooldowns(cooldowns) {
  await fs.writeFile(cooldownsFilePath, JSON.stringify(cooldowns, null, 2));
}

// 自动申请相关函数（保持原有逻辑）
async function getAutoApplyCooldowns() {
  const cooldowns = await getCooldowns();
  const now = Date.now();
  const cooldownAmount = 24 * 60 * 60 * 1000; // 24 小时
  let needsUpdate = false;

  for (const userId in cooldowns["auto_apply"]) {
    const expirationTime = cooldowns["auto_apply"][userId] + cooldownAmount;
    if (now >= expirationTime) {
      delete cooldowns["auto_apply"][userId];
      needsUpdate = true;
    }
  }

  if (needsUpdate) {
    await saveCooldowns(cooldowns);
  }

  return cooldowns["auto_apply"];
}

async function setAutoApplyCooldown(userId) {
  const cooldowns = await getCooldowns();
  const now = Date.now();
  cooldowns["auto_apply"][userId] = now;
  await saveCooldowns(cooldowns);
}

// 新申请面板拉黑相关函数
async function isUserBlacklisted(userId) {
  const cooldowns = await getCooldowns();
  const now = Date.now();
  const blacklistCooldown = 48 * 60 * 60 * 1000; // 48 小时
  let needsUpdate = false;
  
  // 检查并清理过期的拉黑记录
  for (const uid in cooldowns["new_apply_panel"]) {
    const blacklistData = cooldowns["new_apply_panel"][uid];
    const expirationTime = blacklistData.timestamp + blacklistCooldown;
    if (now >= expirationTime) {
      delete cooldowns["new_apply_panel"][uid];
      needsUpdate = true;
      console.log(`[cooldownManager] 用户 ${uid} 的拉黑记录已过期，自动移除`);
    }
  }
  
  if (needsUpdate) {
    await saveCooldowns(cooldowns);
  }
  
  return cooldowns["new_apply_panel"][userId] || null;
}

async function addToBlacklist(userId, reason) {
  const cooldowns = await getCooldowns();
  const now = Date.now();
  cooldowns["new_apply_panel"][userId] = {
    "timestamp": now,
    "reason": reason
  };
  await saveCooldowns(cooldowns);
  console.log(`[cooldownManager] 用户 ${userId} 已被加入新申请面板拉黑列表，原因: ${reason}`);
}

async function removeFromBlacklist(userId) {
  const cooldowns = await getCooldowns();
  if (cooldowns["new_apply_panel"][userId]) {
    delete cooldowns["new_apply_panel"][userId];
    await saveCooldowns(cooldowns);
    console.log(`[cooldownManager] 用户 ${userId} 已从新申请面板拉黑列表中移除`);
    return true;
  }
  return false;
}

async function getBlacklistedUsers() {
  const cooldowns = await getCooldowns();
  const now = Date.now();
  const blacklistCooldown = 48 * 60 * 60 * 1000; // 48 小时
  let needsUpdate = false;
  
  // 检查并清理过期的拉黑记录
  for (const uid in cooldowns["new_apply_panel"]) {
    const blacklistData = cooldowns["new_apply_panel"][uid];
    const expirationTime = blacklistData.timestamp + blacklistCooldown;
    if (now >= expirationTime) {
      delete cooldowns["new_apply_panel"][uid];
      needsUpdate = true;
      console.log(`[cooldownManager] 用户 ${uid} 的拉黑记录已过期，自动移除`);
    }
  }
  
  if (needsUpdate) {
    await saveCooldowns(cooldowns);
  }
  
  return cooldowns["new_apply_panel"];
}

// 获取用户友好的冷却时间信息
function getTimeRemaining(timestamp, cooldownHours = 24) {
  const now = Date.now();
  const cooldownAmount = cooldownHours * 60 * 60 * 1000;
  const expirationTime = timestamp + cooldownAmount;
  
  console.log(`[getTimeRemaining] 调试信息:`);
  console.log(`  当前时间: ${now} (${new Date(now).toISOString()})`);
  console.log(`  冷却开始: ${timestamp} (${new Date(timestamp).toISOString()})`);
  console.log(`  冷却时长: ${cooldownHours}小时`);
  console.log(`  到期时间: ${expirationTime} (${new Date(expirationTime).toISOString()})`);
  
  if (now >= expirationTime) {
    console.log(`  冷却已过期 - 当前时间 >= 到期时间`);
    return null; // 冷却已过期
  }
  
  const timeLeft = (expirationTime - now) / 1000;
  const hoursLeft = Math.floor(timeLeft / 3600);
  const minutesLeft = Math.floor((timeLeft % 3600) / 60);
  const totalSecondsLeft = Math.floor(timeLeft);
  
  console.log(`  剩余时间: ${hoursLeft}小时 ${minutesLeft}分钟 (总秒数: ${totalSecondsLeft})`);
  
  return { 
    hoursLeft, 
    minutesLeft, 
    totalSecondsLeft 
  };
}

module.exports = {
  // 自动申请相关
  getAutoApplyCooldowns,
  setAutoApplyCooldown,
  
  // 新申请面板拉黑相关  
  isUserBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  getBlacklistedUsers,
  
  // 工具函数
  getTimeRemaining,
  getCooldowns,
  saveCooldowns
};
require('dotenv').config();

/**
 * 检查用户是否有权限
 * @param {object} member - GuildMember 对象
 * @param {string} userId - 用户ID
 * @returns {boolean}
 */
function hasPermission(member, userId) {
  // 从环境变量读取，逗号分隔
  const allowedUserIds = (process.env.ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowedRoleIds = (process.env.ALLOWED_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  const isAllowedUser = allowedUserIds.includes(userId);
  const hasAllowedRole =
    member &&
    member.roles &&
    member.roles.cache &&
    member.roles.cache.some(role => allowedRoleIds.includes(role.id));

  return isAllowedUser || hasAllowedRole;
}

module.exports = { hasPermission };

const fs = require('fs');
const path = require('path');

// --- Paths ---
const activeApplyFilePath = path.join(__dirname, '..', '..', 'data', 'active_applies.json');
function getUserApplyHistoryFilePath(guildId) {
    return path.join(__dirname, '..', '..', 'data', `apply_${guildId}.json`);
}

// --- Functions for active_applies.json (New System: Pending & Approved) ---

function loadActiveApplies() {
    try {
        if (fs.existsSync(activeApplyFilePath)) {
            const rawData = fs.readFileSync(activeApplyFilePath, 'utf8');
            return JSON.parse(rawData);
        }
    } catch (error) {
        console.error('[Persistence] Failed to read active_applies.json:', error);
    }
    return {};
}

function saveActiveApplies(data) {
    try {
        fs.writeFileSync(activeApplyFilePath, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[Persistence] Failed to write to active_applies.json:', error);
    }
}

function addActiveApply(applyInfo) {
    const key = `${applyInfo.guildId}-${applyInfo.userId}-${applyInfo.categoryId}`;
    const applies = loadActiveApplies();
    applies[key] = applyInfo;
    saveActiveApplies(applies);
}

function updateActiveApply(guildId, userId, categoryId, updates) {
    const key = `${guildId}-${userId}-${categoryId}`;
    const applies = loadActiveApplies();
    if (applies[key]) {
        Object.assign(applies[key], updates);
        saveActiveApplies(applies);
    }
}

function findActiveApply(guildId, userId, categoryId) {
    const key = `${guildId}-${userId}-${categoryId}`;
    const applies = loadActiveApplies();
    return applies[key] || null;
}

function removeActiveApply(guildId, userId, categoryId) {
    const key = `${guildId}-${userId}-${categoryId}`;
    const applies = loadActiveApplies();
    if (applies[key]) {
        delete applies[key];
        saveActiveApplies(applies);
    }
}

function findActiveApplyByChannelId(channelId) {
    const applies = loadActiveApplies();
    for (const key in applies) {
        if (applies[key].channelId === channelId) {
            return applies[key];
        }
    }
    return null;
}

function removeActiveApplyByChannelId(channelId) {
    const applies = loadActiveApplies();
    let keyToRemove = null;
    for (const key in applies) {
        if (applies[key].channelId === channelId) {
            keyToRemove = key;
            break;
        }
    }
    if (keyToRemove) {
        delete applies[keyToRemove];
        saveActiveApplies(applies);
    }
}

// --- Functions for apply_{guildId}.json (History & Old System) ---

function loadUserApplyHistory(guildId) {
    const filePath = getUserApplyHistoryFilePath(guildId);
    try {
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(rawData);
            return (typeof parsed === 'object' && Array.isArray(parsed.data)) ? parsed : { data: [] };
        }
    } catch (error) {
        console.error(`[Persistence] Failed to read or parse ${filePath}:`, error);
    }
    return { data: [] };
}

function saveUserApplyHistory(guildId, data) {
    const filePath = getUserApplyHistoryFilePath(guildId);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        console.error(`[Persistence] Failed to write to ${filePath}:`, error);
    }
}

function addApplyToHistory(guildId, applyInfo) {
    const history = loadUserApplyHistory(guildId);
    // Ensure no duplicates if logic ever overlaps
    const exists = history.data.some(a => a.userId === applyInfo.userId && a.categoryId === applyInfo.categoryId);
    if (!exists) {
        history.data.push(applyInfo);
        saveUserApplyHistory(guildId, history);
    }
}

function findUserApplyHistory(guildId, userId) {
    const history = loadUserApplyHistory(guildId);
    return history.data.filter(apply => apply.userId === userId);
}

function findApplyInHistoryByChannelId(channelId) {
    const dataDir = path.join(__dirname, '..', '..', 'data');
    const files = fs.readdirSync(dataDir);

    for (const file of files) {
        if (file.startsWith('apply_') && file.endsWith('.json')) {
            const guildId = file.substring(6, file.length - 5);
            const history = loadUserApplyHistory(guildId);
            const foundApply = history.data.find(apply => apply.channelId === channelId);
            if (foundApply) {
                return foundApply;
            }
        }
    }
    return null;
}

module.exports = {
    // New System (uses active_applies.json)
    addActiveApply,
    updateActiveApply,
    findActiveApply,
    removeActiveApply,
    findActiveApplyByChannelId,
    removeActiveApplyByChannelId,
    // History & Old System (uses apply_{guildId}.json)
    addApplyToHistory,
    findUserApplyHistory,
    findApplyInHistoryByChannelId,
};
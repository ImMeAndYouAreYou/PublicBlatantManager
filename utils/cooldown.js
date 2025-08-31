// Cooldown system for command rate limiting
const cooldowns = new Map();
const COOLDOWN_DURATION = 7000; // 7 seconds in milliseconds

/**
 * Check if user is on cooldown for a specific command
 * @param {string} userId - Discord user ID
 * @param {string} commandName - Name of the command
 * @returns {boolean|number} - false if not on cooldown, remaining time if on cooldown
 */
function isOnCooldown(userId, commandName) {
    const key = `${userId}-${commandName}`;
    const cooldownData = cooldowns.get(key);
    
    if (!cooldownData) {
        return false;
    }
    
    const timeRemaining = cooldownData.expiresAt - Date.now();
    
    if (timeRemaining <= 0) {
        cooldowns.delete(key);
        return false;
    }
    
    return Math.ceil(timeRemaining / 1000); // Return seconds remaining
}

/**
 * Set cooldown for user on a specific command
 * @param {string} userId - Discord user ID
 * @param {string} commandName - Name of the command
 */
function setCooldown(userId, commandName) {
    const key = `${userId}-${commandName}`;
    cooldowns.set(key, {
        expiresAt: Date.now() + COOLDOWN_DURATION
    });
}

/**
 * Clear cooldown for user (admin function)
 * @param {string} userId - Discord user ID
 * @param {string} commandName - Name of the command (optional, clears all if not provided)
 */
function clearCooldown(userId, commandName = null) {
    if (commandName) {
        const key = `${userId}-${commandName}`;
        cooldowns.delete(key);
    } else {
        // Clear all cooldowns for user
        for (const [key] of cooldowns.entries()) {
            if (key.startsWith(userId + '-')) {
                cooldowns.delete(key);
            }
        }
    }
}

/**
 * Clean up expired cooldowns (maintenance function)
 */
function cleanupExpiredCooldowns() {
    const now = Date.now();
    for (const [key, data] of cooldowns.entries()) {
        if (data.expiresAt <= now) {
            cooldowns.delete(key);
        }
    }
}

// Run cleanup every 30 seconds
setInterval(cleanupExpiredCooldowns, 30000);

module.exports = {
    isOnCooldown,
    setCooldown,
    clearCooldown,
    COOLDOWN_DURATION
};
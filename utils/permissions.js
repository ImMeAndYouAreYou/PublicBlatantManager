const config = require('../config.js');

/**
 * Check if a user has permission to use bot commands
 * @param {string} userId - Discord user ID
 * @returns {boolean} - True if user is authorized
 */
function checkPermissions(userId) {
    return config.AUTHORIZED_USERS.includes(userId);
}

module.exports = {
    checkPermissions
};

// Performance optimization utilities
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Simple cache system for frequently accessed data
 * @param {string} key - Cache key
 * @param {Function} dataFunction - Function to get data if not cached
 * @param {number} duration - Cache duration in milliseconds
 * @returns {Promise<any>} - Cached or fresh data
 */
async function getCached(key, dataFunction, duration = CACHE_DURATION) {
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < duration) {
        return cached.data;
    }
    
    const data = await dataFunction();
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
    
    return data;
}

/**
 * Clear cache entry
 * @param {string} key - Cache key to clear
 */
function clearCache(key) {
    cache.delete(key);
}

/**
 * Clear all cache entries
 */
function clearAllCache() {
    cache.clear();
}

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            cache.delete(key);
        }
    }
}

// Run cache cleanup every minute
setInterval(cleanupCache, 60000);

/**
 * Debounce function to prevent rapid successive calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

module.exports = {
    getCached,
    clearCache,
    clearAllCache,
    debounce
};
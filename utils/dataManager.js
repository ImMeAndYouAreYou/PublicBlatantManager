const fs = require('fs');
const path = require('path');
const { getCached, clearCache } = require('./performance.js');

const DATA_FILE = path.join(__dirname, '../data/systems.json');

/**
 * Ensure data directory and file exist
 */
function ensureDataFile() {
    const dataDir = path.dirname(DATA_FILE);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create data file if it doesn't exist
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
}

/**
 * Load systems from JSON file
 * @returns {Array} Array of system objects
 */
function loadSystems() {
    try {
        ensureDataFile();
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading systems:', error);
        return [];
    }
}

/**
 * Save systems to JSON file
 * @param {Array} systems - Array of system objects
 */
function saveSystems(systems) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(systems, null, 2));
        // Clear cache when data changes
        clearCache('all_systems');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get all systems (cached for performance)
 * @returns {Array} Array of all systems
 */
function getAllSystems() {
    return getCached('all_systems', loadSystems, 10000); // Cache for 10 seconds
}

/**
 * Get a specific system by name
 * @param {string} systemName - Name of the system
 * @returns {Object|null} System object or null if not found
 */
function getSystem(systemName) {
    const systems = loadSystems();
    return systems.find(system => 
        system.name.toLowerCase() === systemName.toLowerCase()
    ) || null;
}

/**
 * Save a new system
 * @param {Object} systemData - System data object
 * @returns {boolean} Success status
 */
function saveSystem(systemData) {
    try {
        const systems = loadSystems();
        
        // Check if system already exists
        const existingIndex = systems.findIndex(system => 
            system.name.toLowerCase() === systemData.name.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            // Update existing system
            systems[existingIndex] = systemData;
        } else {
            // Add new system
            systems.push(systemData);
        }
        
        return saveSystems(systems);
    } catch (error) {
        console.error('Error saving system:', error);
        return false;
    }
}

/**
 * Remove a system by name
 * @param {string} systemName - Name of the system to remove
 * @returns {boolean} Success status
 */
function removeSystem(systemName) {
    try {
        const systems = loadSystems();
        const initialLength = systems.length;
        
        const filteredSystems = systems.filter(system => 
            system.name.toLowerCase() !== systemName.toLowerCase()
        );
        
        // Check if any system was removed
        if (filteredSystems.length < initialLength) {
            return saveSystems(filteredSystems);
        }
        
        return false; // No system was found to remove
    } catch (error) {
        console.error('Error removing system:', error);
        return false;
    }
}

/**
 * Check if a system exists
 * @param {string} systemName - Name of the system
 * @returns {boolean} True if system exists
 */
function systemExists(systemName) {
    return getSystem(systemName) !== null;
}

module.exports = {
    getAllSystems,
    getSystem,
    saveSystem,
    removeSystem,
    systemExists
};

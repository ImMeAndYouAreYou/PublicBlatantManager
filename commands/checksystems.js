const { EmbedBuilder } = require('discord.js');
const { getAllSystems } = require('../utils/dataManager.js');
const { isOnCooldown, setCooldown } = require('../utils/cooldown.js');

module.exports = {
    async execute(interaction) {
        // Check cooldown
        const cooldownTime = isOnCooldown(interaction.user.id, 'checksystems');
        if (cooldownTime) {
            await interaction.reply({
                content: `⏰ Please wait ${cooldownTime} seconds before using this command again.`,
                flags: 64
            });
            return;
        }

        const systems = await getAllSystems();

        if (systems.length === 0) {
            await interaction.reply({
                content: '📭 No systems saved yet.',
                flags: 64
            });
            return;
        }

        // Create embed with all systems
        const embed = new EmbedBuilder()
            .setTitle('📁 Saved Systems')
            .setDescription(`Found ${systems.length} system(s):`)
            .setColor(0x3498db)
            .setTimestamp();

        // Add fields for each system (max 25 fields per embed)
        const maxSystems = Math.min(systems.length, 25);
        
        for (let i = 0; i < maxSystems; i++) {
            const system = systems[i];
            const createdAt = new Date(system.createdAt).toLocaleDateString();
            const fileInfo = system.file ? `📎 ${system.file.name}` : '📄 No file';
            
            embed.addFields({
                name: `${i + 1}. ${system.name}`,
                value: `**Description:** ${system.description}\n**File:** ${fileInfo}\n**Created:** ${createdAt}`,
                inline: false
            });
        }

        // If there are more than 25 systems, add a note
        if (systems.length > 25) {
            embed.setFooter({ 
                text: `Showing first 25 of ${systems.length} systems` 
            });
        } else {
            embed.setFooter({ 
                text: `Total: ${systems.length} system(s)` 
            });
        }

        // Set cooldown after successful command
        setCooldown(interaction.user.id, 'checksystems');

        await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
};

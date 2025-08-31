const { EmbedBuilder } = require('discord.js');
const { getSystem } = require('../utils/dataManager.js');
const { isOnCooldown, setCooldown } = require('../utils/cooldown.js');

module.exports = {
    async execute(interaction) {
        const member = interaction.options.getUser('member');
        const systemName = interaction.options.getString('system_name');

        // Check cooldown
        const cooldownTime = isOnCooldown(interaction.user.id, 'send');
        if (cooldownTime) {
            await interaction.reply({
                content: `⏰ Please wait ${cooldownTime} seconds before using this command again.`,
                flags: 64
            });
            return;
        }

        // Check if system exists
        const system = getSystem(systemName);
        if (!system) {
            await interaction.reply({
                content: `❌ System "${systemName}" not found. Use \`/checksystems\` to see available systems.`,
                flags: 64
            });
            return;
        }

        // Defer reply to give time for DM sending
        await interaction.deferReply({ flags: 64 });

        try {
            // Create embed for the DM
            const dmEmbed = new EmbedBuilder()
                .setTitle(`📁 System: ${system.name}`)
                .setDescription(system.description)
                .addFields(
                    { name: 'Sent by', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Created by', value: `<@${system.createdBy}>`, inline: true },
                    { name: 'Created at', value: new Date(system.createdAt).toLocaleString(), inline: true }
                )
                .setColor(0x3498db)
                .setTimestamp();

            // Add file information if available
            if (system.file) {
                dmEmbed.addFields(
                    { name: 'File', value: `[${system.file.name}](${system.file.url})`, inline: true },
                    { name: 'File Size', value: `${(system.file.size / 1024).toFixed(2)} KB`, inline: true }
                );
            }

            // Try to send DM
            await member.send({
                content: `You have received a system from **${interaction.user.displayName}**:`,
                embeds: [dmEmbed]
            });

            // Send success message
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ System Sent Successfully')
                .setDescription(`System "${system.name}" has been sent to ${member.displayName}.`)
                .addFields(
                    { name: 'Recipient', value: `<@${member.id}>`, inline: true },
                    { name: 'System', value: system.name, inline: true }
                )
                .setColor(0x2ecc71)
                .setTimestamp();

            // Set cooldown after successful send
            setCooldown(interaction.user.id, 'send');
            
            await interaction.editReply({
                embeds: [successEmbed]
            });

        } catch (error) {
            
            let errorMessage = '❌ Failed to send the system via DM.';
            
            // Check if it's a DM-related error
            if (error.code === 50007) {
                errorMessage = `❌ Could not send DM to ${member.displayName}. They may have disabled DMs from server members.`;
            } else if (error.code === 50013) {
                errorMessage = `❌ Missing permissions to send DM to ${member.displayName}.`;
            }

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Send Failed')
                .setDescription(errorMessage)
                .addFields(
                    { name: 'Intended Recipient', value: `<@${member.id}>`, inline: true },
                    { name: 'System', value: system.name, inline: true }
                )
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    }
};

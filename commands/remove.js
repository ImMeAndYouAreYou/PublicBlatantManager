const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getSystem, removeSystem, getAllSystems } = require('../utils/dataManager.js');
const { isOnCooldown, setCooldown } = require('../utils/cooldown.js');

module.exports = {
    async execute(interaction) {
        const systemName = interaction.options.getString('system_name');

        // Check cooldown
        const cooldownTime = isOnCooldown(interaction.user.id, 'remove');
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

        // Show confirmation dialog
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm System Removal')
            .setDescription(`Are you sure you want to remove the system "${systemName}"?`)
            .addFields(
                { name: 'System Name', value: system.name, inline: true },
                { name: 'Description', value: system.description, inline: true },
                { name: 'File', value: system.file ? system.file.name : 'No file', inline: true }
            )
            .setColor(0xe74c3c)
            .setFooter({ text: 'This action cannot be undone!' });

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`remove-confirm_${systemName}`)
                    .setLabel('✅ Yes, Remove')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('remove-cancel')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            flags: 64
        });
    },

    async handleConfirm(interaction, params) {
        const systemName = params[0];

        try {
            const system = getSystem(systemName);
            if (!system) {
                await interaction.update({
                    content: `❌ System "${systemName}" not found. It may have already been removed.`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // Remove the system
            const success = removeSystem(systemName);
            
            if (success) {
                // Set cooldown after successful removal
                setCooldown(interaction.user.id, 'remove');
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ System Removed')
                    .setDescription(`System "${systemName}" has been successfully removed.`)
                    .setColor(0x2ecc71)
                    .setTimestamp();

                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });
            } else {
                await interaction.update({
                    content: `❌ Failed to remove system "${systemName}". Please try again.`,
                    embeds: [],
                    components: []
                });
            }

        } catch (error) {
            await interaction.update({
                content: '❌ An error occurred while removing the system. Please try again.',
                embeds: [],
                components: []
            });
        }
    },

    async handleCancel(interaction) {
        await interaction.update({
            content: '❌ System removal cancelled.',
            embeds: [],
            components: []
        });
    }
};

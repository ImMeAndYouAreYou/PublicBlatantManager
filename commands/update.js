const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getSystem, saveSystem, getAllSystems } = require('../utils/dataManager.js');
const { isOnCooldown, setCooldown } = require('../utils/cooldown.js');

// Store temporary data for updates
const pendingUpdates = new Map();
const pendingUpdateFiles = new Map();

module.exports = {
    async execute(interaction) {
        const systemName = interaction.options.getString('system_name');

        // Check cooldown
        const cooldownTime = isOnCooldown(interaction.user.id, 'update');
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

        // Show update options dropdown
        const updateEmbed = new EmbedBuilder()
            .setTitle('🔄 Update System')
            .setDescription(`What would you like to update for system "${systemName}"?`)
            .addFields(
                { name: 'Current Name', value: system.name, inline: true },
                { name: 'Current Description', value: system.description, inline: true },
                { name: 'Current File', value: system.file ? system.file.name : 'No file', inline: true }
            )
            .setColor(0xf39c12);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`update-select_${systemName}`)
            .setPlaceholder('Select what to update')
            .addOptions([
                {
                    label: 'Update Name',
                    value: 'name',
                    description: 'Change the system name',
                    emoji: '📝'
                },
                {
                    label: 'Update Description',
                    value: 'description',
                    description: 'Change the system description',
                    emoji: '📄'
                },
                {
                    label: 'Update File',
                    value: 'file',
                    description: 'Replace the system file',
                    emoji: '📁'
                }
            ]);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [updateEmbed],
            components: [selectRow],
            flags: 64
        });
    },

    async handleUpdateSelect(interaction, params) {
        const systemName = params[0];
        const updateType = interaction.values[0];

        const system = getSystem(systemName);
        if (!system) {
            await interaction.update({
                content: `❌ System "${systemName}" not found.`,
                embeds: [],
                components: []
            });
            return;
        }

        // Store pending update data
        pendingUpdates.set(interaction.user.id, {
            systemName,
            updateType,
            originalSystem: system,
            timestamp: Date.now()
        });

        let promptMessage = '';
        let promptTitle = '';

        switch (updateType) {
            case 'name':
                promptTitle = '📝 Update System Name';
                promptMessage = `Please enter the new name for system "${systemName}":`;
                break;
            case 'description':
                promptTitle = '📄 Update System Description';
                promptMessage = `Please enter the new description for system "${systemName}":`;
                break;
            case 'file':
                promptTitle = '📁 Update System File';
                promptMessage = `Please upload the new file for system "${systemName}" in your next message:`;
                break;
        }

        const promptEmbed = new EmbedBuilder()
            .setTitle(promptTitle)
            .setDescription(promptMessage)
            .addFields(
                { name: 'System Name', value: systemName, inline: true },
                { name: 'Updating', value: updateType.charAt(0).toUpperCase() + updateType.slice(1), inline: true }
            )
            .setColor(0xf39c12)
            .setFooter({ text: 'You have 5 minutes to respond' });

        await interaction.update({
            embeds: [promptEmbed],
            components: []
        });

        if (updateType === 'file') {
            // Set up file collection for file updates
            const handleMessage = async (message) => {
                if (message.author.id === interaction.user.id && 
                    message.attachments.size > 0 &&
                    message.channel.id === interaction.channel.id &&
                    pendingUpdates.has(interaction.user.id)) {
                    
                    await handleUpdateFileMessage(message, interaction, systemName);
                    interaction.client.removeListener('messageCreate', handleMessage);
                }
            };

            interaction.client.on('messageCreate', handleMessage);

            // Set timeout
            setTimeout(() => {
                if (pendingUpdates.has(interaction.user.id)) {
                    interaction.followUp({
                        content: '⏰ Update timed out. Please try the command again.',
                        flags: 64
                    }).catch(() => {});
                    
                    pendingUpdates.delete(interaction.user.id);
                    interaction.client.removeListener('messageCreate', handleMessage);
                }
            }, 300000);
        } else {
            // Set up text collection for name/description updates
            const handleMessage = async (message) => {
                if (message.author.id === interaction.user.id && 
                    message.channel.id === interaction.channel.id &&
                    pendingUpdates.has(interaction.user.id)) {
                    
                    await handleUpdateTextMessage(message, interaction, systemName, updateType);
                    interaction.client.removeListener('messageCreate', handleMessage);
                }
            };

            interaction.client.on('messageCreate', handleMessage);

            // Set timeout
            setTimeout(() => {
                if (pendingUpdates.has(interaction.user.id)) {
                    interaction.followUp({
                        content: '⏰ Update timed out. Please try the command again.',
                        flags: 64
                    }).catch(() => {});
                    
                    pendingUpdates.delete(interaction.user.id);
                    interaction.client.removeListener('messageCreate', handleMessage);
                }
            }, 300000);
        }
    },

    async handleUpdateConfirm(interaction, params) {
        const userId = interaction.user.id;
        
        const pendingUpdate = pendingUpdates.get(userId);
        if (!pendingUpdate) {
            await interaction.reply({
                content: '❌ No pending update found. Please try again.',
                flags: 64
            });
            return;
        }

        try {
            const system = getSystem(pendingUpdate.systemName);
            if (!system) {
                await interaction.update({
                    content: `❌ System "${pendingUpdate.systemName}" not found.`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // Apply the update
            let updatedSystem = { ...system };
            let updateDescription = '';

            if (pendingUpdate.updateType === 'file' && pendingUpdateFiles.has(userId)) {
                const fileData = pendingUpdateFiles.get(userId);
                updatedSystem.file = {
                    url: fileData.url,
                    name: fileData.name,
                    size: fileData.size
                };
                updateDescription = `File updated to "${fileData.name}"`;
                pendingUpdateFiles.delete(userId);
            } else if (pendingUpdate.newValue) {
                if (pendingUpdate.updateType === 'name') {
                    updatedSystem.name = pendingUpdate.newValue;
                    updateDescription = `Name updated to "${pendingUpdate.newValue}"`;
                } else if (pendingUpdate.updateType === 'description') {
                    updatedSystem.description = pendingUpdate.newValue;
                    updateDescription = `Description updated`;
                }
            }

            // Save the updated system
            saveSystem(updatedSystem);
            
            // Set cooldown after successful update
            setCooldown(interaction.user.id, 'update');

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ System Updated Successfully')
                .setDescription(updateDescription)
                .addFields(
                    { name: 'System Name', value: updatedSystem.name, inline: true },
                    { name: 'Description', value: updatedSystem.description, inline: true },
                    { name: 'File', value: updatedSystem.file ? updatedSystem.file.name : 'No file', inline: true }
                )
                .setColor(0x2ecc71)
                .setTimestamp();

            await interaction.update({
                embeds: [successEmbed],
                components: []
            });

        } catch (error) {
            await interaction.update({
                content: '❌ An error occurred while updating the system. Please try again.',
                embeds: [],
                components: []
            });
        } finally {
            // Clean up temporary data
            pendingUpdates.delete(userId);
        }
    },

    async handleUpdateCancel(interaction) {
        const userId = interaction.user.id;
        
        // Clean up temporary data
        pendingUpdates.delete(userId);
        pendingUpdateFiles.delete(userId);

        await interaction.update({
            content: '❌ System update cancelled.',
            embeds: [],
            components: []
        });
    }
};

async function handleUpdateTextMessage(message, interaction, systemName, updateType) {
    const newValue = message.content.trim();
    
    if (!newValue) {
        await interaction.followUp({
            content: '❌ Please provide a valid value.',
            flags: 64
        });
        return;
    }

    // Update pending data with new value
    const pendingData = pendingUpdates.get(interaction.user.id);
    pendingData.newValue = newValue;
    pendingUpdates.set(interaction.user.id, pendingData);

    // Delete the user's message
    try {
        await message.delete();
    } catch (error) {
        console.log('Could not delete user message:', error.message);
    }

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Update Received')
        .setDescription('Please confirm to update this system.')
        .addFields(
            { name: 'System Name', value: systemName, inline: true },
            { name: 'Updating', value: updateType.charAt(0).toUpperCase() + updateType.slice(1), inline: true },
            { name: 'New Value', value: newValue, inline: true }
        )
        .setColor(0x2ecc71);

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`update-confirm_${interaction.user.id}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('update-cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.followUp({
        embeds: [confirmEmbed],
        components: [confirmRow],
        flags: 64
    });
}

async function handleUpdateFileMessage(message, interaction, systemName) {
    const attachment = message.attachments.first();
    
    if (!attachment) {
        await interaction.followUp({
            content: '❌ No file attachment found.',
            flags: 64
        });
        return;
    }

    // Store file data temporarily
    pendingUpdateFiles.set(interaction.user.id, {
        url: attachment.url,
        name: attachment.name,
        size: attachment.size
    });

    // Delete the user's message
    try {
        await message.delete();
    } catch (error) {
        console.log('Could not delete user message:', error.message);
    }

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ File Received')
        .setDescription('Please confirm to update this system.')
        .addFields(
            { name: 'System Name', value: systemName, inline: true },
            { name: 'Updating', value: 'File', inline: true },
            { name: 'New File', value: `${attachment.name} (${(attachment.size / 1024).toFixed(2)} KB)`, inline: true }
        )
        .setColor(0x2ecc71);

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`update-confirm_${interaction.user.id}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('update-cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.followUp({
        embeds: [confirmEmbed],
        components: [confirmRow],
        flags: 64
    });
}
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { saveSystem, getSystem } = require('../utils/dataManager.js');
const { isOnCooldown, setCooldown } = require('../utils/cooldown.js');

// Store temporary data for file uploads
const pendingCreations = new Map();
const pendingFiles = new Map();
const activeListeners = new Map();

module.exports = {
    // Export helper methods for index.js
    getPendingCreation(userId) {
        return pendingCreations.get(userId);
    },

    async handleFileMessage(message, pendingCreation) {
        return handleFileMessage(message, { user: message.author }, pendingCreation.systemName, pendingCreation.description);
    },

    async execute(interaction) {
        const systemName = interaction.options.getString('system_name');
        const description = interaction.options.getString('description');

        // Check cooldown
        const cooldownTime = isOnCooldown(interaction.user.id, 'create');
        if (cooldownTime) {
            await interaction.reply({
                content: `⏰ Please wait ${cooldownTime} seconds before using this command again.`,
                flags: 64
            });
            return;
        }

        // Check if system already exists
        const existingSystem = getSystem(systemName);
        if (existingSystem) {
            await interaction.reply({
                content: `❌ A system with the name "${systemName}" already exists. Please choose a different name.`,
                flags: 64 // Ephemeral flag
            });
            return;
        }

        // Store pending creation data
        pendingCreations.set(interaction.user.id, {
            systemName,
            description,
            timestamp: Date.now(),
            guildChannelId: interaction.channel.id // Store the original channel for confirmation
        });

        try {
            // Send initial response in the channel
            const channelEmbed = new EmbedBuilder()
                .setTitle('📁 Create New System')
                .setDescription('I\'ve sent you a DM to upload the file for this system.')
                .addFields(
                    { name: 'System Name', value: systemName, inline: true },
                    { name: 'Description', value: description, inline: true }
                )
                .setColor(0x3498db);

            await interaction.reply({
                embeds: [channelEmbed],
                flags: 64 // Ephemeral flag
            });
            // Send DM with file upload request
            const dmEmbed = new EmbedBuilder()
                .setTitle('📁 Upload File for New System')
                .setDescription('Please upload a file for your new system by attaching it to your next message here.')
                .addFields(
                    { name: 'System Name', value: systemName, inline: true },
                    { name: 'Description', value: description, inline: true }
                )
                .setColor(0x3498db)
                .setFooter({ text: 'Upload a file in your next DM message (you have 5 minutes)' });

            const dmChannel = await interaction.user.createDM();
            await dmChannel.send({
                embeds: [dmEmbed]
            });

            // Remove any existing listener for this user
            if (activeListeners.has(interaction.user.id)) {
                const oldListener = activeListeners.get(interaction.user.id);
                interaction.client.removeListener('messageCreate', oldListener);
            }

            // Set up file collection - listen to DM messages
            const messageHandler = async (message) => {
                if (message.author.id === interaction.user.id && 
                    message.channel.type === 1 && // DM channel
                    message.attachments.size > 0 &&
                    pendingCreations.has(interaction.user.id)) {
                    
                        
                    // Remove the listener immediately to prevent multiple triggers
                    interaction.client.removeListener('messageCreate', messageHandler);
                    activeListeners.delete(interaction.user.id);
                    
                    await handleFileMessage(message, interaction, systemName, description);
                }
            };

            // Store the listener reference
            activeListeners.set(interaction.user.id, messageHandler);
            interaction.client.on('messageCreate', messageHandler);

            // Set timeout for file upload
            setTimeout(() => {
                if (pendingCreations.has(interaction.user.id)) {
                        
                    // Send timeout message to DM
                    interaction.user.createDM().then(dmChannel => {
                        dmChannel.send('⏰ File upload timed out. Please use the `/create` command again.').catch(console.error);
                    }).catch(console.error);
                    
                    // Clean up pending data and listener
                    pendingCreations.delete(interaction.user.id);
                    if (activeListeners.has(interaction.user.id)) {
                        interaction.client.removeListener('messageCreate', activeListeners.get(interaction.user.id));
                        activeListeners.delete(interaction.user.id);
                    }
                }
            }, 300000); // 5 minutes

        } catch (error) {
            // Clean up cooldown on error
            setCooldown(interaction.user.id, 'create');
            
            // Clean up any pending data
            pendingCreations.delete(interaction.user.id);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Could not send you a DM. Please make sure your DMs are open and try again.',
                    flags: 64
                });
            } else {
                await interaction.followUp({
                    content: '❌ Could not send you a DM. Please make sure your DMs are open and try again.',
                    flags: 64
                });
            }
        }
    },

    async handleFileConfirm(interaction, params) {
        const userId = params[0];
        
        if (interaction.user.id !== userId) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ You can only confirm your own actions.',
                    flags: 64 // Ephemeral flag
                });
            }
            return;
        }

        const pendingFile = pendingFiles.get(userId);
        const pendingCreation = pendingCreations.get(userId);

        if (!pendingFile || !pendingCreation) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ No pending system creation found. Please try again.',
                    flags: 64 // Ephemeral flag
                });
            }
            return;
        }

        try {
            // Save the system
            const systemData = {
                name: pendingFile.systemName,
                description: pendingFile.description,
                file: {
                    url: pendingFile.url,
                    name: pendingFile.name,
                    size: pendingFile.size
                },
                createdBy: interaction.user.id,
                createdAt: new Date().toISOString()
            };

            saveSystem(systemData);

            // Set cooldown after successful creation
            setCooldown(interaction.user.id, 'create');

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ System Created Successfully')
                .setDescription(`System "${pendingFile.systemName}" has been saved.`)
                .addFields(
                    { name: 'Name', value: pendingFile.systemName, inline: true },
                    { name: 'Description', value: pendingFile.description, inline: true },
                    { name: 'File', value: pendingFile.name, inline: true }
                )
                .setColor(0x2ecc71)
                .setTimestamp();

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [successEmbed]
                });
            } else {
                await interaction.editReply({
                    embeds: [successEmbed],
                    components: []
                });
            }

        } catch (error) {
            
            const errorContent = '❌ An error occurred while saving the system. Please try again.';
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: errorContent,
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    content: errorContent,
                    embeds: [],
                    components: []
                });
            }
        } finally {
            // Clean up temporary data
            pendingFiles.delete(userId);
            pendingCreations.delete(userId);
        }
    },

    async handleFileCancel(interaction) {
        const userId = interaction.user.id;
        
        // Clean up temporary data
        pendingFiles.delete(userId);
        pendingCreations.delete(userId);

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ System creation cancelled.',
                flags: 64
            });
        } else {
            await interaction.editReply({
                content: '❌ System creation cancelled.',
                embeds: [],
                components: []
            });
        }
    }
};

async function handleFileMessage(message, interaction, systemName, description) {
    const attachment = message.attachments.first();
    
    if (!attachment) {
        await message.reply('❌ No file attachment found. Please attach a file to your message.');
        return;
    }

    // Store file data temporarily
    pendingFiles.set(interaction.user.id, {
        url: attachment.url,
        name: attachment.name,
        size: attachment.size,
        systemName,
        description
    });

    // Show confirmation in DM
    const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ File Received')
        .setDescription('Please confirm to save this system permanently.')
        .addFields(
            { name: 'System Name', value: systemName, inline: true },
            { name: 'Description', value: description, inline: true },
            { name: 'File', value: `${attachment.name} (${(attachment.size / 1024).toFixed(2)} KB)`, inline: true }
        )
        .setColor(0x2ecc71);

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`file-confirm_${interaction.user.id}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`file-cancel_${interaction.user.id}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    try {
        await message.reply({
            embeds: [confirmEmbed],
            components: [confirmRow]
        });
    } catch (error) {
        // Silent error handling for DM operations
    }
}

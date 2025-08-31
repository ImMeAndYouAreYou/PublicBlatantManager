const { Client, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const config = require('./config.js');

// Import commands
const createCommand = require('./commands/create.js');
const removeCommand = require('./commands/remove.js');
const sendCommand = require('./commands/send.js');
const checksystemsCommand = require('./commands/checksystems.js');
const updateCommand = require('./commands/update.js');

// Import utilities
const { checkPermissions } = require('./utils/permissions.js');
const { isOnCooldown, setCooldown } = require('./utils/cooldown.js');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// Command definitions for registration
const commands = [
    {
        name: 'create',
        description: 'Create a new system entry',
        options: [
            {
                name: 'system_name',
                description: 'Name of the system',
                type: 3, // STRING
                required: true
            },
            {
                name: 'description',
                description: 'Description of the system',
                type: 3, // STRING
                required: true
            }
        ]
    },
    {
        name: 'remove',
        description: 'Remove a system entry',
        options: [
            {
                name: 'system_name',
                description: 'Name of the system to remove',
                type: 3, // STRING
                required: true
            }
        ]
    },
    {
        name: 'send',
        description: 'Send a system to a member',
        options: [
            {
                name: 'member',
                description: 'Member to send the system to',
                type: 6, // USER
                required: true
            },
            {
                name: 'system_name',
                description: 'Name of the system to send',
                type: 3, // STRING
                required: true
            }
        ]
    },
    {
        name: 'checksystems',
        description: 'List all saved systems'
    },
    {
        name: 'update',
        description: 'Update an existing system',
        options: [
            {
                name: 'system_name',
                description: 'Name of the system to update',
                type: 3, // STRING
                required: true
            }
        ]
    }
];

// Bot ready event
client.once('clientReady', async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    
    // Set bot presence
    client.user.setPresence({
        activities: [{
            name: 'Blatant Sales',
            type: ActivityType.Playing
        }],
        status: 'online'
    });

    // Register slash commands
    try {
        const rest = new REST({ version: '10' }).setToken(config.TOKEN);
        
        await rest.put(
            Routes.applicationCommands(config.CLIENT_ID),
            { body: commands }
        );
    } catch (error) {
        // Silent error handling for command registration
    }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Check permissions
    if (!checkPermissions(interaction.user.id)) {
        await interaction.reply({
            content: '❌ You do not have permission to use this bot.',
            flags: 64
        });
        return;
    }

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'create':
                await createCommand.execute(interaction);
                break;
            case 'remove':
                await removeCommand.execute(interaction);
                break;
            case 'send':
                await sendCommand.execute(interaction);
                break;
            case 'checksystems':
                await checksystemsCommand.execute(interaction);
                break;
            case 'update':
                await updateCommand.execute(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Unknown command.',
                    flags: 64
                });
        }
    } catch (error) {
        
        // Only respond if interaction hasn't been handled already
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ An error occurred while executing this command. Please try again later.',
                    flags: 64
                });
            } catch (replyError) {
                // Silent error handling
            }
        }
    }
});

// Handle select menu and button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // Check permissions for button interactions too
    if (!checkPermissions(interaction.user.id)) {
        await interaction.reply({
            content: '❌ You do not have permission to use this bot.',
            flags: 64
        });
        return;
    }

    try {
        if (interaction.isStringSelectMenu()) {
            const [action, ...params] = interaction.customId.split('_');
            
            switch (action) {
                case 'update-select':
                    await updateCommand.handleUpdateSelect(interaction, params);
                    break;
            }
        } else if (interaction.isButton()) {
            const [action, ...params] = interaction.customId.split('_');
            
            switch (action) {
                case 'create-confirm':
                    await createCommand.handleConfirm(interaction, params);
                    break;
                case 'create-cancel':
                    await createCommand.handleCancel(interaction);
                    break;
                case 'remove-confirm':
                    await removeCommand.handleConfirm(interaction, params);
                    break;
                case 'remove-cancel':
                    await removeCommand.handleCancel(interaction);
                    break;
                case 'file-confirm':
                    await createCommand.handleFileConfirm(interaction, params);
                    break;
                case 'file-cancel':
                    await createCommand.handleFileCancel(interaction);
                    break;
                case 'update-confirm':
                    await updateCommand.handleUpdateConfirm(interaction, params);
                    break;
                case 'update-cancel':
                    await updateCommand.handleUpdateCancel(interaction);
                    break;
                default:
                    break;
            }
        }
    } catch (error) {
        
        // Only respond if interaction hasn't been handled already
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ An error occurred while processing your request.',
                    flags: 64
                });
            } catch (replyError) {
                // Silent error handling
            }
        }
    }
});

// Handle DM messages for file uploads
client.on('messageCreate', async (message) => {
    // Ignore bot messages and non-DM messages
    if (message.author.bot || message.guild) return;
    
    // Check if user has permission
    if (!checkPermissions(message.author.id)) return;
    
    // Check if user has a pending creation
    const pendingCreation = createCommand.getPendingCreation(message.author.id);
    if (!pendingCreation) return;
    
    // Check if message has attachments
    if (!message.attachments.size) return;
    
    // Handle the file message
    await createCommand.handleFileMessage(message, pendingCreation);
});

// Error handling (silent)
client.on('error', () => {});
process.on('unhandledRejection', () => {});

// Login to Discord
client.login(config.TOKEN);

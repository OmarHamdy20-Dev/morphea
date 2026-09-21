const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const memoryDb = {
    points: {},
    config: {}
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('setup-points')
        .setDescription('Setup the media-only channel for points')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel that only accepts clips/images').addChannelTypes(ChannelType.GuildText).setRequired(true)),

    new SlashCommandBuilder()
        .setName('add-points')
        .setDescription('Add points to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of points').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('remove-points')
        .setDescription('Remove points from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of points').setRequired(true)),

    new SlashCommandBuilder()
        .setName('points')
        .setDescription('Check your or someone else\'s points')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(false)),

    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top points leaderboard')
];

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    try {
        await client.application.commands.set(commands);
        console.log('✅ Commands registered.');
    } catch (error) {
        console.error(error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guildId) return;

    const guildConfig = memoryDb.config[message.guildId];
    
    if (guildConfig && guildConfig.pointsChannelId === message.channel.id) {
        const hasAttachment = message.attachments.size > 0;
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
        const hasLink = urlRegex.test(message.content);

        if (!hasAttachment && !hasLink) {
            try {
                await message.delete();
                const warning = await message.channel.send({ content: `⚠️ ${message.author}, Please only send clips, images, or links here!` });
                setTimeout(() => warning.delete().catch(() => null), 3000);
            } catch (err) {
                console.log('Missing permissions to delete messages.');
            }
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;

    if (commandName === 'setup-points') {
        const targetChannel = options.getChannel('channel');
        
        memoryDb.config[interaction.guildId] = {
            pointsChannelId: targetChannel.id
        };

        return interaction.reply({ 
            content: `✅ Setup complete! The channel ${targetChannel} will now only accept clips, images, and links. Normal text messages will be deleted.`,
            ephemeral: true 
        });
    }

    if (commandName === 'add-points') {
        const targetUser = options.getUser('user');
        const amount = options.getInteger('amount');
        if (amount <= 0) return interaction.reply({ content: '❌ Amount must be > 0.', ephemeral: true });

        memoryDb.points[targetUser.id] = (memoryDb.points[targetUser.id] || 0) + amount;
        return interaction.reply({ content: `✅ Added **${amount}** points to ${targetUser}. Total: **${memoryDb.points[targetUser.id]}**` });
    }

    if (commandName === 'remove-points') {
        const targetUser = options.getUser('user');
        const amount = options.getInteger('amount');
        if (amount <= 0) return interaction.reply({ content: '❌ Amount must be > 0.', ephemeral: true });

        if (!memoryDb.points[targetUser.id]) memoryDb.points[targetUser.id] = 0;
        memoryDb.points[targetUser.id] -= amount;
        if (memoryDb.points[targetUser.id] < 0) memoryDb.points[targetUser.id] = 0;
        
        return interaction.reply({ content: `✅ Removed **${amount}** points from ${targetUser}. Total: **${memoryDb.points[targetUser.id]}**` });
    }

    if (commandName === 'points') {
        const targetUser = options.getUser('user') || interaction.user;
        const userPoints = memoryDb.points[targetUser.id] || 0;
        return interaction.reply({ content: `🪙 ${targetUser} has **${userPoints}** points.` });
    }

    if (commandName === 'leaderboard') {
        const sortedPoints = Object.entries(memoryDb.points)
            .filter(([, pts]) => pts > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        if (sortedPoints.length === 0) return interaction.reply({ content: 'No points have been awarded yet.' });

        let desc = '';
        sortedPoints.forEach(([userId, pts], index) => {
            desc += `**${index + 1}.** <@${userId}> — ${pts} Points\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle('Points Leaderboard 🏆')
            .setDescription(desc)
            .setColor('#FFD700')
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
});
// Replace 'YOUR_BOT_TOKEN_HERE' with your actual bot token before running the bot.
client.login('YOUR_BOT_TOKEN_HERE');
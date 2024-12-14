const { SlashCommand } = require('slashctrl');
const lib = require('../lib');
const randomip = require('random-ip');
const generator = require('generate-password');

class CMD extends SlashCommand {

    constructor() {
        super();

        this.setName("start");
        this.setDescription("Start your VPS");

        this.addIntegerOption(option =>
            option.setName('id')
                .setDescription('VPS ID')
                .setRequired(false)); // Set to false to make it optional

        this.requiresAdmin = false;
    }

    async execute(interaction) {
        if (await lib.checkAdmin(this, interaction)) return;

        var user = await lib.getUser(interaction);

        var ID = interaction.options.getInteger('id');

        const db = require('../db');

        let VPS;
        if (ID) {
            VPS = await db.VPS.findOne({
                shortID: ID,
                userID: interaction.user.id
            });
            if (!VPS) return await lib.error(interaction, 'VPS not found with the provided ID');
        } else {
            const userVPS = await db.VPS.find({
                userID: interaction.user.id
            });

            if (userVPS.length === 0) {
                return await lib.error(interaction, 'No VPS found for your account');
            } else if (userVPS.length === 1) {
                VPS = userVPS[0];
            } else {
                return await lib.error(interaction, 'You have multiple VPS. Please specify the VPS ID');
            }
        }

        if (VPS.state != 'created') return await lib.error(interaction, 'VPS is not created but is ' + VPS.state);
        if (VPS.state === 'running') return await lib.error(interaction, 'VPS is already running');

        await interaction.deferReply();

        const queue = interaction.client.opsQueue[VPS.node];

        if (!queue) return await lib.error(interaction, 'Node not found', true);

        // Rate limiting: Prevent user from spamming start command
        const rateLimitKey = `start_${interaction.user.id}`;
        if (await lib.checkRateLimit(rateLimitKey, 60)) {
            return await lib.error(interaction, 'You are trying to start VPS too frequently. Please wait a minute.');
        }
        await lib.setRateLimit(rateLimitKey, 60);

        // Validate VPS configuration before starting
        if (!await lib.validateVPSConfig(VPS)) {
            return await lib.error(interaction, 'Invalid VPS configuration. Please contact support.');
        }

        await interaction.editReply('Adding to queue...');

        const job = await queue.add(`vps_${interaction.user.id}-${Date.now()}`, {
            action: 'start',
            proxID: VPS.proxID,
            userID: interaction.user.id
        });

        const position = await queue.getJobPosition(job.id);
        interaction.editReply(`**QUEUED**\nThe action has been added to the queue as ID ${job.id} and will process shortly. Your position in the queue is ${position}.`);

        // Notify the user when the VPS has started
        queue.on('completed', (jobId, result) => {
            if (jobId === job.id) {
                interaction.followUp(`Your VPS has started successfully!`);
            }
        });

        console.log('Job added to queue', job.id);
    }
}

module.exports = { default: CMD };

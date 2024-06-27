const { SlashCommand } = require('slashctrl');
const lib = require('../lib');

var randomip = require('random-ip');
var generator = require('generate-password');

class CMD extends SlashCommand {

    constructor() {
        super();
        
        // this.guilds = ["1211544398219976724"];
        
        this.setName("renew");
        this.setDescription("Renew vps");

        this.addIntegerOption(option =>
            option.setName('id')
                .setDescription('Your VPS ID')
                .setRequired(false)); // Set to false to make it optional

        this.requiresAdmin = false;
    }
    
    async execute(interaction) {
        if (await lib.checkAdmin(this, interaction)) return;

        var user = await lib.getUser(interaction);

	if (user.balance < 10) return await lib.error(interaction, 'You need at least 10 credits.');

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

        if (VPS.state != 'created') return await lib.error(interaction, 'VPS is not created, but is ' + VPS.state);
        
        await interaction.deferReply();

        const dayjs = require('dayjs');

        if (!VPS.type) VPS.type = 'alpine';
        VPS.expiry = dayjs(VPS.expiry).add(7, 'day');

        await VPS.save();

	user.balance = user.balance - 10;
	await user.save();

        const { time } = require('discord.js');

        const ex = time(new Date(VPS.expiry), 'R');

        interaction.editReply(`VPS Renewed! Expiry: ${ex} | Balance: ${user.balance}`);
    }
}

module.exports = { default: CMD };

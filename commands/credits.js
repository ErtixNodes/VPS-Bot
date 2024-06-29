const { SlashCommand } = require('slashctrl');
const { time } = require('discord.js');
const lib = require('../lib');

class CMD extends SlashCommand {

    constructor() {
        super();
        
        // this.guilds = ["1211544398219976724"];
        
        this.setName("credits");
        this.setDescription("Get you balance");

        this.requiresAdmin = false;
    }
    
    async execute(interaction) {
        if (await lib.checkAdmin(this, interaction)) return;

        var user = await lib.getUser(interaction);
        
        interaction.reply(`**Your balance:** :coin: ${user.balance}. Execute \`/earn\` to earn credits.`)
    }

}

module.exports = { default: CMD };
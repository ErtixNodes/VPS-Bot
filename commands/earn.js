const { SlashCommand } = require('slashctrl');
const { checkAdmin } = require('../lib');
const lib = require('../lib');

function genToken(length){
    //edit the token allowed characters
    var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
    var b = [];  
    for (var i=0; i<length; i++) {
        var j = (Math.random() * (a.length-1)).toFixed(0);
        b[i] = a[j];
    }
    return b.join("");
}

const fetch = require('node-fetch');

class CMD extends SlashCommand {

    constructor() {
        super();
        
        // this.guilds = ["1211544398219976724"];
        
        this.setName("earn");
        this.setDescription("Get credits");

        this.requiresAdmin = false;
    }
    
    async execute(interaction) {
        if (await checkAdmin(this, interaction)) return;

        await lib.getUser(interaction);
        await interaction.reply('Generating link...');

        var token = genToken(32);

        var url = await fetch(`https://api.cuty.io/quick?token=${process.env.CUTY}&url=${encodeURIComponent(`https://ertixnodes.xyz/earn/${token}`)}&format=text`);
        url = await url.text();

        const db = require('../db');
        const earn = new db.Earn({
            userID: interaction.user.id,
            isUsed: false,
            creditCount: 2,
            token
        });
        await earn.save();

        await interaction.editReply(`**Earn credits:**\n<${url}>\n\nYou will earn **:coin:2** for every view. Please note that each link is only valid ONCE.`);
    } 

}

module.exports = { default: CMD };

const { SlashCommand } = require('slashctrl');
const { checkAdmin } = require('../lib');
const lib = require('../lib');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const cooldownFilePath = path.join(__dirname, 'cooldowns.json');

// Function to read cooldown data from file
function readCooldowns() {
    if (fs.existsSync(cooldownFilePath)) {
        const data = fs.readFileSync(cooldownFilePath);
        return JSON.parse(data);
    }
    return {};
}

// Function to write cooldown data to file
function writeCooldowns(cooldowns) {
    fs.writeFileSync(cooldownFilePath, JSON.stringify(cooldowns, null, 2));
}

const cooldowns = readCooldowns(); // Load cooldown data

function genToken(length) {
    var a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
    var b = [];  
    for (var i = 0; i < length; i++) {
        var j = (Math.random() * (a.length - 1)).toFixed(0);
        b[i] = a[j];
    }
    return b.join("");
}

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
        const userId = interaction.user.id;

        // Check if user is in cooldown
        if (cooldowns[userId]) {
            const lastEarnTime = new Date(cooldowns[userId]);
            const now = new Date();
            const timeDiff = now - lastEarnTime;
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            if (hoursDiff < 24) {
                const nextEarnTime = new Date(lastEarnTime.getTime() + 24 * 60 * 60 * 1000);
                return interaction.reply(`You can earn credits again <t:${Math.floor(nextEarnTime.getTime() / 1000)}:R>.`);
            }
        }

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

        // Set the current time as the last earn time for the user and save to file
        cooldowns[userId] = new Date().toISOString();
        writeCooldowns(cooldowns);

        await interaction.editReply(`**Earn credits:**\n<${url}>\n\nYou will earn **:coin:2** for every view. Please note that each link is only valid ONCE.`);
    } 

}

module.exports = { default: CMD };

const { SlashCommand } = require('slashctrl');
const { checkAdmin } = require('../lib');

class CMD extends SlashCommand {

    constructor() {
        super();
        
        // this.guilds = ["1211544398219976724"];
        
        this.setName("stats");
        this.setDescription("Get the node stats");

        this.requiresAdmin = false;
    }
    
    async execute(interaction) {
        if (await checkAdmin(this, interaction)) return;
        
        var res = '**NODES:**\n';
        const db = require('../db');

        var nodes = await db.Node.find();

        for(let i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            var status = '';
            if (node.isFull) {
                status += `:red_circle:`;
            } else {
                status += ':green_circle:';
            }
            if (node.isAvailable && node.isAvailable == false) {
                status +=  `:orange_circle:`
            }
            res += `\n${status} \`${node.code}\` **${node.vpsCount}/${node.vpsLimit}** - ${Math.round((node.vpsCount/node.vpsLimit)*100)}%`;
        }

        interaction.reply(res);
    }

}

module.exports = { default: CMD };
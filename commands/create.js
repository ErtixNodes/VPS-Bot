const { SlashCommand } = require('slashctrl');
const lib = require('../lib');


var randomip = require('random-ip');
var generator = require('generate-password');

class CMD extends SlashCommand {

    constructor() {
        super();
        
        // this.guilds = ["1211544398219976724"];
        
        this.setName("create");
        this.setDescription("Create a vps");

        this.addStringOption(option =>
            option.setName('name')
                .setDescription('VPS name')
				.setRequired(true));
        

        this.requiresAdmin = false;
    }
    
    async execute(interaction) {
        if (await lib.checkAdmin(this, interaction)) return;

        var user = await lib.getUser(interaction);
        
        var name = interaction.options.getString('name');
        // var type = interaction.options.getString('type');
	    var type = 'normal';

	while (String(name).includes('@')) {
		name = String(name).replace('@', '');
	}

        if (type != 'normal' && type != 'test') return await lib.error(interaction, 'Invalid vps type');

        const db = require('../db');
        var VPS = await db.VPS.find({
            userID: interaction.user.id
        });
        if (VPS.length >= user.vpsLimit) {
		if (user.vpsLimit == 0 && user.isBanned == false) {
			 return lib.error(interaction, `You currently can't create any vps. In order to be able to create one, you will need to request one via the form: https://forms.gle/x1urbCtEHTbbRXZo9. After filling in the from, create a ticket.`);
		} else if (user.vpsLimit == 0 && user.isBanned == true) {
			return lib.error(interaction, `User is banned from service: ${user.banReason}`);
		} else {
			return lib.error(interaction, `You have reached your vps limit. You are limited to ${user.vpsLimit} vps, but you currently have ${VPS.length} vps.`);
		}
        }

	 /*   var nC;
	if (type == 'test') {
		nC = 'de-f1';
	} else {
		nC = 'ro-f1'
	} */
	    
        var node = await db.Node.findOne({
            isFull: false,
            isAvailable: true,
 		// code: nC
        }).sort({ percent: 1 }).exec();

        if (!node) return await lib.error(interaction, 'No node available.');

        // console.log(node);

        await interaction.deferReply();

        // console.log(interaction.client);
        var queue = interaction.client.createQueue[node.code];

        if (!queue) return await lib.error(interaction, 'Node not found?', true);

        var password = generator.generate({
            length: 15,
            uppercase: false,
            numbers: true
        });
        var ip = randomip(node.subnet, node.subnetMask);

        var sshPort = await db.Port.findOne({
            node: node.code,
            isUsed: false
        });
        if (!sshPort) return await lib.error(interaction, 'No ports available. Please contact an administrator.', true);
        sshPort.isUsed = true;
        sshPort.intPort = 22;
        await sshPort.save();

        await interaction.editReply('Adding to queue...');

        var VPS = new db.VPS({
            userID: interaction.user.id,
            password,
            name,
            ip,
            sshPort: sshPort.port,
            sshPortID: sshPort._id,
            state: 'queued',
            isCreated: false,
            cost: (1/730/60),
            portLimit: user.portLimit,
            node: node.code,
            nodeIP: node.ip,
            shortID: Math.floor(1000 + Math.random() * 9000),
            type
        });
        await VPS.save();

        console.log(`${VPS.shortID} has ${ip}`);

        sshPort.vpsID = VPS._id;
        await sshPort.save();

        var job = await queue.add(`vps_${interaction.user.id}-${Date.now()}`, {
            password,
            ip: VPS.ip,
            subnetMask: node.subnetMask,
            sshPort: sshPort.port,
            userID: interaction.user.id,
            nodeIP: node.ip,
            vpsID: VPS._id,
            node: node.code,
            portID: sshPort._id,
            shortID: VPS.shortID,
            storage: node.storage,
            type,
	    subnet: node.subnet
        });
        VPS.jobID = job.id;
        await VPS.save();

        interaction.editReply(`**QUEUED**\nYour vps has been placed in the queue with queue ID ${job.id} and VPS ID ${VPS.shortID} on node \`${node.code}\``);

	var server;
	var inv;
	if (interaction.guild) {
		var guild = interaction.guild;
		server = interaction.guild.name;
		// var ch = await guild.channels.fetch();
		// var ch = await guild.channels.filter(c => c.type === 'text').find(x => x.position == 0);;
		// console.log(ch.entries().next().value);
		// console.log(ch[1]);
        console.log(guild.systemChannelId);
        if (guild.systemChannelId) {
            inv = await guild.invites.create(guild.systemChannelId, {
                maxAge: 0,
                reason: 'audit log',
                unique: false
            });
        } else {
            inv = 'no';
        }
	} else {
		server = 'DM';
        inv = '-';
	}
	interaction.log.send(`<@554344892827172884> **${interaction.user.displayName}** in ${server} (${inv}) created a vps: ${name}`);
    }

}

module.exports = { default: CMD };

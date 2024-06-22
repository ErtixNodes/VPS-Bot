const { SlashCommand, MessageActionRow, MessageButton } = require('slashctrl');
const lib = require('../lib');

var randomip = require('random-ip');
var generator = require('generate-password');

class CMD extends SlashCommand {

    constructor() {
        super();

        this.setName("create");
        this.setDescription("Create a VPS");

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

        while (String(name).includes('@')) {
            name = String(name).replace('@', '');
        }

        const rules = `
**Rules:**
- We have the right to delete your server at any moment without reason or notifying you.
- Do NOT host/do the following:
  - Bitcoin mining
  - (bit)torrent client or server
  - Use a high amount of CPU
  - Illegal things
  - DDoS'ing
  - Bots (excluding Discord bots)
  - Tor exit node
  - Minecraft servers
  - VPN
  - Porn
  - Video hosting and/or encoding
  - Proxy(s)
  - Gameservers
  - Desktops
  - Botnet(s)
  - Pterodactyl
  - Wings
  - Traffic monetizers
  - Any other gamepanel
  - Pufferpanel
  - Hacking
  - Using high bandwidth
Hosting illegal things will result in a ban of the service.
Hosting anything against the law in Germany or the Netherlands will result in a ban.

**Please note:**
- Inactive servers will get deleted after 7 days.
- Our service is free, so we do not have any uptime guarantee.
`;

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('accept')
                    .setLabel('Accept')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('decline')
                    .setLabel('Decline')
                    .setStyle('DANGER')
            );

        await interaction.reply({ content: rules, components: [row], ephemeral: true });

        const filter = i => i.user.id === interaction.user.id;

        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'accept') {
                collector.stop('accepted');
                await i.update({ content: 'You accepted the rules. Creating your VPS...', components: [] });

                // Proceed with VPS creation
                var type = 'normal';

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

                var node = await db.Node.findOne({
                    isFull: false,
                    isAvailable: true,
                }).sort({ percent: 1 }).exec();

                if (!node) return await lib.error(interaction, 'No node available.');

                await interaction.deferReply();

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

                await interaction.editReply(`**QUEUED**\nYour vps has been placed in the queue with queue ID ${job.id} and VPS ID ${VPS.shortID} on node \`${node.code}\``);
            } else if (i.customId === 'decline') {
                collector.stop('declined');
                await i.update({ content: 'You declined the rules. VPS creation aborted.', components: [] });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'accepted' && reason !== 'declined') {
                interaction.editReply({ content: 'No response received. VPS creation aborted.', components: [] });
            }
        });
    }
}

module.exports = { default: CMD };

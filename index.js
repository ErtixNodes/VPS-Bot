require('dotenv').config();

const { SlashCtrl } = require('slashctrl');
const path = require('path');
const dayjs = require('dayjs');
const { log } = console;

var relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime);

var timeOut;
timeOut = {};

// var channel;

var isChecking;
isChecking = false;

var botToken = process.env.DISCORD_TOKEN;
var applicationId = process.env.DISCORD_ID;

const slashCtrl = new SlashCtrl({
    token: botToken,
    applicationId: applicationId
});

var e = slashCtrl.publishCommandsFromFolder(path.join(__dirname, 'commands'));
console.log(e);

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const BullMQ = require('bullmq');

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // channel = client.channels.cache.get('1204045694164533269');

    var queueOptions = {
        connection: {
            host: process.env.REDIS_HOST,
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            port: process.env.REDIS_PORT,
            retryStrategy(times) {
                return 1000;
            },
        }
    };

    // const queue = new BullMQ.Queue('de-f1_create', );

    client.createQueue = {};
    client.opsQueue = {};

    var db = require('./db');
    var nodes = await db.Node.find();

    for (let i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var code = node.code;

        // console.log(queueOptions)

        client.createQueue[code] = new BullMQ.Queue(`${code}_create`, queueOptions);
        client.opsQueue[code] = new BullMQ.Queue(`${code}_ops`, queueOptions);

        createEvents(`${code}_create`, queueOptions, client.createQueue[code], code);
        opsEvents(`${code}_ops`, queueOptions, client.opsQueue[code], code);

        console.log(`> Created <Client>.createQueue[${code}] and .opsQueue[${code}]`);
    }

    calculateNodeSize();

    setInterval(calculateNodeSize, 30 * 1000);


    checkExpiry();
    setInterval(checkExpiry, 1 * 1000);


    updateStatus();
    setInterval(updateStatus, 5 * 60 * 1000)
});

async function updateStatus() {
    const db = require('./db');
    var vpsCount = await db.VPS.find();
    vpsCount = vpsCount.length;
    client.user.setActivity(`with ${vpsCount} vps`);
}

client.on('interactionCreate', async interaction => {
    console.log(`> ${interaction.user.username} -> /${interaction.commandName}`);

    interaction.log = client.channels.cache.get(process.env.CH_LOG);
    
    slashCtrl.handleCommands(interaction);
});


client.login(botToken);

function createEvents(name, queueOptions, q, code) {
    const events = new BullMQ.QueueEvents(name, queueOptions);

    client.createQueue[code].events = events;

    events.on('waiting', ({ jobId }) => {
        // console.log(`[${name}] A job with ID ${jobId} is waiting`);
    });

    events.on('active', ({ jobId, prev }) => {
        // console.log(`[${name}] Job ${jobId} is now active; previous status was ${prev}`);
    });

    events.on('completed', async ({ jobId, returnvalue }) => {
        console.log(`[${name}] ${jobId} has completed and returned ${returnvalue}`, returnvalue);

        var job = await q.getJob(jobId);
        var data = job.data;

        if (returnvalue.ok == true) {
            try {
                var userID = data.userID;

                var db = require('./db');
                var VPS = await db.VPS.findOne({
                    _id: returnvalue.vpsID
                });
                if (!VPS) return console.log('VPS NOT FOUND?!!?!?111');
                VPS.proxID = returnvalue.proxID;
                VPS.state = 'created';
                VPS.expiry = dayjs().add(3, 'day');
                await VPS.save();

                var conn = '';

                conn += '```bash\n';
                conn += `ssh root@${VPS.nodeIP} -p ${VPS.sshPort}`
                conn += '\n```';

                client.users.send(userID, `> **VPS Created!**\n> \t\tHello. Your vps has been created!\n> This message will contain the details of your vps.\n\n> VPS ID: \`${VPS.shortID}\`\n> VPS IP (NAT/shared): ${VPS.nodeIP}\n> SSH Port: ${VPS.sshPort}\n> Username: root\n> Password: ||\`${VPS.password}\`||\n\n> Connect to your vps by executing this in a terminal:\n${conn}\n\nIf you want to forward a port, use the /forward command.`);

            } catch (e) {
                console.log(`> Failed to send ${data.userID} a DM: ${String(e)}`);
            }
        } else {
            try {
                var userID = data.userID;
                console.log('r', returnvalue)
                client.users.send(userID, `> **Create failed :x:!**\n> \t\tHello. Your vps has failed to create :(`);
            } catch (e) { }
        }
    });

    events.on('progress', async ({ jobId, returnvalue, mau }) => {
        // console.log(`[${name}] ${jobId} has progress and returned ${returnvalue}`, returnvalue, mau);
        console.log('> ' + (await q.getJob(jobId)).progress);
    });

    events.on('failed', async ({ jobId, failedReason }) => {
        console.log(`[${name}] ${jobId} has failed with reason ${failedReason}`);

        var job = await q.getJob(jobId);
        var data = job.data;

        try {
            client.users.send(data.userID, `> VPS Failed to create :(`);
        } catch (e) {
            console.log(`> Failed to send ${data.userID} a DM: ${String(e)}`);
        }
    });


}

function messageUser(userID, message) {
    try {
        client.users.send(userID, message);
    } catch (e) {
        console.log('failed to dm user', e)
    }
}

function opsEvents(name, queueOptions, q, code) {
    const events = new BullMQ.QueueEvents(name, queueOptions);

    client.opsQueue[code].events = events;

    events.on('waiting', ({ jobId }) => {
        // console.log(`[${name}] A job with ID ${jobId} is waiting`);
    });

    events.on('active', ({ jobId, prev }) => {
        // console.log(`[${name}] Job ${jobId} is now active; previous status was ${prev}`);
    });

    events.on('completed', async ({ jobId, returnvalue }) => {
        console.log(`[${name}] ${jobId} has completed and returned ${returnvalue}`, returnvalue);

        var job = await q.getJob(jobId);
        var data = job.data;

        if (returnvalue.ok == true) {
            messageUser(data.userID, `Action ${returnvalue.action} for VPS ${returnvalue.proxID} completed!`);
        } else {
            messageUser(data.userID, `Action ${returnvalue.action} failed...`);
        }
    });

    events.on('progress', async ({ jobId, returnvalue, mau }) => {
        // console.log(`[${name}] ${jobId} has progress and returned ${returnvalue}`, returnvalue, mau);
        console.log('> ' + (await q.getJob(jobId)).progress);
    });

    events.on('failed', async ({ jobId, failedReason }) => {
        console.log(`[${name}] ${jobId} has failed with reason ${failedReason}`);

        var job = await q.getJob(jobId);
        var data = job.data;

        try {
            client.users.send(data.userID, `> Action has failed`);
        } catch (e) {
            console.log(`> Failed to send ${data.userID} a DM: ${String(e)}`);
        }
    });

}

async function calculateNodeSize() {
    const db = require('./db');
    log('> Calculating node size...');

    var vpsPerNode = {};
    var nodeVPSLimit = {};

    var nodes = await db.Node.find();
    log(`Found ${nodes.length} nodes`);

    for (let i = 0; i < nodes.length; i++) {

        var node = nodes[i];

        nodeVPSLimit[node.code] = node.vpsLimit;
        vpsPerNode[node.code] = 0;

        var vpsOnNode = await db.VPS.find({ node: node.code });
        // console.log(vpsOnNode);
        vpsPerNode[node.code] = vpsOnNode.length;

        var no = await db.Node.findOne({ code: node.code });
        no.vpsCount = vpsOnNode.length;

        no.percent = (no.vpsCount / no.vpsLimit) * 100;

        if (vpsOnNode.length >= no.vpsLimit) {
            no.isFull = true;
        } else {
            no.isFull = false;
        }

        await no.save();

    }
    log(vpsPerNode, nodeVPSLimit);

    log('> Checked nodes!');
}

// client.on('messageCreate', async (msg) => {
//     if (timeOut[msg.author.id]) {
//         console.log(`User has timeout`);
//         return;
//     }

//     var lib = require('./lib');
//     var user = await lib.getUser(msg, true);

//     user.balance = user.balance + 1;
//     await user.save();
//     timeOut[msg.author.id] = true;
//     setTimeout(() => {
//         console.log(`Remove msg timeout`);
//         delete timeOut[msg.author.id];
//     }, 5 * 1000);
// })

async function checkExpiry() {
    if (isChecking == true) return;

    isChecking = true;

    const db = require('./db');
    var VPS = await db.VPS.find({
        expiry: {
            $lt: Date.now()
        }
    });

    if (VPS.length > 0) log(`> Found ${VPS.length} expired vps!`);

    const channel = client.channels.cache.get(process.env.CH_EXPIRY);


    for (let i = 0; i < VPS.length; i++) {
        var vps = VPS[i];

        log(`${vps.shortID} - ${dayjs().to(dayjs(vps.expiry))}`);

        if (!vps.proxID) {
            var vpsPorts = await db.Port.deleteMany({
                vpsID: vps._id
            });

            await db.VPS.deleteOne({
                _id: vps._id
            });

            log(`${vps.shortID} did not have a proxmox ID`);
        } else {

            var queue = client.opsQueue[vps.node];
            if (queue) {


                var vpsPorts = await db.Port.find({
                    vpsID: vps._id
                });

                log(`VPS ${vps.shortID} has ${vpsPorts.length} ports`);

                for (let i = 0; i < vpsPorts.length; i++) {
                    var port = vpsPorts[i];
                    log(`Deleting port ${port.id}`);

                    var job = await queue.add(`vps_${vps.userID}-${Date.now()}`, {
                        action: 'remforward',
                        proxID: vps.proxID,
                        ip: vps.ip,
                        port: port.port,
                        intPort: port.intPort,
                        userID: vps.userID,
                        portID: port._id
                    });

                    log(`Job added. ${job.id}`);

                    var s = Date.now() / 1000;
                    try {
                        log('Waiting to finish')
                        job.waitUntilFinished(queue.events).then(async () => {
                            log('finished');

                            port.isUsed = false;
                            port.vpsID = null;
                            port.intPort = null;
                            await port.save();

                            var e = Date.now() / 1000;

                            log('A port was removed. Took ' + (e - s) + 's');
                        });
                    } catch (e) {
                        log('error while waiting' + String(e));
                    }

                    log(`> Job: ${job.id}`);

                }

                log(`Added port forwards to queue. Deleting vps...`)

                var job = await queue.add(`vps_${vps.userID}-${Date.now()}`, {
                    action: 'delete',
                    proxID: vps.proxID,
                    userID: vps.userID,
                });

                const { time } = require('discord.js');

                await channel.send(`<@${vps.userID}> your vps \`${vps.name}\` (${vps.type}/${vps.shortID}) expired: ${time(new Date(vps.expiry), 'R')}`);

                await db.VPS.deleteOne({
                    _id: vps._id
                });

                log(`VPS delete added to queue: ${job.id}`)
            }

        }

    }

    isChecking = false;
}

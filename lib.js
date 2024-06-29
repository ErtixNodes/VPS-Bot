const db = require('./db');

async function checkAdmin(command, interaction) {
    if (command.requiresAdmin == false) return false;

    var userID = interaction.user.id;
    var admins = String(process.env.DISCORD_OWNERS).split(',');

    console.log('a', userID, admins, admins.includes(userID));

    if (admins.includes(userID)) return false;

    await interaction.reply(`> **This command is admin only!**`);
    return true;
}
async function getUser(interaction, isMessage) {
    var userID;
    if (isMessage) {
        userID = interaction.author.id;
    } else {
        userID = interaction.user.id;
    }
    // var userID = interaction.user.id;

    var user = await db.User.findOne({
        userID: userID
    });
    
    if (!user) {
        user = new db.User({
            userID,
            balance: 0,
            vpsLimit: 1,
            plan: 'free',
            isBanned: false,
            banReason: '',
            portLimit: 10,
            lastEarn: 0
        });
        await user.save();

    }

    return user;
}
async function error(interaction, message, edit) {
    if (edit == true) {
        return await interaction.editReply(`> \n> **:x: ERROR:**\n> \`${message}\``);
    }
    await interaction.reply(`> \n> **:x: ERROR:**\n> \`${message}\``);
}
module.exports = {
    checkAdmin,
    getUser,
    error
};

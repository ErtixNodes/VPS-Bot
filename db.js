const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URL);

const User = mongoose.model('User', {
    userID: String,
    balance: Number,
    
    vpsLimit: Number,
    isBanned: Boolean,
    banReason: String,
    
    plan: String, // free
    portLimit: Number,

    lastEarn: Number
});

const VPS = mongoose.model('VPS', {
    userID: String,
    ip: String,
    
    proxID: Number,
    
    name: String,
    
    ram: Number,
    cpu: Number,
    disk: Number,
    
    hasUsed: Boolean,
    usedCode: Number,
    
    expiry: Number, // Time to expire after lastRenew
    password: String,
    
    cost: Number,
    lastCost: Number,
    state: String, // queued / created
    node: String,

    sshPort: Number,
    portLimit: Number,

    nodeIP: String,
    shortID: Number,

    type: String // normal or test
});
const Node = mongoose.model('Node', {
    location: String, // first 2 letters
    type: String, // free or paid,
    number: Number,

    code: String,

    vpsCount: Number,
    percent: Number,
    vpsLimit: Number,

    isFull: Boolean,
    isAvailable: Boolean,

    ip: String,
    subnet: String,
    subnetMask: Number,
    storage: String
});
const Port = mongoose.model('Port', {
    node: String,
    port: Number,
    isUsed: Boolean,
    vpsID: String,
    intPort: Number
});

// Money
const Earn = mongoose.model('Earn', {
    userID: String,
    isUsed: Boolean,
    creditCount: Number,
    token: String
});

module.exports = {
    User,
    VPS,
    Node,
    Port,
    Earn
};

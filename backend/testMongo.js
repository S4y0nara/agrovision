const mongoose = require('mongoose');
require('dotenv').config();

const user = process.env.MONGO_USER;
const pass = process.env.MONGO_PASSWORD;
const hosts = process.env.MONGO_HOSTS;
const db = process.env.MONGO_DB;
const replicaSet = process.env.MONGO_REPLICA_SET;

const uri = `mongodb://${hosts}/${db}?tls=true&replicaSet=${encodeURIComponent(replicaSet)}&authSource=admin&appName=Cluster0`;
const opts = {
    user,
    pass,
    serverSelectionTimeoutMS: 5000,
    authSource: 'admin',
};

console.log('Testing connection to:', uri);
mongoose.connect(uri, opts).then(() => {
    console.log('✅ Connected successfully!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});

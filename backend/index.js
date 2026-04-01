require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const chatRoutes = require('./routes/chatRoutes');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const weatherRoutes = require('./routes/weatherRoutes');

const app = express();
const PORT = process.env.PORT || 5001;
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/weather', weatherRoutes);

// Handle unhandled promise rejections (like MongoDB SRV issues)
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

/** Atlas: credentials in mongoose options (not in URI string) — avoids encoding/parsing issues. */
function getMongoConnectArgs() {
    const user = process.env.MONGO_USER?.trim();
    const pass = process.env.MONGO_PASSWORD?.trim();
    const hosts = process.env.MONGO_HOSTS?.trim();
    if (user && pass && hosts) {
        const db = process.env.MONGO_DB || 'agrovision';
        const replicaSet = process.env.MONGO_REPLICA_SET || 'atlas-13mgbq-shard-0';
        const uri = `mongodb://${hosts}/${db}?tls=true&replicaSet=${encodeURIComponent(replicaSet)}&authSource=admin&appName=Cluster0`;
        return {
            uri,
            opts: {
                user,
                pass,
                serverSelectionTimeoutMS: 10000,
                authSource: 'admin',
            },
        };
    }
    const fallback = process.env.MONGO_URI || 'mongodb://localhost:27017/agrovision';
    return { uri: fallback, opts: { serverSelectionTimeoutMS: 10000 } };
}

// Database Connection with retry logic and longer timeout for slower networks
const connectDB = async () => {
    const { uri, opts } = getMongoConnectArgs();
    try {
        await mongoose.connect(uri, opts);
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        if (String(err.message).includes('bad auth')) {
            console.log('💡 In Atlas → Database Access: confirm username (Youssef) and password match backend/.env; user must have "Read and write to any database" or built-in role.');
        }
        console.log('⚠️ Running in offline-first mode (some features may be limited)');
    }
};

connectDB();

// Basic Route
app.get('/', (req, res) => {
    res.send('AgroVision API is running...');
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

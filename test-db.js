const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

async function startTestDB() {
    console.log('🚀 Starting in-memory MongoDB...');
    
    mongoServer = await MongoMemoryServer.create({
        instance: {
            port: 27017, // Use standard port
            dbName: 'attendpro'
        }
    });
    
    const mongoUri = mongoServer.getUri();
    console.log('📍 MongoDB URI:', mongoUri);
    
    // Update .env file
    const fs = require('fs');
    let envContent = fs.readFileSync('.env.local', 'utf8');
    envContent = envContent.replace(
        'MONGODB_URI=mongodb://localhost:27017/attendpro',
        `MONGODB_URI=${mongoUri}attendpro`
    );
    fs.writeFileSync('.env', envContent);
    
    console.log('✅ In-memory MongoDB is running!');
    console.log('🌐 Ready to start AttendPro application');
    
    return mongoUri;
}

async function stopTestDB() {
    if (mongoServer) {
        await mongoServer.stop();
        console.log('🛑 In-memory MongoDB stopped');
    }
}

// Handle cleanup
process.on('SIGINT', async () => {
    await stopTestDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await stopTestDB();
    process.exit(0);
});

if (require.main === module) {
    startTestDB().catch(console.error);
}

module.exports = { startTestDB, stopTestDB };
#!/usr/bin/env node

/**
 * Local MongoDB Setup for AttendPro
 * Creates an in-memory MongoDB instance for local testing
 */

const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

console.log('🗄️ AttendPro Local Database Setup');
console.log('==================================\n');

// Check if MongoDB is installed locally
async function checkMongoInstallation() {
    try {
        await execPromise('mongod --version');
        console.log('✅ MongoDB is installed locally');
        return true;
    } catch (error) {
        console.log('❌ MongoDB not found locally');
        return false;
    }
}

// Install mongodb-memory-server for in-memory testing
async function setupMemoryDB() {
    try {
        console.log('📦 Installing MongoDB Memory Server...');
        await execPromise('npm install --save-dev mongodb-memory-server');
        console.log('✅ MongoDB Memory Server installed');
        return true;
    } catch (error) {
        console.log('❌ Failed to install MongoDB Memory Server:', error.message);
        return false;
    }
}

// Create test database setup
function createTestDBSetup() {
    const testDBScript = `const { MongoMemoryServer } = require('mongodb-memory-server');
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
        \`MONGODB_URI=\${mongoUri}attendpro\`
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

module.exports = { startTestDB, stopTestDB };`;

    fs.writeFileSync('test-db.js', testDBScript);
    console.log('✅ Created test database setup script');
}

// Create enhanced start script
function createEnhancedStartScript() {
    const startScript = `@echo off
echo 🚀 AttendPro Local Development Server
echo ====================================
echo.

echo 📋 Checking setup...
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo 🗄️ Setting up database...
node test-db.js &
timeout /t 3 /nobreak > nul

echo 🔧 Configuring environment...
copy .env.local .env 2>nul
echo Environment configured!

echo.
echo 🌐 Server URLs:
echo • Main App: http://localhost:3000
echo • Admin Panel: http://localhost:3000/admin-panel9920867077@AdilAbullahaUroojFatir
echo • Student Portal: http://localhost:3000/student-portal
echo • Health Check: http://localhost:3000/health
echo.

echo 🔑 Emergency Admin Login:
echo • Username: admin
echo • Password: AttendPro2024!
echo.

echo ⚡ Starting AttendPro...
npm run dev
pause`;

    fs.writeFileSync('start-local-enhanced.bat', startScript);
    console.log('✅ Created enhanced local startup script');
}

// Main setup function
async function main() {
    try {
        console.log('🔍 Checking MongoDB installation...');
        const mongoInstalled = await checkMongoInstallation();
        
        if (!mongoInstalled) {
            console.log('💾 Setting up in-memory MongoDB...');
            await setupMemoryDB();
        }
        
        createTestDBSetup();
        createEnhancedStartScript();
        
        console.log('\n🎉 Local Database Setup Complete!');
        console.log('===================================');
        console.log('Your AttendPro local development environment is ready!');
        console.log('\n📌 How to start:');
        console.log('• Run: start-local-enhanced.bat');
        console.log('• Or run: node test-db.js (then npm run dev in another terminal)');
        console.log('\n💡 Features:');
        console.log('• ✅ In-memory MongoDB (no installation needed)');
        console.log('• ✅ Automatic environment setup');
        console.log('• ✅ Emergency admin access configured');
        console.log('• ✅ All URLs displayed on startup');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n🔧 You can still use external MongoDB Atlas for local development');
    }
}

main();

#!/usr/bin/env node

/**
 * AttendPro One-Click Deployment Script
 * Automates the complete deployment process including database setup
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

console.log('🚀 AttendPro One-Click Deployment');
console.log('==================================\n');

// Generate secure session secret
function generateSessionSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
}

// Create production environment file
function createProductionEnv() {
    const sessionSecret = generateSessionSecret();
    
    const envContent = `NODE_ENV=production
PORT=3000
SESSION_SECRET=${sessionSecret}
TRUST_PROXY=true
FORCE_HTTPS=true
ENABLE_COMPRESSION=true
CACHE_STATIC_FILES=true
ENABLE_REGISTRATION=false
ENABLE_QR_CODE_GENERATION=true
ENABLE_BULK_OPERATIONS=true
LOG_LEVEL=warn
LOG_TO_FILE=true
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
ADMIN_RATE_LIMIT_MAX=3
DB_MAINTENANCE_ENABLED=true
EMERGENCY_ADMIN_USERNAME=admin
EMERGENCY_ADMIN_PASSWORD=AttendPro2024!
EMERGENCY_ADMIN_EMAIL=admin@attendpro.local
EMERGENCY_ADMIN_FULLNAME=AttendPro Administrator
EMERGENCY_SECRET=attendpro-emergency-2024`;

    fs.writeFileSync('.env.production', envContent);
    console.log('✅ Created production environment configuration');
    return sessionSecret;
}

// Create Vercel configuration
function createVercelConfig() {
    const vercelConfig = {
        "version": 2,
        "name": "attendpro",
        "builds": [
            {
                "src": "api/index.js",
                "use": "@vercel/node"
            }
        ],
        "routes": [
            {
                "src": "/api/(.*)",
                "dest": "/api/index.js"
            },
            {
                "src": "/(.*)",
                "dest": "/api/index.js"
            }
        ],
        "env": {
            "NODE_ENV": "production"
        },
        "functions": {
            "api/index.js": {
                "maxDuration": 30
            }
        }
    };
    
    fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
    console.log('✅ Updated Vercel configuration');
}

// Try to deploy to Vercel
async function deployToVercel() {
    try {
        console.log('🔄 Attempting Vercel deployment...\n');
        
        // Try to deploy
        const { stdout, stderr } = await execPromise('vercel --prod --yes');
        console.log('Vercel Output:', stdout);
        
        if (stderr && !stderr.includes('Warning')) {
            console.log('Vercel Warnings/Errors:', stderr);
        }
        
        return true;
    } catch (error) {
        console.log('❌ Vercel deployment failed:', error.message);
        return false;
    }
}

// Create local development setup
function createLocalSetup() {
    console.log('💻 Creating local development setup...\n');
    
    // Create local environment
    const localEnv = `NODE_ENV=development
PORT=3000
SESSION_SECRET=${generateSessionSecret()}
MONGODB_URI=mongodb://localhost:27017/attendpro
BASE_URL=http://localhost:3000
TRUST_PROXY=false
FORCE_HTTPS=false
ENABLE_COMPRESSION=true
CACHE_STATIC_FILES=true
ENABLE_REGISTRATION=false
ENABLE_QR_CODE_GENERATION=true
ENABLE_BULK_OPERATIONS=true
LOG_LEVEL=info
LOG_TO_FILE=true
EMERGENCY_ADMIN_USERNAME=admin
EMERGENCY_ADMIN_PASSWORD=AttendPro2024!
EMERGENCY_ADMIN_EMAIL=admin@attendpro.local
EMERGENCY_ADMIN_FULLNAME=AttendPro Administrator
EMERGENCY_SECRET=attendpro-emergency-2024`;

    fs.writeFileSync('.env.local', localEnv);
    console.log('✅ Created .env.local for local development');
    
    // Create start script
    const startScript = `@echo off
echo Starting AttendPro Development Server...
echo.
echo Setting up environment...
copy .env.local .env 2>nul
echo Environment configured!
echo.
echo Starting server on http://localhost:3000
echo Admin Panel: http://localhost:3000/admin-panel9920867077@AdilAbullahaUroojFatir
echo Student Portal: http://localhost:3000/student-portal
echo.
npm run dev
pause`;

    fs.writeFileSync('start-local.bat', startScript);
    console.log('✅ Created start-local.bat for easy local startup');
}

// Deploy to Railway via Git push
async function deployToRailway() {
    try {
        console.log('🚂 Preparing for Railway deployment...\n');
        
        // Make sure code is committed
        await execPromise('git add .');
        await execPromise('git commit -m "Ready for Railway deployment" || echo "No changes to commit"');
        await execPromise('git push origin main');
        
        console.log('✅ Code pushed to GitHub successfully');
        console.log('\n🚂 Railway Deployment Instructions:');
        console.log('===================================');
        console.log('1. Go to https://railway.app');
        console.log('2. Sign in with GitHub');
        console.log('3. Click "Deploy from GitHub repo"');
        console.log('4. Select "AbdullahAnsari103/ATTENDPRO"');
        console.log('5. Railway will automatically deploy!');
        console.log('\n📋 Environment Variables to Add in Railway:');
        
        // Display the environment variables
        const envContent = fs.readFileSync('.env.production', 'utf8');
        console.log(envContent);
        console.log('\n⚠️  ALSO ADD:');
        console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/attendpro');
        console.log('BASE_URL=https://your-app.up.railway.app');
        
        return true;
    } catch (error) {
        console.log('❌ Railway preparation failed:', error.message);
        return false;
    }
}

// Main deployment function
async function main() {
    try {
        console.log('🔧 Preparing deployment files...\n');
        
        // Create all necessary files
        createProductionEnv();
        createVercelConfig();
        createLocalSetup();
        
        console.log('\n🎯 Attempting automatic deployment...\n');
        
        // Try Vercel first
        const vercelSuccess = await deployToVercel();
        
        if (!vercelSuccess) {
            console.log('📦 Vercel deployment not available, preparing Railway...\n');
            await deployToRailway();
        }
        
        console.log('\n🎉 Deployment Setup Complete!');
        console.log('===============================');
        console.log('Your AttendPro application is ready!');
        console.log('\n📌 Quick Start Options:');
        console.log('• Local Development: Run "start-local.bat"');
        console.log('• Railway: Follow the Railway instructions above');
        console.log('• Vercel: Run "vercel login" then "vercel --prod"');
        
        console.log('\n🔑 Emergency Admin Access:');
        console.log('• Username: admin');
        console.log('• Password: AttendPro2024!');
        console.log('• Admin URL: /admin-panel9920867077@AdilAbullahaUroojFatir');
        
        console.log('\n🗄️ Database Setup Required:');
        console.log('• Free MongoDB Atlas: https://mongodb.com/atlas');
        console.log('• Create cluster → Get connection string');
        console.log('• Add to MONGODB_URI environment variable');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        console.log('\n🔧 Manual deployment options are still available!');
    }
}

// Run the deployment
main();

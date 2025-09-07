@echo off
echo 🚀 AttendPro Railway Deployment Script
echo =====================================

echo.
echo 📋 Prerequisites Check:
echo 1. MongoDB Atlas cluster created and connection string ready
echo 2. Railway account created and connected to GitHub
echo 3. GitHub repository updated with latest code
echo.

echo 🌐 Deployment Steps:
echo.
echo 1. Go to https://railway.app
echo 2. Click "Deploy from GitHub repo"
echo 3. Select: AbdullahAnsari103/ATTENPRO
echo 4. Add these environment variables:
echo.
echo NODE_ENV=production
echo MONGODB_URI=mongodb+srv://attendpro-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/attendpro
echo SESSION_SECRET=7676669c23b9ac3ed9a935f6bc7b46753b9bdbc3565c5280efff6605b903361fa47b4bdee869a87199eebad0b2673d47f36a0137aa6a6c548bf5d01d230ad1bd
echo BASE_URL=https://your-railway-domain.railway.app
echo TRUST_PROXY=true
echo FORCE_HTTPS=true
echo PORT=3000
echo ENABLE_QR_CODE_GENERATION=true
echo EMERGENCY_ADMIN_USERNAME=admin
echo EMERGENCY_ADMIN_PASSWORD=AttendPro2024!
echo EMERGENCY_ADMIN_EMAIL=admin@AttendPro
echo.
echo 5. Deploy and wait for completion
echo 6. Configure custom domain in Railway settings
echo 7. Access your application at the provided URL
echo.
echo 🎉 Your AttendPro application will be live!
echo.
echo 📝 Don't forget to:
echo - Create your permanent admin account
echo - Remove emergency credentials after setup
echo - Test all functionality
echo.
pause

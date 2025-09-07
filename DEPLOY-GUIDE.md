# 🚀 AttendPro Deployment Guide

## Overview
This guide will help you deploy your AttendPro application using Railway with the domain "AttendPro".

## Prerequisites
- [x] GitHub repository: https://github.com/AbdullahAnsari103/ATTENPRO
- [ ] MongoDB Atlas account
- [ ] Railway account

## Step 1: Database Setup (MongoDB Atlas)

### 1.1 Create MongoDB Atlas Account
1. Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Sign up for a free account
3. Create a new project named "AttendPro"

### 1.2 Create Database Cluster
1. Click "Create a Deployment"
2. Choose "M0 Sandbox" (Free forever)
3. Select a region close to your users
4. Name your cluster: `attendpro-cluster`

### 1.3 Configure Database Access
1. **Create Database User**:
   - Username: `attendpro-admin`
   - Password: Generate a secure password (save this!)
   - Built-in Role: `Atlas admin`

2. **Configure Network Access**:
   - Click "Network Access" in left sidebar
   - Click "Add IP Address"
   - Select "Allow access from anywhere" (`0.0.0.0/0`)
   - Confirm

### 1.4 Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string:
   ```
   mongodb+srv://attendpro-admin:<password>@attendpro-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. Add `/attendpro` at the end:
   ```
   mongodb+srv://attendpro-admin:YOUR_PASSWORD@attendpro-cluster.xxxxx.mongodb.net/attendpro?retryWrites=true&w=majority
   ```

## Step 2: Deploy to Railway

### 2.1 Create Railway Account
1. Go to [https://railway.app](https://railway.app)
2. Sign in with your GitHub account
3. Authorize Railway to access your repositories

### 2.2 Deploy Your Application
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository: `AbdullahAnsari103/ATTENPRO`
4. Railway will automatically detect it's a Node.js app

### 2.3 Configure Environment Variables
In Railway dashboard, go to Variables tab and add:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://attendpro-admin:YOUR_PASSWORD@attendpro-cluster.xxxxx.mongodb.net/attendpro?retryWrites=true&w=majority
SESSION_SECRET=7676669c23b9ac3ed9a935f6bc7b46753b9bdbc3565c5280efff6605b903361fa47b4bdee869a87199eebad0b2673d47f36a0137aa6a6c548bf5d01d230ad1bd
BASE_URL=https://your-railway-domain.railway.app
TRUST_PROXY=true
FORCE_HTTPS=true
SECURE_COOKIES=true
PORT=3000
HOST=0.0.0.0
ENABLE_QR_CODE_GENERATION=true
ENABLE_REGISTRATION=false
ENABLE_COMPRESSION=true
CACHE_STATIC_FILES=true
LOG_LEVEL=warn
LOG_TO_FILE=true
DB_MAINTENANCE_ENABLED=true
EMERGENCY_ADMIN_USERNAME=admin
EMERGENCY_ADMIN_PASSWORD=AttendPro2024!
EMERGENCY_ADMIN_EMAIL=admin@AttendPro
EMERGENCY_ADMIN_FULLNAME=AttendPro Administrator
EMERGENCY_SECRET=attendpro-emergency-2024
```

**Important**: Replace `your-railway-domain` with the actual domain Railway provides.

### 2.4 Deploy
1. Railway will automatically deploy after you add environment variables
2. Wait for deployment to complete (usually 2-5 minutes)
3. Check deployment logs for any errors

## Step 3: Configure Custom Domain

### 3.1 Get Railway Domain
1. In Railway dashboard, go to Settings > Domains
2. You'll see a domain like: `your-app-name.railway.app`
3. This is your application URL

### 3.2 Configure Custom Domain (Optional)
If you want to use "AttendPro" as a real domain:
1. Purchase the domain from a registrar
2. In Railway Settings > Domains
3. Click "Add Domain"
4. Enter your domain: `attendpro.com`
5. Configure DNS records as Railway instructs

## Step 4: Access Your Application

Your AttendPro application is now live at:
- **Main URL**: `https://your-railway-domain.railway.app`
- **Login Page**: `https://your-railway-domain.railway.app/login`
- **Admin Panel**: `https://your-railway-domain.railway.app/admin-panel9920867077@AdilAbullahaUroojFatir`
- **Student Portal**: `https://your-railway-domain.railway.app/student-portal`

## Step 5: Initial Setup

### 5.1 Create Admin Account
1. Visit your admin panel URL
2. Use emergency credentials:
   - Username: `admin`
   - Password: `AttendPro2024!`
3. Create your permanent admin account
4. **IMPORTANT**: Remove emergency credentials from Railway environment variables

### 5.2 Test Application
1. **Login System**: Test teacher/admin login
2. **Dashboard**: Check if dashboard loads correctly
3. **Class Management**: Create a test class
4. **Student Management**: Add test students
5. **QR Code Generation**: Verify QR codes generate properly
6. **Attendance Marking**: Test attendance functionality

## Step 6: Security Checklist

- [x] HTTPS enabled (automatic with Railway)
- [x] Session secret configured
- [x] Database credentials secured
- [x] Rate limiting enabled
- [x] Input validation active
- [x] Security headers configured
- [x] Error handling secured
- [ ] Emergency admin credentials removed
- [ ] Regular security updates scheduled

## Step 7: Maintenance

### 7.1 Updates
To update your application:
1. Push changes to GitHub
2. Railway will automatically redeploy
3. Monitor deployment logs

### 7.2 Database Backup
- MongoDB Atlas provides automatic backups
- Consider setting up additional backup strategies for production

### 7.3 Monitoring
- Check Railway deployment logs regularly
- Monitor application performance
- Set up alerts for critical errors

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MongoDB URI format
   - Verify IP whitelist includes 0.0.0.0/0
   - Confirm database user credentials

2. **Application Won't Start**
   - Check Railway deployment logs
   - Verify all required environment variables are set
   - Ensure MongoDB connection string is correct

3. **Admin Panel Access Issues**
   - Verify admin panel URL is correct
   - Check emergency admin credentials
   - Ensure user has admin privileges

4. **QR Code Generation Issues**
   - Verify ENABLE_QR_CODE_GENERATION=true
   - Check if qrcode package is installed
   - Review application logs for errors

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Review application logs in Railway console
3. Verify environment variables are correctly set
4. Test database connection separately

## Success! 🎉

Your AttendPro application is now deployed and ready for production use!

### Next Steps:
1. ✅ Create your admin account
2. ✅ Add teachers and classes
3. ✅ Configure student access
4. ✅ Test all functionality
5. ✅ Remove emergency credentials
6. ✅ Set up monitoring and backups

---

**Security Note**: Always keep your environment variables secure and never commit sensitive information to version control.

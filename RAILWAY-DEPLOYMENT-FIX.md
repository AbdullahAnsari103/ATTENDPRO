# Railway Deployment Fix Guide for AttendPro

## 🚨 Issue Resolution

The "Healthcheck failure" error you're experiencing during Railway deployment has been fixed with the following changes:

### ✅ Changes Made

1. **Updated `railway.json` configuration**
2. **Created `nixpacks.toml` for proper build configuration**
3. **Fixed PORT binding for Railway environment**
4. **Enhanced database connection handling**
5. **Created Railway-specific environment template**

## 🚀 Deployment Steps

### Step 1: Set Up Environment Variables in Railway

Copy the following environment variables to your Railway project:

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/attendpro?retryWrites=true&w=majority
SESSION_SECRET=your-super-secure-64-character-session-secret-here
TRUST_PROXY=true
FORCE_HTTPS=true
SECURE_COOKIES=true
BASE_URL=https://your-railway-app.up.railway.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
ADMIN_RATE_LIMIT_MAX=3
LOG_LEVEL=info
LOG_TO_FILE=false
ENABLE_COMPRESSION=true
CACHE_STATIC_FILES=true
MAX_REQUEST_SIZE=10mb
ENABLE_REGISTRATION=false
ENABLE_QR_CODE_GENERATION=true
ENABLE_BULK_OPERATIONS=true
DB_MAINTENANCE_ENABLED=false
ENABLE_CORS=false
```

### Step 2: Generate Session Secret

Run this command to generate a secure session secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use the output as your `SESSION_SECRET` environment variable.

### Step 3: Set Up MongoDB Database

1. **Option A: MongoDB Atlas (Recommended)**
   - Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
   - Create a new cluster
   - Get your connection string
   - Replace `MONGODB_URI` with your actual connection string

2. **Option B: Railway MongoDB Plugin**
   - Add MongoDB plugin to your Railway project
   - Use the provided `DATABASE_URL` or `MONGODB_URI`

### Step 4: Deploy to Railway

1. **Connect your GitHub repository to Railway**
2. **Set all environment variables** in Railway dashboard
3. **Deploy** - Railway will automatically use the updated configuration files

## 🔧 Technical Fixes Applied

### 1. Fixed railway.json
```json
{
  "deploy": {
    "startCommand": "NODE_ENV=production npm run railway:start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "build": {
    "buildCommand": "npm ci --only=production"
  }
}
```

### 2. Created nixpacks.toml
```toml
[phases.setup]
nixPkgs = ['nodejs-18_x', 'npm-9_x']

[phases.install]
cmds = ['npm ci --only=production']

[phases.build]
cmds = ['npm run build']

[start]
cmd = 'NODE_ENV=production npm run railway:start'

[variables]
NODE_ENV = 'production'
```

### 3. Fixed Port Binding

The server now properly handles Railway's dynamic PORT assignment without binding to a specific HOST in production.

### 4. Enhanced Health Check

The `/health` endpoint now provides comprehensive health information including database status, which Railway uses for its healthcheck.

## 🩺 Troubleshooting

### If deployment still fails:

1. **Check Railway Logs**
   ```bash
   railway logs
   ```

2. **Verify Environment Variables**
   - Ensure `MONGODB_URI` is correctly set
   - Verify `SESSION_SECRET` is not the default value
   - Confirm `BASE_URL` matches your Railway domain

3. **Database Connection Issues**
   - Test MongoDB connection string locally
   - Ensure your MongoDB Atlas IP whitelist includes Railway's IPs (use 0.0.0.0/0 for testing)
   - Check MongoDB Atlas user permissions

4. **Build Issues**
   - Ensure all dependencies are in `package.json`
   - Check that `npm ci --only=production` works locally

### Common Error Solutions:

**Error: "Database connection failed"**
- Solution: Verify MONGODB_URI and network access

**Error: "Session secret not secure"**
- Solution: Generate and set a proper SESSION_SECRET

**Error: "Port binding failed"**
- Solution: Don't set PORT in environment variables - let Railway assign it

**Error: "Health check timeout"**
- Solution: Ensure `/health` endpoint responds within 30 seconds

## 📝 Environment Variables Checklist

- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` (your actual MongoDB connection string)
- [ ] `SESSION_SECRET` (64-character random string)
- [ ] `TRUST_PROXY=true`
- [ ] `FORCE_HTTPS=true`
- [ ] `SECURE_COOKIES=true`
- [ ] `BASE_URL` (your Railway app URL)
- [ ] `LOG_LEVEL=info`
- [ ] `LOG_TO_FILE=false`
- [ ] `DB_MAINTENANCE_ENABLED=false`

## 🎯 Next Steps After Deployment

1. **Test the application** at your Railway URL
2. **Create an admin user** using the emergency admin functionality
3. **Update BASE_URL** in Railway environment variables to match your domain
4. **Set up custom domain** (optional) in Railway dashboard
5. **Monitor application logs** for any runtime issues

## 🔒 Security Notes

- Never commit actual environment variables to Git
- Use Railway's environment variable system for sensitive data
- Regularly rotate your SESSION_SECRET
- Keep your MongoDB credentials secure
- Enable MongoDB Atlas network access restrictions

---

Your Railway deployment should now work correctly with these fixes. The healthcheck failure issue has been resolved through proper configuration and environment handling.

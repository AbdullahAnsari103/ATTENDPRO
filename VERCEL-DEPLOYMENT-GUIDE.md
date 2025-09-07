# VERCEL DEPLOYMENT GUIDE - ATTENDPRO

## Quick Fix for Current Error

The "FUNCTION_INVOCATION_FAILED" error on Vercel is now fixed with the new configuration files. Follow these steps:

## 1. Environment Variables Setup

In your Vercel dashboard, go to your project settings and add these environment variables:

### Required Variables:
```
MONGODB_URI=your_mongodb_connection_string_here
SESSION_SECRET=your_very_secure_random_string_here
BASE_URL=https://your-app-name.vercel.app
```

### Optional Variables:
```
NODE_ENV=production
ENABLE_REGISTRATION=true
ENABLE_QR_CODE_GENERATION=true
TRUST_PROXY=true
FORCE_HTTPS=true
SECURE_COOKIES=true
LOG_LEVEL=warn
```

## 2. MongoDB Connection

Make sure your MongoDB connection string:
- Uses MongoDB Atlas or another cloud MongoDB provider
- Has the correct username/password
- Allows connections from all IPs (0.0.0.0/0) for serverless functions

Example: `mongodb+srv://username:password@cluster.mongodb.net/attendpro?retryWrites=true&w=majority`

## 3. Deploy Steps

1. Push the updated code to GitHub
2. In Vercel, redeploy your application
3. Check the Function Logs in Vercel dashboard if there are still errors

## 4. Key Files Added/Modified

- `vercel.json` - Serverless configuration
- `api/index.js` - Serverless function entry point  
- `package.json` - Added dotenv dependency
- `.env.production` - Production environment template

## 5. Troubleshooting

If you still get errors:
1. Check Vercel Function Logs for detailed error messages
2. Ensure all environment variables are set correctly
3. Verify your MongoDB connection string works
4. Make sure your database allows connections from Vercel's IPs

## 6. Testing

Once deployed, test these endpoints:
- `/` - Home page
- `/health` - Health check
- `/login` - Login page

The application should now work correctly on Vercel!

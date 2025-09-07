const path = require('path');
const fs = require('fs');

// Load environment variables from .env file if it exists
const loadEnvironmentFile = () => {
    const envPath = path.join(__dirname, '../.env');
    
    if (fs.existsSync(envPath)) {
        try {
            require('dotenv').config({ path: envPath });
            console.log('✅ Environment variables loaded from .env file');
        } catch (error) {
            console.warn('⚠️  Failed to load .env file:', error.message);
        }
    }
};

// Environment variable validation and defaults
const validateEnvironment = () => {
    const required = [];
    const warnings = [];
    const config = {};

    // Core application settings
    config.NODE_ENV = process.env.NODE_ENV || 'development';
    config.PORT = parseInt(process.env.PORT) || 3000;
    config.HOST = process.env.HOST || '0.0.0.0';

    // Database configuration
    config.MONGODB_URI = process.env.MONGODB_URI;
    if (!config.MONGODB_URI) {
        if (config.NODE_ENV === 'production') {
            required.push('MONGODB_URI - Database connection string required in production');
        } else {
            config.MONGODB_URI = 'mongodb://127.0.0.1:27017/attendpro';
            warnings.push('MONGODB_URI not set, using default local database');
        }
    }

    // Session configuration
    config.SESSION_SECRET = process.env.SESSION_SECRET;
    if (!config.SESSION_SECRET) {
        if (config.NODE_ENV === 'production') {
            required.push('SESSION_SECRET - Cryptographically strong session secret required in production');
        } else {
            config.SESSION_SECRET = 'dev-secret-change-in-production';
            warnings.push('SESSION_SECRET not set, using insecure default for development');
        }
    }

    // Security settings
    config.TRUST_PROXY = process.env.TRUST_PROXY === 'true';
    config.FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';
    config.SECURE_COOKIES = config.NODE_ENV === 'production' || process.env.SECURE_COOKIES === 'true';

    // Rate limiting configuration
    config.RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
    config.RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
    config.AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5;
    config.ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX) || 3;

    // Logging configuration
    config.LOG_LEVEL = process.env.LOG_LEVEL || (config.NODE_ENV === 'production' ? 'warn' : 'info');
    config.LOG_TO_FILE = process.env.LOG_TO_FILE !== 'false';
    config.LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');

    // File upload limits
    config.MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5242880; // 5MB
    config.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

    // Email configuration (optional)
    config.SMTP_HOST = process.env.SMTP_HOST;
    config.SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
    config.SMTP_USER = process.env.SMTP_USER;
    config.SMTP_PASS = process.env.SMTP_PASS;
    config.EMAIL_FROM = process.env.EMAIL_FROM;

    // External service URLs
    config.BASE_URL = process.env.BASE_URL || `http://localhost:${config.PORT}`;
    if (config.NODE_ENV === 'production' && config.BASE_URL.startsWith('http://localhost')) {
        warnings.push('BASE_URL should be set to your production domain');
    }

    // Admin configuration (for emergency access)
    config.EMERGENCY_ADMIN_USERNAME = process.env.EMERGENCY_ADMIN_USERNAME;
    config.EMERGENCY_ADMIN_PASSWORD = process.env.EMERGENCY_ADMIN_PASSWORD;
    config.EMERGENCY_ADMIN_EMAIL = process.env.EMERGENCY_ADMIN_EMAIL;
    config.EMERGENCY_ADMIN_FULLNAME = process.env.EMERGENCY_ADMIN_FULLNAME;
    config.EMERGENCY_SECRET = process.env.EMERGENCY_SECRET;

    // Feature flags
    config.ENABLE_REGISTRATION = process.env.ENABLE_REGISTRATION !== 'false';
    config.ENABLE_EMAIL_NOTIFICATIONS = process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true';
    config.ENABLE_QR_CODE_GENERATION = process.env.ENABLE_QR_CODE_GENERATION !== 'false';
    config.ENABLE_BULK_OPERATIONS = process.env.ENABLE_BULK_OPERATIONS !== 'false';

    // Database maintenance
    config.DB_MAINTENANCE_ENABLED = process.env.DB_MAINTENANCE_ENABLED !== 'false';
    config.DB_MAINTENANCE_INTERVAL = parseInt(process.env.DB_MAINTENANCE_INTERVAL) || 86400000; // 24 hours

    // Performance settings
    config.ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION !== 'false';
    config.CACHE_STATIC_FILES = process.env.CACHE_STATIC_FILES !== 'false';
    config.MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';

    // Development settings
    config.ENABLE_DEBUG = config.NODE_ENV === 'development' || process.env.ENABLE_DEBUG === 'true';
    config.ENABLE_CORS = process.env.ENABLE_CORS === 'true';
    config.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

    // Return validation results
    return {
        config,
        required,
        warnings,
        isValid: required.length === 0
    };
};

// Initialize environment configuration
const initializeEnvironment = () => {
    // Load .env file if present
    loadEnvironmentFile();

    // Validate and configure environment
    const { config, required, warnings, isValid } = validateEnvironment();

    // Handle validation results
    if (!isValid) {
        console.error('❌ Environment Configuration Errors:');
        required.forEach(error => console.error(`  • ${error}`));
        console.error('\n💡 Please set the required environment variables and restart the application.');
        process.exit(1);
    }

    if (warnings.length > 0) {
        console.warn('⚠️  Environment Configuration Warnings:');
        warnings.forEach(warning => console.warn(`  • ${warning}`));
        console.warn('');
    }

    // Create required directories
    const dirs = [config.LOG_DIR, config.UPLOAD_DIR];
    dirs.forEach(dir => {
        if (dir && !fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            } catch (error) {
                console.error(`❌ Failed to create directory ${dir}:`, error.message);
            }
        }
    });

    // Log configuration summary
    console.log('🚀 Environment Configuration:');
    console.log(`  • Environment: ${config.NODE_ENV}`);
    console.log(`  • Port: ${config.PORT}`);
    console.log(`  • Database: ${config.MONGODB_URI.includes('localhost') ? 'Local MongoDB' : 'Remote MongoDB'}`);
    console.log(`  • Session Security: ${config.SESSION_SECRET === 'dev-secret-change-in-production' ? 'Development' : 'Production'}`);
    console.log(`  • HTTPS Enforced: ${config.FORCE_HTTPS}`);
    console.log(`  • Logging Level: ${config.LOG_LEVEL}`);
    console.log('');

    return config;
};

// Get environment-specific database URI
const getDatabaseURI = (config) => {
    if (config.NODE_ENV === 'test') {
        return config.MONGODB_URI.replace(/\/[^/]*$/, '/attendpro_test');
    }
    return config.MONGODB_URI;
};

// Get session store configuration
const getSessionStoreConfig = (config) => {
    if (config.NODE_ENV === 'production') {
        // Use MongoDB session store in production
        return {
            store: 'mongodb',
            uri: getDatabaseURI(config),
            options: {
                touchAfter: 24 * 3600 // Lazy session update
            }
        };
    } else {
        // Use memory store in development
        return {
            store: 'memory',
            options: {}
        };
    }
};

// Environment-specific security settings
const getSecurityConfig = (config) => ({
    helmet: {
        enabled: true,
        contentSecurityPolicy: config.NODE_ENV === 'production',
        hsts: config.NODE_ENV === 'production',
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'same-origin' }
    },
    cors: {
        enabled: config.ENABLE_CORS,
        origin: config.NODE_ENV === 'production' ? config.BASE_URL : config.CORS_ORIGIN,
        credentials: true,
        optionsSuccessStatus: 200
    },
    rateLimit: {
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        max: config.RATE_LIMIT_MAX_REQUESTS,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    }
});

module.exports = {
    initializeEnvironment,
    validateEnvironment,
    getDatabaseURI,
    getSessionStoreConfig,
    getSecurityConfig,
    loadEnvironmentFile
};

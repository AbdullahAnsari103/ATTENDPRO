const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: {
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
});

// General rate limiting - 100 requests per 15 minutes
const generalLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100,
    'Too many requests from this IP, please try again later.'
);

// Auth rate limiting - 5 login attempts per 15 minutes
const authLimiter = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5,
    'Too many login attempts from this IP, please try again after 15 minutes.'
);

// Admin rate limiting - 3 admin attempts per hour
const adminLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    3,
    'Too many admin access attempts. Please try again later.'
);

// API rate limiting - 50 requests per 10 minutes for API endpoints
const apiLimiter = createRateLimit(
    10 * 60 * 1000, // 10 minutes
    50,
    'API rate limit exceeded. Please slow down your requests.'
);

// Strict rate limiting for sensitive operations
const strictLimiter = createRateLimit(
    60 * 60 * 1000, // 1 hour
    10,
    'Too many sensitive operations. Please try again later.'
);

// Security headers configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
};

// Security middleware setup
const setupSecurity = (app) => {
    // Basic security headers
    app.use(helmet(helmetConfig));
    
    // Sanitize MongoDB queries
    app.use(mongoSanitize({
        replaceWith: '_'
    }));
    
    // General rate limiting
    app.use(generalLimiter);
    
    // Auth specific rate limiting
    app.use('/login', authLimiter);
    app.use('/register', authLimiter);
    
    // Admin specific rate limiting
    app.use('/admin-panel9920867077@AdilAbullahaUroojFatir', adminLimiter);
    app.use('/admin', strictLimiter);
    
    // API endpoints rate limiting
    app.use('/api', apiLimiter);
    
    // Trust proxy (for accurate IP addresses behind reverse proxy)
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }
    
    console.log('🔒 Security middleware configured');
};

module.exports = {
    setupSecurity,
    generalLimiter,
    authLimiter,
    adminLimiter,
    apiLimiter,
    strictLimiter
};

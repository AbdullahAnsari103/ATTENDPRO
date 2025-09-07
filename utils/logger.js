const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        
        return msg;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    defaultMeta: { 
        service: 'attendpro',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: fileFormat
        }),
        
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: fileFormat
        }),
        
        // Security log file
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: fileFormat
        })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880,
            maxFiles: 5
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Security logger for audit trail
const securityLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'security-audit.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10
        })
    ]
});

// Request logger middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request details
    const requestData = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        sessionId: req.sessionID,
        userId: req.user ? req.user._id : null,
        userRole: req.user ? req.user.ROLE : null
    };
    
    logger.info('HTTP Request', requestData);
    
    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const responseData = {
            ...requestData,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        };
        
        if (res.statusCode >= 400) {
            logger.warn('HTTP Error Response', responseData);
        } else {
            logger.info('HTTP Response', responseData);
        }
    });
    
    next();
};

// Security event logger
const logSecurityEvent = (eventType, details, req = null) => {
    const securityEvent = {
        eventType,
        timestamp: new Date().toISOString(),
        details,
        ip: req ? (req.ip || req.connection.remoteAddress) : null,
        userAgent: req ? req.headers['user-agent'] : null,
        sessionId: req ? req.sessionID : null,
        userId: req && req.user ? req.user._id : null,
        userRole: req && req.user ? req.user.ROLE : null
    };
    
    securityLogger.warn('Security Event', securityEvent);
    logger.warn(`🚨 Security Event: ${eventType}`, securityEvent);
};

// Authentication event logger
const logAuthEvent = (eventType, userId, username, success, req, details = {}) => {
    const authEvent = {
        eventType,
        userId,
        username,
        success,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        details
    };
    
    if (success) {
        logger.info(`✅ Auth Success: ${eventType}`, authEvent);
    } else {
        logger.warn(`🚨 Auth Failure: ${eventType}`, authEvent);
        logSecurityEvent(`AUTH_FAILURE_${eventType.toUpperCase()}`, authEvent, req);
    }
};

// Admin action logger
const logAdminAction = (action, details, req) => {
    const adminEvent = {
        action,
        adminId: req.user._id,
        adminUsername: req.user.USERNAME,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        details
    };
    
    logger.info(`👑 Admin Action: ${action}`, adminEvent);
    securityLogger.info('Admin Action', adminEvent);
};

// Database operation logger
const logDatabaseOperation = (operation, collection, details = {}) => {
    const dbEvent = {
        operation,
        collection,
        timestamp: new Date().toISOString(),
        details
    };
    
    logger.info(`🗄️  Database Operation: ${operation}`, dbEvent);
};

// Error logger with stack trace
const logError = (error, req = null, additionalInfo = {}) => {
    const errorData = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: req ? req.url : null,
        method: req ? req.method : null,
        ip: req ? (req.ip || req.connection.remoteAddress) : null,
        userId: req && req.user ? req.user._id : null,
        ...additionalInfo
    };
    
    logger.error('🔥 Application Error', errorData);
};

// Performance logger
const logPerformance = (operation, duration, details = {}) => {
    const performanceData = {
        operation,
        duration,
        timestamp: new Date().toISOString(),
        details
    };
    
    if (duration > 1000) {
        logger.warn(`⚠️  Slow Operation: ${operation}`, performanceData);
    } else {
        logger.info(`⚡ Performance: ${operation}`, performanceData);
    }
};

// Cleanup old log files (run periodically)
const cleanupLogs = () => {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();
    
    fs.readdir(logsDir, (err, files) => {
        if (err) {
            logger.error('Error reading logs directory', { error: err.message });
            return;
        }
        
        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlink(filePath, (err) => {
                        if (!err) {
                            logger.info(`🗑️  Cleaned up old log file: ${file}`);
                        }
                    });
                }
            });
        });
    });
};

// Run cleanup once a day
setInterval(cleanupLogs, 24 * 60 * 60 * 1000);

module.exports = {
    logger,
    securityLogger,
    requestLogger,
    logSecurityEvent,
    logAuthEvent,
    logAdminAction,
    logDatabaseOperation,
    logError,
    logPerformance,
    cleanupLogs
};

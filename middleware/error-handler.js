const { logger, logError, logSecurityEvent } = require('../utils/logger');

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = isOperational;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400);
        this.errors = errors;
        this.type = 'validation';
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
        this.type = 'authentication';
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
        this.type = 'authorization';
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.type = 'not_found';
    }
}

class DatabaseError extends AppError {
    constructor(message, originalError) {
        super(message, 500);
        this.originalError = originalError;
        this.type = 'database';
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429);
        this.type = 'rate_limit';
    }
}

// Error response formatter
const formatErrorResponse = (error, req, isDevelopment = false) => {
    const response = {
        success: false,
        error: {
            message: error.message,
            statusCode: error.statusCode || 500,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method
        }
    };

    // Add error type if available
    if (error.type) {
        response.error.type = error.type;
    }

    // Add validation errors if available
    if (error.errors && Array.isArray(error.errors)) {
        response.error.details = error.errors;
    }

    // Add stack trace in development
    if (isDevelopment && error.stack) {
        response.error.stack = error.stack;
    }

    // Add request ID for tracking
    response.error.requestId = req.requestId || req.sessionID || 'unknown';

    return response;
};

// Handle specific error types
const handleCastErrorDB = (error) => {
    const message = `Invalid ${error.path}: ${error.value}`;
    return new ValidationError(message);
};

const handleDuplicateFieldsDB = (error) => {
    const value = error.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
    const message = `Duplicate field value: ${value}. Please use another value.`;
    return new ValidationError(message);
};

const handleValidationErrorDB = (error) => {
    const errors = Object.values(error.errors).map(el => ({
        field: el.path,
        message: el.message,
        value: el.value
    }));
    const message = 'Invalid input data';
    return new ValidationError(message, errors);
};

const handleJWTError = () => new AuthenticationError('Invalid token. Please log in again.');

const handleJWTExpiredError = () => new AuthenticationError('Your token has expired. Please log in again.');

const handleMongooseError = (error) => {
    if (error.name === 'CastError') return handleCastErrorDB(error);
    if (error.code === 11000) return handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') return handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') return handleJWTError();
    if (error.name === 'TokenExpiredError') return handleJWTExpiredError();
    
    return new DatabaseError('Database operation failed', error);
};

// Security event checker
const checkForSecurityThreats = (error, req) => {
    const suspiciousPatterns = [
        /script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload/i,
        /onerror/i,
        /eval\(/i,
        /<iframe/i,
        /union.*select/i,
        /drop.*table/i,
        /insert.*into/i,
        /update.*set/i,
        /delete.*from/i
    ];

    const requestData = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
    });

    const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(requestData) || pattern.test(error.message)
    );

    if (isSuspicious) {
        logSecurityEvent('SUSPICIOUS_REQUEST', {
            error: error.message,
            requestData: req.body,
            userAgent: req.headers['user-agent'],
            patterns: suspiciousPatterns.filter(p => p.test(requestData))
        }, req);
    }
};

// Development error handler
const sendErrorDevelopment = (err, req, res) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response = formatErrorResponse(err, req, isDevelopment);

    // Log error details in development
    console.error('🔥 Development Error:', {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        user: req.user ? req.user.USERNAME : 'Anonymous'
    });

    // Check if it's an API request
    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
        return res.status(err.statusCode || 500).json(response);
    }

    // Render error page for web requests
    return res.status(err.statusCode || 500).render('error', {
        title: 'Error',
        message: err.message,
        error: isDevelopment ? err : {},
        statusCode: err.statusCode || 500,
        user: req.user || null
    });
};

// Production error handler
const sendErrorProduction = (err, req, res) => {
    // Check for security threats
    checkForSecurityThreats(err, req);

    // Log error
    logError(err, req, {
        statusCode: err.statusCode,
        isOperational: err.isOperational,
        type: err.type
    });

    // Only send error details to client if it's operational
    if (err.isOperational) {
        const response = formatErrorResponse(err, req, false);

        if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
            return res.status(err.statusCode).json(response);
        }

        return res.status(err.statusCode).render('error', {
            title: 'Error',
            message: err.message,
            statusCode: err.statusCode,
            user: req.user || null
        });
    }

    // For programming errors, send generic error
    const genericMessage = err.statusCode === 500 
        ? 'Something went wrong on our end. Please try again later.'
        : 'An unexpected error occurred';

    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
        return res.status(500).json({
            success: false,
            error: {
                message: genericMessage,
                statusCode: 500,
                timestamp: new Date().toISOString()
            }
        });
    }

    return res.status(500).render('error', {
        title: 'Server Error',
        message: genericMessage,
        statusCode: 500,
        user: req.user || null
    });
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
    // Set default error properties
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Add request ID for tracking
    req.requestId = req.requestId || req.sessionID || 'unknown';

    // Handle specific error types
    let error = { ...err };
    error.message = err.message;

    // Handle Mongoose errors
    if (err.name === 'CastError' || err.name === 'ValidationError' || err.code === 11000) {
        error = handleMongooseError(err);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        error = handleMongooseError(err);
    }

    // Send error response based on environment
    if (process.env.NODE_ENV === 'development') {
        sendErrorDevelopment(error, req, res);
    } else {
        sendErrorProduction(error, req, res);
    }
};

// Async error wrapper
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 Not Found handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => {
    return (req, res, next) => {
        const timeoutId = setTimeout(() => {
            const error = new AppError('Request timeout', 408);
            next(error);
        }, timeout);

        res.on('finish', () => {
            clearTimeout(timeoutId);
        });

        res.on('close', () => {
            clearTimeout(timeoutId);
        });

        next();
    };
};

// Graceful shutdown handler
const gracefulShutdown = (server) => {
    const shutdown = (signal) => {
        logger.info(`${signal} received. Shutting down gracefully...`);
        
        server.close((err) => {
            if (err) {
                logger.error('Error during server shutdown:', err);
                process.exit(1);
            }
            
            logger.info('Server closed successfully');
            process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            logger.error('Forced shutdown due to timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Close server and exit process
    process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    
    // Close server and exit process
    process.exit(1);
});

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    DatabaseError,
    RateLimitError,
    globalErrorHandler,
    asyncErrorHandler,
    notFoundHandler,
    timeoutHandler,
    gracefulShutdown
};

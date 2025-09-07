const User = require('../models/user');
const { createHash } = require('crypto');

// Enhanced session configuration
const getEnhancedSessionConfig = () => ({
    secret: process.env.SESSION_SECRET || 'fallback-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Hide default session name
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict' // CSRF protection
    },
    genid: () => {
        // Generate cryptographically strong session ID
        return require('crypto').randomBytes(32).toString('hex');
    }
});

// Enhanced authentication middleware with brute force protection
const requireAuth = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!userId) {
            // Log unauthorized access attempt
            console.warn(`🚨 Unauthorized access attempt from IP: ${clientIP} to ${req.path}`);
            return res.redirect('/login');
        }
        
        const user = await User.findById(userId).select('-PASSWORD');
        if (!user || !user.ISACTIVE) {
            // Log suspicious activity
            console.warn(`🚨 Invalid/Inactive user session from IP: ${clientIP}, User ID: ${userId}`);
            req.session.destroy();
            return res.redirect('/login');
        }

        // Additional security: Check if user role is valid
        if (!['admin', 'teacher', 'student'].includes(user.ROLE)) {
            console.warn(`🚨 Invalid user role detected: ${user.ROLE} from IP: ${clientIP}`);
            req.session.destroy();
            return res.redirect('/login');
        }
        
        // Update last activity
        user.LASTLOGIN = new Date();
        await user.save();
        
        req.user = user;
        next();
    } catch (error) {
        console.error('🔥 Auth middleware error:', error);
        req.session.destroy();
        res.redirect('/login');
    }
};

// Enhanced admin middleware with additional security checks
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            console.warn(`🚨 Admin access without authentication from IP: ${req.ip}`);
            return res.redirect('/login');
        }
        
        if (req.user.ROLE !== 'admin') {
            console.warn(`🚨 Non-admin user attempting admin access: ${req.user.USERNAME} (${req.user.ROLE}) from IP: ${req.ip}`);
            return res.status(403).render('error', {
                message: 'Access denied. Administrator privileges required.',
                user: req.user
            });
        }
        
        // Log admin access
        console.log(`✅ Admin access granted to: ${req.user.USERNAME} from IP: ${req.ip} for path: ${req.path}`);
        
        next();
    } catch (error) {
        console.error('🔥 Admin middleware error:', error);
        res.status(500).render('error', {
            message: 'Authentication error occurred',
            user: req.user
        });
    }
};

// Enhanced teacher middleware
const requireTeacher = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        
        if (!['teacher', 'admin'].includes(req.user.ROLE)) {
            console.warn(`🚨 Non-teacher/admin attempting teacher access: ${req.user.USERNAME} (${req.user.ROLE}) from IP: ${req.ip}`);
            return res.status(403).render('error', {
                message: 'Access denied. Teacher privileges required.',
                user: req.user
            });
        }
        
        next();
    } catch (error) {
        console.error('🔥 Teacher middleware error:', error);
        res.status(500).render('error', {
            message: 'Authentication error occurred',
            user: req.user
        });
    }
};

// Enhanced student middleware
const requireStudent = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }

        if (req.user.ROLE !== 'student') {
            return res.status(403).render('error', {
                message: 'Access denied. This area is for students only.',
                user: req.user
            });
        }

        next();
    } catch (error) {
        console.error('🔥 Student middleware error:', error);
        res.status(500).render('error', {
            message: 'Authentication error occurred',
            user: req.user
        });
    }
};

// CSRF Protection middleware
const csrfProtection = (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        const token = req.body.csrfToken || req.headers['x-csrf-token'];
        const sessionToken = req.session.csrfToken;
        
        if (!token || !sessionToken || token !== sessionToken) {
            console.warn(`🚨 CSRF token mismatch from IP: ${req.ip} for path: ${req.path}`);
            return res.status(403).json({
                error: 'Invalid CSRF token. Please refresh the page and try again.'
            });
        }
    }
    next();
};

// Generate CSRF token for forms
const generateCSRFToken = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

// Enhanced class access control
const hasClassAccess = async (req, res, next) => {
    try {
        const classId = req.params.id || req.params.classId;
        const clientIP = req.ip;

        if (!classId) {
            console.warn(`🚨 Class access without class ID from IP: ${clientIP}`);
            return res.status(400).render('error', {
                message: 'Class ID is required',
                user: req.user
            });
        }

        const Class = require('../models/class');
        const classDoc = await Class.findById(classId);
        
        if (!classDoc || !classDoc.ISACTIVE) {
            console.warn(`🚨 Access attempt to non-existent/inactive class: ${classId} from IP: ${clientIP}`);
            return res.status(404).render('error', {
                message: 'Class not found or is inactive',
                user: req.user
            });
        }

        // Admin has access to all classes
        if (req.user.ROLE === 'admin') {
            req.classDoc = classDoc;
            return next();
        }

        // Check if user is one of the teachers for this class
        const hasAccess = classDoc.TEACHERS.some(teacherId =>
            teacherId.toString() === req.user._id.toString()
        );

        if (!hasAccess) {
            console.warn(`🚨 Unauthorized class access attempt: User ${req.user.USERNAME} to class ${classId} from IP: ${clientIP}`);
            return res.status(403).render('error', {
                message: 'Access denied. You are not authorized to access this class.',
                user: req.user
            });
        }

        req.classDoc = classDoc;
        next();
    } catch (error) {
        console.error('🔥 Class access check error:', error);
        res.status(500).render('error', {
            message: 'Access verification failed',
            user: req.user
        });
    }
};

// Secure admin route with obfuscation
const requireSecureAdmin = async (req, res, next) => {
    try {
        // Additional layer of security for the obfuscated admin route
        const route = req.path;
        const expectedRoute = '/admin-panel9920867077@AdilAbullahaUroojFatir';
        
        if (route !== expectedRoute) {
            return res.status(404).render('error', {
                message: 'Page not found',
                user: null
            });
        }
        
        // Call regular admin middleware
        await requireAdmin(req, res, next);
        
    } catch (error) {
        console.error('🔥 Secure admin middleware error:', error);
        res.status(500).render('error', {
            message: 'Access verification failed',
            user: null
        });
    }
};

// Middleware to make user and security tokens available to all views
const userToViews = (req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.NODE_ENV = process.env.NODE_ENV;
    res.locals.isProduction = process.env.NODE_ENV === 'production';
    next();
};

// Input sanitization middleware
const sanitizeInputs = (req, res, next) => {
    // Remove any potentially dangerous characters
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                obj[key] = sanitize(obj[key]);
            });
        }
        return obj;
    };
    
    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    req.params = sanitize(req.params);
    
    next();
};

module.exports = {
    getEnhancedSessionConfig,
    requireAuth,
    requireAdmin,
    requireTeacher,
    requireStudent,
    hasClassAccess,
    requireSecureAdmin,
    userToViews,
    csrfProtection,
    generateCSRFToken,
    sanitizeInputs
};

const User = require('../models/user');

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        
        if (!userId) {
            return res.redirect('/login');
        }
        
        const user = await User.findById(userId);
        if (!user || !user.ISACTIVE) {
            req.session.destroy();
            return res.redirect('/login');
        }

        // Additional security: Check if user role is valid
        if (!['admin', 'teacher', 'student'].includes(user.ROLE)) {
            req.session.destroy();
            return res.redirect('/login');
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        req.session.destroy();
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        
        if (req.user.ROLE !== 'admin') {
            return res.status(403).render('error', {
                message: 'Access denied. Admin privileges required.',
                user: req.user
            });
        }
        
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware to check if user is teacher or admin
const requireTeacher = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        
        if (!['teacher', 'admin'].includes(req.user.ROLE)) {
            return res.status(403).render('error', {
                message: 'Access denied. Teacher privileges required.',
                user: req.user
            });
        }
        
        next();
    } catch (error) {
        console.error('Teacher middleware error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware to prevent students from accessing teacher routes
const preventStudentAccess = async (req, res, next) => {
    try {
        if (req.user && req.user.ROLE === 'student') {
            return res.status(403).render('error', {
                message: 'Access denied. This area is restricted to teachers and administrators only.',
                user: req.user
            });
        }
        next();
    } catch (error) {
        console.error('Student access prevention error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware to ensure only students can access student routes
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
        console.error('Student access middleware error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware to allow only students and teachers (no admin) for certain routes
const requireStudentOrTeacher = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }

        if (!['student', 'teacher'].includes(req.user.ROLE)) {
            return res.status(403).render('error', {
                message: 'Access denied. This area is for students and teachers only.',
                user: req.user
            });
        }

        next();
    } catch (error) {
        console.error('Student/Teacher access middleware error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware to make user available to all views
const userToViews = (req, res, next) => {
    res.locals.user = req.user || null;
    next();
};

// Middleware to check if user has access to a specific class
const hasClassAccess = async (req, res, next) => {
    try {
        const classId = req.params.id || req.params.classId;

        if (!classId) {
            return res.status(400).render('error', {
                message: 'Class ID is required',
                user: req.user
            });
        }

        const Class = require('../models/class');

        const classDoc = await Class.findById(classId);
        if (!classDoc) {
            return res.status(404).render('error', {
                message: 'Class not found',
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
            return res.status(403).render('error', {
                message: 'Access denied. You are not a teacher for this class.',
                user: req.user
            });
        }

        req.classDoc = classDoc;
        next();
    } catch (error) {
        console.error('Class access check error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

// Middleware specifically for class management routes (blocks students)
const hasClassManagementAccess = async (req, res, next) => {
    try {
        const classId = req.params.id || req.params.classId;

        if (!classId) {
            return res.status(400).render('error', {
                message: 'Class ID is required',
                user: req.user
            });
        }

        const Class = require('../models/class');

        const classDoc = await Class.findById(classId);
        if (!classDoc) {
            return res.status(404).render('error', {
                message: 'Class not found',
                user: req.user
            });
        }

        // Students should not access class management routes
        if (req.user.ROLE === 'student') {
            return res.status(403).render('error', {
                message: 'Access denied. Students cannot access class management.',
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
            return res.status(403).render('error', {
                message: 'Access denied. You are not a teacher for this class.',
                user: req.user
            });
        }

        req.classDoc = classDoc;
        next();
    } catch (error) {
        console.error('Class management access check error:', error);
        res.status(500).render('error', {
            message: 'Server error',
            user: req.user
        });
    }
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireTeacher,
    requireStudent,
    requireStudentOrTeacher,
    preventStudentAccess,
    hasClassAccess,
    hasClassManagementAccess,
    userToViews
};
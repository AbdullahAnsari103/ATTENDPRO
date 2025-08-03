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

// Middleware to make user available to all views
const userToViews = (req, res, next) => {
    res.locals.user = req.user || null;
    next();
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireTeacher,
    userToViews
}; 
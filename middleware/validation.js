const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));
        
        console.warn('🚨 Validation errors:', errorMessages);
        
        // For API requests, return JSON
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errorMessages
            });
        }
        
        // For form submissions, redirect with error message
        const firstError = errorMessages[0];
        return res.status(400).render('error', {
            message: `Validation Error: ${firstError.message}`,
            user: req.user || null
        });
    }
    next();
};

// User validation rules
const validateRegistration = [
    body('USERNAME')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage('Username can only contain letters, numbers, dots, hyphens, and underscores'),
    
    body('EMAIL')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
        .isLength({ max: 100 })
        .withMessage('Email must not exceed 100 characters'),
    
    body('PASSWORD')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    body('CONFIRMPASSWORD')
        .custom((value, { req }) => {
            if (value !== req.body.PASSWORD) {
                throw new Error('Password confirmation does not match password');
            }
            return true;
        }),
    
    body('FULLNAME')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s.'-]+$/)
        .withMessage('Full name can only contain letters, spaces, periods, apostrophes, and hyphens'),
    
    body('ROLE')
        .optional()
        .isIn(['teacher', 'student'])
        .withMessage('Role must be either teacher or student'),
    
    handleValidationErrors
];

const validateLogin = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username or email is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Username/email must be between 3 and 100 characters'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 1, max: 128 })
        .withMessage('Password is invalid'),
    
    handleValidationErrors
];

// Class validation rules
const validateClass = [
    body('CLASSNAME')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Class name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s.-]+$/)
        .withMessage('Class name can only contain letters, numbers, spaces, periods, and hyphens'),
    
    body('ROOMNO')
        .isInt({ min: 1, max: 9999 })
        .withMessage('Room number must be a valid number between 1 and 9999'),
    
    body('SUBJECT')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Subject must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s.-]+$/)
        .withMessage('Subject can only contain letters, numbers, spaces, periods, and hyphens'),
    
    body('DESCRIPTION')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    
    handleValidationErrors
];

// Student validation rules
const validateStudent = [
    body('NAME')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Student name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s.'-]+$/)
        .withMessage('Student name can only contain letters, spaces, periods, apostrophes, and hyphens'),
    
    body('ROLLNO')
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage('Roll number must be between 1 and 20 characters')
        .matches(/^[a-zA-Z0-9-]+$/)
        .withMessage('Roll number can only contain letters, numbers, and hyphens'),
    
    body('EMAIL')
        .optional()
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    handleValidationErrors
];

// Attendance validation rules
const validateAttendance = [
    body('date')
        .isISO8601()
        .toDate()
        .withMessage('Please provide a valid date'),
    
    body('lectures')
        .isInt({ min: 1, max: 10 })
        .withMessage('Number of lectures must be between 1 and 10'),
    
    handleValidationErrors
];

// ObjectId validation
const validateObjectId = (paramName) => [
    param(paramName)
        .custom((value) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error('Invalid ID format');
            }
            return true;
        }),
    handleValidationErrors
];

// Roll number validation for student portal
const validateRollNumber = [
    body('rollno')
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage('Roll number must be between 1 and 20 characters')
        .matches(/^[a-zA-Z0-9-]+$/)
        .withMessage('Roll number can only contain letters, numbers, and hyphens'),
    
    handleValidationErrors
];

// Class code validation
const validateClassCode = [
    body('classCode')
        .trim()
        .isLength({ min: 6, max: 8 })
        .withMessage('Class code must be between 6 and 8 characters')
        .matches(/^[A-Z0-9]+$/)
        .withMessage('Class code can only contain uppercase letters and numbers'),
    
    handleValidationErrors
];

// Bulk student validation
const validateBulkStudents = [
    body('students')
        .isArray({ min: 1, max: 100 })
        .withMessage('Students must be an array with 1-100 entries'),
    
    body('students.*.NAME')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Each student name must be between 2 and 100 characters'),
    
    body('students.*.ROLLNO')
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage('Each roll number must be between 1 and 20 characters'),
    
    handleValidationErrors
];

// Date range validation
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601()
        .toDate()
        .withMessage('Start date must be a valid date'),
    
    query('endDate')
        .optional()
        .isISO8601()
        .toDate()
        .withMessage('End date must be a valid date')
        .custom((value, { req }) => {
            if (req.query.startDate && value < req.query.startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    handleValidationErrors
];

// File upload validation (for future file uploads)
const validateFileUpload = (fieldName, allowedMimeTypes = [], maxSize = 5 * 1024 * 1024) => [
    body(fieldName)
        .optional()
        .custom((value, { req }) => {
            if (req.file) {
                // Check file size
                if (req.file.size > maxSize) {
                    throw new Error(`File size must not exceed ${Math.round(maxSize / (1024 * 1024))}MB`);
                }
                
                // Check file type
                if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(req.file.mimetype)) {
                    throw new Error(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`);
                }
            }
            return true;
        }),
    
    handleValidationErrors
];

// Sanitize HTML to prevent XSS
const sanitizeHtml = (value) => {
    if (typeof value === 'string') {
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }
    return value;
};

// Custom sanitization middleware
const sanitizeBody = (req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeHtml(req.body[key].trim());
            }
        });
    }
    next();
};

module.exports = {
    handleValidationErrors,
    validateRegistration,
    validateLogin,
    validateClass,
    validateStudent,
    validateAttendance,
    validateObjectId,
    validateRollNumber,
    validateClassCode,
    validateBulkStudents,
    validateDateRange,
    validateFileUpload,
    sanitizeBody,
    sanitizeHtml
};
